import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, apiJson } from '../api/client'

type RegisterResponse = { user: { id: string; email: string } }

export function RegisterPage() {
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
      await apiJson<RegisterResponse>('/api/auth/register', {
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
      <h1>Register</h1>
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
            autoComplete="new-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
            minLength={8}
          />
        </label>
        <p className="hint">At least 8 characters.</p>
        {error != null && <p className="error">{error}</p>}
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="muted">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </main>
  )
}
