/**
 * Webhooks section content — extracted from DevelopersPage.
 * Documents the HTTPS webhook delivery system: event table, payload
 * shape, and link to the in-dashboard endpoint manager.
 */
import { CodeBlock } from '../components/DocCodeBlock'

// ── Event table rows ──────────────────────────────────────────────────────────

interface WebhookEvent {
    event:   string
    trigger: string
}

const WEBHOOK_EVENTS: WebhookEvent[] = [
    { event: 'subscription.created',   trigger: 'New subscriber'                          },
    { event: 'subscription.cancelled', trigger: 'Subscriber cancels'                      },
    { event: 'payment.charged',        trigger: 'Successful charge settled'               },
    { event: 'payment.failed',         trigger: 'Charge failed (low balance or allowance)'},
]

// ── Payload example ───────────────────────────────────────────────────────────

const PAYLOAD_EXAMPLE = `\
{
  "event":      "payment.charged",
  "planId":     "42",
  "subscriber": "0xabc...def",
  "amount":     "9990000",
  "fee":        "299700",
  "txHash":     "0x1a2b...9f0e",
  "timestamp":  1716480000
}`

// ── Component ─────────────────────────────────────────────────────────────────

export function WebhooksSection() {
    return (
        <div className="space-y-8">

            {/* Intro */}
            <div className="space-y-3">
                <h3 className="text-base font-semibold text-gray-900">Webhook delivery</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                    Register an HTTPS endpoint and Cyclo will POST a signed JSON payload
                    every time a lifecycle event occurs on one of your plans. Delivery is
                    attempted up to five times with exponential back-off.
                </p>
            </div>

            {/* Events table */}
            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Events
                </p>
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2.5 w-56">
                                Event
                            </th>
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2.5">
                                Trigger
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {WEBHOOK_EVENTS.map(({ event, trigger }) => (
                            <tr key={event} className="border-b border-gray-100 last:border-0">
                                <td className="py-3 pr-4 align-middle">
                                    <code className="text-[12px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                        {event}
                                    </code>
                                </td>
                                <td className="py-3 align-middle text-gray-600">
                                    {trigger}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Payload example */}
            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Example payload — payment.charged
                </p>
                <CodeBlock code={PAYLOAD_EXAMPLE} language="json" />
            </div>

            {/* Link to dashboard */}
            <p className="text-sm text-gray-600">
                <a
                    href="/webhooks"
                    className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                >
                    Manage your webhook endpoints →
                </a>
            </p>
        </div>
    )
}
