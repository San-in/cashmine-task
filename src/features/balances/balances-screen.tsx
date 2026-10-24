import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';

import type { AssetBalance } from '@/api/balances';
import { describeError, isApiError } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { assetTotal, balanceTotals } from '@/features/balances/totals';
import { useBalances } from '@/features/balances/use-balances';
import { maskToken, useToken } from '@/features/token/token-context';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatAmountForDisplay, formatUsd, usdValue } from '@/lib/amount';
import { formatAge, formatTime } from '@/lib/time';

// Snapshots refresh every 15s; older than this means our polling is failing.
const STALE_AFTER_MS = 60_000;

export function BalancesScreen() {
  const token = useToken();
  const router = useRouter();
  const query = useBalances();
  const [pulling, setPulling] = useState(false);

  const refresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <Link href="/token" style={styles.headerLink}>
            <ThemedText type="small" themeColor="tint">
              Token {maskToken(token)}
            </ThemedText>
          </Link>
        ),
      }}
    />
  );

  if (query.isPending) {
    return (
      <Screen>
        {header}
        <LoadingState
          message="Loading balances…"
          hint={query.failureCount > 0 ? 'Having trouble reaching the server, retrying…' : undefined}
        />
      </Screen>
    );
  }

  if (query.isError && !query.data) {
    const unauthorized = isApiError(query.error) && query.error.code === 'UNAUTHORIZED';
    return (
      <Screen>
        {header}
        <ErrorState
          title="Couldn't load balances"
          message={describeError(query.error)}
          actionTitle={unauthorized ? 'Change token' : 'Try again'}
          onAction={() => (unauthorized ? router.push('/token') : void query.refetch())}
          retrying={query.isFetching}
        />
      </Screen>
    );
  }

  const { asOf, items } = query.data;
  const totals = balanceTotals(items);

  return (
    <Screen refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}>
      {header}
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Total payback
        </ThemedText>
        <ThemedText style={styles.total}>{formatUsd(totals.totalUsd)}</ThemedText>
        <ThemedText type="small">Available to claim {formatUsd(totals.availableUsd)}</ThemedText>
        <Freshness asOf={asOf} checkedAt={query.dataUpdatedAt} fetching={query.isFetching} onRefresh={refresh} />
      </Card>

      {query.isRefetchError ? (
        <Banner tone="warning">
          <ThemedText type="small">
            Couldn't refresh: {describeError(query.error)} Showing balances from {formatTime(asOf)}.
          </ThemedText>
        </Banner>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="No payback yet" message="Payback from your exchange trades will show up here." />
      ) : (
        items.map((item) => <AssetCard key={item.asset} item={item} />)
      )}
    </Screen>
  );
}

type FreshnessProps = {
  /** When the server computed the snapshot: the real age of the numbers. */
  asOf: string;
  /** When we last fetched successfully. A refresh within the same 15s snapshot keeps asOf unchanged. */
  checkedAt: number;
  fetching: boolean;
  onRefresh: () => void;
};

function Freshness({ asOf, checkedAt, fetching, onRefresh }: FreshnessProps) {
  const now = useNow();
  const age = now - new Date(asOf).getTime();
  const stale = age > STALE_AFTER_MS;
  return (
    <View style={styles.freshness}>
      <View style={styles.freshnessText}>
        <ThemedText type="small" themeColor={stale ? 'warning' : 'textSecondary'}>
          Updated {formatAge(age)} · {formatTime(asOf)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Checked {formatAge(now - checkedAt)}
        </ThemedText>
        {stale ? (
          <ThemedText type="small" themeColor="warning">
            Balances may be out of date.
          </ThemedText>
        ) : null}
      </View>
      {fetching ? <ActivityIndicator /> : <Button title="Refresh" variant="secondary" onPress={onRefresh} />}
    </View>
  );
}

function AssetCard({ item }: { item: AssetBalance }) {
  const theme = useTheme();
  const fmt = (units: bigint) => `${formatAmountForDisplay(units, item.decimals)} ${item.asset}`;
  return (
    <Card>
      <View style={styles.row}>
        <ThemedText type="smallBold">{item.asset}</ThemedText>
        <ThemedText type="smallBold">{formatUsd(usdValue(assetTotal(item), item.decimals, item.usdPrice))}</ThemedText>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <BalanceRow label="Available" value={fmt(item.available)} emphasis />
      <BalanceRow label="Pending" value={fmt(item.pending)} hint="Accrued, waiting for the exchange to confirm" />
      {item.claiming > 0n ? (
        <BalanceRow label="Claiming" value={fmt(item.claiming)} hint="In claims that have not completed yet" />
      ) : null}
    </Card>
  );
}

function BalanceRow({ label, value, hint, emphasis }: { label: string; value: string; hint?: string; emphasis?: boolean }) {
  return (
    <View>
      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type={emphasis ? 'smallBold' : 'small'} style={styles.amount}>
          {value}
        </ThemedText>
      </View>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerLink: {
    paddingHorizontal: Spacing.three,
  },
  total: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  freshness: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  freshnessText: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  amount: {
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
