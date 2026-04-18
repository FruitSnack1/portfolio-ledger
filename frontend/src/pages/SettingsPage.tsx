import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, apiJson } from '../api/client'
import { ConfirmModal } from '../components/ConfirmModal'
import { Toast } from '../components/Toast'
import { ThemeToggle } from '../components/ThemeToggle'
import { CURRENCY_OPTIONS } from '../currency/supportedCurrencies'
import type { UserWithCurrency } from '../components/CurrencySettingsModal'

type MeResponse = { user: UserWithCurrency }

type PurgeResponse = { ok: boolean; deletedAssetCount: number }

export function SettingsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<UserWithCurrency | null>(null)
  const [loading, setLoading] = useState(true)
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [currencySaving, setCurrencySaving] = useState(false)
  const [currencyError, setCurrencyError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [purgeModalOpen, setPurgeModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const clearToast = useCallback(() => setToastMessage(null), [])

  useEffect(() => {
    let cancelled = false
    void apiJson<MeResponse>('/api/auth/me')
      .then((data) => {
        if (!cancelled) {
          setUser(data.user)
          setCurrencyCode(data.user.displayCurrency ?? 'USD')
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) {
          void navigate('/login', { replace: true })
          return
        }
        setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  async function saveCurrency(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setCurrencyError(null)
    setCurrencySaving(true)
    try {
      const res = await apiJson<MeResponse>('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ displayCurrency: currencyCode }),
      })
      setUser(res.user)
      const saved = res.user.displayCurrency ?? currencyCode
      setCurrencyCode(saved)
      setToastMessage(`Currency saved (${saved})`)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError) setCurrencyError(err.message)
      else setCurrencyError('Could not save currency')
    } finally {
      setCurrencySaving(false)
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setPasswordError(null)
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }
    setPasswordSaving(true)
    try {
      await apiJson<{ ok: boolean }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setToastMessage('Password updated')
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        if (err.message === 'Current password is incorrect') {
          setPasswordError(err.message)
          return
        }
        void navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError) setPasswordError(err.message)
      else setPasswordError('Could not update password')
    } finally {
      setPasswordSaving(false)
    }
  }

  async function runPurge() {
    try {
      await apiJson<PurgeResponse>('/api/settings/purge-portfolio', { method: 'POST' })
      window.dispatchEvent(new Event('portfolio-purge'))
      setToastMessage('All data deleted')
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true })
        throw new Error('Session expired')
      }
      if (err instanceof ApiError) throw new Error(err.message)
      throw new Error('Could not purge data')
    }
  }

  if (loading) return <main className="app">Loading settings…</main>

  if (!user)
    return (
      <main className="app">
        <p className="error">You need to be signed in to view settings.</p>
        <Link to="/login" className="btn primary">
          Sign in
        </Link>
      </main>
    )

  return (
    <main className="app settings-page">
      <Toast message={toastMessage} onRequestClear={clearToast} />

      <p className="page-back">
        <Link to="/">← Home</Link>
      </p>

      <header className="settings-page-header">
        <h1 className="settings-page-title">Settings</h1>
        <p className="muted">Signed in as {user.email}</p>
      </header>

      <div className="settings-stack">
        <section className="card settings-card" aria-labelledby="settings-currency-heading">
          <h2 id="settings-currency-heading" className="card-title">
            Display currency
          </h2>
          <p className="muted settings-card-lead">Amounts across the app use this currency for formatting.</p>
          <form className="form settings-currency-form" onSubmit={(ev) => void saveCurrency(ev)}>
            <label className="field">
              <span>Currency</span>
              <select value={currencyCode} onChange={(ev) => setCurrencyCode(ev.target.value)} disabled={currencySaving}>
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {currencyError != null && <p className="error">{currencyError}</p>}
            <button
              type="submit"
              className="btn primary settings-currency-save-btn"
              disabled={currencySaving}
            >
              Save currency
            </button>
          </form>
        </section>

        <section className="card settings-card" aria-labelledby="settings-password-heading">
          <h2 id="settings-password-heading" className="card-title">
            Password
          </h2>
          <p className="muted settings-card-lead">Use your current password, then choose a new one (at least 8 characters).</p>
          <form className="form settings-password-form" onSubmit={(ev) => void savePassword(ev)}>
            <label className="field">
              <span>Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(ev) => setCurrentPassword(ev.target.value)}
                autoComplete="current-password"
                disabled={passwordSaving}
                required
              />
            </label>
            <label className="field">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(ev) => setNewPassword(ev.target.value)}
                autoComplete="new-password"
                disabled={passwordSaving}
                required
                minLength={8}
                maxLength={128}
              />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(ev) => setConfirmPassword(ev.target.value)}
                autoComplete="new-password"
                disabled={passwordSaving}
                required
                minLength={8}
                maxLength={128}
              />
            </label>
            {passwordError != null && <p className="error">{passwordError}</p>}
            <button
              type="submit"
              className="btn primary settings-password-save-btn"
              disabled={passwordSaving}
            >
              {passwordSaving ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </section>

        <section className="card settings-card" aria-labelledby="settings-appearance-heading">
          <h2 id="settings-appearance-heading" className="card-title">
            Appearance
          </h2>
          <p className="muted settings-card-lead">Light, dark, or match your system.</p>
          <div className="settings-theme-row">
            <ThemeToggle />
          </div>
        </section>

        <section className="card settings-card settings-card--danger-zone" aria-labelledby="settings-data-heading">
          <h2 id="settings-data-heading" className="card-title">
            Data
          </h2>
          <p className="muted settings-card-lead">
            Permanently delete every asset and all monthly logs. Your account and display settings stay; this cannot be undone.
          </p>
          <button type="button" className="btn btn-danger" onClick={() => setPurgeModalOpen(true)}>
            Purge all assets and logs
          </button>
        </section>
      </div>

      <ConfirmModal
        open={purgeModalOpen}
        title="Purge all portfolio data?"
        description="This removes all assets and every log entry. Your login and settings (including currency) are kept."
        confirmLabel="Purge everything"
        cancelLabel="Cancel"
        danger
        onClose={() => setPurgeModalOpen(false)}
        onConfirm={() => void runPurge()}
      />
    </main>
  )
}
