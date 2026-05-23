/**
 * The three standard billing intervals Cyclo supports, in seconds.
 * These constants are the canonical source of truth for the interval presets used
 * in the create-plan form toggle and the display helpers throughout the UI.
 */
export const INTERVAL_WEEKLY  = 604800    //  7 × 86 400
export const INTERVAL_MONTHLY = 2592000   // 30 × 86 400
export const INTERVAL_YEARLY  = 31536000  // 365 × 86 400

/**
 * Maps a billing interval in seconds to a human-readable label.
 * Returns 'Weekly', 'Monthly', or 'Yearly' for the three standard presets.
 * Falls back to a compact day/second string for any non-standard value.
 * @param seconds - Interval duration in seconds (pass `Number(bigintValue)` for on-chain values)
 * @returns Human-readable label, e.g. 'Monthly'
 */
export function intervalToLabel(seconds: number): string {
    if (seconds === INTERVAL_WEEKLY)  return 'Weekly'
    if (seconds === INTERVAL_MONTHLY) return 'Monthly'
    if (seconds === INTERVAL_YEARLY)  return 'Yearly'
    const days = seconds / 86400
    if (Number.isInteger(days)) return `${days}d`
    return `${seconds}s`
}

/** Scale factor for USDC — 6 decimal places, so 1 USDC = 1_000_000 raw units. */
const USDC_SCALE = 1_000_000n;

/**
 * Converts a human-readable USDC amount string to raw 6-decimal units.
 * Truncates at 6 decimal places without rounding.
 * @param humanAmount - Decimal string, e.g. "1.50" or "10"
 * @returns Raw USDC units as bigint, e.g. 1_500_000n
 */
export function toUsdcUnits(humanAmount: string): bigint {
    const [integerPart = '0', decimalPart = ''] = humanAmount.split('.');
    const paddedDecimal = decimalPart.padEnd(6, '0').slice(0, 6);
    return BigInt(integerPart) * USDC_SCALE + BigInt(paddedDecimal || '0');
}

/**
 * Converts raw 6-decimal USDC units to a JavaScript number.
 * @param rawAmount - Raw USDC units as bigint, e.g. 1_500_000n
 * @returns Float, e.g. 1.5
 */
export function fromUsdcUnits(rawAmount: bigint): number {
    return Number(rawAmount) / 1_000_000;
}
