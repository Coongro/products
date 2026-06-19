import { sql } from 'drizzle-orm';
import { jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Lote (batch) genérico de stock: número de lote + vencimiento + cantidad por producto.
 * Reutilizable por cualquier kit (no asume semántica vet). Espeja la forma del batchTable
 * de vet-pharmacy para que su data migre 1:1 (product_id pasa de text a uuid; expiration
 * pasa a NULLABLE porque no todo producto vence). vet-pharmacy y otros consumen este via
 * products.batches; Salidas (purchases) escribe lote acá al recibir mercadería. (COONG-217)
 */
export const batchTable = pgTable('module_products_batches', {
  id: uuid('id').primaryKey().notNull(),
  product_id: uuid('product_id').notNull(),
  /** Variante opcional (products tiene variantes); null = lote a nivel producto. */
  variant_id: uuid('variant_id'),
  batch_number: text('batch_number').notNull(),
  /** Nullable: no todo producto vence. */
  expiration_date: timestamp('expiration_date', { mode: 'string' }),
  /** Cantidad remanente del lote. */
  quantity: numeric('quantity').notNull(),
  purchase_date: timestamp('purchase_date', { mode: 'string' }),
  purchase_price: numeric('purchase_price'),
  supplier: text('supplier'),
  notes: text('notes'),
  // NOT NULL + DEFAULT por la regla de plugins (un plugin desactivado no debe romper INSERTs).
  status: text('status').notNull().default('active'),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at', { mode: 'string' })
    .notNull()
    .default(sql`now()`),
});

export type BatchRow = typeof batchTable.$inferSelect;
export type NewBatchRow = typeof batchTable.$inferInsert;
