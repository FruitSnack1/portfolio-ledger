import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { formatDbNumericStringForClient } from '../asset/formatDbNumericString.js'
import { requireUserId } from '../auth/requireUserId.js'
import type { Db } from '../db/client.js'
import { assetLogs, assets } from '../db/schema.js'

const assetIdParamsSchema = z.object({
  assetId: z.string().uuid(),
})

const logIdParamsSchema = z.object({
  assetId: z.string().uuid(),
  logId: z.string().uuid(),
})

const postLogBodySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  deposit: z.coerce.number().finite(),
  balance: z.coerce.number().finite(),
})

const patchLogBodySchema = postLogBodySchema

const bulkImportSubmitBodySchema = z.object({
  entries: z.array(
    z.object({
      assetId: z.string().uuid(),
      deposit: z.coerce.number().finite(),
      balance: z.coerce.number().finite(),
    }),
  ),
})

const assetSummaryColumns = {
  id: assets.id,
  name: assets.name,
  color: assets.color,
  createdAt: assets.createdAt,
  withdrawn: assets.withdrawn,
}

const logReturnColumns = {
  id: assetLogs.id,
  year: assetLogs.year,
  month: assetLogs.month,
  deposit: assetLogs.deposit,
  balance: assetLogs.balance,
  createdAt: assetLogs.createdAt,
}

function isMissingAssetLogsTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if (!('message' in error)) return false
  const msg = String((error as { message: unknown }).message)
  return msg.includes('relation "asset_logs" does not exist')
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if (!('code' in error)) return false
  return (error as { code: unknown }).code === '23505'
}

async function loadOwnedAsset(db: Db, userId: string, assetId: string) {
  const [row] = await db
    .select(assetSummaryColumns)
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
    .limit(1)
  return row ?? null
}

export async function registerAssetLogRoutes(app: FastifyInstance, db: Db) {
  app.get('/bulk-import/current-month-draft', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    try {
      const activeAssets = await db
        .select({ id: assets.id, name: assets.name, color: assets.color })
        .from(assets)
        .where(and(eq(assets.userId, userId), eq(assets.withdrawn, false)))

      const rows: {
        assetId: string
        name: string
        color: string
        prefillDeposit: string
        prefillBalance: string
        blocked: boolean
        blockReason: 'month_exists' | null
      }[] = []

      for (const a of activeAssets) {
        const [existingThisMonth] = await db
          .select(logReturnColumns)
          .from(assetLogs)
          .where(and(eq(assetLogs.assetId, a.id), eq(assetLogs.year, year), eq(assetLogs.month, month)))
          .limit(1)

        const [latest] = await db
          .select(logReturnColumns)
          .from(assetLogs)
          .where(eq(assetLogs.assetId, a.id))
          .orderBy(desc(assetLogs.year), desc(assetLogs.month))
          .limit(1)

        const blocked = existingThisMonth != null
        if (blocked) {
          rows.push({
            assetId: a.id,
            name: a.name,
            color: a.color,
            prefillDeposit: formatDbNumericStringForClient(existingThisMonth.deposit),
            prefillBalance: formatDbNumericStringForClient(existingThisMonth.balance),
            blocked: true,
            blockReason: 'month_exists',
          })
          continue
        }

        rows.push({
          assetId: a.id,
          name: a.name,
          color: a.color,
          prefillDeposit: latest ? formatDbNumericStringForClient(latest.deposit) : '',
          prefillBalance: latest ? formatDbNumericStringForClient(latest.balance) : '',
          blocked: false,
          blockReason: null,
        })
      }

      return { year, month, rows }
    } catch (error: unknown) {
      request.log.error(error)
      if (isMissingAssetLogsTable(error))
        return reply.status(503).send({
          error:
            'Database is missing the asset_logs table. Apply migrations, then try again (npm run db:migrate -w backend).',
        })
      return reply.status(500).send({ error: 'Failed to load bulk import draft' })
    }
  })

  app.post('/bulk-import/current-month', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const bodyParsed = bulkImportSubmitBodySchema.safeParse(request.body)
    if (!bodyParsed.success) return reply.status(400).send({ error: 'Invalid entries payload' })

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    try {
      const createdRows: {
        assetId: string
        name: string
        log: {
          id: string
          year: number
          month: number
          deposit: string
          balance: string
          createdAt: Date
        }
      }[] = []
      const failed: { assetId: string; name: string; error: string }[] = []

      for (const entry of bodyParsed.data.entries) {
        const asset = await loadOwnedAsset(db, userId, entry.assetId)
        if (!asset) {
          failed.push({ assetId: entry.assetId, name: 'Unknown', error: 'Asset not found' })
          continue
        }
        if (asset.withdrawn) {
          failed.push({ assetId: entry.assetId, name: asset.name, error: 'Asset is withdrawn' })
          continue
        }

        const [existingThisMonth] = await db
          .select({ id: assetLogs.id })
          .from(assetLogs)
          .where(and(eq(assetLogs.assetId, entry.assetId), eq(assetLogs.year, year), eq(assetLogs.month, month)))
          .limit(1)

        if (existingThisMonth) {
          failed.push({ assetId: entry.assetId, name: asset.name, error: 'Log for this month already exists' })
          continue
        }

        try {
          const [row] = await db
            .insert(assetLogs)
            .values({
              assetId: entry.assetId,
              year,
              month,
              deposit: String(entry.deposit),
              balance: String(entry.balance),
            })
            .returning(logReturnColumns)

          if (!row) continue
          createdRows.push({
            assetId: entry.assetId,
            name: asset.name,
            log: {
              id: row.id,
              year: row.year,
              month: row.month,
              deposit: String(row.deposit),
              balance: String(row.balance),
              createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt)),
            },
          })
        } catch (error: unknown) {
          request.log.error(error)
          if (isUniqueViolation(error))
            failed.push({ assetId: entry.assetId, name: asset.name, error: 'Log for this month already exists' })
          else failed.push({ assetId: entry.assetId, name: asset.name, error: 'Could not save log' })
        }
      }

      return { year, month, created: createdRows, failed }
    } catch (error: unknown) {
      request.log.error(error)
      if (isMissingAssetLogsTable(error))
        return reply.status(503).send({
          error:
            'Database is missing the asset_logs table. Apply migrations, then try again (npm run db:migrate -w backend).',
        })
      return reply.status(500).send({ error: 'Failed to bulk import logs' })
    }
  })

  app.get('/:assetId/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const paramsParsed = assetIdParamsSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'Invalid asset id' })

    const assetId = paramsParsed.data.assetId

    try {
      const asset = await loadOwnedAsset(db, userId, assetId)
      if (!asset) return reply.status(404).send({ error: 'Asset not found' })

      const logs = await db
        .select(logReturnColumns)
        .from(assetLogs)
        .where(eq(assetLogs.assetId, assetId))
        .orderBy(desc(assetLogs.year), desc(assetLogs.month))

      return { asset, logs }
    } catch (error: unknown) {
      request.log.error(error)
      if (isMissingAssetLogsTable(error))
        return reply.status(503).send({
          error:
            'Database is missing the asset_logs table. Apply migrations, then try again (npm run db:migrate -w backend).',
        })
      return reply.status(500).send({ error: 'Failed to load logs' })
    }
  })

  app.post('/:assetId/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const paramsParsed = assetIdParamsSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'Invalid asset id' })

    const bodyParsed = postLogBodySchema.safeParse(request.body)
    if (!bodyParsed.success) return reply.status(400).send({ error: 'Invalid year, month, deposit, or balance' })

    const assetId = paramsParsed.data.assetId
    const { year, month, deposit, balance } = bodyParsed.data

    try {
      const asset = await loadOwnedAsset(db, userId, assetId)
      if (!asset) return reply.status(404).send({ error: 'Asset not found' })

      const [row] = await db
        .insert(assetLogs)
        .values({
          assetId,
          year,
          month,
          deposit: String(deposit),
          balance: String(balance),
        })
        .returning(logReturnColumns)

      if (!row) return reply.status(500).send({ error: 'Failed to save log' })

      return reply.status(201).send({ log: row, asset })
    } catch (error: unknown) {
      request.log.error(error)
      if (isUniqueViolation(error))
        return reply.status(409).send({ error: 'A log for that month already exists for this asset' })
      if (isMissingAssetLogsTable(error))
        return reply.status(503).send({
          error: 'Database is missing the asset_logs table. Apply migrations, then try again.',
        })
      return reply.status(500).send({ error: 'Failed to save log' })
    }
  })

  app.patch('/:assetId/logs/:logId', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const paramsParsed = logIdParamsSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'Invalid asset or log id' })

    const bodyParsed = patchLogBodySchema.safeParse(request.body)
    if (!bodyParsed.success) return reply.status(400).send({ error: 'Invalid year, month, deposit, or balance' })

    const { assetId, logId } = paramsParsed.data
    const { year, month, deposit, balance } = bodyParsed.data

    try {
      const asset = await loadOwnedAsset(db, userId, assetId)
      if (!asset) return reply.status(404).send({ error: 'Asset not found' })

      const [existing] = await db
        .select({ id: assetLogs.id })
        .from(assetLogs)
        .where(and(eq(assetLogs.id, logId), eq(assetLogs.assetId, assetId)))
        .limit(1)

      if (!existing) return reply.status(404).send({ error: 'Log not found' })

      const [row] = await db
        .update(assetLogs)
        .set({
          year,
          month,
          deposit: String(deposit),
          balance: String(balance),
        })
        .where(and(eq(assetLogs.id, logId), eq(assetLogs.assetId, assetId)))
        .returning(logReturnColumns)

      if (!row) return reply.status(404).send({ error: 'Log not found' })

      return { log: row }
    } catch (error: unknown) {
      request.log.error(error)
      if (isUniqueViolation(error))
        return reply.status(409).send({ error: 'Another log already uses that month for this asset' })
      if (isMissingAssetLogsTable(error))
        return reply.status(503).send({
          error: 'Database is missing the asset_logs table. Apply migrations, then try again.',
        })
      return reply.status(500).send({ error: 'Failed to update log' })
    }
  })

  app.delete('/:assetId/logs/:logId', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const paramsParsed = logIdParamsSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'Invalid asset or log id' })

    const { assetId, logId } = paramsParsed.data

    try {
      const asset = await loadOwnedAsset(db, userId, assetId)
      if (!asset) return reply.status(404).send({ error: 'Asset not found' })

      const removed = await db
        .delete(assetLogs)
        .where(and(eq(assetLogs.id, logId), eq(assetLogs.assetId, assetId)))
        .returning({ id: assetLogs.id })

      if (removed.length === 0) return reply.status(404).send({ error: 'Log not found' })

      return { ok: true }
    } catch (error: unknown) {
      request.log.error(error)
      if (isMissingAssetLogsTable(error))
        return reply.status(503).send({
          error: 'Database is missing the asset_logs table. Apply migrations, then try again.',
        })
      return reply.status(500).send({ error: 'Failed to delete log' })
    }
  })
}
