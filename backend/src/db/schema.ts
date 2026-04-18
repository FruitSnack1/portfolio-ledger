import { index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  /** ISO 4217 code for portfolio display; null until user completes setup. */
  displayCurrency: text('display_currency'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Display color as #RRGGBB uppercase. */
    color: text('color').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('assets_user_id_idx').on(t.userId),
  }),
)

/** One row per asset per calendar month: deposit and end-of-period balance. */
export const assetLogs = pgTable(
  'asset_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    deposit: numeric('deposit', { precision: 18, scale: 4 }).notNull(),
    balance: numeric('balance', { precision: 18, scale: 4 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    assetIdx: index('asset_logs_asset_id_idx').on(t.assetId),
    assetYearMonthUnique: uniqueIndex('asset_logs_asset_year_month_uidx').on(t.assetId, t.year, t.month),
  }),
)
