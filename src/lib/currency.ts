/**
 * Currency utilities for formatting financial amounts.
 * The org's currency is fetched from /api/org-currency and passed around.
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

/**
 * Format a number as a currency string.
 * e.g. formatCurrency(125.5, 'GBP') → '£125.50'
 * e.g. formatCurrency(0, 'USD') → '$0.00'
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  const currency = CURRENCIES[currencyCode as CurrencyCode] || CURRENCIES.USD
  return `${currency.symbol}${amount.toFixed(2)}`
}

/**
 * Format a number as a currency string without decimals (for large round numbers).
 * e.g. formatCurrencyShort(950, 'GBP') → '£950'
 */
export function formatCurrencyShort(amount: number, currencyCode: string = 'USD'): string {
  const currency = CURRENCIES[currencyCode as CurrencyCode] || CURRENCIES.USD
  return `${currency.symbol}${Math.round(amount)}`
}

/**
 * Get just the currency symbol.
 * e.g. getCurrencySymbol('EUR') → '€'
 */
export function getCurrencySymbol(currencyCode: string = 'USD'): string {
  const currency = CURRENCIES[currencyCode as CurrencyCode] || CURRENCIES.USD
  return currency.symbol
}
