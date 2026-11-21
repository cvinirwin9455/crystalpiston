/**
 * Currency utilities for formatting financial amounts.
 * The org's currency is fetched from /api/org-currency (see use-org-currency.ts)
 * and passed around.
 */

export type CurrencyCode = 'USD' | 'GBP' | 'EUR' | 'AUD' | 'NZD' | 'CAD'

export const CURRENCIES: Record<CurrencyCode, { code: CurrencyCode; symbol: string; label: string; flag: string }> = {
  USD: { code: 'USD', symbol: '$', label: 'US Dollar', flag: '🇺🇸' },
  GBP: { code: 'GBP', symbol: '£', label: 'British Pound', flag: '🇬🇧' },
  EUR: { code: 'EUR', symbol: '€', label: 'Euro', flag: '🇪🇺' },
  AUD: { code: 'AUD', symbol: 'A$', label: 'Australian Dollar', flag: '🇦🇺' },
  NZD: { code: 'NZD', symbol: 'NZ$', label: 'New Zealand Dollar', flag: '🇳🇿' },
  CAD: { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar', flag: '🇨🇦' },
}

/** Currencies a coach can choose from. Shared by the settings UI and the API. */
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[]

/** Normalise any casing/garbage to a supported code, defaulting to USD. */
export function normalizeCurrencyCode(code?: string | null): CurrencyCode {
  const upper = String(code || '').toUpperCase()
  return (upper in CURRENCIES ? upper : 'USD') as CurrencyCode
}

/**
 * Format a number as a currency string.
 * e.g. formatCurrency(125.5, 'GBP') → '£125.50'
 * e.g. formatCurrency(0, 'USD') → '$0.00'
 * e.g. formatCurrency(950, 'EUR', 0) → '€950'
 * Negative amounts put the minus sign first: '-£5.00'.
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD', decimals: number = 2): string {
  const currency = CURRENCIES[normalizeCurrencyCode(currencyCode)]
  const n = Number(amount)
  const safe = Number.isFinite(n) ? n : 0
  const body = Math.abs(safe).toFixed(decimals)
  const isZero = Number(body) === 0
  return `${safe < 0 && !isZero ? '-' : ''}${currency.symbol}${body}`
}

/**
 * Format a number as a currency string without decimals (for large round numbers).
 * e.g. formatCurrencyShort(950, 'GBP') → '£950'
 */
export function formatCurrencyShort(amount: number, currencyCode: string = 'USD'): string {
  return formatCurrency(Math.round(Number(amount) || 0), currencyCode, 0)
}

/**
 * Whole amounts show without decimals, everything else with two.
 * e.g. formatCurrencyAuto(125, 'GBP') → '£125', formatCurrencyAuto(125.5, 'GBP') → '£125.50'
 */
export function formatCurrencyAuto(amount: number, currencyCode: string = 'USD'): string {
  const n = Number(amount)
  return formatCurrency(n, currencyCode, Number.isInteger(n) ? 0 : 2)
}

/**
 * Get just the currency symbol.
 * e.g. getCurrencySymbol('EUR') → '€'
 */
export function getCurrencySymbol(currencyCode: string = 'USD'): string {
  return CURRENCIES[normalizeCurrencyCode(currencyCode)].symbol
}
