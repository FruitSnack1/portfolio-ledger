import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireUserId } from '../auth/requireUserId.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { isSupportedCurrencyCode } from '../currency/supportedCurrencies.js'
import type { Db } from '../db/client.js'
import { users } from '../db/schema.js'

const authCookieName = 'token'

const credentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
})

function parseCredentials(body: unknown) {
  return credentialsSchema.safeParse(body)
}

const patchMeBodySchema = z.object({
  displayCurrency: z
    .string()
    .length(3)
    .transform((s) => s.toUpperCase())
    .refine(isSupportedCurrencyCode, { message: 'Unsupported currency' }),
})

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if (!('code' in error)) return false
  return (error as { code?: string }).code === '23505'
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function setAuthCookie(reply: FastifyReply, token: string, secure: boolean) {
  reply.setCookie(authCookieName, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 60 * 60 * 24 * 7,
  })
}

function clearAuthCookie(reply: FastifyReply, secure: boolean) {
  reply.setCookie(authCookieName, '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 0,
  })
}

function isSecureRequest(request: FastifyRequest) {
  return request.protocol === 'https'
}

function createRegisterHandler(db: Db) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = parseCredentials(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid email or password' })

    const email = normalizeEmail(parsed.data.email)
    const passwordHash = hashPassword(parsed.data.password)

    try {
      const [row] = await db
        .insert(users)
        .values({ email, passwordHash })
        .returning({
          id: users.id,
          email: users.email,
          displayCurrency: users.displayCurrency,
        })

      if (!row) throw new Error('Failed to create user')

      const token = await reply.jwtSign({ sub: row.id, email: row.email })
      setAuthCookie(reply, token, isSecureRequest(request))
      return reply.status(201).send({ user: row })
    } catch (error: unknown) {
      if (isUniqueViolation(error)) return reply.status(409).send({ error: 'Email already registered' })
      throw error
    }
  }
}

function createLoginHandler(db: Db) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = parseCredentials(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid email or password' })

    const email = normalizeEmail(parsed.data.email)
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        displayCurrency: users.displayCurrency,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (!row) return reply.status(401).send({ error: 'Invalid email or password' })

    if (!verifyPassword(parsed.data.password, row.passwordHash))
      return reply.status(401).send({ error: 'Invalid email or password' })

    const token = await reply.jwtSign({ sub: row.id, email: row.email })
    setAuthCookie(reply, token, isSecureRequest(request))
    return {
      user: { id: row.id, email: row.email, displayCurrency: row.displayCurrency },
    }
  }
}

function createLogoutHandler() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    clearAuthCookie(reply, isSecureRequest(request))
    return { ok: true }
  }
}

function createMeHandler(db: Db) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        displayCurrency: users.displayCurrency,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!row) return reply.status(401).send({ error: 'Unauthorized' })

    return { user: row }
  }
}

function createPatchMeHandler(db: Db) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const parsed = patchMeBodySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid display currency' })

    const [row] = await db
      .update(users)
      .set({ displayCurrency: parsed.data.displayCurrency })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        displayCurrency: users.displayCurrency,
      })

    if (!row) return reply.status(404).send({ error: 'User not found' })

    return { user: row }
  }
}

export async function registerAuthRoutes(app: FastifyInstance, db: Db) {
  app.post('/register', createRegisterHandler(db))
  app.post('/login', createLoginHandler(db))
  app.post('/logout', createLogoutHandler())
  app.get('/me', createMeHandler(db))
  app.patch('/me', createPatchMeHandler(db))
}
