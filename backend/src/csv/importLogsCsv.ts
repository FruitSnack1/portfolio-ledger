import { randomInt } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { ASSET_COLOR_PALETTE } from '../asset/assetColorPalette.js'
import type { Db } from '../db/client.js'
import { assetLogs, assets } from '../db/schema.js'

export type CsvImportFailure = { line: number; detail: string }

export type CsvImportAssetCreated = { id: string; name: string }

export type CsvImportResult = {
  createdLogs: number
  updatedLogs: number
  failed: CsvImportFailure[]
  assetsCreated: CsvImportAssetCreated[]
}

function randomPaletteColor(): string {
  return ASSET_COLOR_PALETTE[randomInt(ASSET_COLOR_PALETTE.length)]!
}

function normalizeAssetKey(name: string): string {
  return name.trim().toLowerCase()
}

/** RFC4180-ish: splits on commas outside quotes; strips outer quotes. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (c === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  out.push(cur.trim())
  return out
}

/** Parses calendar month for a log row. Supports `5/24` → May 2024 (M/YY). */
export function parseLogDateCell(raw: string): { year: number; month: number } | null {
  const s = raw.trim()
  if (!s) return null

  const mdyFull = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (mdyFull) {
    const month = Number(mdyFull[1])
    const year = Number(mdyFull[3])
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) return { year, month }
    return null
  }

  const myy = /^(\d{1,2})\/(\d{2})$/.exec(s)
  if (myy) {
    const month = Number(myy[1])
    const yy = Number(myy[2])
    if (month >= 1 && month <= 12 && yy >= 0 && yy <= 99) return { year: 2000 + yy, month }
    return null
  }

  const myyyy = /^(\d{1,2})\/(\d{4})$/.exec(s)
  if (myyyy) {
    const month = Number(myyyy[1])
    const year = Number(myyyy[2])
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) return { year, month }
    return null
  }

  const iso = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) return { year, month }
    return null
  }

  return null
}

export function parseMoneyCell(raw: string): number | null {
  const s = raw.trim().replace(/[$\s]/g, '').replace(/,/g, '')
  if (s === '') return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n
}

/** First row is treated as a header (skipped) when it does not parse as a log data row. */
function looksLikeDataRow(cells: readonly string[]): boolean {
  if (cells.length < 4) return false
  const dateRaw = cells[0] ?? ''
  const depositRaw = cells[2] ?? ''
  const balanceRaw = cells[3] ?? ''
  if (parseLogDateCell(dateRaw) == null) return false
  if (parseMoneyCell(depositRaw) == null) return false
  if (parseMoneyCell(balanceRaw) == null) return false
  if (!(cells[1] ?? '').trim()) return false
  return true
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if (!('code' in error)) return false
  return (error as { code: unknown }).code === '23505'
}

type AssetRow = { id: string; name: string; color: string; withdrawn: boolean }

export async function importLogsCsv(db: Db, userId: string, csv: string): Promise<CsvImportResult> {
  const failed: CsvImportFailure[] = []
  const assetsCreated: CsvImportAssetCreated[] = []
  let createdLogs = 0
  let updatedLogs = 0

  const normalizedCsv = csv.replace(/^\uFEFF/, '')
  const lines = normalizedCsv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    failed.push({ line: 1, detail: 'CSV is empty' })
    return { createdLogs: 0, updatedLogs: 0, failed, assetsCreated }
  }

  const firstCells = parseCsvLine(lines[0]!)
  let start = 0
  if (!looksLikeDataRow(firstCells)) start = 1

  if (start >= lines.length) {
    failed.push({
      line: 1,
      detail: 'No data rows: add at least one row with date, asset name, deposit, balance in columns 1–4 (optional header row is ignored)',
    })
    return { createdLogs: 0, updatedLogs: 0, failed, assetsCreated }
  }

  const existingAssets = await db
    .select({ id: assets.id, name: assets.name, color: assets.color, withdrawn: assets.withdrawn })
    .from(assets)
    .where(eq(assets.userId, userId))

  const byNormName = new Map<string, AssetRow>()
  for (const a of existingAssets) byNormName.set(normalizeAssetKey(a.name), a)

  for (let i = start; i < lines.length; i++) {
    const lineNum = i + 1
    const cells = parseCsvLine(lines[i]!)
    if (cells.length < 4) {
      failed.push({ line: lineNum, detail: 'Row does not have enough columns (need 4: date, asset name, deposit, balance)' })
      continue
    }

    const dateRaw = cells[0] ?? ''
    const nameRaw = cells[1] ?? ''
    const depositRaw = cells[2] ?? ''
    const balanceRaw = cells[3] ?? ''

    const period = parseLogDateCell(dateRaw)
    if (!period) {
      failed.push({ line: lineNum, detail: `Unrecognized date: "${dateRaw}"` })
      continue
    }

    const assetName = nameRaw.trim()
    if (!assetName) {
      failed.push({ line: lineNum, detail: 'Asset name is empty' })
      continue
    }

    const deposit = parseMoneyCell(depositRaw)
    const balance = parseMoneyCell(balanceRaw)
    if (deposit == null) {
      failed.push({ line: lineNum, detail: `Invalid deposit: "${depositRaw}"` })
      continue
    }
    if (balance == null) {
      failed.push({ line: lineNum, detail: `Invalid balance: "${balanceRaw}"` })
      continue
    }

    const key = normalizeAssetKey(assetName)
    let asset = byNormName.get(key)
    if (!asset) {
      const color = randomPaletteColor()
      try {
        const [row] = await db
          .insert(assets)
          .values({ userId, name: assetName, color })
          .returning({ id: assets.id, name: assets.name, color: assets.color, withdrawn: assets.withdrawn })

        if (!row) {
          failed.push({ line: lineNum, detail: 'Could not create asset' })
          continue
        }
        asset = row
        byNormName.set(key, row)
        assetsCreated.push({ id: row.id, name: row.name })
      } catch (e: unknown) {
        failed.push({ line: lineNum, detail: 'Could not create asset' })
        continue
      }
    }

    const assetId = asset.id
    const { year, month } = period

    try {
      const [existing] = await db
        .select({ id: assetLogs.id })
        .from(assetLogs)
        .where(and(eq(assetLogs.assetId, assetId), eq(assetLogs.year, year), eq(assetLogs.month, month)))
        .limit(1)

      if (existing) {
        await db
          .update(assetLogs)
          .set({ deposit: String(deposit), balance: String(balance) })
          .where(eq(assetLogs.id, existing.id))
        updatedLogs++
      } else {
        await db.insert(assetLogs).values({
          assetId,
          year,
          month,
          deposit: String(deposit),
          balance: String(balance),
        })
        createdLogs++
      }
    } catch (e: unknown) {
      if (isUniqueViolation(e))
        failed.push({ line: lineNum, detail: 'Log month conflict (duplicate)' })
      else failed.push({ line: lineNum, detail: 'Could not save log row' })
    }
  }

  return { createdLogs, updatedLogs, failed, assetsCreated }
}
