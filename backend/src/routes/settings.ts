import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../auth/requireUserId.js'
import type { Db } from '../db/client.js'
import { assets } from '../db/schema.js'

/** Deletes all assets (and their logs via FK cascade) for the authenticated user. */
export async function registerSettingsRoutes(app: FastifyInstance, db: Db) {
  app.post('/purge-portfolio', async (request, reply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    try {
      const deleted = await db.delete(assets).where(eq(assets.userId, userId)).returning({ id: assets.id })
      return { ok: true, deletedAssetCount: deleted.length }
    } catch (error: unknown) {
      request.log.error(error)
      return reply.status(500).send({ error: 'Failed to purge portfolio data' })
    }
  })
}
