import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, apiJson } from '../api/client'

type MeResponse = { user: { id: string; email: string } }

export function HomePage() {
  const [user, setUser] = useState<MeResponse['user'] | null>(null)
  const [loading, setLoading] = useState(true)

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
      <button type="button" className="btn" onClick={() => void logout()}>
        Log out
      </button>
      <p className="muted small">Asset and log CRUD will go here next.</p>
    </main>
  )
}
