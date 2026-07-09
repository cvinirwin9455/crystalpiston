'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Region = 'US' | 'CA' | 'GB' | 'EU' | 'AU'

export type CurrencyConfig = {
  region: Region
  symbol: string
  code: string
  label: string
  flag: string
}

export const REGIONS: Record<Region, CurrencyConfig> = {
  US: { region: 'US', symbol: '$',  code: 'USD', label: 'USD',  flag: '🇺🇸' },
  CA: { region: 'CA', symbol: 'CA$', code: 'CAD', label: 'CAD', flag: '🇨🇦' },
  GB: { region: 'GB', symbol: '£',  code: 'GBP', label: 'GBP',  flag: '🇬🇧' },
  EU: { region: 'EU', symbol: '€',  code: 'EUR', label: 'EUR',  flag: '🇪🇺' },
  AU: { region: 'AU', symbol: 'A$', code: 'AUD', label: 'AUD', flag: '🇦🇺' },
}

// EU country codes (all use EUR pricing even if not on the euro)
const EU_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU',
  'IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
  'IS','LI','NO','CH', // EEA + Switzerland
])

type CurrencyContextType = {
  currency: CurrencyConfig
  setRegion: (region: Region) => void
  detected: boolean
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: REGIONS['US'],
  setRegion: () => {},
  detected: false,
})

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyConfig>(REGIONS['US'])
  const [detected, setDetected] = useState(false)

  useEffect(() => {
    // Check localStorage for saved preference first
    const saved = localStorage.getItem('fmc_region') as Region | null
    if (saved && REGIONS[saved]) {
      setCurrency(REGIONS[saved])
      setDetected(true)
      return
    }

    // Auto-detect via free IP geolocation API
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        const country: string = data?.country_code || 'US'
        let region: Region = 'US'

        if (country === 'GB') region = 'GB'
        else if (country === 'CA') region = 'CA'
        else if (country === 'AU') region = 'AU'
        else if (EU_COUNTRIES.has(country)) region = 'EU'
        else region = 'US'

        setCurrency(REGIONS[region])
        setDetected(true)
      })
      .catch(() => {
        // Failed to detect — default to USD
        setDetected(true)
      })
  }, [])

  const setRegion = (region: Region) => {
    const config = REGIONS[region]
    if (!config) return
    setCurrency(config)
    localStorage.setItem('fmc_region', region)
  }

  return (
    <CurrencyContext.Provider value={{ currency, setRegion, detected }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}

/** Format a price number with the current currency symbol */
export function usePrice() {
  const { currency } = useCurrency()
  return (amount: number) => `${currency.symbol}${amount}`
}
