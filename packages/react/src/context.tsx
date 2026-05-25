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
  // walletClient is intentionally omitted here; it is injected via
  // setWalletClient() in the effect below once useWalletClient() resolves.
  if (publicClient && !clientRef.current) {
    clientRef.current = new CycloClient({
      contractAddress,
      usdcAddress,
      publicClient,
    })
  }

  // Synchronise walletClient into the SDK client after every render in which
  // it changes. useEffect runs after the render is committed, so it reliably
  // picks up the resolved value from useWalletClient() regardless of whether
  // the wallet was connected before or after the provider mounted.
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
