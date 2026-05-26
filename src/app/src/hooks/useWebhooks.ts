import { useState, useEffect, useCallback } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { API_BASE } from '../utils/apiBase'
import { getCachedAuth } from '../utils/authCache'

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
    const { timestamp, signature } = await getCachedAuth(address, signMessageAsync)
    const res = await fetch(
      `${API_BASE}/api/merchants/${address}/webhooks?timestamp=${timestamp}&signature=${encodeURIComponent(signature)}`
    )
    if (res.ok) setWebhooks(await res.json())
  }, [address, signMessageAsync])

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
      const res = await fetch(`${API_BASE}/api/merchants/${address}/webhooks`, {
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
      await fetch(`${API_BASE}/api/merchants/${address}/webhooks/${id}`, {
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
