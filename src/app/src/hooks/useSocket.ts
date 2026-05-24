/**
 * useSocket — singleton Socket.io connection to the Cyclo API server.
 *
 * The underlying socket is created on the first hook mount and disconnected
 * when the last consumer unmounts. Every call to useSocket() in between
 * shares the same connection (reference-counted, no duplicate connects).
 *
 * Connection status is tracked at module level and broadcast to all
 * useSocketStatus() subscribers whenever it changes.
 *
 * Usage:
 *   const { onPaymentCharged, status } = useSocket()
 *
 *   useEffect(() => {
 *     return onPaymentCharged((data) => {
 *       console.log('new charge', data)
 *     })
 *   }, [onPaymentCharged])
 *
 * onPaymentCharged returns an unsubscribe function. The hook also removes
 * all listeners it registered when the component unmounts, so the return
 * value only matters if you need to unsubscribe before unmount.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'

// ── Public types ──────────────────────────────────────────────────────────────

/** Shape of the 'payment.charged' event emitted by the API after each confirmed charge. */
export interface PaymentChargedPayload {
    /** Plan ID as a decimal string */
    planId:     string
    /** Subscriber wallet address */
    subscriber: string
    /** Total USDC amount charged, human-readable (e.g. "9.99") */
    amount:     string
    /** Protocol fee deducted from the amount, human-readable */
    fee:        string
    /** Transaction hash of the confirmed batchCharge call */
    txHash:     string
    /** Block confirmation time, Unix seconds */
    timestamp:  number
}

/**
 * Observable connection state of the singleton socket.
 *   connecting   — socket created but not yet accepted by the server, or
 *                  actively retrying after a disconnect
 *   connected    — socket.io 'connect' event fired; ready to receive events
 *   disconnected — transport closed; socket.io will retry every 5 seconds
 */
export type SocketStatus = 'connecting' | 'connected' | 'disconnected'

// ── Singleton state ───────────────────────────────────────────────────────────

const SOCKET_URL: string =
    (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'

/** Exact 5-second fixed retry interval — no exponential growth, no jitter. */
const RECONNECT_INTERVAL_MS = 5_000

let _socket:   Socket | null = null
let _refCount: number         = 0

// ── Status pub-sub ────────────────────────────────────────────────────────────

let _status: SocketStatus = 'connecting'
const _statusSubscribers = new Set<(s: SocketStatus) => void>()

/**
 * Updates the module-level status and notifies every active useSocketStatus()
 * subscriber. Skips notification when the value has not changed.
 */
function broadcastStatus(next: SocketStatus): void {
    if (_status === next) return
    _status = next
    _statusSubscribers.forEach(fn => fn(next))
}

// ── Socket lifecycle ──────────────────────────────────────────────────────────

/**
 * Returns the shared socket, creating it on the first call.
 * Socket event listeners that drive the connection status are attached
 * exactly once when the socket is first created.
 */
function acquireSocket(): Socket {
    if (!_socket) {
        _socket = io(SOCKET_URL, {
            reconnectionAttempts: Infinity,
            // Fixed 5-second retry interval, no exponential back-off or jitter.
            // This is the reconnect logic required by the spec.
            reconnectionDelay:    RECONNECT_INTERVAL_MS,
            reconnectionDelayMax: RECONNECT_INTERVAL_MS,
            randomizationFactor:  0,
        })

        // Status transitions driven by socket.io lifecycle events.
        // These listeners live for the full singleton lifetime.
        _socket.on('connect',           () => broadcastStatus('connected'))
        _socket.on('disconnect',        () => broadcastStatus('disconnected'))
        _socket.on('connect_error',     () => broadcastStatus('disconnected'))
        // Fires at the start of each reconnection attempt — shows "Connecting…"
        // in the indicator so the user sees the retry happening.
        _socket.on('reconnect_attempt', () => broadcastStatus('connecting'))
    }
    _refCount++
    return _socket
}

/**
 * Decrements the consumer reference count.
 * Disconnects and nulls the singleton when the count reaches zero.
 */
function releaseSocket(): void {
    _refCount = Math.max(0, _refCount - 1)
    if (_refCount === 0 && _socket) {
        _socket.disconnect()
        _socket = null
        // Reset so the next acquireSocket() starts from 'connecting'.
        broadcastStatus('connecting')
    }
}

// ── Status hook (lightweight — does not acquire the socket) ──────────────────

/**
 * Returns the current connection status and re-renders whenever it changes.
 * Does NOT acquire or release the socket — safe to call from any component
 * without affecting the socket lifecycle.
 */
export function useSocketStatus(): SocketStatus {
    const [status, setStatus] = useState<SocketStatus>(() => _status)

    useEffect(() => {
        const subscriber = (s: SocketStatus) => setStatus(s)
        _statusSubscribers.add(subscriber)
        // Sync in case status changed between the render that read _status
        // and this effect running.
        setStatus(_status)
        return () => { _statusSubscribers.delete(subscriber) }
    }, [])

    return status
}

// ── Main hook ─────────────────────────────────────────────────────────────────

/**
 * Acquires the shared socket and exposes event registration and connection
 * status. The first caller creates the connection; the last caller (on
 * unmount) disconnects it.
 *
 * Placing this hook in a persistent layout component (e.g. Layout) ensures
 * the socket stays connected for the entire dashboard session.
 */
export function useSocket() {
    const socketRef    = useRef<Socket | null>(null)
    const listenersRef = useRef<((payload: PaymentChargedPayload) => void)[]>([])
    const status       = useSocketStatus()

    useEffect(() => {
        const socket      = acquireSocket()
        socketRef.current = socket

        return () => {
            listenersRef.current.forEach(cb => socket.off('payment.charged', cb))
            listenersRef.current = []
            socketRef.current    = null
            releaseSocket()
        }
    }, [])

    /**
     * Registers a callback for 'payment.charged' events.
     * Emitted by the keeper bot after each successful on-chain charge.
     *
     * @param callback - Invoked with the event payload for every confirmed charge
     * @returns Unsubscribe function that removes this specific listener.
     *          The hook removes all listeners automatically on unmount, so
     *          calling this is only necessary for early removal.
     */
    const onPaymentCharged = useCallback(
        (callback: (payload: PaymentChargedPayload) => void): (() => void) => {
            const socket = socketRef.current
            if (!socket) return () => {}

            socket.on('payment.charged', callback)
            listenersRef.current.push(callback)

            return () => {
                socket.off('payment.charged', callback)
                listenersRef.current = listenersRef.current.filter(fn => fn !== callback)
            }
        },
        []
    )

    return { onPaymentCharged, status }
}
