/**
 * Composability section content — extracted from DevelopersPage.
 * Shows how any on-chain contract or frontend can verify Cyclo subscriptions.
 */
import { CodeBlock } from '../components/DocCodeBlock'
import { COMPOSABILITY_SOLIDITY_CODE } from '../constants/codeSnippets'

// ── React hook snippet ────────────────────────────────────────────────────────

const REACT_COMPOSABILITY_CODE = `\
import { useIsSubscribed } from '@cyclo/react'

function PremiumFeature({ planId }) {
  const { isSubscribed, isLoading } = useIsSubscribed(
    userAddress,
    planId
  )
  if (isLoading) return <Spinner />
  if (!isSubscribed) return <UpgradePrompt />
  return <PremiumContent />
}`

// ── Component ─────────────────────────────────────────────────────────────────

export function ComposabilitySection() {
    return (
        <div className="space-y-8">

            {/* Intro */}
            <div className="space-y-3">
                <h3 className="text-base font-semibold text-gray-900">On-chain composability</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                    Every active Cyclo subscription mints a soulbound ERC-721 to the
                    subscriber's wallet. Any smart contract on Arc can verify subscription
                    status with a single call — no API key, no Cyclo integration, no
                    off-chain dependency.
                </p>
            </div>

            {/* Solidity example */}
            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Solidity — on-chain gate
                </p>
                <CodeBlock code={COMPOSABILITY_SOLIDITY_CODE} language="solidity" />
            </div>

            {/* React hook example */}
            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    TypeScript — frontend check
                </p>
                <CodeBlock code={REACT_COMPOSABILITY_CODE} />
            </div>
        </div>
    )
}
