import { describe, expect, it } from 'vitest';

import type { AssetBalance } from '@/api/balances';
import { formatUsd } from '@/lib/amount';
import { balanceTotals } from './totals';

const usdt: AssetBalance = {
  asset: 'USDT',
  decimals: 6,
  available: 820413207n, // 820.413207
  pending: 50120000n, // 50.12
  claiming: 0n,
  usdPrice: '1.0002',
};

const eth: AssetBalance = {
  asset: 'ETH',
  decimals: 18,
  available: 500000000000000000n, // 0.5
  pending: 0n,
  claiming: 100000000000000000n, // 0.1
  usdPrice: '2500.5',
};

describe('balanceTotals', () => {
  it('sums every bucket across assets in USD', () => {
    const totals = balanceTotals([usdt, eth]);
    // USDT: (820.413207 + 50.12) * 1.0002 = 870.7073136414; ETH: 0.6 * 2500.5 = 1500.3
    expect(formatUsd(totals.totalUsd)).toBe('$2,371.01');
    // USDT: 820.5772896414; ETH: 0.5 * 2500.5 = 1250.25
    expect(formatUsd(totals.availableUsd)).toBe('$2,070.83');
  });

  it('is zero for no assets', () => {
    expect(balanceTotals([])).toEqual({ totalUsd: 0n, availableUsd: 0n });
  });
});
