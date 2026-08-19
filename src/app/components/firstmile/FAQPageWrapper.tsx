'use client'

import { CurrencyProvider } from './CurrencyContext'
import FAQPageClient from './FAQPageClient'

export default function FAQPageWrapper() {
  return (
    <CurrencyProvider>
      <FAQPageClient />
    </CurrencyProvider>
  )
}
