import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { AssetBalance } from '@/api/balances';
import { fetchClaimOptions, type ClaimOptions } from '@/api/claims';
import { describeError, isApiError } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { balancesQueryKey } from '@/features/balances/use-balances';
import { claimIntentStore, type ClaimIntent } from '@/features/claims/claims-store';
import { confirmClaimIntent, submitClaimIntent } from '@/features/claims/submit-claim';
import { useAdjustedBalances } from '@/features/claims/use-claims';
import { useToken } from '@/features/token/token-context';
import { useTheme } from '@/hooks/use-theme';
import {
  formatAmountForDisplay,
  formatMinorUnits,
  parseAmountInput,
  receiveAmount,
  toMinorUnits,
  validateClaimAmount,
  type AmountInputError,
  type ClaimAmountError,
} from '@/lib/amount';

type Draft = { asset: string | null; amount: string; destinationId: string | null };

export function ClaimScreen() {
  const params = useLocalSearchParams<{ asset?: string }>();
  const intent = claimIntentStore.useValue();
  const [draft, setDraft] = useState<Draft>({ asset: params.asset ?? null, amount: '', destinationId: null });
  const [rejection, setRejection] = useState<unknown>(null);

  return (
    <Screen>
      {intent ? (
        <ClaimSubmission
          intent={intent}
          onRejected={(error) => {
            setDraft({ ...intent.body });
            setRejection(error);
          }}
        />
      ) : (
        <ClaimForm draft={draft} onChange={setDraft} rejection={rejection} clearRejection={() => setRejection(null)} />
      )}
    </Screen>
  );
}

type ClaimFormProps = {
  draft: Draft;
  onChange: (draft: Draft) => void;
  rejection: unknown;
  clearRejection: () => void;
};

function ClaimForm({ draft, onChange, rejection, clearRejection }: ClaimFormProps) {
  const { query, balances } = useAdjustedBalances();

  if (query.isPending) return <LoadingState message="Loading balances…" />;
  if (!balances) {
    return (
      <ErrorState
        title="Couldn't load balances"
        message={describeError(query.error)}
        actionTitle="Try again"
        onAction={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (balances.items.length === 0) {
    return <EmptyState title="Nothing to claim" message="You have no payback balances yet." />;
  }

  const selected =
    balances.items.find((i) => i.asset === draft.asset) ??
    balances.items.find((i) => i.available > 0n) ??
    balances.items[0];

  return (
    <>
      <AssetPicker
        assets={balances.items}
        selected={selected.asset}
        onSelect={(asset) => {
          clearRejection();
          onChange({ asset, amount: '', destinationId: null });
        }}
      />
      <ClaimDetails
        key={selected.asset}
        balance={selected}
        adjusted={balances.adjustedAssets.includes(selected.asset)}
        draft={draft}
        onChange={(next) => {
          clearRejection();
          onChange({ ...next, asset: selected.asset });
        }}
        rejection={rejection}
      />
    </>
  );
}

function AssetPicker({ assets, selected, onSelect }: { assets: AssetBalance[]; selected: string; onSelect: (asset: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {assets.map((item) => {
        const active = item.asset === selected;
        return (
          <Pressable
            key={item.asset}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(item.asset)}
            style={[
              styles.chip,
              { borderColor: active ? theme.tint : theme.border, backgroundColor: active ? theme.backgroundSelected : theme.backgroundElement },
            ]}>
            <ThemedText type="smallBold">{item.asset}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

type ParsedOptions = { minAmount: bigint; fee: bigint; raw: ClaimOptions };

function parseOptions(options: ClaimOptions, decimals: number): ParsedOptions | null {
  try {
    return { minAmount: toMinorUnits(options.minAmount, decimals), fee: toMinorUnits(options.fee, decimals), raw: options };
  } catch {
    return null;
  }
}

type ClaimDetailsProps = {
  balance: AssetBalance;
  adjusted: boolean;
  draft: Draft;
  onChange: (draft: Draft) => void;
  rejection: unknown;
};

function ClaimDetails({ balance, adjusted, draft, onChange, rejection }: ClaimDetailsProps) {
  const token = useToken();
  const theme = useTheme();
  const [reviewing, setReviewing] = useState(false);
  const optionsQuery = useQuery({
    queryKey: ['claim-options', balance.asset],
    queryFn: ({ signal }) => fetchClaimOptions(token, balance.asset, signal),
  });

  const { asset, decimals, available } = balance;
  const show = (units: bigint) => `${formatAmountForDisplay(units, decimals)} ${asset}`;

  if (optionsQuery.isPending) return <LoadingState message={`Loading ${asset} claim options…`} />;
  const options = optionsQuery.data ? parseOptions(optionsQuery.data, decimals) : null;
  if (!options) {
    return (
      <ErrorState
        title="Couldn't load claim options"
        message={optionsQuery.isError ? describeError(optionsQuery.error) : 'The server sent claim options we could not read.'}
        actionTitle="Try again"
        onAction={() => void optionsQuery.refetch()}
        retrying={optionsQuery.isFetching}
      />
    );
  }

  const destinations = options.raw.destinations;
  const destination = destinations.find((d) => d.id === draft.destinationId) ?? destinations[0];
  const rules = { minAmount: options.minAmount, available, fee: options.fee };
  const parsed = parseAmountInput(draft.amount, decimals);
  const amountError: AmountInputError | ClaimAmountError | null =
    draft.amount.trim() === '' ? null : parsed.ok ? validateClaimAmount(parsed.value, rules) : parsed.error;
  const valid = parsed.ok && amountError === null && destination !== undefined;
  const serverFieldError = isApiError(rejection) && rejection.field ? rejection : null;
  const canClaimAtAll = available >= options.minAmount && available > options.fee;

  if (reviewing && parsed.ok && valid && destination) {
    const body = { asset, amount: formatMinorUnits(parsed.value, decimals), destinationId: destination.id };
    return (
      <Card>
        <ThemedText type="smallBold">Review your claim</ThemedText>
        <Row label="You claim" value={show(parsed.value)} />
        <Row label="Fee" value={`− ${show(options.fee)}`} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Row label="You receive" value={show(receiveAmount(parsed.value, options.fee))} strong />
        <Row label="To" value={destination.label} />
        <ThemedText type="small" themeColor="textSecondary">
          The amount leaves your available balance right away and usually settles within 20 seconds.
        </ThemedText>
        <Button title="Confirm claim" onPress={() => confirmClaimIntent(body)} />
        <Button title="Edit" variant="secondary" onPress={() => setReviewing(false)} />
      </Card>
    );
  }

  return (
    <>
      {rejection && !serverFieldError ? (
        <Banner tone="danger">
          <ThemedText type="small">Your claim was not created: {describeError(rejection)}</ThemedText>
        </Banner>
      ) : null}

      <Card>
        <Row label="Available" value={show(available)} strong />
        {adjusted ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Already excludes your recent claim, which the balance snapshot does not show yet.
          </ThemedText>
        ) : null}
        <Row label="Minimum claim" value={show(options.minAmount)} />
        <Row label="Fee" value={show(options.fee)} />
      </Card>

      {!canClaimAtAll ? (
        <Banner tone="info">
          <ThemedText type="small">
            You need at least {show(options.minAmount > options.fee ? options.minAmount : options.fee)} available to
            claim {asset}.
          </ThemedText>
        </Banner>
      ) : (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Amount
          </ThemedText>
          <View style={styles.amountRow}>
            <TextInput
              value={draft.amount}
              onChangeText={(amount) => onChange({ ...draft, amount })}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              inputMode="decimal"
              keyboardType="decimal-pad"
              autoCorrect={false}
              accessibilityLabel={`Amount in ${asset}`}
              style={[styles.input, { color: theme.text, borderColor: amountError || serverFieldError ? theme.danger : theme.border, backgroundColor: theme.background }]}
            />
            <Button title="Max" variant="secondary" onPress={() => onChange({ ...draft, amount: formatMinorUnits(available, decimals) })} />
          </View>
          {amountError ? (
            <ThemedText type="small" themeColor="danger">
              {amountErrorText(amountError, { asset, decimals, show, ...rules })}
            </ThemedText>
          ) : serverFieldError ? (
            <ThemedText type="small" themeColor="danger">
              {serverFieldError.message}
            </ThemedText>
          ) : null}

          {destinations.length > 1 ? (
            <View style={styles.chips}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.fullWidth}>
                Send to
              </ThemedText>
              {destinations.map((d) => (
                <Button
                  key={d.id}
                  title={d.label}
                  variant={d.id === destination?.id ? 'primary' : 'secondary'}
                  onPress={() => onChange({ ...draft, destinationId: d.id })}
                />
              ))}
            </View>
          ) : destination ? (
            <Row label="To" value={destination.label} />
          ) : (
            <ThemedText type="small" themeColor="danger">
              No destination is available for {asset}.
            </ThemedText>
          )}

          {parsed.ok && valid ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Row label="Fee" value={`− ${show(options.fee)}`} />
              <Row label="You receive" value={show(receiveAmount(parsed.value, options.fee))} strong />
            </>
          ) : null}

          <Button title="Review" onPress={() => setReviewing(true)} disabled={!valid} />
        </Card>
      )}
    </>
  );
}

function amountErrorText(
  error: AmountInputError | ClaimAmountError,
  ctx: { asset: string; decimals: number; show: (u: bigint) => string; minAmount: bigint; available: bigint; fee: bigint },
): string {
  switch (error) {
    case 'empty':
    case 'zero':
      return 'Enter an amount greater than 0.';
    case 'format':
      return 'Use digits with an optional dot, for example 0.5.';
    case 'too_many_decimals':
      return `${ctx.asset} allows at most ${ctx.decimals} decimal places.`;
    case 'below_min':
      return `The minimum claim is ${ctx.show(ctx.minAmount)}.`;
    case 'above_available':
      return `You have ${ctx.show(ctx.available)} available.`;
    case 'not_above_fee':
      return `The amount must be greater than the fee of ${ctx.show(ctx.fee)}.`;
  }
}

function ClaimSubmission({ intent, onRejected }: { intent: ClaimIntent; onRejected: (error: unknown) => void }) {
  const token = useToken();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<'submitting' | 'unknown'>('submitting');
  const [attempt, setAttempt] = useState(1);
  const [lastError, setLastError] = useState<unknown>(null);

  const run = useCallback(async () => {
    setPhase('submitting');
    const outcome = await submitClaimIntent(token, setAttempt);
    if (outcome.kind === 'created') {
      void queryClient.invalidateQueries({ queryKey: balancesQueryKey });
      router.replace({ pathname: '/claim-status', params: { id: outcome.claim.id } });
    } else if (outcome.kind === 'rejected') {
      onRejected(outcome.error);
    } else {
      setLastError(outcome.error);
      setPhase('unknown');
    }
  }, [token, queryClient, router, onRejected]);

  // Runs on open, including after a reload with an unresolved claim.
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const what = `${intent.body.amount} ${intent.body.asset}`;

  if (phase === 'submitting') {
    return (
      <Card>
        <View style={styles.centerRow}>
          <ActivityIndicator />
          <ThemedText type="smallBold">Submitting your claim of {what}…</ThemedText>
        </View>
        {attempt > 1 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No clear answer from the server yet. Checking again with the same request (attempt {attempt} of 5). This
            can never create a second claim.
          </ThemedText>
        ) : null}
      </Card>
    );
  }

  return (
    <>
      <Banner tone="warning">
        <ThemedText type="smallBold">We could not confirm your claim of {what}</ThemedText>
        <ThemedText type="small">
          The server did not answer ({describeError(lastError)}), so we do not know yet whether the claim went through.
          Please do not start a new claim. Checking again sends the same request, which can never create a second
          claim.
        </ThemedText>
      </Banner>
      <Button title="Check again" onPress={() => void run()} />
      <Button title="Back to balances" variant="secondary" onPress={() => router.replace('/')} />
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type={strong ? 'smallBold' : 'small'} style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  amountRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  fullWidth: {
    width: '100%',
  },
  note: {
    fontSize: 12,
    lineHeight: 16,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
