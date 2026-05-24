/**
 * Toast notification system — context + portal renderer.
 *
 * Usage:
 *   1. Wrap the app in <ToastProvider>.
 *   2. Call const { toast } = useToast() from any component.
 *   3. toast.success('Title', 'Optional message')
 *      toast.danger('Error', 'Something went wrong')
 *      toast.warning('Heads up', 'USDC balance is low')
 *      toast.info('Tip', 'Optional message')
 *
 * Each toast auto-dismisses after 4 s (configurable via durationMs).
 * The dismiss button triggers the exit animation before removal.
 *
 * Class prefix: tn-
 */
import {
    createContext, useContext, useCallback, useRef,
    useState, useEffect, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
    IconCheck, IconX, IconAlertTriangle, IconInfoCircle,
} from '@tabler/icons-react'
import './Toast.css'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'danger' | 'warning' | 'info'

interface ToastItem {
    id:       string
    variant:  ToastVariant
    title:    string
    message?: string
    exiting:  boolean
}

interface ToastAPI {
    success: (title: string, message?: string) => void
    danger:  (title: string, message?: string) => void
    warning: (title: string, message?: string) => void
    info:    (title: string, message?: string) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastAPI | null>(null)

// ── Icon map ──────────────────────────────────────────────────────────────────

const VARIANT_ICON: Record<ToastVariant, ReactNode> = {
    success: <IconCheck size={16} aria-hidden="true" />,
    danger:  <IconX    size={16} aria-hidden="true" />,
    warning: <IconAlertTriangle  size={16} aria-hidden="true" />,
    info:    <IconInfoCircle     size={16} aria-hidden="true" />,
}

const AUTO_DISMISS_MS = 4_000
const EXIT_DURATION_MS = 220

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

    const dismiss = useCallback((id: string) => {
        // Mark as exiting first to trigger CSS exit animation
        setToasts(prev =>
            prev.map(t => t.id === id ? { ...t, exiting: true } : t)
        )
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, EXIT_DURATION_MS)
    }, [])

    const push = useCallback((variant: ToastVariant, title: string, message?: string) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        setToasts(prev => [...prev, { id, variant, title, message, exiting: false }])
        const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
        timersRef.current.set(id, timer)
    }, [dismiss])

    // Clear all timers on unmount
    useEffect(() => {
        return () => {
            timersRef.current.forEach(t => clearTimeout(t))
        }
    }, [])

    const api: ToastAPI = {
        success: (title, msg) => push('success', title, msg),
        danger:  (title, msg) => push('danger',  title, msg),
        warning: (title, msg) => push('warning', title, msg),
        info:    (title, msg) => push('info',    title, msg),
    }

    return (
        <ToastContext.Provider value={api}>
            {children}
            {createPortal(
                <div className="tn-container" aria-live="polite" aria-atomic="false">
                    {toasts.map(t => (
                        <ToastItem
                            key={t.id}
                            item={t}
                            onDismiss={() => dismiss(t.id)}
                        />
                    ))}
                </div>,
                document.body,
            )}
        </ToastContext.Provider>
    )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the toast API. Must be called inside a ToastProvider.
 *
 * @throws If called outside a ToastProvider.
 */
export function useToast(): ToastAPI {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
    return ctx
}

// ── Toast item ────────────────────────────────────────────────────────────────

interface ToastItemProps {
    item:      ToastItem
    onDismiss: () => void
}

function ToastItem({ item, onDismiss }: ToastItemProps) {
    return (
        <div
            role="alert"
            className={
                `tn-toast tn-toast--${item.variant}${item.exiting ? ' tn-toast--exit' : ''}`
            }
        >
            <span className={`tn-icon tn-icon--${item.variant}`}>
                {VARIANT_ICON[item.variant]}
            </span>

            <div className="tn-body">
                <p className="tn-title">{item.title}</p>
                {item.message && <p className="tn-message">{item.message}</p>}
            </div>

            <button
                type="button"
                className="tn-close"
                onClick={onDismiss}
                aria-label="Dismiss notification"
            >
                <IconX size={14} aria-hidden="true" />
            </button>
        </div>
    )
}
