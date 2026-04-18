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

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
})

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if (!('code' in error)) return false
  return (error as { code?: string }).code === '23505'
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isSecureRequest(request: FastifyRequest) {
  return request.protocol === 'https'
}

export type AuthRouteCookieOptions = { cookieSameSite: 'lax' | 'none' }

function createTokenCookieSetters(sameSite: 'lax' | 'none') {
  const secureFor = (request: FastifyRequest) => (sameSite === 'none' ? true : isSecureRequest(request))

  function setTokenCookie(reply: FastifyReply, token: string, request: FastifyRequest) {
    reply.setCookie(authCookieName, token, {
      path: '/',
      httpOnly: true,
      sameSite,
      secure: secureFor(request),
      maxAge: 60 * 60 * 24 * 7,
    })
  }

  function clearTokenCookie(reply: FastifyReply, request: FastifyRequest) {
    reply.setCookie(authCookieName, '', {
      path: '/',
      httpOnly: true,
      sameSite,
      secure: secureFor(request),
      maxAge: 0,
    })
  }

  return { setTokenCookie, clearTokenCookie }
}

function createRegisterHandler(
  db: Db,
  setTokenCookie: (reply: FastifyReply, token: string, request: FastifyRequest) => void,
) {
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
      setTokenCookie(reply, token, request)
      return reply.status(201).send({ user: row })
    } catch (error: unknown) {
      if (isUniqueViolation(error)) return reply.status(409).send({ error: 'Email already registered' })
      throw error
    }
  }
}

function createLoginHandler(
  db: Db,
  setTokenCookie: (reply: FastifyReply, token: string, request: FastifyRequest) => void,
) {
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
    setTokenCookie(reply, token, request)
    return {
      user: { id: row.id, email: row.email, displayCurrency: row.displayCurrency },
    }
  }
}

function createLogoutHandler(clearTokenCookie: (reply: FastifyReply, request: FastifyRequest) => void) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    clearTokenCookie(reply, request)
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

function createChangePasswordHandler(db: Db) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return

    const parsed = changePasswordBodySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid password request' })

    const [row] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!row) return reply.status(401).send({ error: 'Unauthorized' })

    if (!verifyPassword(parsed.data.currentPassword, row.passwordHash))
      return reply.status(401).send({ error: 'Current password is incorrect' })

    if (verifyPassword(parsed.data.newPassword, row.passwordHash))
      return reply.status(400).send({ error: 'New password must be different from the current one' })

    const passwordHash = hashPassword(parsed.data.newPassword)
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId))

    return { ok: true }
  }
}

export async function registerAuthRoutes(app: FastifyInstance, db: Db, cookieOpts: AuthRouteCookieOptions) {
  const { setTokenCookie, clearTokenCookie } = createTokenCookieSetters(cookieOpts.cookieSameSite)

  app.post('/register', createRegisterHandler(db, setTokenCookie))
  app.post('/login', createLoginHandler(db, setTokenCookie))
  app.post('/logout', createLogoutHandler(clearTokenCookie))
  app.get('/me', createMeHandler(db))
  app.patch('/me', createPatchMeHandler(db))
  app.post('/change-password', createChangePasswordHandler(db))
}
