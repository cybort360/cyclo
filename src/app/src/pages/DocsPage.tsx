import { useState } from 'react'
import { Link } from 'wouter'

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? '0x...'
const USDC_ADDRESS     = import.meta.env.VITE_USDC_ADDRESS     ?? '0x...'
const RPC_URL          = 'https://rpc.arc-testnet.canteen.xyz'

const NAV_ITEMS = [
    { id: 'overview',    label: 'Overview' },
    { id: 'hosted-link', label: 'Hosted link' },
    { id: 'widget',      label: 'Widget (script tag)' },
    { id: 'react',       label: 'React component' },
    { id: 'sdk',         label: 'SDK' },
    { id: 'webhooks',    label: 'Webhooks' },
]

function CodeBlock({ code }: { code: string }) {
    const [copied,  setCopied]  = useState(false)
    const [hovered, setHovered] = useState(false)

    function copy() {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div
            style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', margin: '16px 0' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <pre style={{
                background: '#030712', color: '#f3f4f6', fontSize: '13px',
                padding: '20px', overflowX: 'auto', lineHeight: 1.65, margin: 0,
            }}>
                <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{code}</code>
            </pre>
            <button
                onClick={copy}
                style={{
                    position: 'absolute', top: '12px', right: '12px',
                    fontSize: '11px', background: '#1f2937', color: '#d1d5db',
                    padding: '4px 12px', borderRadius: '6px', border: 'none',
                    cursor: 'pointer', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
                }}
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
        </div>
    )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    return (
        <section id={id} style={{ marginBottom: '64px', scrollMarginTop: '96px' }}>
            <h2 style={{
                fontSize: '18px', fontWeight: 600, color: '#111827', marginTop: 0,
                marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb',
            }}>
                {title}
            </h2>
            {children}
        </section>
    )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
            <div style={{
                flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
                background: '#4f46e5', color: '#fff', fontSize: '11px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px',
            }}>
                {n}
            </div>
            <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 500, color: '#111827', margin: '0 0 8px' }}>{title}</p>
                {children}
            </div>
        </div>
    )
}

export function DocsPage() {
    return (
        <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

            {/* Top nav */}
            <nav style={{
                borderBottom: '1px solid #e5e7eb', padding: '16px 32px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'sticky', top: 0, background: '#fff', zIndex: 10,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                        <div style={{ width: '24px', height: '24px', background: '#4f46e5', borderRadius: '6px' }} />
                        <span style={{ fontWeight: 600, color: '#111827', fontSize: '15px' }}>Cyclo</span>
                    </Link>
                    <span style={{ color: '#d1d5db' }}>/</span>
                    <span style={{ color: '#6b7280', fontSize: '14px' }}>Docs</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <a href="/arc-economics" style={{ fontSize: '14px', color: '#6b7280', textDecoration: 'none' }}>
                        Arc economics
                    </a>
                    <a href="/demo" style={{ fontSize: '14px', color: '#4f46e5', textDecoration: 'none', fontWeight: 500 }}>
                        See live demo →
                    </a>
                </div>
            </nav>

            <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px', display: 'flex', gap: '48px' }}>

                {/* Sidebar */}
                <aside style={{ width: '192px', flexShrink: 0, position: 'sticky', top: '96px', alignSelf: 'flex-start' }}>
                    <p style={{
                        fontSize: '11px', fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        margin: '0 0 12px',
                    }}>
                        Integration
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {NAV_ITEMS.map(item => (
                            <li key={item.id}>
                                <a
                                    href={`#${item.id}`}
                                    style={{ fontSize: '14px', color: '#6b7280', textDecoration: 'none', display: 'block', padding: '4px 0' }}
                                >
                                    {item.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </aside>

                {/* Main content */}
                <main style={{ flex: 1, minWidth: 0 }}>

                    <Section id="overview" title="Overview">
                        <p style={{ color: '#4b5563', lineHeight: 1.7, margin: '0 0 16px' }}>
                            Cyclo is an on-chain recurring billing protocol on Arc testnet. Merchants create
                            subscription plans. Subscribers approve USDC once. A keeper bot charges on-chain
                            automatically every interval.
                        </p>
                        <p style={{ color: '#4b5563', lineHeight: 1.7, margin: '0 0 24px' }}>
                            There are four ways to add Cyclo to your product. Pick the one that fits your stack.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {[
                                { label: 'Hosted link',      desc: 'Zero code. Share a URL.' },
                                { label: 'Script tag',       desc: 'One line. Any webpage.' },
                                { label: 'React component',  desc: 'npm install. Full control.' },
                                { label: 'SDK',              desc: 'Framework-agnostic. Build anything.' },
                            ].map(({ label, desc }) => (
                                <div key={label} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
                                    <p style={{ fontWeight: 500, color: '#111827', fontSize: '14px', margin: '0 0 4px' }}>{label}</p>
                                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{desc}</p>
                                </div>
                            ))}
                        </div>
                    </Section>

                    <Section id="hosted-link" title="Option 1 — Hosted link">
                        <p style={{ color: '#4b5563', lineHeight: 1.7, margin: '0 0 24px' }}>
                            Every plan gets a shareable checkout URL. Drop it in an email, a landing page,
                            or a Notion doc. No installation required.
                        </p>
                        <Step n={1} title="Create a plan in the dashboard">
                            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                                Go to Create Plan, set your price and interval. Note the Plan ID returned.
                            </p>
                        </Step>
                        <Step n={2} title="Share the link">
                            <CodeBlock code={`https://your-cyclo-app.com/subscribe/{planId}`} />
                            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                                The page handles wallet connect, USDC approval, and subscription in one flow.
                            </p>
                        </Step>
                    </Section>

                    <Section id="widget" title="Option 2 — Widget (script tag)">
                        <p style={{ color: '#4b5563', lineHeight: 1.7, margin: '0 0 24px' }}>
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
                        <p style={{ color: '#4b5563', lineHeight: 1.7, margin: '0 0 24px' }}>
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
                        <p style={{ color: '#4b5563', lineHeight: 1.7, margin: '0 0 24px' }}>
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
                        <p style={{ color: '#4b5563', lineHeight: 1.7, margin: '0 0 24px' }}>
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
