export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** JSON fetch to same-origin `/api` (Vite proxy in dev). Sends cookies. */
export async function apiJson<T>(input: string, init?: RequestInit): Promise<T> {
  const hasJsonBody = init?.body != null && init.body !== ''

  const res = await fetch(input, {
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
