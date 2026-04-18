import { z } from 'zod'

/**
 * Fixed palette for asset/chart colors (must match frontend `assetColorPalette.ts`).
 */
export const ASSET_COLOR_PALETTE = [
  '#4F46E5',
  '#EC4899',
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
] as const

export type AssetPaletteHex = (typeof ASSET_COLOR_PALETTE)[number]

const allowed = new Set<string>(ASSET_COLOR_PALETTE)

export function isAssetPaletteHex(value: string): value is AssetPaletteHex {
  return allowed.has(value.toUpperCase() as AssetPaletteHex)
}

export const assetColorSchema = z
  .string()
  .refine((s) => isAssetPaletteHex(s), { message: 'Color must be one of the preset options' })
  .transform((s) => s.toUpperCase() as AssetPaletteHex)
