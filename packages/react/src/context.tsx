import { createContext, useContext, useRef, type ReactNode } from 'react'
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
  const { data: walletClient } = useWalletClient()
  const clientRef = useRef<CycloClient | null>(null)

  if (!publicClient) return null

  if (!clientRef.current) {
    clientRef.current = new CycloClient({
      contractAddress,
      usdcAddress,
      publicClient,
      walletClient: walletClient ?? undefined,
    })
  } else {
    if (walletClient) clientRef.current.setWalletClient(walletClient)
  }

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
