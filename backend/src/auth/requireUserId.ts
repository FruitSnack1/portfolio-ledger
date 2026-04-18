import type { FastifyReply, FastifyRequest } from 'fastify'

/** Returns JWT `sub` or sends 401 and returns null. */
export async function requireUserId(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  try {
    await request.jwtVerify({ onlyCookie: true })
  } catch {
    void reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  return request.user.sub
}
