// Money math. Amounts are decimal strings on the wire and bigint minor units
// (amount * 10^decimals) in the app. No Number/parseFloat anywhere on this path.

// API format: digits, optional dot + digits, no leading zeros ("0.5", "12"; not ".5", "1.", "05", "1e-3").
const AMOUNT_RE = /^(0|[1-9]\d*)(\.\d+)?$/;
// Server values may be signed (activity amounts are negative for reversals and claims).
const SIGNED_RE = /^-?(0|[1-9]\d*)(\.\d+)?$/;

const pow10 = (n: number): bigint => 10n ** BigInt(n);

/** Strict server-side parse: throws on malformed input or more places than `decimals`. */
export function toMinorUnits(value: string, decimals: number): bigint {
  if (!SIGNED_RE.test(value)) {
    throw new Error(`Malformed amount from server: "${value}"`);
  }
  const negative = value.startsWith('-');
  const [intPart, fracPart = ''] = (negative ? value.slice(1) : value).split('.');
  if (fracPart.length > decimals) {
    throw new Error(`Amount "${value}" has more than ${decimals} decimal places`);
  }
  const units = BigInt(intPart) * pow10(decimals) + BigInt(fracPart.padEnd(decimals, '0') || '0');
  return negative ? -units : units;
}

export type AmountInputError = 'empty' | 'format' | 'too_many_decimals';

export type ParsedAmountInput =
  | { ok: true; value: bigint }
  | { ok: false; error: AmountInputError };

/**
 * Parses what the user typed. Trims spaces and accepts a comma as the decimal
 * separator (common on phones), then applies the API format rules.
 */
export function parseAmountInput(input: string, decimals: number): ParsedAmountInput {
  const normalized = input.trim().replace(',', '.');
  if (normalized === '') return { ok: false, error: 'empty' };
  if (!AMOUNT_RE.test(normalized)) return { ok: false, error: 'format' };
  const fracPart = normalized.split('.')[1] ?? '';
  if (fracPart.length > decimals) return { ok: false, error: 'too_many_decimals' };
  return { ok: true, value: toMinorUnits(normalized, decimals) };
}

/**
 * Canonical decimal string for minor units: no trailing zeros, no exponent.
 * This is also the exact string we send to the API.
 */
export function formatMinorUnits(units: bigint, decimals: number): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const base = pow10(decimals);
  const intPart = (abs / base).toString();
  const fracPart = decimals > 0 ? (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '') : '';
  return `${negative ? '-' : ''}${intPart}${fracPart ? `.${fracPart}` : ''}`;
}

/** Same as formatMinorUnits but with thousands separators, for display only. */
export function formatAmountForDisplay(units: bigint, decimals: number): string {
  const plain = formatMinorUnits(units, decimals);
  const [intPart, fracPart] = plain.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart ? `${grouped}.${fracPart}` : grouped;
}

export type ClaimRules = { minAmount: bigint; available: bigint; fee: bigint };

export type ClaimAmountError = 'zero' | 'below_min' | 'above_available' | 'not_above_fee';

/** API rule: minAmount <= amount <= available. We also refuse amounts the fee would eat. */
export function validateClaimAmount(amount: bigint, rules: ClaimRules): ClaimAmountError | null {
  if (amount <= 0n) return 'zero';
  if (amount < rules.minAmount) return 'below_min';
  if (amount > rules.available) return 'above_available';
  if (amount <= rules.fee) return 'not_above_fee';
  return null;
}

/** The fee is taken from the claimed amount. */
export function receiveAmount(amount: bigint, fee: bigint): bigint {
  return amount - fee;
}

// USD values are kept at 10^-12 dollar precision and rounded to cents only for display,
// so a total is rounded once instead of summing per-row rounding errors.
export const USD_SCALE = 12;

/** units (at `decimals`) * usdPrice, as an integer at USD_SCALE, rounded half-up. */
export function usdValue(units: bigint, decimals: number, usdPrice: string): bigint {
  if (!AMOUNT_RE.test(usdPrice)) {
    throw new Error(`Malformed usdPrice from server: "${usdPrice}"`);
  }
  const priceScale = usdPrice.split('.')[1]?.length ?? 0;
  const price = toMinorUnits(usdPrice, priceScale);
  const product = units * price; // scale: decimals + priceScale
  return roundToScale(product, decimals + priceScale, USD_SCALE);
}

/** Formats a USD_SCALE value as dollars and cents, rounded half-up: "$1,234.56". */
export function formatUsd(value: bigint): string {
  const cents = roundToScale(value, USD_SCALE, 2);
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const dollars = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const rest = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}$${dollars}.${rest}`;
}

function roundToScale(value: bigint, fromScale: number, toScale: number): bigint {
  if (fromScale <= toScale) return value * pow10(toScale - fromScale);
  const divisor = pow10(fromScale - toScale);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const rounded = (abs + divisor / 2n) / divisor;
  return negative ? -rounded : rounded;
}
