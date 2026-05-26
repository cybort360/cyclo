/**
 * Shared wallet-signature cache for authenticated API calls.
 *
 * Many API endpoints now require a signed proof that the caller controls
 * their wallet address. Signing on every request/poll would cause repeated
 * wallet prompts. This module caches each signature for 4 minutes (under
 * the 5-minute server TTL) so the user is only asked to sign ~once per
 * session window.
 *
 * Usage:
 *   const { timestamp, signature } = await getCachedAuth(address, signMessageAsync)
 *   // pass as query params or request body fields
 */

const CACHE_TTL_MS = 4 * 60 * 1000 // 4 min — stays within server's 5-min TTL

interface CachedEntry {
    timestamp: number
    signature: string
    expiresAt: number
}

const cache = new Map<string, CachedEntry>()

/**
 * Builds the canonical sign-in message that the API server's verify.ts expects.
 * Must stay in sync with api/verify.ts buildMessage().
 */
export function buildSignMessage(address: string, timestamp: number): string {
    return `Sign this message to set up your Cyclo merchant profile.\n\nWallet: ${address}\nTimestamp: ${timestamp}`
}

/**
 * Returns a valid {timestamp, signature} pair for `address`.
 * Reuses the cached entry if it is still fresh; otherwise prompts the wallet
 * for a fresh signature and caches the result.
 *
 * @param address         - Wallet address (checksummed or lowercase; normalised internally).
 * @param signMessageAsync - The wagmi signMessageAsync function from useSignMessage().
 *   Typed broadly to remain compatible across wagmi versions whose parameter
 *   shapes vary (some require `account`, others don't).
 */
export async function getCachedAuth(
    address: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signMessageAsync: (...args: any[]) => Promise<string>
): Promise<{ timestamp: number; signature: string }> {
    const key = address.toLowerCase()
    const now = Date.now()
    const cached = cache.get(key)

    if (cached && now < cached.expiresAt) {
        return { timestamp: cached.timestamp, signature: cached.signature }
    }

    const timestamp = now
    const message   = buildSignMessage(key, timestamp)
    const signature = await signMessageAsync({ message })

    cache.set(key, { timestamp, signature, expiresAt: now + CACHE_TTL_MS })
    return { timestamp, signature }
}

/** Clears the cached entry for an address (e.g. on wallet disconnect). */
export function clearCachedAuth(address: string): void {
    cache.delete(address.toLowerCase())
}
