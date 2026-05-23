/**
 * /demo — fictional SaaS landing page that embeds the Cyclo widget inline in the
 * pricing section. "Start 7-day free trial" reveals the checkout card in place.
 */
import { useState } from 'react'
import { CycloCheckout } from '../widget/Widget'
import { CONTRACT_ADDRESS, USDC_ADDRESS } from '../constants/addresses'

const DEMO_PLAN_ID = 1n

const features = [
    { icon: '⚡', title: 'Instant deploys',       description: 'Push to main and your app is live in seconds. Zero config.' },
    { icon: '📊', title: 'Real-time analytics',   description: 'See every request, error, and latency spike as it happens.' },
    { icon: '🔒', title: 'Built-in security',     description: 'DDoS protection, WAF, and SSL certificates included.' },
    { icon: '🌍', title: 'Global edge network',   description: 'Served from 47 regions. Sub-100ms response times worldwide.' },
]

const hobbyFeatures   = ['3 projects', '10k requests/month', 'Community support']
const proFeatures     = ['Unlimited projects', '1M requests/month', 'Priority support', 'Custom domains']
const enterpriseFeatures = ['Everything in Pro', 'SLA guarantee', 'Dedicated support', 'SSO + audit logs']

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <a href={href} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>
            {children}
        </a>
    )
}

function PlanCard({
    name, price, sub, features, highlight, cta, onCta,
}: {
    name: string; price: string; sub: string; features: string[];
    highlight?: boolean; cta: string; onCta?: () => void;
}) {
    return (
        <div style={{
            background: '#fff',
            border:     highlight ? '2px solid #4f46e5' : '1px solid #e5e7eb',
            borderRadius: '16px',
            padding:    '24px',
            boxShadow:  highlight ? '0 4px 24px rgba(79,70,229,0.12)' : 'none',
            position:   'relative',
        }}>
            {highlight && (
                <span style={{
                    position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                    background: '#4f46e5', color: '#fff', fontSize: '11px',
                    padding: '3px 12px', borderRadius: '999px',
                }}>
                    Most popular
                </span>
            )}
            <p style={{ fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>{name}</p>
            <p style={{ fontSize: '30px', fontWeight: 700, margin: '0 0 4px' }}>{price}</p>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 20px' }}>{sub}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {features.map(f => (
                    <li key={f} style={{ fontSize: '14px', color: '#374151' }}>✓ {f}</li>
                ))}
            </ul>
            {onCta ? (
                <button
                    onClick={onCta}
                    style={{
                        width: '100%', padding: '10px', borderRadius: '10px', fontWeight: 500,
                        fontSize: '14px', cursor: 'pointer', border: 'none',
                        background: '#4f46e5', color: '#fff',
                    }}
                >
                    {cta}
                </button>
            ) : (
                <button style={{
                    width: '100%', padding: '10px', borderRadius: '10px', fontWeight: 500,
                    fontSize: '14px', cursor: 'pointer', background: 'none',
                    border: '1px solid #e5e7eb', color: '#374151',
                }}>
                    {cta}
                </button>
            )}
        </div>
    )
}

export function DemoPage() {
    const [billingOpen, setBillingOpen] = useState(false)

    return (
        <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

            {/* Nav */}
            <nav style={{
                borderBottom: '1px solid #e5e7eb', padding: '16px 32px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 28, height: 28, background: '#4f46e5', borderRadius: 6 }} />
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: '18px' }}>Flowboard</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <NavLink href="#features">Features</NavLink>
                    <NavLink href="#pricing">Pricing</NavLink>
                    <NavLink href="#">Docs</NavLink>
                    <a href="/dashboard" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>← Back to app</a>
                    <button style={{
                        background: '#4f46e5', color: '#fff', padding: '6px 16px',
                        borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px',
                    }}>
                        Sign in
                    </button>
                </div>
            </nav>

            {/* Hero */}
            <section style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: '96px 24px 64px' }}>
                <span style={{
                    display: 'inline-block', background: '#eef2ff', color: '#4f46e5',
                    fontSize: '12px', fontWeight: 500, padding: '4px 12px',
                    borderRadius: '999px', marginBottom: '16px',
                }}>
                    Now in public beta
                </span>
                <h1 style={{ fontSize: '48px', fontWeight: 700, color: '#111827', lineHeight: 1.15, margin: '0 0 20px' }}>
                    Ship faster.<br />Scale further.
                </h1>
                <p style={{ fontSize: '20px', color: '#6b7280', margin: '0 auto 32px', maxWidth: 480 }}>
                    Flowboard gives your team the deployment infrastructure used by the world's fastest-growing startups.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                    <button
                        onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                        style={{
                            background: '#4f46e5', color: '#fff', padding: '12px 24px',
                            borderRadius: '12px', border: 'none', fontWeight: 500, cursor: 'pointer', fontSize: '15px',
                        }}
                    >
                        Start free trial
                    </button>
                    <button style={{
                        padding: '12px 24px', borderRadius: '12px',
                        border: '1px solid #e5e7eb', background: 'none',
                        fontWeight: 500, cursor: 'pointer', fontSize: '15px', color: '#374151',
                    }}>
                        View demo
                    </button>
                </div>
            </section>

            {/* Features */}
            <section id="features" style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 96px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {features.map(f => (
                        <div key={f.title} style={{
                            border: '1px solid #e5e7eb', borderRadius: '16px',
                            padding: '24px',
                        }}>
                            <div style={{ fontSize: '24px', marginBottom: '12px' }}>{f.icon}</div>
                            <h3 style={{ fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>{f.title}</h3>
                            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>{f.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" style={{ background: '#f9fafb', padding: '80px 24px' }}>
                <div style={{ maxWidth: 900, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                        <h2 style={{ fontSize: '30px', fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>
                            Simple, transparent pricing
                        </h2>
                        <p style={{ color: '#6b7280', margin: 0 }}>No seat fees. No surprise bills. Cancel any time.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', alignItems: 'start' }}>
                        <PlanCard
                            name="Hobby" price="$0" sub="Forever free"
                            features={hobbyFeatures} cta="Get started"
                        />

                        {/* Pro — Cyclo widget embedded here */}
                        <div style={{
                            background: '#fff',
                            border: '2px solid #4f46e5',
                            borderRadius: '16px',
                            padding: '24px',
                            boxShadow: '0 4px 24px rgba(79,70,229,0.12)',
                            position: 'relative',
                        }}>
                            <span style={{
                                position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                                background: '#4f46e5', color: '#fff', fontSize: '11px',
                                padding: '3px 12px', borderRadius: '999px',
                            }}>
                                Most popular
                            </span>
                            <p style={{ fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>Pro</p>
                            <p style={{ fontSize: '30px', fontWeight: 700, margin: '0 0 4px' }}>$5.99</p>
                            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 20px' }}>per month, billed on-chain</p>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {proFeatures.map(f => (
                                    <li key={f} style={{ fontSize: '14px', color: '#374151' }}>✓ {f}</li>
                                ))}
                            </ul>
                            {!billingOpen ? (
                                <button
                                    onClick={() => setBillingOpen(true)}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: '10px',
                                        fontWeight: 500, fontSize: '14px', cursor: 'pointer',
                                        border: 'none', background: '#4f46e5', color: '#fff',
                                    }}
                                >
                                    Start 7-day free trial
                                </button>
                            ) : (
                                <div style={{ marginTop: '8px' }}>
                                    <CycloCheckout
                                        planId={DEMO_PLAN_ID}
                                        contractAddress={CONTRACT_ADDRESS}
                                        usdcAddress={USDC_ADDRESS}
                                        rpcUrl="/rpc"
                                    />
                                </div>
                            )}
                        </div>

                        <PlanCard
                            name="Enterprise" price="Custom" sub="Contact us"
                            features={enterpriseFeatures} cta="Talk to sales"
                        />
                    </div>

                    {/* Powered by badge */}
                    <div style={{ textAlign: 'center', marginTop: '40px' }}>
                        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                            Payments powered by{' '}
                            <a
                                href="/"
                                style={{ fontWeight: 500, color: '#818cf8', textDecoration: 'none' }}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Cyclo
                            </a>
                            {' '}— on-chain recurring billing on Arc testnet
                        </p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer style={{
                borderTop: '1px solid #e5e7eb', padding: '24px 32px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '14px', color: '#9ca3af',
            }}>
                <span>© 2026 Flowboard, Inc.</span>
                <div style={{ display: 'flex', gap: '24px' }}>
                    {['Privacy', 'Terms', 'Status'].map(l => (
                        <a key={l} href="#" style={{ color: '#9ca3af', textDecoration: 'none' }}>{l}</a>
                    ))}
                </div>
            </footer>
        </div>
    )
}
