import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  /** Comma-separated browser origins allowed to call the API with credentials (e.g. `https://your-app.vercel.app`, no trailing slash). */
  CORS_ORIGINS: z.string().optional(),
  /** Same as `CORS_ORIGINS` for a single URL (optional; avoids typos if you only set one variable). */
  CORS_ORIGIN: z.string().optional(),
  /**
   * `none` = cross-site cookies (needs `CORS_ORIGINS` + HTTPS). Use when the frontend is on a different host than the API.
   * `lax` = default for same-site / local dev.
   */
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'none']).default('lax'),
})

export type Env = z.infer<typeof schema>

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid or missing environment variables (see backend/.env.example)')
  }
  const data = parsed.data
  if (data.AUTH_COOKIE_SAME_SITE === 'none') {
    const hasCors =
      [data.CORS_ORIGINS, data.CORS_ORIGIN].some((s) => s != null && s.split(',').some((p) => p.trim().length > 0))
    if (!hasCors)
      throw new Error('AUTH_COOKIE_SAME_SITE=none requires CORS_ORIGINS or CORS_ORIGIN (your frontend URL(s))')
  }
  return data
}
