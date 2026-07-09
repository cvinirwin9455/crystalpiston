'use client'

import { useCurrency, REGIONS, Region } from './CurrencyContext'

export default function RegionToggle() {
  const { currency, setRegion } = useCurrency()

  return (
    <select
      className="fmc-region-select"
      value={currency.region}
      onChange={(e) => setRegion(e.target.value as Region)}
      aria-label="Select your region"
    >
      {Object.values(REGIONS).map((r) => (
        <option key={r.region} value={r.region}>
          {r.flag} {r.label}
        </option>
      ))}
    </select>
  )
}
