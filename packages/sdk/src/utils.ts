const USDC_DECIMALS = 6n
const USDC_SCALE = 10n ** USDC_DECIMALS

export function toUsdcUnits(amount: number): bigint {
  return BigInt(Math.round(amount * Number(USDC_SCALE)))
}

export function fromUsdcUnits(amount: bigint): number {
  return Number(amount) / Number(USDC_SCALE)
}

export function daysToSeconds(days: number): bigint {
  return BigInt(days * 86400)
}

export function secondsToDays(seconds: bigint): number {
  return Number(seconds) / 86400
}
