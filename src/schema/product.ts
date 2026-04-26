import { sql } from 'drizzle-orm';
import { boolean, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const productTable = pgTable('module_products_products', {
  id: uuid('id').primaryKey().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category_id: uuid('category_id'),
  sku: text('sku'),
  barcode: text('barcode'),
  unit: text('unit'),
  purchase_price: numeric('purchase_price'),
  sale_price: numeric('sale_price'),
  tax_rate: numeric('tax_rate'),
  stock_current: numeric('stock_current').notNull().default('0'),
  stock_minimum: numeric('stock_minimum').notNull().default('0'),
  image_url: text('image_url'),
  tags: jsonb('tags'),
  metadata: jsonb('metadata'),
  is_active: boolean('is_active').notNull().default(true),
  deleted_at: timestamp('deleted_at', { mode: 'string' }),
  created_at: timestamp('created_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
  updated_at: timestamp('updated_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date().toISOString()),
});

export type ProductRow = typeof productTable.$inferSelect;
export type NewProductRow = typeof productTable.$inferInsert;
