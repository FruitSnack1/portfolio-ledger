import Fastify from 'fastify'

/** Builds the HTTP app with routes registered (no listen). */
export function buildApp() {
  const app = Fastify({ logger: true })

  app.get('/api/health', async () => ({ ok: true }))

  return app
}
