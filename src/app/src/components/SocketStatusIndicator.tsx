/**
 * SocketStatusIndicator — persistent WebSocket connection badge.
 *
 * Calling useSocket() here (rather than the lightweight useSocketStatus())
 * serves a dual purpose: it reads the live connection status AND it acquires
 * the socket, keeping it alive for the full lifetime of the Layout so that
 * every dashboard page receives real-time events without needing to manage
 * the connection themselves.
 *
 * Visual states:
 *   connected    — green dot, pulsing, "Live"
 *   connecting   — grey dot, static, "Connecting…"
 *   disconnected — red dot, static, "Disconnected"
 *                  (socket.io retries automatically every 5 s)
 */
import { useSocket, type SocketStatus } from '../hooks/useSocket'

// ── Config ────────────────────────────────────────────────────────────────────

interface StatusConfig {
    dotColor:  string
    textColor: string
    label:     string
    pulse:     boolean
}

const STATUS_CONFIG: Record<SocketStatus, StatusConfig> = {
    connected: {
        dotColor:  '#22c55e',
        textColor: '#15803d',
        label:     'Live',
        pulse:     true,
    },
    connecting: {
        dotColor:  '#9ca3af',
        textColor: '#6b7280',
        label:     'Connecting…',
        pulse:     false,
    },
    disconnected: {
        dotColor:  '#ef4444',
        textColor: '#b91c1c',
        label:     'Disconnected',
        pulse:     false,
    },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SocketStatusIndicator() {
    const { status } = useSocket()
    const { dotColor, textColor, label, pulse } = STATUS_CONFIG[status]

    return (
        <>
            {/* Keyframe for the "Live" pulse — injected once, scoped by name. */}
            <style>{`
                @keyframes socket-dot-pulse {
                    0%, 100% { opacity: 1;   transform: scale(1);    }
                    50%      { opacity: 0.45; transform: scale(0.85); }
                }
            `}</style>

            <div
                style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        '5px',
                    padding:    '3px 8px',
                    borderRadius: '999px',
                    background:   status === 'connected'    ? 'rgba(34,197,94,0.08)'
                                : status === 'disconnected' ? 'rgba(239,68,68,0.08)'
                                : 'rgba(156,163,175,0.10)',
                    border: `1px solid ${
                        status === 'connected'    ? 'rgba(34,197,94,0.25)'
                        : status === 'disconnected' ? 'rgba(239,68,68,0.25)'
                        : 'rgba(156,163,175,0.25)'
                    }`,
                }}
                title={
                    status === 'disconnected'
                        ? 'WebSocket disconnected — retrying every 5 seconds'
                        : status === 'connecting'
                        ? 'Establishing WebSocket connection…'
                        : 'WebSocket connected — receiving live updates'
                }
            >
                <span
                    style={{
                        display:         'block',
                        width:           '6px',
                        height:          '6px',
                        borderRadius:    '50%',
                        backgroundColor: dotColor,
                        flexShrink:      0,
                        animation: pulse
                            ? 'socket-dot-pulse 2s ease-in-out infinite'
                            : undefined,
                    }}
                />
                <span
                    style={{
                        fontSize:   '11px',
                        fontWeight: 500,
                        color:      textColor,
                        whiteSpace: 'nowrap',
                        lineHeight: 1,
                    }}
                >
                    {label}
                </span>
            </div>
        </>
    )
}
