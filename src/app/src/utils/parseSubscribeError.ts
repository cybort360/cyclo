/**
 * Parses errors thrown by CycloClient.subscribe() into structured, user-facing messages.
 *
 * Error origin map:
 *   - UserRejectedRequestError   → user dismissed the wallet prompt (approve OR subscribe step)
 *   - ContractFunctionRevertedError → contract reverted; .data.errorName gives the custom error
 *   - HttpRequestError / TimeoutError → RPC connectivity failure
 *   - Anything else → generic fallback
 *
 * Errors are found by walking the .cause chain because viem and wagmi wrap low-level
 * errors in higher-level ones (e.g. ContractFunctionExecutionError wraps
 * ContractFunctionRevertedError).
 */
import {
    UserRejectedRequestError,
    ContractFunctionRevertedError,
    HttpRequestError,
    TimeoutError,
} from 'viem'

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * cancelled — user rejected the wallet prompt; shown subtly, not as an error
 * balance   — insufficient USDC balance
 * already   — wallet already subscribed to this plan
 * inactive  — plan is deactivated or not found
 * network   — RPC / connectivity failure
 * contract  — generic or unrecognised contract revert
 */
export type SubscribeErrorKind = 'cancelled' | 'balance' | 'already' | 'inactive' | 'network' | 'contract'

export interface ParsedSubscribeError {
    kind:    SubscribeErrorKind
    message: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Walks err → err.cause → err.cause.cause … returning the first value for which
 * pred returns true, or undefined if none is found.
 */
function findCause<T>(
    err:  unknown,
    pred: (e: unknown) => e is T,
): T | undefined {
    let cur: unknown = err
    while (cur instanceof Error) {
        if (pred(cur)) return cur
        cur = (cur as { cause?: unknown }).cause
    }
    return undefined
}

/**
 * Returns true if err (or any error in its .cause chain) represents a user
 * wallet rejection.  Handles both viem's UserRejectedRequestError class and
 * any error carrying numeric code 4001 or string code 'ACTION_REJECTED'
 * (the latter used by some WalletConnect bridges).
 */
function isUserRejection(err: unknown): boolean {
    if (!err) return false
    if (err instanceof UserRejectedRequestError) return true
    if (!(err instanceof Error)) return false
    const e = err as Error & { code?: unknown; cause?: unknown }
    if (e.code === 4001 || e.code === 'ACTION_REJECTED') return true
    return isUserRejection(e.cause)
}

// ── Custom error → user message map ───────────────────────────────────────────

/**
 * Maps ABI custom error names (from ContractFunctionRevertedError.data.errorName)
 * to { kind, message } pairs.  Unmapped names fall through to the generic revert handler.
 */
const REVERT_MAP: Record<string, { kind: SubscribeErrorKind; message: string }> = {
    TransferFailed: {
        kind:    'balance',
        message: "Your wallet doesn't have enough USDC to complete this subscription.",
    },
    InsufficientAllowance: {
        // ensureAllowance usually prevents this, but guard anyway
        kind:    'balance',
        message: "Your USDC allowance is too low. Please try subscribing again.",
    },
    AlreadySubscribed: {
        kind:    'already',
        message: "Your wallet is already subscribed to this plan.",
    },
    PlanInactive: {
        kind:    'inactive',
        message: "This plan is no longer accepting new subscribers.",
    },
    PlanNotFound: {
        kind:    'inactive',
        message: "This plan is no longer accepting new subscribers.",
    },
}

// ── Main parser ───────────────────────────────────────────────────────────────

/**
 * Converts a raw error from CycloClient.subscribe() into a ParsedSubscribeError
 * suitable for rendering in the checkout UI.
 */
export function parseSubscribeError(err: unknown): ParsedSubscribeError {
    // 1. User dismissed the wallet prompt — treat as a soft cancellation, not an error.
    if (isUserRejection(err)) {
        return { kind: 'cancelled', message: 'Transaction cancelled.' }
    }

    // 2. Contract revert — extract the ContractFunctionRevertedError from the cause chain.
    const revert = findCause(
        err,
        (e): e is ContractFunctionRevertedError => e instanceof ContractFunctionRevertedError,
    )
    if (revert) {
        const errorName = revert.data?.errorName ?? ''
        const mapped    = REVERT_MAP[errorName]
        if (mapped) return mapped

        // Generic revert: use the reason string if present, otherwise the error name.
        const detail = revert.reason ?? (errorName || null)
        return {
            kind:    'contract',
            message: `Transaction failed: ${detail ?? 'please try again'}.`,
        }
    }

    // 3. Network / RPC failure.
    const isHttp    = (e: unknown): e is HttpRequestError => e instanceof HttpRequestError
    const isTimeout = (e: unknown): e is TimeoutError     => e instanceof TimeoutError
    if (findCause(err, isHttp) || findCause(err, isTimeout)) {
        return { kind: 'network', message: 'Connection issue. Please check your network and try again.' }
    }
    // Catch plain fetch failures that aren't wrapped in a viem class.
    if (err instanceof Error) {
        const msg = err.message.toLowerCase()
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) {
            return { kind: 'network', message: 'Connection issue. Please check your network and try again.' }
        }
    }

    // 4. Generic fallback.
    const raw = err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { kind: 'contract', message: `Transaction failed: ${raw}` }
}
