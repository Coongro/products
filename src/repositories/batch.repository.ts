import { randomUUID } from 'node:crypto';

import type { ModuleDatabaseAPI } from '@coongro/plugin-sdk';
import { eq, and, lte, asc, gt } from 'drizzle-orm';

import { batchTable } from '../schema/batch.js';
import type { BatchRow, NewBatchRow } from '../schema/batch.js';

/**
 * Lotes (batches) genéricos de stock. Contrato reutilizable por cualquier kit (COONG-217):
 * vet-pharmacy y Salidas (purchases) consumen esto en vez de tener su propio batchTable.
 */
export class BatchRepository {
  constructor(private readonly db: ModuleDatabaseAPI) {}

  async list(): Promise<BatchRow[]> {
    return this.db.ormQuery((tx) => tx.select().from(batchTable));
  }

  async getById({ id }: { id: string }): Promise<BatchRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx.select().from(batchTable).where(eq(batchTable.id, id)).limit(1)
    );
    return rows[0];
  }

  async create({ data }: { data: NewBatchRow }): Promise<BatchRow[]> {
    const row = { ...data, id: data.id ?? randomUUID() };
    return this.db.ormQuery((tx) => tx.insert(batchTable).values(row).returning());
  }

  async update({ id, data }: { id: string; data: Partial<NewBatchRow> }): Promise<BatchRow[]> {
    return this.db.ormQuery((tx) =>
      tx.update(batchTable).set(data).where(eq(batchTable.id, id)).returning()
    );
  }

  async delete({ id }: { id: string }): Promise<void> {
    await this.db.ormQuery((tx) => tx.delete(batchTable).where(eq(batchTable.id, id)));
  }

  // ─── Métodos custom ─────────────────────────────────────────────────────────

  /** Lotes de un producto, ordenados por vencimiento ASC (FIFO). */
  async listByProduct({ productId }: { productId: string }): Promise<BatchRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(batchTable)
        .where(eq(batchTable.product_id, productId))
        .orderBy(asc(batchTable.expiration_date))
    );
  }

  /** Lotes activos próximos a vencer dentro de N días (ignora los sin vencimiento). */
  async getExpiringSoon({ days }: { days: number }): Promise<BatchRow[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(batchTable)
        .where(
          and(
            eq(batchTable.status, 'active'),
            lte(batchTable.expiration_date, cutoff.toISOString()),
            gt(batchTable.expiration_date, new Date().toISOString())
          )
        )
        .orderBy(asc(batchTable.expiration_date))
    );
  }

  /** Lotes vencidos (aún marcados como active). */
  async getExpired(): Promise<BatchRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(batchTable)
        .where(
          and(
            eq(batchTable.status, 'active'),
            lte(batchTable.expiration_date, new Date().toISOString())
          )
        )
        .orderBy(asc(batchTable.expiration_date))
    );
  }
}
