import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { desc, eq } from 'drizzle-orm'
import { formatDbNumericStringForClient } from '../asset/formatDbNumericString.js'
import { requireUserId } from '../auth/requireUserId.js'
import type { Db } from '../db/client.js'
import { assetLogs, assets } from '../db/schema.js'

export async function registerAllLogsRoutes(app: FastifyInstance, db: Db) {
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const rows = await db
      .select({
        id: assetLogs.id,
        year: assetLogs.year,
        month: assetLogs.month,
        deposit: assetLogs.deposit,
        balance: assetLogs.balance,
        createdAt: assetLogs.createdAt,
        assetId: assets.id,
        assetName: assets.name,
        assetColor: assets.color,
        withdrawn: assets.withdrawn,
      })
      .from(assetLogs)
      .innerJoin(assets, eq(assetLogs.assetId, assets.id))
      .where(eq(assets.userId, userId))
      .orderBy(desc(assetLogs.year), desc(assetLogs.month), desc(assetLogs.createdAt))

    return {
      logs: rows.map((r) => ({
        id: r.id,
        assetId: r.assetId,
        assetName: r.assetName,
        assetColor: r.assetColor,
        withdrawn: r.withdrawn,
        year: r.year,
        month: r.month,
        deposit: formatDbNumericStringForClient(r.deposit),
        balance: formatDbNumericStringForClient(r.balance),
        createdAt: r.createdAt.toISOString(),
      })),
    }
  })
}
