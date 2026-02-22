import type { ModuleDatabaseAPI } from '@coongro/plugin-sdk';
import { eq, and, isNull, asc } from 'drizzle-orm';

import { variantTable } from '../schema/variant.js';
import type { VariantRow, NewVariantRow } from '../schema/variant.js';

export class VariantRepository {
  constructor(private readonly db: ModuleDatabaseAPI) {}

  async list(): Promise<VariantRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(variantTable)
        .where(isNull(variantTable.deleted_at))
        .orderBy(asc(variantTable.order), asc(variantTable.name))
    );
  }

  async getById({ id }: { id: string }): Promise<VariantRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx.select().from(variantTable).where(eq(variantTable.id, id)).limit(1)
    );
    return rows[0];
  }

  async create({ data }: { data: NewVariantRow }): Promise<VariantRow[]> {
    const row = { ...data, id: data.id ?? crypto.randomUUID() };
    return this.db.ormQuery((tx) => tx.insert(variantTable).values(row).returning());
  }

  async update({ id, data }: { id: string; data: Partial<NewVariantRow> }): Promise<VariantRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .update(variantTable)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .set({ ...data, updated_at: new Date().toISOString() } as any)
        .where(eq(variantTable.id, id))
        .returning()
    );
  }

  async delete({ id }: { id: string }): Promise<void> {
    await this.db.ormQuery((tx) => tx.delete(variantTable).where(eq(variantTable.id, id)));
  }

  async softDelete({ id }: { id: string }): Promise<VariantRow[]> {
    const now = new Date().toISOString();
    return this.db.ormQuery((tx) =>
      tx
        .update(variantTable)
        .set({ deleted_at: now, updated_at: now } as Partial<VariantRow>)
        .where(eq(variantTable.id, id))
        .returning()
    );
  }

  async restore({ id }: { id: string }): Promise<VariantRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .update(variantTable)
        .set({ deleted_at: null, updated_at: new Date().toISOString() } as Partial<VariantRow>)
        .where(eq(variantTable.id, id))
        .returning()
    );
  }

  async listByProduct({ productId }: { productId: string }): Promise<VariantRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(variantTable)
        .where(and(eq(variantTable.product_id, productId), isNull(variantTable.deleted_at)))
        .orderBy(asc(variantTable.order), asc(variantTable.name))
    );
  }

  async findBySku({ sku }: { sku: string }): Promise<VariantRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx
        .select()
        .from(variantTable)
        .where(and(eq(variantTable.sku, sku), isNull(variantTable.deleted_at)))
        .limit(1)
    );
    return rows[0];
  }

  async findByBarcode({ barcode }: { barcode: string }): Promise<VariantRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx
        .select()
        .from(variantTable)
        .where(and(eq(variantTable.barcode, barcode), isNull(variantTable.deleted_at)))
        .limit(1)
    );
    return rows[0];
  }
}
