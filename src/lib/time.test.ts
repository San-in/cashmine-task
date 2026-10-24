import { describe, expect, it } from 'vitest';

import { formatAge } from './time';

describe('formatAge', () => {
  it('counts every second', () => {
    expect(formatAge(0)).toBe('just now');
    expect(formatAge(1_000)).toBe('1s ago');
    expect(formatAge(14_999)).toBe('14s ago');
  });

  it('switches to minutes and hours', () => {
    expect(formatAge(60_000)).toBe('1 min ago');
    expect(formatAge(2 * 3_600_000)).toBe('2 h ago');
  });

  it('treats a future snapshot (device clock behind) as now', () => {
    expect(formatAge(-5_000)).toBe('just now');
  });
});
