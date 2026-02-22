import { sql } from 'drizzle-orm';
import { jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const stockMovementTable = pgTable('module_products_stock_movements', {
  id: uuid('id').primaryKey().notNull(),
  product_id: uuid('product_id').notNull(),
  variant_id: uuid('variant_id'),
  type: text('type').notNull(),
  quantity: numeric('quantity').notNull(),
  reference_type: text('reference_type'),
  reference_id: text('reference_id'),
  unit_cost: numeric('unit_cost'),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
});

export type StockMovementRow = typeof stockMovementTable.$inferSelect;
export type NewStockMovementRow = typeof stockMovementTable.$inferInsert;
