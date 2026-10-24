import { describe, expect, it } from 'vitest';

import {
  formatAmountForDisplay,
  formatMinorUnits,
  formatUsd,
  parseAmountInput,
  receiveAmount,
  toMinorUnits,
  usdValue,
  validateClaimAmount,
} from './amount';

describe('parseAmountInput', () => {
  it('parses valid amounts into minor units', () => {
    expect(parseAmountInput('0.5', 18)).toEqual({ ok: true, value: 500000000000000000n });
    expect(parseAmountInput('12', 6)).toEqual({ ok: true, value: 12000000n });
    expect(parseAmountInput('0.00000001', 8)).toEqual({ ok: true, value: 1n });
    expect(parseAmountInput('820.413207', 6)).toEqual({ ok: true, value: 820413207n });
  });

  it('accepts a comma and surrounding spaces', () => {
    expect(parseAmountInput(' 0,5 ', 2)).toEqual({ ok: true, value: 50n });
  });

  it('rejects formats the API rejects', () => {
    for (const bad of ['.5', '1.', '05', '1e-3', '-1', '1.2.3', 'abc', '1 000', '+1', '0x10']) {
      expect(parseAmountInput(bad, 8)).toEqual({ ok: false, error: 'format' });
    }
  });

  it('rejects empty input', () => {
    expect(parseAmountInput('   ', 8)).toEqual({ ok: false, error: 'empty' });
  });

  it('rejects more decimal places than the asset allows', () => {
    expect(parseAmountInput('0.1234567', 6)).toEqual({ ok: false, error: 'too_many_decimals' });
    expect(parseAmountInput('1.5', 0)).toEqual({ ok: false, error: 'too_many_decimals' });
    expect(parseAmountInput('0.123456', 6)).toEqual({ ok: true, value: 123456n });
  });

  it('does not lose precision on large values', () => {
    expect(parseAmountInput('123456789012345678.123456789012345678', 18)).toEqual({
      ok: true,
      value: 123456789012345678123456789012345678n,
    });
  });
});

describe('toMinorUnits', () => {
  it('parses signed server amounts', () => {
    expect(toMinorUnits('-9.81', 6)).toBe(-9810000n);
    expect(toMinorUnits('0', 8)).toBe(0n);
  });

  it('throws on malformed server data instead of guessing', () => {
    expect(() => toMinorUnits('1e-3', 8)).toThrow();
    expect(() => toMinorUnits('0.123', 2)).toThrow();
  });
});

describe('formatMinorUnits', () => {
  it('produces the canonical API string', () => {
    expect(formatMinorUnits(500000000000000000n, 18)).toBe('0.5');
    expect(formatMinorUnits(12000000n, 6)).toBe('12');
    expect(formatMinorUnits(1n, 8)).toBe('0.00000001');
    expect(formatMinorUnits(0n, 6)).toBe('0');
    expect(formatMinorUnits(-9810000n, 6)).toBe('-9.81');
    expect(formatMinorUnits(7n, 0)).toBe('7');
  });

  it('round-trips with parsing', () => {
    for (const s of ['0.5', '12', '0.00000001', '820.413207', '1000000']) {
      const parsed = parseAmountInput(s, 8);
      if (!parsed.ok) throw new Error(s);
      expect(formatMinorUnits(parsed.value, 8)).toBe(s);
    }
  });

  it('groups thousands for display', () => {
    expect(formatAmountForDisplay(1234567891234n, 6)).toBe('1,234,567.891234');
    expect(formatAmountForDisplay(999000000n, 6)).toBe('999');
  });
});

describe('validateClaimAmount', () => {
  const rules = { minAmount: 10000000000000000n, available: 500000000000000000n, fee: 1200000000000000n }; // ETH: min 0.01, avail 0.5, fee 0.0012

  it('accepts amounts within [min, available]', () => {
    expect(validateClaimAmount(10000000000000000n, rules)).toBeNull();
    expect(validateClaimAmount(500000000000000000n, rules)).toBeNull();
  });

  it('rejects zero, below min and above available', () => {
    expect(validateClaimAmount(0n, rules)).toBe('zero');
    expect(validateClaimAmount(9999999999999999n, rules)).toBe('below_min');
    expect(validateClaimAmount(500000000000000001n, rules)).toBe('above_available');
  });

  it('rejects amounts the fee would eat', () => {
    expect(validateClaimAmount(5n, { minAmount: 1n, available: 100n, fee: 5n })).toBe('not_above_fee');
  });
});

describe('fee and totals', () => {
  it('subtracts the fee from the claimed amount', () => {
    expect(formatMinorUnits(receiveAmount(500000000000000000n, 1200000000000000n), 18)).toBe('0.4988');
  });

  it('computes USD value without float error', () => {
    // 820.413207 USDT * 1.0002 = 820.5772896414
    expect(formatUsd(usdValue(820413207n, 6, '1.0002'))).toBe('$820.58');
    // 0.1 * 0.1 + 0.2 * 0.1 is 0.030000000000000002 in floats; here it is exactly 0.03
    expect(formatUsd(usdValue(1n, 1, '0.1') + usdValue(2n, 1, '0.1'))).toBe('$0.03');
  });

  it('rounds the total once, not per row', () => {
    // three rows of $0.004 each: per-row rounding gives $0.00, the real total is $0.012 -> $0.01
    const row = usdValue(4n, 3, '1');
    expect(formatUsd(row)).toBe('$0.00');
    expect(formatUsd(row + row + row)).toBe('$0.01');
  });

  it('formats large and half-up values', () => {
    expect(formatUsd(usdValue(123456789n, 2, '1'))).toBe('$1,234,567.89');
    expect(formatUsd(usdValue(5n, 3, '1'))).toBe('$0.01');
  });
});
