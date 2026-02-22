import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const variantTable = pgTable('module_products_variants', {
  id: uuid('id').primaryKey().notNull(),
  product_id: uuid('product_id').notNull(),
  name: text('name').notNull(),
  sku: text('sku'),
  barcode: text('barcode'),
  purchase_price: numeric('purchase_price'),
  sale_price: numeric('sale_price'),
  stock_current: numeric('stock_current').notNull().default('0'),
  stock_minimum: numeric('stock_minimum').notNull().default('0'),
  attributes: jsonb('attributes'),
  image_url: text('image_url'),
  is_active: boolean('is_active').notNull().default(true),
  order: integer('order').notNull().default(0),
  deleted_at: timestamp('deleted_at', { mode: 'string' }),
  created_at: timestamp('created_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
  updated_at: timestamp('updated_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
});

export type VariantRow = typeof variantTable.$inferSelect;
export type NewVariantRow = typeof variantTable.$inferInsert;
