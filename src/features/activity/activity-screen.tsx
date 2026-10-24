import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { fetchActivityPage, mergeActivityPages, type ActivityItem } from '@/api/activity';
import { describeError } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useToken } from '@/features/token/token-context';
import { useTheme } from '@/hooks/use-theme';

export function ActivityScreen() {
  const token = useToken();
  const router = useRouter();
  const [pulling, setPulling] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ['activity'],
    queryFn: ({ pageParam, signal }) => fetchActivityPage(token, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const refresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  if (query.isPending) {
    return (
      <Screen>
        <LoadingState message="Loading activity…" />
      </Screen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <Screen>
        <ErrorState
          title="Couldn’t load activity"
          message={describeError(query.error)}
          actionTitle="Try again"
          onAction={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </Screen>
    );
  }

  const items = mergeActivityPages(query.data.pages);

  return (
    <Screen refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}>
      {query.isRefetchError ? (
        <Banner tone="warning">
          <ThemedText type="small">Couldn’t refresh: {describeError(query.error)}</ThemedText>
        </Banner>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="No activity yet" message="Payback, reversals and claims will show up here." />
      ) : (
        <Card>
          {items.map((item, index) => (
            <ActivityRow
              key={item.id}
              item={item}
              first={index === 0}
              onOpenClaim={
                item.type === 'claim' && item.relatedId
                  ? () => router.push({ pathname: '/claim-status', params: { id: item.relatedId ?? '' } })
                  : undefined
              }
            />
          ))}
        </Card>
      )}

      {query.isFetchNextPageError ? (
        <Banner tone="danger">
          <ThemedText type="small">Couldn’t load more: {describeError(query.error)}</ThemedText>
          <Button title="Try again" variant="secondary" onPress={() => void query.fetchNextPage()} />
        </Banner>
      ) : query.hasNextPage ? (
        <Button
          title="Load more"
          variant="secondary"
          onPress={() => void query.fetchNextPage()}
          loading={query.isFetchingNextPage}
        />
      ) : items.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.end}>
          That’s everything.
        </ThemedText>
      ) : null}
    </Screen>
  );
}

const STATUS_COLOR: Record<ActivityItem['status'], ThemeColor> = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'success',
  failed: 'danger',
};

function title(item: ActivityItem): string {
  switch (item.type) {
    case 'accrual':
      return item.exchange ? `Payback from ${item.exchange}` : 'Payback';
    case 'reversal':
      return item.exchange ? `Reversed by ${item.exchange}` : 'Reversal';
    case 'claim':
      return 'Claim';
  }
}

function ActivityRow({ item, first, onOpenClaim }: { item: ActivityItem; first: boolean; onOpenClaim?: () => void }) {
  const theme = useTheme();
  const negative = item.amount.startsWith('-');
  // The API sends signed decimal strings; we only add the "+" and never parse to a float.
  const amount = `${negative ? '' : '+'}${item.amount} ${item.asset}`;
  const content = (
    <View style={[styles.row, !first && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.main}>
        <ThemedText type="small">{title(item)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
          {new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          {onOpenClaim ? ' · details' : ''}
        </ThemedText>
      </View>
      <View style={styles.side}>
        <ThemedText type="smallBold" themeColor={negative ? 'text' : 'success'} style={styles.amount}>
          {amount}
        </ThemedText>
        <ThemedText type="small" themeColor={STATUS_COLOR[item.status]} style={styles.meta}>
          {item.status}
        </ThemedText>
      </View>
    </View>
  );
  return onOpenClaim ? (
    <Pressable accessibilityRole="button" onPress={onOpenClaim}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  main: {
    flex: 1,
  },
  side: {
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  amount: {
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
  },
  end: {
    textAlign: 'center',
  },
});
