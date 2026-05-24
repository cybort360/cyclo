/**
 * Contract and token addresses loaded from environment variables.
 * Throws at module load time if a required variable is absent — this enforces
 * the fail-fast startup requirement from CLAUDE.md.
 */
function requireEnv(name: string): string {
    const value = process.env[name];
    if (value === undefined || value === '') {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export const USDC_ADDRESS: string     = requireEnv('USDC_ADDRESS');
export const CONTRACT_ADDRESS: string = requireEnv('CONTRACT_ADDRESS');
