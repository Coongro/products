import type { ModuleDatabaseAPI } from '@coongro/plugin-sdk';
import { eq, and, or, ilike, isNull, sql, asc, desc } from 'drizzle-orm';

import { productTable } from '../schema/product.js';
import type { ProductRow, NewProductRow } from '../schema/product.js';

export interface ProductSearchParams {
  query?: string;
  categoryId?: string;
  tags?: string[];
  isActive?: boolean;
  inStock?: boolean;
  lowStock?: boolean;
  priceMin?: number;
  priceMax?: number;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export class ProductRepository {
  constructor(private readonly db: ModuleDatabaseAPI) {}

  async list(): Promise<ProductRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(productTable)
        .where(isNull(productTable.deleted_at))
        .orderBy(asc(productTable.name))
    );
  }

  async getById({ id }: { id: string }): Promise<ProductRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx.select().from(productTable).where(eq(productTable.id, id)).limit(1)
    );
    return rows[0];
  }

  async create({ data }: { data: NewProductRow }): Promise<ProductRow[]> {
    const row = { ...data, id: data.id ?? crypto.randomUUID() };
    return this.db.ormQuery((tx) => tx.insert(productTable).values(row).returning());
  }

  async update({ id, data }: { id: string; data: Partial<NewProductRow> }): Promise<ProductRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .update(productTable)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .set({ ...data, updated_at: new Date().toISOString() } as any)
        .where(eq(productTable.id, id))
        .returning()
    );
  }

  async delete({ id }: { id: string }): Promise<void> {
    await this.db.ormQuery((tx) => tx.delete(productTable).where(eq(productTable.id, id)));
  }

  async softDelete({ id }: { id: string }): Promise<ProductRow[]> {
    const now = new Date().toISOString();
    return this.db.ormQuery((tx) =>
      tx
        .update(productTable)
        .set({ deleted_at: now, updated_at: now } as Partial<ProductRow>)
        .where(eq(productTable.id, id))
        .returning()
    );
  }

  async restore({ id }: { id: string }): Promise<ProductRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .update(productTable)
        .set({ deleted_at: null, updated_at: new Date().toISOString() } as Partial<ProductRow>)
        .where(eq(productTable.id, id))
        .returning()
    );
  }

  async search({
    query,
    categoryId,
    tags,
    isActive,
    inStock,
    lowStock,
    priceMin,
    priceMax,
    includeDeleted,
    limit = 50,
    offset = 0,
    orderBy: orderByField,
    orderDir = 'asc',
  }: ProductSearchParams): Promise<ProductRow[]> {
    return this.db.ormQuery((tx) => {
      const conditions = [];

      if (!includeDeleted) conditions.push(isNull(productTable.deleted_at));

      if (query) {
        const pattern = `%${query}%`;
        conditions.push(
          or(
            ilike(productTable.name, pattern),
            ilike(productTable.description, pattern),
            ilike(productTable.sku, pattern),
            ilike(productTable.barcode, pattern)
          )
        );
      }

      if (categoryId) conditions.push(eq(productTable.category_id, categoryId));
      if (isActive !== undefined) conditions.push(eq(productTable.is_active, isActive));

      if (tags && tags.length > 0) {
        conditions.push(
          sql`${productTable.tags} ?| array[${sql.join(
            tags.map((t) => sql`${t}`),
            sql`, `
          )}]`
        );
      }

      if (inStock === true) {
        conditions.push(sql`${productTable.stock_current}::numeric > 0`);
      } else if (inStock === false) {
        conditions.push(sql`${productTable.stock_current}::numeric <= 0`);
      }

      if (lowStock) {
        conditions.push(
          sql`${productTable.stock_current}::numeric <= ${productTable.stock_minimum}::numeric`
        );
        conditions.push(sql`${productTable.stock_minimum}::numeric > 0`);
      }

      if (priceMin !== undefined) {
        conditions.push(sql`${productTable.sale_price}::numeric >= ${priceMin}`);
      }
      if (priceMax !== undefined) {
        conditions.push(sql`${productTable.sale_price}::numeric <= ${priceMax}`);
      }

      let q = tx.select().from(productTable);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      if (conditions.length > 0) q = q.where(and(...conditions)) as typeof q;

      const col =
        orderByField === 'name'
          ? productTable.name
          : orderByField === 'sale_price'
            ? productTable.sale_price
            : orderByField === 'stock_current'
              ? productTable.stock_current
              : orderByField === 'created_at'
                ? productTable.created_at
                : productTable.name;
      q = q.orderBy(orderDir === 'desc' ? desc(col) : asc(col)) as typeof q;
      q = q.limit(limit).offset(offset) as typeof q;

      return q;
    });
  }

  async findBySku({ sku }: { sku: string }): Promise<ProductRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx
        .select()
        .from(productTable)
        .where(and(eq(productTable.sku, sku), isNull(productTable.deleted_at)))
        .limit(1)
    );
    return rows[0];
  }

  async findByBarcode({ barcode }: { barcode: string }): Promise<ProductRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx
        .select()
        .from(productTable)
        .where(and(eq(productTable.barcode, barcode), isNull(productTable.deleted_at)))
        .limit(1)
    );
    return rows[0];
  }

  async listByCategory({ categoryId }: { categoryId: string }): Promise<ProductRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(productTable)
        .where(and(eq(productTable.category_id, categoryId), isNull(productTable.deleted_at)))
        .orderBy(asc(productTable.name))
    );
  }

  async listLowStock(): Promise<ProductRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(productTable)
        .where(
          and(
            isNull(productTable.deleted_at),
            eq(productTable.is_active, true),
            sql`${productTable.stock_minimum}::numeric > 0`,
            sql`${productTable.stock_current}::numeric <= ${productTable.stock_minimum}::numeric`
          )
        )
        .orderBy(asc(productTable.stock_current))
    );
  }

  async countByCategory({ categoryId }: { categoryId: string }): Promise<number> {
    const rows = await this.db.ormQuery((tx) =>
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(productTable)
        .where(and(eq(productTable.category_id, categoryId), isNull(productTable.deleted_at)))
    );
    return rows[0]?.count ?? 0;
  }

  async adjustStock({ id, delta }: { id: string; delta: number }): Promise<ProductRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .update(productTable)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .set({
          stock_current: sql`(${productTable.stock_current}::numeric + ${delta})::text`,
          updated_at: new Date().toISOString(),
        } as any)
        .where(eq(productTable.id, id))
        .returning()
    );
  }
}
