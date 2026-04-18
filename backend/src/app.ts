import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import Fastify from 'fastify'
import type { Env } from './config/env.js'
import type { Db } from './db/client.js'
import { registerAllLogsRoutes } from './routes/allLogs.js'
import { registerAssetLogRoutes } from './routes/assetLogs.js'
import { registerAssetRoutes } from './routes/assets.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerDashboardRoutes } from './routes/dashboard.js'
import { registerSettingsRoutes } from './routes/settings.js'

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

  await app.register(async (instance) => {
    await registerDashboardRoutes(instance, db)
  }, { prefix: '/api/dashboard' })

  await app.register(async (instance) => {
    await registerAllLogsRoutes(instance, db)
  }, { prefix: '/api/logs' })

  await app.register(async (instance) => {
    await registerSettingsRoutes(instance, db)
  }, { prefix: '/api/settings' })

  return app
}
