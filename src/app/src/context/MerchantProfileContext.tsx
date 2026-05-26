import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { API_BASE } from '../utils/apiBase'
import { getCachedAuth, buildSignMessage } from '../utils/authCache'

export interface MerchantProfile {
  wallet_address:   string
  business_name:    string
  email:            string
  logo_url:         string | null
  brand_name:       string | null
  brand_logo_url:   string | null
  brand_color:      string | null
  custom_subdomain: string | null
}

export interface BrandingFields {
  brandName:       string
  brandLogoUrl:    string
  brandColor:      string
  customSubdomain: string
}

interface MerchantProfileContextValue {
  profile:      MerchantProfile | null
  loading:      boolean
  saveProfile:  (businessName: string, email: string, logoUrl?: string) => Promise<MerchantProfile>
  saveBranding: (fields: BrandingFields) => Promise<MerchantProfile>
}

const MerchantProfileContext = createContext<MerchantProfileContextValue | null>(null)

export function MerchantProfileProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [profile, setProfile] = useState<MerchantProfile | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) {
      setProfile(null)
      return
    }
    // Profile contains PII (email) — require a wallet signature so only the
    // owner can read their own data. getCachedAuth reuses the signature for
    // 4 minutes so the user isn't prompted on every re-render.
    getCachedAuth(address, signMessageAsync)
      .then(({ timestamp, signature }) =>
        fetch(
          `${API_BASE}/api/merchants/${address}?timestamp=${timestamp}&signature=${encodeURIComponent(signature)}`
        )
      )
      .then(r => r.ok ? r.json() : null)
      .then(data => setProfile(data))
      .catch(() => setProfile(null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

  const saveProfile = async (businessName: string, email: string, logoUrl?: string): Promise<MerchantProfile> => {
    if (!address) throw new Error('Wallet not connected')
    setLoading(true)
    try {
      const timestamp = Date.now()
      const message   = buildSignMessage(address, timestamp)
      const signature = await signMessageAsync({ message })

      const res = await fetch(`${API_BASE}/api/merchants`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ address, signature, timestamp, businessName, email, logoUrl }),
      })

      if (!res.ok) throw new Error(await res.text())
      const saved = await res.json() as MerchantProfile
      setProfile(saved)
      return saved
    } finally {
      setLoading(false)
    }
  }

  /**
   * Saves brand identity fields via PATCH /api/merchants/:address.
   * Does not touch business_name or email.
   */
  const saveBranding = async (fields: BrandingFields): Promise<MerchantProfile> => {
    if (!address) throw new Error('Wallet not connected')
    setLoading(true)
    try {
      const timestamp = Date.now()
      const message   = buildSignMessage(address, timestamp)
      const signature = await signMessageAsync({ message })

      const res = await fetch(`${API_BASE}/api/merchants/${address}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          timestamp,
          signature,
          brand_name:       fields.brandName       || null,
          brand_logo_url:   fields.brandLogoUrl    || null,
          brand_color:      fields.brandColor       || null,
          custom_subdomain: fields.customSubdomain || null,
        }),
      })

      if (!res.ok) throw new Error(await res.text())
      const saved = await res.json() as MerchantProfile
      setProfile(saved)
      return saved
    } finally {
      setLoading(false)
    }
  }

  return (
    <MerchantProfileContext.Provider value={{ profile, loading, saveProfile, saveBranding }}>
      {children}
    </MerchantProfileContext.Provider>
  )
}

export function useMerchantProfile() {
  const ctx = useContext(MerchantProfileContext)
  if (!ctx) throw new Error('useMerchantProfile must be used inside MerchantProfileProvider')
  return ctx
}
