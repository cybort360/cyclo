/**
 * Contract Reference section content — extracted from DevelopersPage to keep that
 * file under the 300-line limit.
 *
 * Renders: intro + explorer link, function reference table, ABI download button.
 */
import { CONTRACT_ADDRESS } from '../constants/addresses'

// ── Data ──────────────────────────────────────────────────────────────────────

interface ContractFn {
    signature:   string
    /** Who is the typical / authorised caller. */
    caller:      'Merchant' | 'User' | 'Anyone' | 'Keeper' | 'Off-chain'
    description: string
}

const CONTRACT_FUNCTIONS: ContractFn[] = [
    { signature: 'createPlan(price, interval, trial)',     caller: 'Merchant',  description: 'Create a billing plan.' },
    { signature: 'deactivatePlan(planId)',                 caller: 'Merchant',  description: 'Disable a plan — no new subscribers, no future charges.' },
    { signature: 'subscribe(planId)',                     caller: 'User',      description: 'Subscribe to a plan.' },
    { signature: 'cancelSubscription(planId)',            caller: 'User',      description: 'Cancel immediately. No refund is issued.' },
    { signature: 'migratePlan(fromPlanId, toPlanId)',     caller: 'User',      description: 'Atomic plan switch — cancel + subscribe in one transaction.' },
    { signature: 'charge(planId, subscriber)',            caller: 'Anyone',    description: 'Settle one due payment.' },
    { signature: 'batchCharge(planIds[], subscribers[])', caller: 'Keeper',    description: 'Batch settle — skips individual failures without reverting.' },
    { signature: 'pay(recipient, amount)',                caller: 'Anyone',    description: 'One-time USDC payment with 3% protocol fee.' },
    { signature: 'isSubscribed(subscriber, planId)',      caller: 'Anyone',    description: 'Returns true if the wallet holds an active soulbound token.' },
    { signature: 'checkPreFlight(planId, subscriber)',    caller: 'Off-chain', description: 'Reason code: 0 = ready · 1 = not due · 2 = low balance · 3 = low allowance · 4 = inactive' },
]

/** Tailwind class strings per caller type for the badge. */
const CALLER_BADGE: Record<ContractFn['caller'], string> = {
    Merchant:    'bg-indigo-50 text-indigo-700 border border-indigo-100',
    User:        'bg-blue-50   text-blue-700   border border-blue-100',
    Anyone:      'bg-gray-100  text-gray-600   border border-gray-200',
    Keeper:      'bg-amber-50  text-amber-700  border border-amber-100',
    'Off-chain': 'bg-green-50  text-green-700  border border-green-100',
}

const EXPLORER_BASE = 'https://testnet.arcscan.app'
const explorerContractUrl = CONTRACT_ADDRESS
    ? `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`
    : EXPLORER_BASE

// ── Component ─────────────────────────────────────────────────────────────────

export function ContractReferenceSection() {
    return (
        <div className="space-y-8">

            {/* Intro */}
            <div className="space-y-2">
                <p className="text-sm text-gray-600 leading-relaxed">
                    Interact with{' '}
                    <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">
                        SubscriptionManager
                    </code>{' '}
                    directly via any Ethereum-compatible library. The contract is
                    verified on the Arc testnet explorer.
                </p>
                <a
                    href={explorerContractUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                    View on explorer →
                </a>
            </div>

            {/* Function reference table */}
            <div>
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2.5 pr-4">
                                Function
                            </th>
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2.5 pr-4 w-28">
                                Caller
                            </th>
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2.5">
                                Description
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {CONTRACT_FUNCTIONS.map(({ signature, caller, description }) => (
                            <tr key={signature} className="border-b border-gray-100 last:border-0">
                                <td className="py-3 pr-4 align-top">
                                    <code className="font-mono text-[12px] text-gray-900 whitespace-nowrap">
                                        {signature}
                                    </code>
                                </td>
                                <td className="py-3 pr-4 align-top">
                                    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${CALLER_BADGE[caller]}`}>
                                        {caller}
                                    </span>
                                </td>
                                <td className="py-3 align-top text-gray-600 text-[13px] leading-relaxed">
                                    {description}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ABI download */}
            <div className="pt-2">
                <a
                    href="/abi/SubscriptionManager.json"
                    download="SubscriptionManager.json"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                        border border-gray-200 rounded-lg text-gray-700
                        hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                    <span aria-hidden="true">↓</span>
                    Download ABI JSON
                </a>
                <p className="text-xs text-gray-400 mt-2">
                    <code className="font-mono">SubscriptionManager.json</code> — ABI only, extracted from the Foundry build artifact.
                </p>
            </div>

        </div>
    )
}
