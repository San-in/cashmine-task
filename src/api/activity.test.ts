import { describe, expect, it } from 'vitest';

import { mergeActivityPages, type ActivityItem } from './activity';

const item = (id: string): ActivityItem => ({
  id,
  type: 'accrual',
  asset: 'USDT',
  amount: '1',
  status: 'confirmed',
  exchange: 'Binance',
  createdAt: '2026-10-03T10:29:10.336Z',
  relatedId: null,
});

describe('mergeActivityPages', () => {
  it('keeps order and drops an item repeated across a page boundary', () => {
    const pages = [
      { items: [item('a'), item('b')], nextCursor: 'c1' },
      { items: [item('b'), item('c')], nextCursor: null },
    ];
    expect(mergeActivityPages(pages).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('handles no pages', () => {
    expect(mergeActivityPages([])).toEqual([]);
  });
});
