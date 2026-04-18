import cors from '@fastify/cors'
import type { FastifyInstance } from 'fastify'
import type { Env } from '../config/env.js'

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
] as const

/** Trims, strips trailing slashes, lowercases (browsers send lowercase https origins). */
function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, '').toLowerCase()
}

function collectConfiguredOrigins(env: Env): string[] {
  const merged = [env.CORS_ORIGINS, env.CORS_ORIGIN].filter((s): s is string => s != null && s.trim().length > 0)
  if (merged.length === 0) return []
  return merged
    .join(',')
    .split(',')
    .map((s) => normalizeOrigin(s))
    .filter((s) => s.length > 0)
}

/**
 * Registers CORS first so OPTIONS preflight is handled before other plugins (see @fastify/cors README).
 * Uses normalized origin matching so `https://app.vercel.app/` in env still matches the browser Origin.
 */
export async function registerAppCors(app: FastifyInstance, env: Env) {
  const allowed = new Set<string>()
  for (const o of DEV_ORIGINS) allowed.add(normalizeOrigin(o))
  for (const o of collectConfiguredOrigins(env)) allowed.add(o)

  await app.register(cors, {
    origin: (originHeader, cb) => {
      if (originHeader == null || originHeader === '') return cb(null, false)
      if (allowed.has(normalizeOrigin(originHeader))) return cb(null, true)
      return cb(null, false)
    },
    credentials: true,
    strictPreflight: false,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  })

  app.log.info({ corsAllowlist: [...allowed] }, 'CORS enabled')
}
