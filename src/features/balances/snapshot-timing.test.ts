import { describe, expect, it } from 'vitest';

import { nextRefetchDelay } from './snapshot-timing';

const asOf = '2026-10-24T10:00:00.000Z';
const at = (secondsAfterAsOf: number) => Date.parse(asOf) + secondsAfterAsOf * 1000;

describe('nextRefetchDelay', () => {
  it('refetches just after the next snapshot', () => {
    expect(nextRefetchDelay(asOf, at(5))).toBe(11_000); // 15s cycle + 1s grace - 5s age
  });

  it('never polls faster than every 5s when the snapshot is late', () => {
    expect(nextRefetchDelay(asOf, at(20))).toBe(5_000);
  });

  it('never waits longer than 15s when the device clock is behind', () => {
    expect(nextRefetchDelay(asOf, at(-30))).toBe(15_000);
  });

  it('falls back to 15s without a usable snapshot time', () => {
    expect(nextRefetchDelay(undefined, at(0))).toBe(15_000);
    expect(nextRefetchDelay('not a date', at(0))).toBe(15_000);
  });
});
