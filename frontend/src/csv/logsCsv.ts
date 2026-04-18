/** Minimal row shape for CSV export (matches `AllLogRow` fields used). */
export type LogCsvExportRow = {
  year: number
  month: number
  assetName: string
  deposit: string
  balance: string
}

export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** CSV for import/export: four columns in order date, asset name, deposit, balance (import ignores header text). */
export function buildLogsCsvForExport(rows: readonly LogCsvExportRow[]): string {
  const header = 'date,asset name,deposit,balance'
  const sorted = [...rows].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    if (a.month !== b.month) return a.month - b.month
    return a.assetName.localeCompare(b.assetName)
  })
  const lines = [header]
  for (const r of sorted) {
    const date = `${r.year}-${String(r.month).padStart(2, '0')}-01`
    lines.push(
      [
        escapeCsvField(date),
        escapeCsvField(r.assetName),
        escapeCsvField(r.deposit),
        escapeCsvField(r.balance),
      ].join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export function downloadCsvFile(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}
