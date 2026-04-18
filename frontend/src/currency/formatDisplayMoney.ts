import { APP_INTL_LOCALE } from '../intl/appLocale'

const FALLBACK_CURRENCY = 'USD'

/** ISO 4217 code for Intl, or fallback when unset / invalid. */
export function resolveDisplayCurrencyCode(currencyCode: string | null | undefined): string {
  if (currencyCode != null && currencyCode.length === 3) return currencyCode.toUpperCase()
  return FALLBACK_CURRENCY
}

/** Uses a normal space instead of the locale’s grouping character (e.g. comma or narrow space). */
function joinGroupingSpace(parts: readonly Intl.NumberFormatPart[]): string {
  return parts.map((p) => (p.type === 'group' ? ' ' : p.value)).join('')
}

/**
 * Formats a numeric amount (`APP_INTL_LOCALE`, space-separated digit groups).
 * CZK is fixed as `111 111 Kč` (no decimals). Other currencies use Intl currency formatting.
 */
export function formatDisplayMoney(amount: number | null, currencyCode: string | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  const code = resolveDisplayCurrencyCode(currencyCode)
  try {
    if (code === 'CZK') {
      const nf = new Intl.NumberFormat(APP_INTL_LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        useGrouping: true,
      })
      return `${joinGroupingSpace(nf.formatToParts(amount))} Kč`
    }
    const nf = new Intl.NumberFormat(APP_INTL_LOCALE, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    return joinGroupingSpace(nf.formatToParts(amount))
  } catch {
    if (code === 'CZK') {
      const num = amount.toLocaleString(APP_INTL_LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      return `${num.replace(/,/g, ' ')} Kč`
    }
    const num = amount.toLocaleString(APP_INTL_LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    return `${num.replace(/,/g, ' ')} ${code}`
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
