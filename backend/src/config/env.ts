import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
})

export type Env = z.infer<typeof schema>

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid or missing environment variables (see backend/.env.example)')
  }
  return parsed.data
}
