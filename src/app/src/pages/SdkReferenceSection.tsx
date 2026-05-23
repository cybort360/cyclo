/**
 * SDK Reference section content — extracted from DevelopersPage to keep that
 * file under the 300-line limit. Exports a single SdkReferenceSection component
 * that is rendered as the children of its DocSection wrapper.
 */
import { CodeBlock } from '../components/DocCodeBlock'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MethodParam {
    name:        string
    type:        string
    description: string
}

interface MethodDef {
    signature:   string
    description: string
    params:      MethodParam[]
    example:     string
}

interface HookDef {
    /** Unique key for React list rendering. */
    name:        string
    /** Full hook signature shown as an inline code badge. */
    signature:   string
    description: string
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ParamsTable({ params }: { params: MethodParam[] }) {
    if (params.length === 0) return null
    return (
        <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Parameters
            </p>
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="border-b border-gray-200">
                        <th className="text-left text-xs text-gray-400 font-medium pb-1.5 w-36">Name</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-1.5 w-40">Type</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-1.5">Description</th>
                    </tr>
                </thead>
                <tbody>
                    {params.map(p => (
                        <tr key={p.name} className="border-b border-gray-100 last:border-0">
                            <td className="py-2 pr-3 font-mono text-xs text-gray-900 align-top">{p.name}</td>
                            <td className="py-2 pr-3 font-mono text-xs text-indigo-600 align-top">{p.type}</td>
                            <td className="py-2 text-xs text-gray-600 leading-relaxed">{p.description}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function MethodDoc({ signature, description, params, example }: MethodDef) {
    return (
        <div className="pb-10 mb-10 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
            {/* Signature bar */}
            <div className="font-mono text-[13px] bg-gray-900 text-indigo-200 px-4 py-2.5 rounded-lg mb-3 overflow-x-auto">
                {signature}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{description}</p>
            <ParamsTable params={params} />
            <CodeBlock code={example} />
        </div>
    )
}

// ── Method definitions ────────────────────────────────────────────────────────

const METHODS: MethodDef[] = [
    {
        signature:   'getPlan(planId: bigint): Promise<Plan>',
        description: 'Returns the on-chain details of a billing plan.',
        params: [
            { name: 'planId', type: 'bigint', description: 'On-chain plan identifier, as returned by createPlan.' },
        ],
        example: `\
const plan = await client.getPlan(1n)
// { price: 9990000n, interval: 2592000n, trialPeriod: 0n,
//   merchant: '0x4f91...', active: true }`,
    },
    {
        signature:   'createPlan(params: CreatePlanParams): Promise<bigint>',
        description: 'Deploys a new subscription plan to the contract. Returns the new plan ID.',
        params: [
            { name: 'params.price',       type: 'bigint', description: 'Charge amount in USDC. 1 USDC = 1_000_000n (6 decimals).' },
            { name: 'params.interval',    type: 'bigint', description: 'Billing interval in seconds. 30 days = 2_592_000n.' },
            { name: 'params.trialPeriod', type: 'bigint', description: 'Free trial duration in seconds. Pass 0n for no trial.' },
        ],
        example: `\
const planId = await client.createPlan({
  price:       9990000n,  // 9.99 USDC
  interval:    2592000n,  // 30 days
  trialPeriod: 604800n,   // 7-day free trial (0n for none)
})
// Returns 1n`,
    },
    {
        signature:   'subscribe(planId: bigint): Promise<void>',
        description: 'Subscribes the connected wallet to a plan. Manages USDC allowance automatically.',
        params: [
            { name: 'planId', type: 'bigint', description: 'ID of the plan to subscribe to.' },
        ],
        example: `\
await client.subscribe(1n)
// Approves 12 months of USDC allowance on first call.
// Re-approves when fewer than 2 months of allowance remain.`,
    },
    {
        signature:   'cancelSubscription(planId: bigint): Promise<void>',
        description: 'Cancels the subscription immediately. No refund is issued.',
        params: [
            { name: 'planId', type: 'bigint', description: 'ID of the plan to unsubscribe from.' },
        ],
        example: `\
await client.cancelSubscription(1n)
// Subscription ends immediately. The soulbound token is burned.`,
    },
    {
        signature:   'migratePlan(fromPlanId: bigint, toPlanId: bigint): Promise<void>',
        description: 'Atomically cancels one subscription and creates another in a single transaction.',
        params: [
            { name: 'fromPlanId', type: 'bigint', description: 'Current plan to cancel.' },
            { name: 'toPlanId',   type: 'bigint', description: 'New plan to subscribe to.' },
        ],
        example: `\
await client.migratePlan(
  1n,  // cancel this plan
  2n,  // subscribe to this one
)
// Both operations execute atomically — no gap in coverage.`,
    },
    {
        signature:   'deactivatePlan(planId: bigint): Promise<void>',
        description: 'Blocks new subscriptions and future charges on a plan. Merchant-only.',
        params: [
            { name: 'planId', type: 'bigint', description: 'ID of the plan to deactivate.' },
        ],
        example: `\
// Must be called from the merchant address that created the plan.
await client.deactivatePlan(1n)
// Existing subscribers are unaffected until they cancel.`,
    },
    {
        signature:   'isSubscribed(subscriber: Address, planId: bigint): Promise<boolean>',
        description: 'Returns true if the wallet holds an active soulbound subscription token for this plan.',
        params: [
            { name: 'subscriber', type: 'Address', description: 'Wallet address to check.' },
            { name: 'planId',     type: 'bigint',  description: 'Plan to check subscription status for.' },
        ],
        example: `\
const active = await client.isSubscribed('0x4f91...', 1n)
if (active) {
  // Wallet holds an active soulbound token for plan 1
}`,
    },
    {
        signature:   "on(event: EventName, callback: (payload: EventPayload) => void): () => void",
        description: "Subscribes to a contract event. Returns an unsubscribe function; call it to remove the listener.",
        params: [
            { name: 'event',    type: 'EventName',                  description: "'SubscriptionCreated' | 'SubscriptionCancelled' | 'PaymentCharged'" },
            { name: 'callback', type: '(payload: EventPayload) => void', description: 'Invoked with the decoded event payload each time the event fires.' },
        ],
        example: `\
const unsubscribe = client.on('PaymentCharged', (event) => {
  const { subscriber, planId, amount } = event
  console.log(\`Charged \${subscriber} \${amount} for plan \${planId}\`)
})

// Remove listener when done
unsubscribe()`,
    },
]

// ── React hook definitions ────────────────────────────────────────────────────

const REACT_HOOKS: HookDef[] = [
    { name: 'CycloProvider',         signature: '<CycloProvider contractAddress usdcAddress>',  description: 'Context provider. Wrap your app once — required before any hook below can be used.' },
    { name: 'usePlan',               signature: 'usePlan(planId: bigint)',                       description: 'Fetches plan details. Returns { plan, isLoading, error }.' },
    { name: 'useSubscribe',          signature: 'useSubscribe()',                                description: 'Returns { subscribe, isPending }. Manages USDC approval automatically.' },
    { name: 'useCancelSubscription', signature: 'useCancelSubscription()',                       description: 'Returns { cancel, isPending }.' },
    { name: 'useMigratePlan',        signature: 'useMigratePlan()',                             description: 'Returns { migrate, isPending }. Atomic cancel + subscribe in one call.' },
    { name: 'useIsSubscribed',       signature: 'useIsSubscribed(subscriber?, planId?)',         description: 'Returns { isSubscribed, tokenId, isLoading }.' },
]

// ── Section component ─────────────────────────────────────────────────────────

export function SdkReferenceSection() {
    return (
        <div>
            {/* Core SDK methods */}
            <div>
                {METHODS.map((method) => (
                    <MethodDoc key={method.signature} {...method} />
                ))}
            </div>

            {/* @cyclo/react hooks subsection */}
            <div className="mt-12 pt-10 border-t-2 border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">
                    React hooks —{' '}
                    <code className="font-mono text-sm font-normal text-indigo-600">@cyclo/react</code>
                </h3>
                <p className="text-sm text-gray-500 mt-2 mb-6">
                    Install:{' '}
                    <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">
                        npm install @cyclo/react
                    </code>
                    {'. '}Wrap your app with <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">CycloProvider</code> before using any hook.
                </p>
                <div className="border-t border-gray-100">
                    {REACT_HOOKS.map(({ name, signature, description }) => (
                        <div key={name} className="flex gap-5 py-3.5 border-b border-gray-100 last:border-0 items-start">
                            <code className="font-mono text-[12px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded shrink-0 leading-snug">
                                {signature}
                            </code>
                            <p className="text-sm text-gray-600 leading-relaxed mt-0.5">{description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
