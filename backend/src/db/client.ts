import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

let sql: ReturnType<typeof postgres> | null = null

/** Opens a single Postgres pool for the process. */
export function connectDb(databaseUrl: string) {
  if (sql) return drizzle(sql, { schema })
  sql = postgres(databaseUrl)
  return drizzle(sql, { schema })
}

export function getSql() {
  if (!sql) throw new Error('Database not connected')
  return sql
}

export type Db = ReturnType<typeof connectDb>
