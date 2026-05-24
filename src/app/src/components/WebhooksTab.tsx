import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useWebhooks } from '../hooks/useWebhooks'
import { EmptyState } from './EmptyState'
import { IconWebhook } from '@tabler/icons-react'

const EVENT_TYPES = [
  'payment.charged',
  'subscription.created',
  'subscription.cancelled',
  'plan.created',
  'plan.deactivated',
  'plan.migrated',
]

interface WebhooksTabProps {
  actions?: React.ReactNode
}

export function WebhooksTab({ actions }: WebhooksTabProps) {
  const { address } = useAccount()
  const { webhooks, loading, addWebhook, removeWebhook } = useWebhooks()

  const [showForm, setShowForm] = useState(false)
  const [planId, setPlanId] = useState('*')
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)

  if (!address) {
    return <p className="text-gray-500 mt-8">Connect your wallet to manage webhooks.</p>
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await addWebhook(planId, url, secret)
      setShowForm(false)
      setUrl('')
      setSecret('')
      setPlanId('*')
    } catch (err) {
      setError(String(err))
    }
  }

  const handleRemove = async (id: string) => {
    setRemoving(id)
    try {
      await removeWebhook(id)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="space-y-6 mt-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Webhooks</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Receive real-time events in your backend when subscriptions are charged, created, or cancelled.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <button
            onClick={() => setShowForm(v => !v)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            {showForm ? 'Cancel' : '+ Add endpoint'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="border rounded-xl p-5 bg-gray-50 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endpoint URL
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://myapp.com/webhooks/cyclo"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Signing secret
              </label>
              <input
                type="text"
                required
                value={secret}
                onChange={e => setSecret(e.target.value)}
                placeholder="whsec_..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan filter
            </label>
            <select
              value={planId}
              onChange={e => setPlanId(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="*">All plans</option>
              <option value="1">Plan 1</option>
              <option value="2">Plan 2</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              "All plans" sends every event regardless of plan ID.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Events delivered</p>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map(e => (
                <span
                  key={e}
                  className="text-xs bg-white border px-2 py-1 rounded-md font-mono text-gray-600"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Waiting for signature...' : 'Add endpoint'}
          </button>
        </form>
      )}

      {/* Empty state — shown when no webhooks exist and the form is not yet open */}
      {webhooks.length === 0 && !showForm && (
        <EmptyState
          icon={IconWebhook}
          heading="No webhooks registered"
          subtext="Register an endpoint to receive real-time notifications when subscriptions are created, cancelled, or payments are settled."
          action={{ label: 'Register a webhook', onClick: () => setShowForm(true) }}
        />
      )}

      {webhooks.length > 0 && (
        <div className="border rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Endpoint', 'Plan', 'Status', 'Added', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {webhooks.map(w => (
                <tr key={w.id}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 max-w-xs truncate">
                    {w.url}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {w.plan_id === '*' ? 'All plans' : `Plan ${w.plan_id}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                      w.active
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${w.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {w.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(w.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(w.id)}
                      disabled={removing === w.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                    >
                      {removing === w.id ? 'Removing...' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Docs callout */}
      <div className="bg-gray-50 border rounded-xl p-4 flex items-start gap-3">
        <span className="text-lg">📖</span>
        <div>
          <p className="text-sm font-medium text-gray-700">Verifying webhook signatures</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Every request includes an <span className="font-mono text-xs bg-white border px-1 py-0.5 rounded">X-Cyclo-Signature</span> header.
            See the <a href="/docs#webhooks" className="text-indigo-600 hover:underline">docs</a> for verification code.
          </p>
        </div>
      </div>

    </div>
  )
}
