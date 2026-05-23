/**
 * Thin HTTP bridge to the API server's Socket.io relay.
 * Posts events to POST /internal/events so the API can broadcast them to
 * connected frontend clients. All errors are swallowed — the keeper must
 * never crash because the API server is unreachable.
 *
 * Required env:
 *   API_BASE_URL (optional, defaults to http://localhost:3001)
 */
import { formatUnits } from 'ethers'
import { log } from './logger.js'

const API_BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '')

// Matches the protocol's FEE_BPS constant in SubscriptionManager.sol (300 bp = 3%).
const FEE_BPS = 300n

export interface PaymentChargedPayload {
    planId:     string
    subscriber: string
    amount:     string  // USDC human-readable, e.g. "9.99"
    fee:        string  // Protocol fee taken, USDC human-readable
    txHash:     string
    timestamp:  number  // Unix seconds
}

/**
 * Builds a PaymentChargedPayload from raw on-chain values.
 * fee is derived from rawAmount using the contract's fixed 3% rate so we
 * avoid an extra log parse — FeeCollected is always emitted with the same value.
 * @param planId     - Plan ID as BigInt from the PaymentCharged event
 * @param subscriber - Subscriber address from the PaymentCharged event
 * @param rawAmount  - plan.price in 6-decimal USDC units from the PaymentCharged event
 * @param txHash     - Transaction hash of the confirmed batchCharge call
 * @returns PaymentChargedPayload ready to emit
 */
export function buildPaymentChargedPayload(params: {
    planId:     bigint
    subscriber: string
    rawAmount:  bigint
    txHash:     string
}): PaymentChargedPayload {
    const feeRaw = params.rawAmount * FEE_BPS / 10_000n
    return {
        planId:     params.planId.toString(),
        subscriber: params.subscriber,
        amount:     formatUnits(params.rawAmount, 6),
        fee:        formatUnits(feeRaw, 6),
        txHash:     params.txHash,
        timestamp:  Math.floor(Date.now() / 1000),
    }
}

/**
 * Posts a payment.charged event to the API server's internal relay endpoint.
 * Resolves immediately on success (HTTP 204). Fails silently on any network
 * error or non-2xx response — the keeper must stay alive regardless.
 * @param payload - The event payload to broadcast
 */
export async function emitPaymentCharged(payload: PaymentChargedPayload): Promise<void> {
    try {
        const response = await fetch(`${API_BASE_URL}/internal/events`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ event: 'payment.charged', payload }),
        })

        if (!response.ok) {
            log('warn', 'apiEmitter: unexpected response from API', {
                status:     response.status,
                planId:     payload.planId,
                subscriber: payload.subscriber,
            })
        }
    } catch (err) {
        // API server is not running or unreachable — swallow to keep keeper alive
        log('warn', 'apiEmitter: could not reach API server', {
            error:      String(err),
            planId:     payload.planId,
            subscriber: payload.subscriber,
        })
    }
}
