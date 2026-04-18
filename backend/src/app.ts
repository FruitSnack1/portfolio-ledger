import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import Fastify from 'fastify'
import type { Env } from './config/env.js'
import type { Db } from './db/client.js'
import { registerAssetLogRoutes } from './routes/assetLogs.js'
import { registerAssetRoutes } from './routes/assets.js'
import { registerAuthRoutes } from './routes/auth.js'

export async function buildApp(env: Env, db: Db) {
  const app = Fastify({ logger: true })

  await app.register(cookie)
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '7d' },
    cookie: { cookieName: 'token', signed: false },
  })

  const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']
  await app.register(cors, {
    origin: devOrigins,
    credentials: true,
  })

  app.get('/api/health', async () => ({ ok: true }))

  await app.register(async (instance) => {
    await registerAuthRoutes(instance, db)
  }, { prefix: '/api/auth' })

  await app.register(async (instance) => {
    await registerAssetLogRoutes(instance, db)
    await registerAssetRoutes(instance, db)
  }, { prefix: '/api/assets' })

  return app
}
