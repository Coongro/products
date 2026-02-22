import { sql } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const categoryTable = pgTable('module_products_categories', {
  id: uuid('id').primaryKey().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  parent_id: uuid('parent_id'),
  slug: text('slug'),
  icon: text('icon'),
  color: text('color'),
  order: integer('order').notNull().default(0),
  metadata: jsonb('metadata'),
  is_active: boolean('is_active').notNull().default(true),
  deleted_at: timestamp('deleted_at', { mode: 'string' }),
  created_at: timestamp('created_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
  updated_at: timestamp('updated_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
});

export type CategoryRow = typeof categoryTable.$inferSelect;
export type NewCategoryRow = typeof categoryTable.$inferInsert;
