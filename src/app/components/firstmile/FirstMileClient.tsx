'use client'

import { CurrencyProvider } from './CurrencyContext'
import FirstMileContent from './FirstMileContent'

export default function FirstMileClient() {
  return (
    <CurrencyProvider>
      <FirstMileContent />
    </CurrencyProvider>
  )
}
