import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { importLogsCsv } from '../csv/importLogsCsv.js'
import { formatDbNumericStringForClient } from '../asset/formatDbNumericString.js'
import { requireUserId } from '../auth/requireUserId.js'
import type { Db } from '../db/client.js'
import { assetLogs, assets } from '../db/schema.js'

const importCsvBodySchema = z.object({
  csv: z.string().min(1).max(1_500_000),
})

export async function registerAllLogsRoutes(app: FastifyInstance, db: Db) {
  app.post(
    '/import-csv',
    { bodyLimit: 3 * 1024 * 1024 },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = await requireUserId(request, reply)
      if (!userId) return

      const parsed = importCsvBodySchema.safeParse(request.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid body: send JSON { "csv": "..." }' })

      try {
        const result = await importLogsCsv(db, userId, parsed.data.csv)
        return result
      } catch (error: unknown) {
        request.log.error(error)
        return reply.status(500).send({ error: 'CSV import failed' })
      }
    },
  )

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
