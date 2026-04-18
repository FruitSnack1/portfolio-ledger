export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Absolute API origin in production, e.g. `https://your-api.onrender.com` (no trailing slash). Empty = same origin + Vite `/api` proxy in dev. */
function apiOrigin(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  if (raw == null || raw === '') return ''
  return raw.replace(/\/$/, '')
}

/** Resolves `/api/...` against `VITE_API_URL` when set. */
export function apiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = apiOrigin()
  if (!base) return path
  return new URL(path, `${base}/`).href
}

/** JSON fetch to `/api` on the same host, or to `VITE_API_URL` when set. Sends cookies (cross-origin only if backend allows your frontend origin). */
export async function apiJson<T>(input: string, init?: RequestInit): Promise<T> {
  const hasJsonBody = init?.body != null && init.body !== ''

  const res = await fetch(apiUrl(input), {
    credentials: 'include',
    headers: {
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      throw new ApiError(res.status, 'Invalid JSON response')
    }
  }

  if (!res.ok) {
    const errBody = body as { error?: string } | null
    const message = errBody?.error ?? res.statusText
    throw new ApiError(res.status, message)
  }

  return body as T
}
