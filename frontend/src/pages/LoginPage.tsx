import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, apiJson } from '../api/client'

type LoginResponse = { user: { id: string; email: string } }

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiJson<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      navigate('/', { replace: true })
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="app narrow">
      <h1>Log in</h1>
      <form className="form" onSubmit={(ev) => void onSubmit(ev)}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
            minLength={8}
          />
        </label>
        {error != null && <p className="error">{error}</p>}
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="muted">
        No account? <Link to="/register">Register</Link>
      </p>
    </main>
  )
}
