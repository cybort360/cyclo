import { useState } from 'react'
import { WebhooksTab } from '../components/WebhooksTab'

const FRAMEWORKS = ['Express.js', 'Next.js', 'Fastify', 'Hono', 'Flask', 'Django', 'Laravel']

export function WebhooksPage() {
  const [showCodeGen, setShowCodeGen] = useState(false)
  const [codeDesc, setCodeDesc] = useState('')
  const [framework, setFramework] = useState('Express.js')
  const [generatedCode, setGeneratedCode] = useState('')
  const [generating, setGenerating] = useState(false)

  const generateCode = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/webhook-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: codeDesc, framework }),
      })
      const data = await res.json() as { code: string }
      setGeneratedCode(data.code)
    } finally {
      setGenerating(false)
    }
  }

  const generateButton = (
    <button
      onClick={() => setShowCodeGen(true)}
      className="border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50"
    >
      ✦ Generate handler
    </button>
  )

  return (
    <div className="max-w-4xl">
      <WebhooksTab actions={generateButton} />

      {showCodeGen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Generate webhook handler</h3>
              <button
                onClick={() => { setShowCodeGen(false); setGeneratedCode('') }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {!generatedCode ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    What should the handler do?
                  </label>
                  <textarea
                    value={codeDesc}
                    onChange={e => setCodeDesc(e.target.value)}
                    placeholder='e.g. "Unlock Pro features when payment.charged fires, revoke access on subscription.cancelled"'
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Framework</label>
                  <select
                    value={framework}
                    onChange={e => setFramework(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    {FRAMEWORKS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <button
                  onClick={generateCode}
                  disabled={generating || !codeDesc.trim()}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                >
                  {generating ? 'Generating...' : '✦ Generate code'}
                </button>
              </>
            ) : (
              <>
                <pre className="bg-gray-950 text-gray-100 text-xs p-4 rounded-xl overflow-x-auto max-h-96">
                  <code>{generatedCode}</code>
                </pre>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedCode)}
                    className="flex-1 border rounded-xl py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    Copy code
                  </button>
                  <button
                    onClick={() => setGeneratedCode('')}
                    className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-indigo-700"
                  >
                    Regenerate
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
