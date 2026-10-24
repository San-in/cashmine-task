import { describe, expect, it } from 'vitest';

import type { Balances } from '@/api/balances';

import { applyUnsnapshottedClaims, pruneTrackedClaims, type TrackedClaim } from './claim-adjustments';

const snapshot = (asOf: string): Balances => ({
  asOf,
  items: [
    { asset: 'ETH', decimals: 18, available: 500000000000000000n, pending: 0n, claiming: 0n, usdPrice: '2500' },
    { asset: 'BTC', decimals: 8, available: 1000000n, pending: 0n, claiming: 0n, usdPrice: '60000' },
  ],
});

const claim = (createdAt: string, status: TrackedClaim['status'] = 'pending'): TrackedClaim => ({
  id: 'clm_1',
  asset: 'ETH',
  amount: '0.2',
  createdAt,
  status,
  failureReason: null,
  settledAt: status === 'pending' ? null : createdAt,
});

const eth = (b: Balances) => b.items.find((i) => i.asset === 'ETH')!;

describe('applyUnsnapshottedClaims', () => {
  it('moves a new pending claim from available to claiming before the snapshot catches up', () => {
    const result = applyUnsnapshottedClaims(snapshot('2026-10-24T10:00:00Z'), [claim('2026-10-24T10:00:05Z')]);
    expect(eth(result).available).toBe(300000000000000000n);
    expect(eth(result).claiming).toBe(200000000000000000n);
    expect(result.adjustedAssets).toEqual(['ETH']);
  });

  it('does nothing once the snapshot includes the claim, so numbers do not jump', () => {
    const result = applyUnsnapshottedClaims(snapshot('2026-10-24T10:00:15Z'), [claim('2026-10-24T10:00:05Z')]);
    expect(eth(result).available).toBe(500000000000000000n);
    expect(result.adjustedAssets).toEqual([]);
  });

  it('removes a completed claim from available without counting it as claiming', () => {
    const result = applyUnsnapshottedClaims(snapshot('2026-10-24T10:00:00Z'), [
      claim('2026-10-24T10:00:05Z', 'completed'),
    ]);
    expect(eth(result).available).toBe(300000000000000000n);
    expect(eth(result).claiming).toBe(0n);
  });

  it('ignores failed claims: their amount is back in available', () => {
    const result = applyUnsnapshottedClaims(snapshot('2026-10-24T10:00:00Z'), [claim('2026-10-24T10:00:05Z', 'failed')]);
    expect(eth(result).available).toBe(500000000000000000n);
  });

  it('only touches the claimed asset and never goes negative', () => {
    const big = { ...claim('2026-10-24T10:00:05Z'), amount: '9' };
    const result = applyUnsnapshottedClaims(snapshot('2026-10-24T10:00:00Z'), [big]);
    expect(eth(result).available).toBe(0n);
    expect(result.items.find((i) => i.asset === 'BTC')!.available).toBe(1000000n);
  });
});

describe('pruneTrackedClaims', () => {
  const now = Date.parse('2026-10-24T10:01:00Z');

  it('keeps pending claims and claims the snapshot has not seen yet', () => {
    const pending = claim('2026-10-24T10:00:05Z');
    const settledUnseen = { ...claim('2026-10-24T10:00:20Z', 'completed'), id: 'clm_2' };
    const settledSeen = { ...claim('2026-10-24T10:00:05Z', 'failed'), id: 'clm_3' };
    const later = Date.parse('2026-10-24T10:05:00Z'); // settledSeen settled more than 2 min ago
    expect(pruneTrackedClaims([pending, settledUnseen, settledSeen], '2026-10-24T10:00:15Z', later)).toEqual([
      pending,
      settledUnseen,
    ]);
  });

  it('keeps a settled claim visible for two minutes after it settled', () => {
    const justFailed = { ...claim('2026-10-24T10:00:05Z', 'failed'), settledAt: '2026-10-24T10:00:30Z' };
    expect(pruneTrackedClaims([justFailed], '2026-10-24T10:00:45Z', now)).toEqual([justFailed]);
    expect(pruneTrackedClaims([justFailed], '2026-10-24T10:00:45Z', Date.parse('2026-10-24T10:03:00Z'))).toEqual([]);
  });

  it('drops claims older than a day', () => {
    expect(pruneTrackedClaims([claim('2026-10-23T09:00:00Z')], '2026-10-23T08:00:00Z', now)).toEqual([]);
  });
});
