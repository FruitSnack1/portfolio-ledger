import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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
