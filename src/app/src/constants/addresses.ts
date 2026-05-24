/**
 * Contract and token addresses sourced from Vite environment variables.
 * Set VITE_CONTRACT_ADDRESS and VITE_USDC_ADDRESS in src/app/.env
 */
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string ?? '';
export const USDC_ADDRESS      = import.meta.env.VITE_USDC_ADDRESS      as string ?? '';
export const DEPLOY_BLOCK      = BigInt(import.meta.env.VITE_DEPLOY_BLOCK ?? '0');
