'use client'

import { useCurrency } from './CurrencyContext'

/** Renders a price with the current currency symbol, e.g. $1, £1, €1, etc. */
export default function Price({ amount }: { amount: number }) {
  const { currency } = useCurrency()
  return <>{currency.symbol}{amount}</>
}

/** Renders a price with /month suffix */
export function PricePerMonth({ amount }: { amount: number }) {
  const { currency } = useCurrency()
  return <>{currency.symbol}{amount}/month</>
}

/** Renders a price range like $50–$200/month */
export function PriceRange({ low, high, suffix }: { low: number; high: number; suffix?: string }) {
  const { currency } = useCurrency()
  return <>{currency.symbol}{low}–{currency.symbol}{high}{suffix || ''}</>
}
