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
 * Converts raw 6-decimal USDC units to a human-readable decimal string.
 * Trims trailing zeros but always shows at least 2 decimal places.
 * @param rawAmount - Raw USDC units as bigint, e.g. 1_500_000n
 * @returns Human-readable string, e.g. "1.50"
 */
export function fromUsdcUnits(rawAmount: bigint): string {
    const integer     = rawAmount / USDC_SCALE;
    const fraction    = rawAmount % USDC_SCALE;
    const fractionStr = fraction.toString().padStart(6, '0');
    const trimmed     = fractionStr.replace(/0+$/, '').padEnd(2, '0');
    return `${integer}.${trimmed}`;
}
