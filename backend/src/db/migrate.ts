import { migrate } from 'drizzle-orm/postgres-js/migrator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

/** Resolves `backend/drizzle` from compiled `dist/db/migrate.js` so migrations work regardless of `process.cwd()`. */
function migrationsFolderPath() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.join(here, '..', '..', 'drizzle')
}

/** Applies SQL migrations in `backend/drizzle`. */
export async function runMigrations(databaseUrl: string) {
  const migrationClient = postgres(databaseUrl, { max: 1 })
  const db = drizzle(migrationClient)
  await migrate(db, { migrationsFolder: migrationsFolderPath() })
  await migrationClient.end({ timeout: 5 })
}
