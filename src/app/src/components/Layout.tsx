import { Link, useRoute } from 'wouter'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useState, useEffect } from 'react'
import { useMerchantProfile } from '../context/MerchantProfileContext'
import { ProfileSetupModal } from './ProfileSetupModal'
import { AIChatPanel } from './AIChatPanel'
import { SocketStatusIndicator } from './SocketStatusIndicator'
import { arcTestnet } from '../wagmi'

const nav = [
  { path: '/',            label: 'Overview',    icon: '▦' },
  { path: '/plans',       label: 'Plans',       icon: '☰' },
  { path: '/subscribers', label: 'Subscribers', icon: '◎' },
  { path: '/settlements', label: 'Settlements', icon: '⇅' },
  { path: '/analytics',   label: 'Analytics',   icon: '∿' },
  { path: '/webhooks',    label: 'Webhooks',    icon: '⊹' },
  { path: '/developers',  label: 'Developers',  icon: '⌥' },
]

function NavItem({ path, label, icon }: { path: string; label: string; icon: string }) {
  const [active] = useRoute(path === '/' ? path : `${path}*`)
  return (
    <Link href={path}>
      <a className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
      }`}>
        <span className="text-base w-5 text-center">{icon}</span>
        {label}
      </a>
    </Link>
  )
}

function WrongNetworkBanner() {
  const { switchChain, isPending } = useSwitchChain()
  return (
    <div className="flex items-center gap-4 px-8 py-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">
      <span className="flex-1">
        Wrong network — please switch to <strong>Arc Testnet</strong> (chain ID {arcTestnet.id}).
      </span>
      <button
        onClick={() => switchChain({ chainId: arcTestnet.id })}
        disabled={isPending}
        className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 disabled:opacity-60"
      >
        {isPending ? 'Switching…' : 'Switch network'}
      </button>
    </div>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const onCorrectChain = !isConnected || chainId === arcTestnet.id
  const { profile } = useMerchantProfile()
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const [showAI, setShowAI] = useState(false)

  useEffect(() => {
    if (isConnected && address && profile === null) {
      const t = setTimeout(() => setShowProfileSetup(true), 1000)
      return () => clearTimeout(t)
    }
    if (profile) setShowProfileSetup(false)
  }, [isConnected, address, profile])

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {showProfileSetup && (
        <ProfileSetupModal onComplete={() => setShowProfileSetup(false)} />
      )}

      {/* Sidebar */}
      <aside className="w-56 bg-white border-r flex-shrink-0 flex flex-col fixed h-full">

        {/* Logo */}
        <div className="px-4 py-5 border-b">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <span className="font-semibold text-gray-900">Cyclo</span>
          </div>
          {profile && (
            <p className="text-xs text-gray-400 mt-1 truncate">{profile.business_name}</p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {nav.map(item => (
            <NavItem key={item.path} {...item} />
          ))}
        </nav>

        {/* Footer links */}
        <div className="px-2 pb-2">
          <Link href="/onboarding">
            <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors">
              <span className="text-base w-5 text-center">✎</span>
              Setup guide
            </a>
          </Link>
          <a
            href="/stats"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span className="text-base w-5 text-center">⊞</span>
            Public stats
          </a>
        </div>

        {/* Wallet */}
        <div className="px-4 py-4 border-t">
          {isConnected ? (
            <div>
              <p className="text-xs text-gray-400">Connected</p>
              <p className="text-xs font-mono text-gray-600 truncate mt-0.5">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
          ) : (
            <Link href="/connect">
              <a className="text-sm text-indigo-600 font-medium hover:underline">
                Connect wallet →
              </a>
            </Link>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 min-h-screen">

        {/* Top bar */}
        <header className="bg-white border-b px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div />
          <div className="flex items-center gap-3">
            <SocketStatusIndicator />
            <a href="/docs" className="text-sm text-gray-500 hover:text-gray-900">
              Docs
            </a>
            <a href="/demo" className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
              Live demo
            </a>
          </div>
        </header>

        {isConnected && !onCorrectChain && <WrongNetworkBanner />}

        <div className="px-8 py-8">
          {children}
        </div>
      </main>

      {showAI && <AIChatPanel onClose={() => setShowAI(false)} />}
      <button
        onClick={() => setShowAI(v => !v)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 flex items-center justify-center text-xl z-40"
        title="Cyclo AI"
      >
        ✦
      </button>
    </div>
  )
}
