import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Link } from 'wouter'
import { useAnalytics } from '../hooks/useAnalytics'
import { useSocket } from '../hooks/useSocket'
import { InsightsCard } from '../components/InsightsCard'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const ONBOARDING_DISMISSED_KEY = 'cyclo_onboarding_dismissed'

interface OnboardingBannerProps {
    onDismiss: () => void
}

function OnboardingBanner({ onDismiss }: OnboardingBannerProps): JSX.Element {
    return (
        <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
            <span className="text-indigo-500">★</span>
            <p className="flex-1 text-gray-700">
                Welcome to Cyclo. Set up your first plan in 90 seconds.
            </p>
            <Link href="/onboarding">
                <a className="text-indigo-600 font-medium hover:underline whitespace-nowrap">
                    Get started →
                </a>
            </Link>
            <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 text-base leading-none"
                aria-label="Dismiss banner"
            >
                ×
            </button>
        </div>
    )
}

export function OverviewPage() {
  const { isConnected, address } = useAccount()
  const { data, isLoading } = useAnalytics()
  const { onPaymentCharged } = useSocket()

  // Live counters — incremented by socket events, never reset mid-session.
  // These are additive on top of the initial data fetch.
  const [liveChargesCount,  setLiveChargesCount]  = useState(0)
  const [liveUsdcProcessed, setLiveUsdcProcessed] = useState(0)

  const [dismissed, setDismissed] = useState(false)

  // Re-check dismissal when the wallet address resolves or changes.
  // localStorage is synchronous but address can arrive after mount.
  useEffect(() => {
    if (!address) return
    if (localStorage.getItem(ONBOARDING_DISMISSED_KEY) === address.toLowerCase()) {
      setDismissed(true)
    }
  }, [address])

  function handleDismiss(): void {
    if (!address) return
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, address.toLowerCase())
    setDismissed(true)
  }

  useEffect(() => {
    return onPaymentCharged((payload) => {
      setLiveChargesCount(c  => c  + 1)
      setLiveUsdcProcessed(u => u + parseFloat(payload.amount))
    })
  }, [onPaymentCharged])

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⬡</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Cyclo</h1>
        <p className="text-gray-500 text-sm mb-6">
          On-chain recurring USDC billing on Arc testnet. Connect your wallet to get started.
        </p>
        <Link href="/connect">
          <a className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700">
            Connect wallet
          </a>
        </Link>
      </div>
    )
  }

  // Patch Total Revenue with the live socket delta.
  // After the 30-second React Query refetch the fetched total naturally catches up,
  // at which point liveUsdcProcessed can be thought of as "in-flight" additional
  // charges that arrived between fetches.
  const displayedTotalRevenue = (data?.totalRevenue ?? 0) + liveUsdcProcessed

  const kpis = [
    {
      label: 'Monthly Recurring Revenue',
      value: isLoading ? '—' : fmt(data?.mrr ?? 0),
      sub:   'from active subscriptions',
    },
    {
      label: 'Total Revenue',
      value: isLoading ? '—' : fmt(displayedTotalRevenue),
      sub:   'all time',
    },
    {
      label: 'Active Subscribers',
      value: isLoading ? '—' : String(data?.activeSubscribers ?? 0),
      sub:   'across all plans',
    },
    {
      label: 'Charges Today',
      // Counter starts from what arrives live after page load.
      // The initial historical count is included in Total Revenue above.
      value: String(liveChargesCount),
      sub:   'received since page load',
      live:  true,
    },
  ]

  return (
    <div className="max-w-4xl space-y-8">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/plans">
          <a className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Create plan
          </a>
        </Link>
      </div>

      {/* Onboarding entry banner — shown only to new merchants with zero plans */}
      {isConnected && !!address && !isLoading && data !== undefined && data.plans.length === 0 && !dismissed && (
        <OnboardingBanner onDismiss={handleDismiss} />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, live }) => (
          <div
            key={label}
            className={`bg-white border rounded-2xl p-5 ${live ? 'border-indigo-200 bg-indigo-50/40' : ''}`}
          >
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold mt-2 ${live ? 'text-indigo-600' : 'text-gray-900'}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <InsightsCard />

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Quick actions</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              href:  '/plans',
              icon:  '☰',
              label: 'Create a plan',
              desc:  'Set price, interval, and trial period',
            },
            {
              href:  '/subscribers',
              icon:  '◎',
              label: 'Add a subscriber',
              desc:  'Subscribe a wallet to an existing plan',
            },
            {
              href:  '/webhooks',
              icon:  '⊹',
              label: 'Add a webhook',
              desc:  'Get notified when payments are charged',
            },
          ].map(({ href, icon, label, desc }) => (
            <Link key={href} href={href}>
              <a className="bg-white border rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all block">
                <span className="text-xl">{icon}</span>
                <p className="font-medium text-gray-900 text-sm mt-2">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </a>
            </Link>
          ))}
        </div>
      </div>

      {/* Plan breakdown */}
      {(data?.plans.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Plans</h2>
            <Link href="/plans">
              <a className="text-xs text-indigo-600 hover:underline">View all →</a>
            </Link>
          </div>
          <div className="bg-white border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Plan', 'Price', 'Subscribers', 'MRR'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data!.plans.map(p => (
                  <tr key={p.planId.toString()} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">Plan {p.planId.toString()}</td>
                    <td className="px-5 py-3 text-gray-600">{fmt(p.price)}</td>
                    <td className="px-5 py-3 text-gray-600">{p.activeSubscribers}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{fmt(p.mrr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
