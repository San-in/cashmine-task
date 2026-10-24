import { apiRequest, createApiError } from '@/api/client';
import { toMinorUnits } from '@/lib/amount';

type BalanceItemDto = {
  asset: string;
  decimals: number;
  available: string;
  pending: string;
  claiming: string;
  usdPrice: string;
};

type BalancesDto = { asOf: string; items: BalanceItemDto[] };

export type AssetBalance = {
  asset: string;
  decimals: number;
  available: bigint;
  pending: bigint;
  claiming: bigint;
  usdPrice: string;
};

export type Balances = { asOf: string; items: AssetBalance[] };

export async function fetchBalances(token: string, signal?: AbortSignal): Promise<Balances> {
  const { data } = await apiRequest<BalancesDto>('/v1/balances', { token, signal });
  try {
    return {
      asOf: data.asOf,
      items: data.items.map((item) => ({
        asset: item.asset,
        decimals: item.decimals,
        available: toMinorUnits(item.available, item.decimals),
        pending: toMinorUnits(item.pending, item.decimals),
        claiming: toMinorUnits(item.claiming, item.decimals),
        usdPrice: item.usdPrice,
      })),
    };
  } catch (error) {
    // Refuse to show money we could not parse exactly.
    throw createApiError({
      code: 'BAD_RESPONSE',
      message: error instanceof Error ? error.message : 'Unexpected balances format',
      status: null,
      field: null,
      retryAfterMs: null,
      outcomeUnknown: false,
    });
  }
}
