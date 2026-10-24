import { apiRequest } from '@/api/client';

export type ActivityType = 'accrual' | 'reversal' | 'claim';

export type ActivityItem = {
  id: string;
  type: ActivityType;
  asset: string;
  /** Signed decimal string: negative for reversals and claims. */
  amount: string;
  status: 'pending' | 'confirmed' | 'completed' | 'failed';
  exchange: string | null;
  createdAt: string;
  relatedId: string | null;
};

export type ActivityPage = { items: ActivityItem[]; nextCursor: string | null };

export const ACTIVITY_PAGE_SIZE = 20;

export async function fetchActivityPage(token: string, cursor: string | null, signal?: AbortSignal): Promise<ActivityPage> {
  const params = new URLSearchParams({ limit: String(ACTIVITY_PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  const { data } = await apiRequest<ActivityPage>(`/v1/activity?${params.toString()}`, { token, signal });
  return data;
}

/**
 * Flattens pages newest first, dropping repeats. The API's cursor can return the last
 * item of one page again as the first item of the next, which would show it twice.
 */
export function mergeActivityPages(pages: ActivityPage[]): ActivityItem[] {
  const seen = new Set<string>();
  const items: ActivityItem[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}
