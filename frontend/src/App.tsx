import { useEffect, useState } from 'react'

type Health = { ok: boolean }

async function fetchHealth(): Promise<Health> {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  return res.json() as Promise<Health>
}

export function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchHealth()
      .then((data) => {
        if (!cancelled) setHealth(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="app">
      <h1>Portfolio Ledger</h1>
      <p className="muted">Vite + React frontend</p>
      <section className="card">
        <h2>API</h2>
        {error != null && <p className="error">{error}</p>}
        {error == null && health == null && <p>Checking backend…</p>}
        {health != null && (
          <p>
            Backend: <code>/api/health</code> → {JSON.stringify(health)}
          </p>
        )}
      </section>
    </main>
  )
}
