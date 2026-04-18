import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, apiJson } from '../api/client'
import { CurrencySettingsModal, type UserWithCurrency } from '../components/CurrencySettingsModal'
import { DashboardView, type DashboardPayload } from '../components/dashboard/DashboardView'
import { useTheme } from '../theme/ThemeProvider'

type MeResponse = { user: UserWithCurrency }

export function HomePage() {
  const { resolved } = useTheme()
  const [user, setUser] = useState<UserWithCurrency | null>(null)
  const [loading, setLoading] = useState(true)
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [dashState, setDashState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [dashError, setDashError] = useState<string | null>(null)
  const [dashboardRev, setDashboardRev] = useState(0)

  useEffect(() => {
    function onPurge() {
      setDashboardRev((n) => n + 1)
    }
    window.addEventListener('portfolio-purge', onPurge)
    return () => window.removeEventListener('portfolio-purge', onPurge)
  }, [])

  useEffect(() => {
    function onPortfolioLogout() {
      setUser(null)
      setDashboard(null)
      setDashState('idle')
    }
    window.addEventListener('portfolio-logout', onPortfolioLogout)
    return () => window.removeEventListener('portfolio-logout', onPortfolioLogout)
  }, [])

  useEffect(() => {
    let cancelled = false
    apiJson<MeResponse>('/api/auth/me')
      .then((data) => {
        if (!cancelled) setUser(data.user)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setDashboard(null)
      setDashState('idle')
      return
    }
    let cancelled = false
    setDashState('loading')
    setDashError(null)
    void apiJson<DashboardPayload>('/api/dashboard')
      .then((data) => {
        if (!cancelled) {
          setDashboard(data)
          setDashState('ok')
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) {
          setUser(null)
          return
        }
        if (e instanceof ApiError) setDashError(e.message)
        else setDashError('Could not load dashboard')
        setDashState('error')
      })
    return () => {
      cancelled = true
    }
  }, [user, dashboardRev])

  useEffect(() => {
    if (!user) {
      setCurrencyModalOpen(false)
      return
    }
    if (user.displayCurrency == null) setCurrencyModalOpen(true)
  }, [user])

  if (loading) return <main className="app">Checking session…</main>

  if (!user)
    return (
      <main className="app">
        <h1>Welcome</h1>
        <p className="muted">Sign in to view your portfolio dashboard.</p>
        <p className="home-guest-actions">
          <Link to="/login" className="btn primary">
            Sign in
          </Link>
        </p>
        <p className="muted home-guest-register">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </main>
    )

  return (
    <main className="app dashboard-page">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="muted">
          Signed in as <strong>{user.email}</strong>
        </p>
      </div>

      {dashState === 'loading' && <p className="muted">Loading portfolio…</p>}
      {dashState === 'error' && <p className="error">{dashError ?? 'Could not load dashboard.'}</p>}
      {dashState === 'ok' && dashboard != null && (
        <DashboardView data={dashboard} displayCurrency={user.displayCurrency} theme={resolved} />
      )}

      <CurrencySettingsModal
        open={currencyModalOpen}
        mandatory={user.displayCurrency == null}
        displayCurrency={user.displayCurrency}
        onClose={() => setCurrencyModalOpen(false)}
        onSaved={(next) => setUser(next)}
      />
    </main>
  )
}
