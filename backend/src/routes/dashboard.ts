import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { eq, inArray } from 'drizzle-orm'
import { requireUserId } from '../auth/requireUserId.js'
import { buildDashboard } from '../portfolio/buildDashboard.js'
import type { Db } from '../db/client.js'
import { assetLogs, assets } from '../db/schema.js'

function isMissingDashboardTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if (!('message' in error)) return false
  const msg = String((error as { message: unknown }).message)
  return msg.includes('relation "assets" does not exist') || msg.includes('relation "asset_logs" does not exist')
}

export async function registerDashboardRoutes(app: FastifyInstance, db: Db) {
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    try {
      const assetRows = await db
        .select({
          id: assets.id,
          name: assets.name,
          color: assets.color,
        })
        .from(assets)
        .where(eq(assets.userId, userId))

      if (assetRows.length === 0) {
        return {
          totals: { totalBalance: 0, totalDeposits: 0, plMoney: 0, plPercent: null as number | null },
          balanceOverTime: [],
          distribution: [],
          assets: [],
        }
      }

      const assetIds = assetRows.map((a) => a.id)

      const logRows = await db
        .select({
          assetId: assetLogs.assetId,
          year: assetLogs.year,
          month: assetLogs.month,
          deposit: assetLogs.deposit,
          balance: assetLogs.balance,
        })
        .from(assetLogs)
        .where(inArray(assetLogs.assetId, assetIds))

      const payload = buildDashboard(
        assetRows.map((a) => ({ id: a.id, name: a.name, color: a.color })),
        logRows.map((r) => ({
          assetId: r.assetId,
          year: r.year,
          month: r.month,
          deposit: String(r.deposit),
          balance: String(r.balance),
        })),
      )

      return payload
    } catch (error: unknown) {
      request.log.error(error)
      if (isMissingDashboardTable(error))
        return reply.status(503).send({
          error: 'Database is missing tables. Apply migrations, then try again (npm run db:migrate -w backend).',
        })
      return reply.status(500).send({ error: 'Failed to load dashboard' })
    }
  })
}
