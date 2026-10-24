import { API_BASE_URL } from '@/config/api';

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_MISMATCH'
  | 'RATE_LIMITED'
  | 'SERVER'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'BAD_RESPONSE';

export type ApiError = Error & {
  name: 'ApiError';
  code: ApiErrorCode;
  status: number | null;
  field: string | null;
  retryAfterMs: number | null;
  /**
   * True when the server may or may not have done the work: 5xx, 504, timeout,
   * dropped connection. For POST /v1/claims this means "retry with the same key".
   */
  outcomeUnknown: boolean;
};

export function createApiError(fields: Omit<ApiError, 'name' | 'stack' | 'cause'>): ApiError {
  return Object.assign(new Error(fields.message), fields, { name: 'ApiError' as const });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && error.name === 'ApiError';
}

const REQUEST_TIMEOUT_MS = 15_000;

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'VALIDATION',
  401: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  409: 'IDEMPOTENCY_MISMATCH',
  429: 'RATE_LIMITED',
  504: 'TIMEOUT',
};

type ErrorBody = { error?: { code?: string; message?: string; field?: string; retryAfterMs?: number } };

type RequestOptions = {
  token: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type ApiResponse<T> = { data: T; status: number; headers: Headers };

export async function apiRequest<T>(path: string, options: RequestOptions): Promise<ApiResponse<T>> {
  const { token, method = 'GET', body, headers, signal } = options;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    // Cancelled by the caller (e.g. TanStack Query): not a failure, rethrow as is.
    if (signal?.aborted) throw error;
    throw createApiError({
      code: timedOut ? 'TIMEOUT' : 'NETWORK',
      message: timedOut ? 'The server took too long to respond' : 'Could not reach the server',
      status: null,
      field: null,
      retryAfterMs: null,
      outcomeUnknown: true,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }

  const text = await response.text().catch(() => '');
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const err = (json as ErrorBody | null)?.error;
    const retryAfterHeader = Number(response.headers.get('Retry-After'));
    const retryAfterMs =
      typeof err?.retryAfterMs === 'number'
        ? err.retryAfterMs
        : Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : null;
    throw createApiError({
      code: CODE_BY_STATUS[response.status] ?? (response.status >= 500 ? 'SERVER' : 'BAD_RESPONSE'),
      message: err?.message ?? `Request failed with status ${response.status}`,
      status: response.status,
      field: err?.field ?? null,
      retryAfterMs,
      outcomeUnknown: response.status >= 500,
    });
  }

  if (json === null) {
    throw createApiError({
      code: 'BAD_RESPONSE',
      message: 'The server sent an unreadable response',
      status: response.status,
      field: null,
      retryAfterMs: null,
      outcomeUnknown: true,
    });
  }

  return { data: json as T, status: response.status, headers: response.headers };
}

/** Errors worth retrying automatically for reads. */
export function isRetryable(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return ['RATE_LIMITED', 'SERVER', 'TIMEOUT', 'NETWORK'].includes(error.code);
}

export function retryDelayFor(error: unknown, attempt: number): number {
  if (isApiError(error) && error.retryAfterMs !== null) return error.retryAfterMs;
  return Math.min(1000 * 2 ** attempt, 8000);
}

/** Short user-facing text for an error. */
export function describeError(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Please try again.';
  switch (error.code) {
    case 'UNAUTHORIZED':
      return 'Your token was rejected. It may be wrong or expired.';
    case 'RATE_LIMITED':
      return 'Too many requests. Please wait a moment.';
    case 'NETWORK':
      return 'Could not reach the server. Check your connection.';
    case 'TIMEOUT':
      return 'The server took too long to respond.';
    case 'SERVER':
      return 'The server had a temporary problem.';
    default:
      return error.message;
  }
}
