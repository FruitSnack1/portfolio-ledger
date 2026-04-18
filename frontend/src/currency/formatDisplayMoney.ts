const FALLBACK_CURRENCY = 'USD'

/** ISO 4217 code for Intl, or fallback when unset / invalid. */
export function resolveDisplayCurrencyCode(currencyCode: string | null | undefined): string {
  if (currencyCode != null && currencyCode.length === 3) return currencyCode.toUpperCase()
  return FALLBACK_CURRENCY
}

/** Formats a numeric amount with currency symbol (browser locale). */
export function formatDisplayMoney(amount: number | null, currencyCode: string | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  const code = resolveDisplayCurrencyCode(currencyCode)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
    }).format(amount)
  } catch {
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${code}`
  }
}

/** Parses API numeric string, then formats as currency. */
export function formatDisplayMoneyFromString(raw: string, currencyCode: string | null | undefined): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return '—'
  return formatDisplayMoney(n, currencyCode)
}

/**
 * Currency string with an explicit leading `+` when amount is finite and &gt; 0
 * (Intl does not add a plus for positives).
 */
export function formatSignedDisplayMoney(amount: number | null, currencyCode: string | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  const formatted = formatDisplayMoney(amount, currencyCode)
  if (formatted === '—') return '—'
  if (amount > 0) return `+${formatted}`
  return formatted
}
