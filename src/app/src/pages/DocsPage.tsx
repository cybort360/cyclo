/**
 * /docs — public-facing integration documentation.
 * Two-column layout: sticky sidebar + scrollable content.
 * Mobile: sidebar collapses to a horizontal pill strip.
 *
 * Class prefix: dp-
 */
import { useState } from 'react'
import { Link } from 'wouter'
import Logo from '../components/Logo'
import './DocsPage.css'

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? '0x...'
const USDC_ADDRESS     = import.meta.env.VITE_USDC_ADDRESS     ?? '0x...'
const RPC_URL          = 'https://rpc.arc-testnet.canteen.xyz'

const NAV_ITEMS = [
    { id: 'overview',    label: 'Overview'          },
    { id: 'hosted-link', label: 'Hosted link'        },
    { id: 'widget',      label: 'Widget (script tag)' },
    { id: 'react',       label: 'React component'    },
    { id: 'sdk',         label: 'SDK'                },
    { id: 'webhooks',    label: 'Webhooks'           },
]

// ── CodeBlock ─────────────────────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
    const [copied, setCopied] = useState(false)

    function copy(): void {
        void navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2_000)
    }

    return (
        <div className="dp-code-wrap">
            <pre className="dp-code-pre">{code}</pre>
            <button
                onClick={copy}
                className={`dp-code-copy${copied ? ' dp-code-copy--copied' : ''}`}
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
        </div>
    )
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    return (
        <section id={id} className="dp-section">
            <h2 className="dp-section-title">{title}</h2>
            {children}
        </section>
    )
}

// ── Step ──────────────────────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <div className="dp-step">
            <div className="dp-step-badge" aria-hidden="true">{n}</div>
            <div className="dp-step-body">
                <p className="dp-step-title">{title}</p>
                {children}
            </div>
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DocsPage() {
    return (
        <div className="dp-root">

            {/* ── Top nav ───────────────────────────────────────────────── */}
            <nav className="dp-nav">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <Link href="/">
                        <a className="dp-nav-brand" aria-label="Cyclo home">
                            <Logo size={22} wordmarkSize={13} />
                        </a>
                    </Link>
                    <span className="dp-nav-sep" aria-hidden="true">/</span>
                    <span className="dp-nav-section">Docs</span>
                </div>

                <div className="dp-nav-links">
                    <a href="/arc-economics" className="dp-nav-link">Arc economics</a>
                    <a href="/demo" className="dp-nav-cta">See live demo →</a>
                </div>
            </nav>

            <div className="dp-body">

                {/* ── Sidebar ───────────────────────────────────────────── */}
                <aside className="dp-sidebar" aria-label="Documentation sections">
                    <p className="dp-sidebar-heading">Integration</p>
                    <ul className="dp-sidebar-list">
                        {NAV_ITEMS.map(item => (
                            <li key={item.id}>
                                <a href={`#${item.id}`} className="dp-sidebar-link">
                                    {item.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </aside>

                {/* ── Main content ──────────────────────────────────────── */}
                <main className="dp-main">

                    <Section id="overview" title="Overview">
                        <p className="dp-p">
                            Cyclo is an on-chain recurring billing protocol on Arc testnet. Merchants create
                            subscription plans. Subscribers approve USDC once. A keeper bot charges on-chain
                            automatically every interval.
                        </p>
                        <p className="dp-p">
                            There are four ways to add Cyclo to your product. Pick the one that fits your stack.
                        </p>
                        <div className="dp-overview-grid">
                            {[
                                { label: 'Hosted link',     desc: 'Zero code. Share a URL.'           },
                                { label: 'Script tag',      desc: 'One line. Any webpage.'            },
                                { label: 'React component', desc: 'npm install. Full control.'        },
                                { label: 'SDK',             desc: 'Framework-agnostic. Build anything.' },
                            ].map(({ label, desc }) => (
                                <div key={label} className="dp-overview-card">
                                    <p className="dp-overview-card-title">{label}</p>
                                    <p className="dp-overview-card-desc">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </Section>

                    <Section id="hosted-link" title="Option 1 — Hosted link">
                        <p className="dp-p">
                            Every plan gets a shareable checkout URL. Drop it in an email, a landing page,
                            or a Notion doc. No installation required.
                        </p>
                        <Step n={1} title="Create a plan in the dashboard">
                            <p className="dp-p-sm">
                                Go to Create Plan, set your price and interval. Note the Plan ID returned.
                            </p>
                        </Step>
                        <Step n={2} title="Share the link">
                            <CodeBlock code={`https://your-cyclo-app.com/subscribe/{planId}`} />
                            <p className="dp-p-sm">
                                The page handles wallet connect, USDC approval, and subscription in one flow.
                            </p>
                        </Step>
                    </Section>

                    <Section id="widget" title="Option 2 — Widget (script tag)">
                        <p className="dp-p">
                            Drop the Cyclo widget into any webpage with a single script tag. Works with
                            plain HTML, Vue, Svelte, or any framework.
                        </p>
                        <Step n={1} title="Add the script tag">
                            <CodeBlock code={`<script src="https://unpkg.com/cyclo-widget/dist/cyclo-widget.iife.js"></script>`} />
                        </Step>
                        <Step n={2} title="Add a mount target">
                            <CodeBlock code={`<div id="cyclo-checkout"></div>`} />
                        </Step>
                        <Step n={3} title="Mount the widget">
                            <CodeBlock code={
`<script>
  CycloWidget.mount('#cyclo-checkout', {
    planId: 1,
    contractAddress: '${CONTRACT_ADDRESS}',
    usdcAddress: '${USDC_ADDRESS}',
    rpcUrl: '${RPC_URL}',
  })
</script>`
                            } />
                        </Step>
                    </Section>

                    <Section id="react" title="Option 3 — React component">
                        <p className="dp-p">
                            Install the React package and drop the checkout into any pricing page or modal.
                            Bring your own wagmi setup or use the built-in provider.
                        </p>
                        <Step n={1} title="Install">
                            <CodeBlock code={`npm install @cyclo/react`} />
                        </Step>
                        <Step n={2} title="Wrap your app with CycloProvider">
                            <CodeBlock code={
`import { CycloProvider } from '@cyclo/react'

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <CycloProvider
          contractAddress="${CONTRACT_ADDRESS}"
          usdcAddress="${USDC_ADDRESS}"
        >
          <YourApp />
        </CycloProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}`
                            } />
                        </Step>
                        <Step n={3} title="Use the checkout component">
                            <CodeBlock code={
`import { CycloCheckout } from '@cyclo/react'

export function PricingPage() {
  return (
    <div>
      <h2>Pro Plan — $5.99/mo</h2>
      <CycloCheckout planId={1n} />
    </div>
  )
}`
                            } />
                        </Step>
                    </Section>

                    <Section id="sdk" title="Option 4 — SDK">
                        <p className="dp-p">
                            Use the SDK directly when you want full control over the UI or need to integrate
                            from a Vue, Svelte, or Node.js environment.
                        </p>
                        <Step n={1} title="Install">
                            <CodeBlock code={`npm install @cyclo/sdk viem`} />
                        </Step>
                        <Step n={2} title="Create a client">
                            <CodeBlock code={
`import { CycloClient } from '@cyclo/sdk'
import { createPublicClient, createWalletClient, http, custom } from 'viem'

const publicClient = createPublicClient({
  transport: http('${RPC_URL}'),
})

const walletClient = createWalletClient({
  transport: custom(window.ethereum),
})

const cyclo = new CycloClient({
  contractAddress: '${CONTRACT_ADDRESS}',
  usdcAddress: '${USDC_ADDRESS}',
  publicClient,
  walletClient,
})`
                            } />
                        </Step>
                        <Step n={3} title="Create a plan">
                            <CodeBlock code={
`const planId = await cyclo.createPlan({
  price: 5.99,
  intervalDays: 30,
  trialDays: 7,       // optional
})

const link = cyclo.getSubscribeLink(planId, 'https://myapp.com')
console.log(link)  // https://myapp.com/subscribe/1`
                            } />
                        </Step>
                        <Step n={4} title="Subscribe a user">
                            <CodeBlock code={
`// Handles USDC approval automatically
await cyclo.subscribe(planId)

// Cancel
await cyclo.cancelSubscription(planId)

// Migrate to a different plan
await cyclo.migratePlan(oldPlanId, newPlanId)`
                            } />
                        </Step>
                        <Step n={5} title="Listen for payments">
                            <CodeBlock code={
`const unsubscribe = cyclo.on('PaymentCharged', ({ subscriber, planId, amount }) => {
  console.log(\`Charged \${subscriber} for plan \${planId}\`)
  // unlock features, send receipt, update your DB
})

// Clean up
unsubscribe()`
                            } />
                        </Step>
                    </Section>

                    <Section id="webhooks" title="Webhooks">
                        <p className="dp-p">
                            Register an HTTPS endpoint to receive Cyclo events in your backend.
                            All requests are signed with HMAC-SHA256 so you can verify they came from Cyclo.
                        </p>
                        <Step n={1} title="Register an endpoint">
                            <CodeBlock code={`tsx webhook/register.ts add "*" https://myapp.com/webhooks/cyclo --secret mysecret`} />
                        </Step>
                        <Step n={2} title="Verify the signature">
                            <CodeBlock code={
`import crypto from 'crypto'

function verify(payload: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}`
                            } />
                        </Step>
                        <Step n={3} title="Handle events">
                            <CodeBlock code={
`// Event types
// plan.created | plan.deactivated | plan.migrated
// subscription.created | subscription.cancelled
// payment.charged

app.post('/webhooks/cyclo', (req, res) => {
  const sig = req.headers['x-cyclo-signature'] as string
  if (!verify(req.rawBody, sig, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).end()
  }

  const { type, data } = req.body

  if (type === 'payment.charged') {
    const { subscriber, planId, amount } = data
    await unlockFeatures(subscriber)
    await sendReceipt(subscriber, amount)
  }

  res.status(200).end()
})`
                            } />
                        </Step>
                    </Section>

                </main>
            </div>
        </div>
    )
}
