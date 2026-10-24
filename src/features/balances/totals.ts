import type { AssetBalance } from '@/api/balances';
import { usdValue } from '@/lib/amount';

export type BalanceTotals = {
  /** available + pending + claiming, at USD_SCALE */
  totalUsd: bigint;
  /** what can be claimed right now, at USD_SCALE */
  availableUsd: bigint;
};

export function assetTotal(item: AssetBalance): bigint {
  return item.available + item.pending + item.claiming;
}

export function balanceTotals(items: AssetBalance[]): BalanceTotals {
  let totalUsd = 0n;
  let availableUsd = 0n;
  for (const item of items) {
    totalUsd += usdValue(assetTotal(item), item.decimals, item.usdPrice);
    availableUsd += usdValue(item.available, item.decimals, item.usdPrice);
  }
  return { totalUsd, availableUsd };
}
