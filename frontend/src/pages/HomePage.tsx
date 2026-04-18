import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, apiJson } from '../api/client'
import { CurrencySettingsModal, type UserWithCurrency } from '../components/CurrencySettingsModal'

type MeResponse = { user: UserWithCurrency }

export function HomePage() {
  const [user, setUser] = useState<UserWithCurrency | null>(null)
  const [loading, setLoading] = useState(true)
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false)

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
      setCurrencyModalOpen(false)
      return
    }
    if (user.displayCurrency == null) setCurrencyModalOpen(true)
  }, [user])

  async function logout() {
    await apiJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  if (loading) return <main className="app">Checking session…</main>

  if (!user)
    return (
      <main className="app">
        <h1>Welcome</h1>
        <p className="muted">Create an account or log in to continue.</p>
        <p>
          <Link to="/register">Register</Link>
          {' · '}
          <Link to="/login">Log in</Link>
        </p>
      </main>
    )

  return (
    <main className="app">
      <h1>Signed in</h1>
      <p className="muted">
        Logged in as <strong>{user.email}</strong>
      </p>
      <p className="settings-row">
        <span className="muted">Display currency:</span>{' '}
        <button type="button" className="link-btn" onClick={() => setCurrencyModalOpen(true)}>
          {user.displayCurrency ?? 'Not set — tap to choose'}
        </button>
      </p>
      <p className="settings-row">
        <Link to="/assets" className="link-btn">
          Manage assets
        </Link>
      </p>
      <button type="button" className="btn" onClick={() => void logout()}>
        Log out
      </button>
      <p className="muted small">Monthly logs and dashboard will follow.</p>

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
