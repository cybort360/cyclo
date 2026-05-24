import { useState, useEffect, useCallback } from 'react'
import { useAccount, useSignMessage } from 'wagmi'

export interface Webhook {
  id: string
  plan_id: string
  url: string
  active: boolean
  created_at: string
}

export function useWebhooks() {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(false)

  const fetchWebhooks = useCallback(async () => {
    if (!address) return
    const res = await fetch(`/api/merchants/${address}/webhooks`)
    if (res.ok) setWebhooks(await res.json())
  }, [address])

  useEffect(() => { fetchWebhooks() }, [fetchWebhooks])

  const buildSignature = async () => {
    const timestamp = Date.now()
    const message = `Sign this message to set up your Cyclo merchant profile.\n\nWallet: ${address}\nTimestamp: ${timestamp}`
    const signature = await signMessageAsync({ message })
    return { signature, timestamp }
  }

  const addWebhook = async (planId: string, url: string, secret: string) => {
    if (!address) return
    setLoading(true)
    try {
      const { signature, timestamp } = await buildSignature()
      const res = await fetch(`/api/merchants/${address}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, timestamp, planId, url, secret }),
      })
      if (!res.ok) throw new Error(await res.text())
      await fetchWebhooks()
    } finally {
      setLoading(false)
    }
  }

  const removeWebhook = async (id: string) => {
    if (!address) return
    setLoading(true)
    try {
      const { signature, timestamp } = await buildSignature()
      await fetch(`/api/merchants/${address}/webhooks/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, timestamp }),
      })
      await fetchWebhooks()
    } finally {
      setLoading(false)
    }
  }

  return { webhooks, loading, addWebhook, removeWebhook, refetch: fetchWebhooks }
}
