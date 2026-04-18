/**
 * Normalizes PostgreSQL numeric strings (e.g. scale 4 → "1000.0000") for JSON clients / inputs.
 */
export function formatDbNumericStringForClient(value: unknown): string {
  const s = String(value).trim()
  if (s === '') return ''
  const n = Number(s)
  if (!Number.isFinite(n)) return s
  return String(n)
}
