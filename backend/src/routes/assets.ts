import type { FastifyInstance } from 'fastify'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { assetColorSchema } from '../asset/assetColorPalette.js'
import { computeAssetListSummaryForLogs } from '../asset/assetListSummary.js'
import { requireUserId } from '../auth/requireUserId.js'
import type { Db } from '../db/client.js'
import { assetLogs, assets } from '../db/schema.js'

const createAssetBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  color: assetColorSchema,
})

const assetIdParamsSchema = z.object({
  id: z.string().uuid(),
})

const patchAssetBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    color: assetColorSchema.optional(),
    withdrawn: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.name === undefined && d.color === undefined && d.withdrawn === undefined)
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' })
  })

const assetReturnColumns = {
  id: assets.id,
  name: assets.name,
  color: assets.color,
  createdAt: assets.createdAt,
  withdrawn: assets.withdrawn,
}

const emptyAssetListSummary = {
  hasLogs: false,
  currentBalance: null,
  sumDeposits: 0,
  percentPL: null,
} as const

function isMissingAssetsTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if (!('message' in error)) return false
  const msg = String((error as { message: unknown }).message)
  return msg.includes('relation "assets" does not exist')
}

export async function registerAssetRoutes(app: FastifyInstance, db: Db) {
  app.get('/', async (request, reply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    try {
      const rows = await db
        .select(assetReturnColumns)
        .from(assets)
        .where(eq(assets.userId, userId))
        .orderBy(desc(assets.createdAt))

      const assetIds = rows.map((r) => r.id)
      const logsByAssetId = new Map<string, { year: number; month: number; deposit: string; balance: string }[]>()
      if (assetIds.length > 0) {
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
        for (const log of logRows) {
          const deposit = String(log.deposit).trim()
          const balance = String(log.balance).trim()
          const list = logsByAssetId.get(log.assetId) ?? []
          list.push({ year: log.year, month: log.month, deposit, balance })
          logsByAssetId.set(log.assetId, list)
        }
      }

      const assetsWithSummary = rows.map((asset) => ({
        ...asset,
        summary: computeAssetListSummaryForLogs(logsByAssetId.get(asset.id) ?? []),
      }))

      return { assets: assetsWithSummary }
    } catch (error: unknown) {
      request.log.error(error)
      if (isMissingAssetsTable(error))
        return reply.status(503).send({
          error: 'Database is missing the assets table. From the repo root run Postgres, then restart the API so migrations run (or run npm run db:migrate -w backend).',
        })
      return reply.status(500).send({ error: 'Failed to load assets' })
    }
  })

  app.post('/', async (request, reply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const parsed = createAssetBodySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid name or color choice' })

    try {
      const [row] = await db
        .insert(assets)
        .values({
          userId,
          name: parsed.data.name,
          color: parsed.data.color,
        })
        .returning(assetReturnColumns)

      if (!row) return reply.status(500).send({ error: 'Failed to create asset' })

      return reply.status(201).send({ asset: { ...row, summary: { ...emptyAssetListSummary } } })
    } catch (error: unknown) {
      request.log.error(error)
      if (isMissingAssetsTable(error))
        return reply.status(503).send({
          error: 'Database is missing the assets table. Apply migrations, then try again.',
        })
      return reply.status(500).send({ error: 'Failed to create asset' })
    }
  })

  app.patch('/:id', async (request, reply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const paramsParsed = assetIdParamsSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'Invalid asset id' })

    const bodyParsed = patchAssetBodySchema.safeParse(request.body)
    if (!bodyParsed.success) return reply.status(400).send({ error: 'Invalid update' })

    const assetId = paramsParsed.data.id
    const patch = bodyParsed.data

    try {
      const [existing] = await db
        .select({ id: assets.id })
        .from(assets)
        .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
        .limit(1)

      if (!existing) return reply.status(404).send({ error: 'Asset not found' })

      const updates: { name?: string; color?: string; withdrawn?: boolean } = {}
      if (patch.name !== undefined) updates.name = patch.name
      if (patch.color !== undefined) updates.color = patch.color
      if (patch.withdrawn !== undefined) updates.withdrawn = patch.withdrawn

      const [row] = await db
        .update(assets)
        .set(updates)
        .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
        .returning(assetReturnColumns)

      if (!row) return reply.status(404).send({ error: 'Asset not found' })

      return { asset: row }
    } catch (error: unknown) {
      request.log.error(error)
      if (isMissingAssetsTable(error))
        return reply.status(503).send({
          error: 'Database is missing the assets table. Apply migrations, then try again.',
        })
      return reply.status(500).send({ error: 'Failed to update asset' })
    }
  })

  app.delete('/:id', async (request, reply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const paramsParsed = assetIdParamsSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'Invalid asset id' })

    const assetId = paramsParsed.data.id

    try {
      const deleted = await db
        .delete(assets)
        .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
        .returning({ id: assets.id })

      if (deleted.length === 0) return reply.status(404).send({ error: 'Asset not found' })

      return { ok: true }
    } catch (error: unknown) {
      request.log.error(error)
      if (isMissingAssetsTable(error))
        return reply.status(503).send({
          error: 'Database is missing the assets table. Apply migrations, then try again.',
        })
      return reply.status(500).send({ error: 'Failed to delete asset' })
    }
  })
}
