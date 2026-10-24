import { apiRequest } from '@/api/client';

export type Destination = { id: string; label: string };

export type ClaimOptions = {
  asset: string;
  minAmount: string;
  fee: string;
  destinations: Destination[];
};

export type ClaimStatus = 'pending' | 'completed' | 'failed';

export type Claim = {
  id: string;
  asset: string;
  amount: string;
  fee: string;
  receiveAmount: string;
  destinationId: string;
  status: ClaimStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateClaimBody = { asset: string; amount: string; destinationId: string };

export async function fetchClaimOptions(token: string, asset: string, signal?: AbortSignal): Promise<ClaimOptions> {
  const { data } = await apiRequest<ClaimOptions>(`/v1/claim-options?asset=${encodeURIComponent(asset)}`, {
    token,
    signal,
  });
  return data;
}

/**
 * Same key + same body is safe to repeat: the server returns the original claim
 * (200, Idempotent-Replayed: true) and never creates a second one.
 */
export async function createClaim(
  token: string,
  idempotencyKey: string,
  body: CreateClaimBody,
): Promise<{ claim: Claim; replayed: boolean }> {
  const { data, headers } = await apiRequest<Claim>('/v1/claims', {
    token,
    method: 'POST',
    body,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return { claim: data, replayed: headers.get('Idempotent-Replayed') === 'true' };
}

export async function fetchClaim(token: string, id: string, signal?: AbortSignal): Promise<Claim> {
  const { data } = await apiRequest<Claim>(`/v1/claims/${encodeURIComponent(id)}`, { token, signal });
  return data;
}
