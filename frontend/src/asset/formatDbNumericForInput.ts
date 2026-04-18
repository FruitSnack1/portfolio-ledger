/**
 * Normalizes DB / API numeric strings (e.g. PostgreSQL numeric(18,4) → "1000.0000") for form fields.
 */
export function formatDbNumericForInput(raw: string) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw.trim()
  return String(n)
}
