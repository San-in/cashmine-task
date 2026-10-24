import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { fetchClaimOptions, type ClaimStatus } from '@/api/claims';
import { describeError, isApiError } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, ErrorState, LoadingState } from '@/components/ui';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { claimQueryOptions, useTrackedClaimsPolling } from '@/features/claims/use-claims';
import { useToken } from '@/features/token/token-context';
import { formatTime } from '@/lib/time';

const STATUS_TEXT: Record<ClaimStatus, { label: string; color: ThemeColor }> = {
  pending: { label: 'Pending', color: 'warning' },
  completed: { label: 'Completed', color: 'success' },
  failed: { label: 'Failed', color: 'danger' },
};

export function ClaimStatusScreen({ id }: { id: string }) {
  const token = useToken();
  const router = useRouter();
  useTrackedClaimsPolling();
  const query = useQuery(claimQueryOptions(token, id));
  const asset = query.data?.asset;
  const optionsQuery = useQuery({
    queryKey: ['claim-options', asset],
    queryFn: ({ signal }) => fetchClaimOptions(token, asset ?? '', signal),
    enabled: asset !== undefined,
  });
  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (query.isPending) return <LoadingState message="Loading claim…" />;
  if (query.isError && !query.data) {
    const notFound = isApiError(query.error) && query.error.code === 'NOT_FOUND';
    return (
      <ErrorState
        title={notFound ? 'Claim not found' : "Couldn’t load the claim"}
        message={notFound ? 'This claim does not exist for your token.' : describeError(query.error)}
        actionTitle={notFound ? 'Back to balances' : 'Try again'}
        onAction={notFound ? goHome : () => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  const claim = query.data;
  const status = STATUS_TEXT[claim.status];
  const destination = optionsQuery.data?.destinations.find((d) => d.id === claim.destinationId)?.label ?? claim.destinationId;

  return (
    <>
      <Card>
        <View style={styles.statusRow}>
          {claim.status === 'pending' ? <ActivityIndicator /> : null}
          <ThemedText type="subtitle" themeColor={status.color}>
            {status.label}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {claim.status === 'pending'
            ? 'Your claim is being processed. This usually takes about 20 seconds; this page updates by itself.'
            : claim.status === 'completed'
              ? `${claim.receiveAmount} ${claim.asset} was sent to ${destination}.`
              : 'The claim did not go through. The full amount is back in your available balance.'}
        </ThemedText>
      </Card>

      {claim.status === 'failed' && claim.failureReason ? (
        <Banner tone="danger">
          <ThemedText type="small">Reason: {claim.failureReason}</ThemedText>
        </Banner>
      ) : null}

      {query.isRefetchError ? (
        <Banner tone="warning">
          <ThemedText type="small">Couldn’t refresh the status: {describeError(query.error)} Still trying.</ThemedText>
        </Banner>
      ) : null}

      <Card>
        <Row label="Amount" value={`${claim.amount} ${claim.asset}`} />
        <Row label="Fee" value={`− ${claim.fee} ${claim.asset}`} />
        <Row label="You receive" value={`${claim.receiveAmount} ${claim.asset}`} strong />
        <Row label="To" value={destination} />
        <Row label="Created" value={formatTime(claim.createdAt)} />
        <Row label="Claim ID" value={claim.id} />
      </Card>

      <Button title="Back to balances" variant="secondary" onPress={goHome} />
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
});
