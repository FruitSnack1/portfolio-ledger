import { migrate } from 'drizzle-orm/postgres-js/migrator'
import path from 'node:path'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

/** Applies SQL migrations in ./drizzle (run with backend cwd). */
export async function runMigrations(databaseUrl: string) {
  const migrationClient = postgres(databaseUrl, { max: 1 })
  const db = drizzle(migrationClient)
  const migrationsFolder = path.join(process.cwd(), 'drizzle')
  await migrate(db, { migrationsFolder })
  await migrationClient.end({ timeout: 5 })
}
