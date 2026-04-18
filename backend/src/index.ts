import { loadEnv } from './config/env.js'
import { connectDb } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { buildApp } from './app.js'

const env = loadEnv()

await runMigrations(env.DATABASE_URL)
const db = connectDb(env.DATABASE_URL)
const app = await buildApp(env, db)

const port = env.PORT
const host = env.HOST

try {
  await app.listen({ port, host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
