/**
 * Preset colors for assets and charts (hex values must match backend `assetColorPalette.ts`).
 */
export const ASSET_COLOR_PRESETS = [
  { hex: '#4F46E5', label: 'Indigo' },
  { hex: '#EC4899', label: 'Pink' },
  { hex: '#EF4444', label: 'Red' },
  { hex: '#F97316', label: 'Orange' },
  { hex: '#EAB308', label: 'Amber' },
  { hex: '#22C55E', label: 'Green' },
  { hex: '#06B6D4', label: 'Cyan' },
  { hex: '#3B82F6', label: 'Blue' },
] as const

export const DEFAULT_ASSET_COLOR = ASSET_COLOR_PRESETS[0].hex
