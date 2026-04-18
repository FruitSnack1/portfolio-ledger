import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

const storageKey = 'pl-theme'

function readStoredPreference(): ThemePreference {
  const raw = localStorage.getItem(storageKey)
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

function isSystemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

type ThemeContextValue = {
  preference: ThemePreference
  resolved: 'light' | 'dark'
  setPreference: (value: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference())
  const [systemDark, setSystemDark] = useState(() => isSystemDark())

  useEffect(() => {
    if (preference !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  const resolved = useMemo(() => {
    if (preference === 'system') return systemDark ? 'dark' : 'light'
    return preference
  }, [preference, systemDark])

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved
    document.documentElement.style.colorScheme = resolved
  }, [resolved])

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value)
    localStorage.setItem(storageKey, value)
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
