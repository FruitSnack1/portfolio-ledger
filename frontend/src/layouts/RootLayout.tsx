import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ApiError, apiJson } from '../api/client'
import { ThemeToggle } from '../components/ThemeToggle'
import type { UserWithCurrency } from '../components/CurrencySettingsModal'

type MeResponse = { user: UserWithCurrency }

function LogoutIcon() {
  return (
    <svg className="nav-logout-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RootLayout() {
  const location = useLocation()
  const [user, setUser] = useState<UserWithCurrency | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  const loadSession = useCallback(async () => {
    setSessionLoading(true)
    try {
      const data = await apiJson<MeResponse>('/api/auth/me')
      setUser(data.user)
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) setUser(null)
      else setUser(null)
    } finally {
      setSessionLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSession()
  }, [location.pathname, loadSession])

  async function logout() {
    try {
      await apiJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      window.dispatchEvent(new Event('portfolio-logout'))
    }
  }

  return (
    <div className="layout">
      <header className="topbar">
        <Link to="/" className="brand">
          Portfolio Ledger
        </Link>
        <div className="topbar-right">
          <ThemeToggle />
          <nav className="nav" aria-label="Main">
            <Link to="/">Home</Link>
            <Link to="/assets">Assets</Link>
            <Link to="/logs">Logs</Link>
            {!sessionLoading && user == null ? (
              <Link to="/login" className="nav-sign-in">
                Sign in
              </Link>
            ) : null}
            {!sessionLoading && user != null ? (
              <button type="button" className="nav-logout" onClick={() => void logout()}>
                <LogoutIcon />
                <span>Logout</span>
              </button>
            ) : null}
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
