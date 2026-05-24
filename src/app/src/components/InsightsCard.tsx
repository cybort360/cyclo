import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'

export function InsightsCard() {
  const { address } = useAccount()
  const [insights, setInsights] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) return
    setLoading(true)
    fetch('/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address }),
    })
      .then(r => r.json())
      .then((d: { insights?: string[] }) => setInsights(d.insights ?? []))
      .finally(() => setLoading(false))
  }, [address])

  if (!address || (!loading && insights.length === 0)) return null

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-indigo-600">✦</span>
        <p className="text-sm font-semibold text-indigo-900">AI Insights</p>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-4 bg-indigo-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-indigo-800">
              <span className="mt-0.5 text-indigo-400">•</span>
              {insight}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
