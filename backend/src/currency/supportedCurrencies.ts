/** ISO 4217 codes used for display currency (keep in sync with frontend `supportedCurrencies.ts`). */
export const SUPPORTED_CURRENCY_CODES = [
  'USD',
  'EUR',
  'GBP',
  'CHF',
  'JPY',
  'AUD',
  'CAD',
  'NZD',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
] as const

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCY_CODES)[number]

const allowed = new Set<string>(SUPPORTED_CURRENCY_CODES)

export function isSupportedCurrencyCode(value: string): value is SupportedCurrencyCode {
  return allowed.has(value)
}
