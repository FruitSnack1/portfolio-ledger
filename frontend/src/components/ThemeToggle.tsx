import type { ReactElement } from 'react'
import { useTheme, type ThemePreference } from '../theme/ThemeProvider'

export type ThemeToggleMode = 'all' | 'lightDark'

function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function IconSystem() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

const optionsAll: { value: ThemePreference; label: string; Icon: () => ReactElement }[] = [
  { value: 'system', label: 'Match system appearance', Icon: IconSystem },
  { value: 'light', label: 'Light theme', Icon: IconSun },
  { value: 'dark', label: 'Dark theme', Icon: IconMoon },
]

const optionsLightDark: { value: 'light' | 'dark'; label: string; Icon: () => ReactElement }[] = [
  { value: 'light', label: 'Light theme', Icon: IconSun },
  { value: 'dark', label: 'Dark theme', Icon: IconMoon },
]

function lightLooksActive(preference: ThemePreference, resolved: 'light' | 'dark') {
  if (preference === 'light') return true
  if (preference === 'system') return resolved === 'light'
  return false
}

function darkLooksActive(preference: ThemePreference, resolved: 'light' | 'dark') {
  if (preference === 'dark') return true
  if (preference === 'system') return resolved === 'dark'
  return false
}

type ThemeToggleProps = {
  /** `lightDark` hides system — for the top bar; settings uses `all` (default). */
  mode?: ThemeToggleMode
}

export function ThemeToggle({ mode = 'all' }: ThemeToggleProps) {
  const { preference, resolved, setPreference } = useTheme()

  if (mode === 'lightDark')
    return (
      <div className="theme-segment" role="group" aria-label="Theme">
        {optionsLightDark.map(({ value, label, Icon }) => {
          const pressed =
            value === 'light' ? lightLooksActive(preference, resolved) : darkLooksActive(preference, resolved)
          return (
            <button
              key={value}
              type="button"
              className="theme-segment-btn"
              aria-pressed={pressed}
              aria-label={label}
              title={label}
              onClick={() => setPreference(value)}
            >
              <Icon />
            </button>
          )
        })}
      </div>
    )

  return (
    <div className="theme-segment" role="group" aria-label="Theme">
      {optionsAll.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className="theme-segment-btn"
          aria-pressed={preference === value}
          aria-label={label}
          title={label}
          onClick={() => setPreference(value)}
        >
          <Icon />
        </button>
      ))}
    </div>
  )
}
