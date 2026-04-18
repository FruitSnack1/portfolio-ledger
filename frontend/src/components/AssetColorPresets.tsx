import { ASSET_COLOR_PRESETS } from '../asset/assetColorPalette'

type AssetColorPresetsProps = {
  value: string
  onChange: (hex: string) => void
  groupLabel?: string
  disabled?: boolean
}

export function AssetColorPresets({ value, onChange, groupLabel = 'Asset color', disabled = false }: AssetColorPresetsProps) {
  return (
    <div className="color-preset-grid" role="radiogroup" aria-label={groupLabel}>
      {ASSET_COLOR_PRESETS.map((preset) => {
        const selected = preset.hex === value
        return (
          <button
            key={preset.hex}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`color-preset${selected ? ' color-preset--selected' : ''}`}
            style={{ backgroundColor: preset.hex }}
            title={preset.label}
            disabled={disabled}
            onClick={() => onChange(preset.hex)}
          >
            <span className="sr-only">{preset.label}</span>
          </button>
        )
      })}
    </div>
  )
}
