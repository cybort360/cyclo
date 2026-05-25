import { createContext, useContext, useRef, useEffect, type ReactNode } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { CycloClient } from '@cyclo/sdk'

const CycloContext = createContext<CycloClient | null>(null)

interface CycloProviderProps {
  contractAddress: `0x${string}`
  usdcAddress: `0x${string}`
  children: ReactNode
}

export function CycloProvider({ contractAddress, usdcAddress, children }: CycloProviderProps) {
  const publicClient = usePublicClient()
  // useWalletClient() is async — data starts as undefined even when a wallet is
  // already connected, then resolves on the next render. We must not rely on it
  // being set at construction time.
  const { data: walletClient } = useWalletClient()
  const clientRef = useRef<CycloClient | null>(null)

  // Create the SDK client once when publicClient first becomes available.
  if (publicClient && !clientRef.current) {
    clientRef.current = new CycloClient({
      contractAddress,
      usdcAddress,
      publicClient,
      // Pass walletClient here if it's already resolved (wallet was connected
      // before this provider mounted). If it's still undefined the effect below
      // will inject it once useWalletClient() resolves asynchronously.
      walletClient: walletClient ?? undefined,
    })
  }

  // Belt-and-suspenders: also update synchronously on every render where
  // walletClient is available. Covers the case where walletClient resolves on
  // the same render tick that the client was just created.
  if (clientRef.current && walletClient) {
    clientRef.current.setWalletClient(walletClient)
  }

  // useEffect path: catches the async resolution of useWalletClient() which
  // often arrives one render after mount (wagmi fetches it via a query).
  useEffect(() => {
    if (!clientRef.current || !walletClient) return
    clientRef.current.setWalletClient(walletClient)
  }, [walletClient])

  if (!publicClient || !clientRef.current) return null

  return (
    <CycloContext.Provider value={clientRef.current}>
      {children}
    </CycloContext.Provider>
  )
}

export function useCycloClient(): CycloClient {
  const client = useContext(CycloContext)
  if (!client) throw new Error('useCycloClient must be used inside CycloProvider')
  return client
}
