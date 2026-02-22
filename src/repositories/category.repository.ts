import type { ModuleDatabaseAPI } from '@coongro/plugin-sdk';
import { eq, and, or, ilike, isNull, sql, asc, desc } from 'drizzle-orm';

import { categoryTable } from '../schema/category.js';
import type { CategoryRow, NewCategoryRow } from '../schema/category.js';

export interface CategorySearchParams {
  query?: string;
  parentId?: string | null;
  isActive?: boolean;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export class CategoryRepository {
  constructor(private readonly db: ModuleDatabaseAPI) {}

  async list(): Promise<CategoryRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(categoryTable)
        .where(isNull(categoryTable.deleted_at))
        .orderBy(asc(categoryTable.order), asc(categoryTable.name))
    );
  }

  async getById({ id }: { id: string }): Promise<CategoryRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx.select().from(categoryTable).where(eq(categoryTable.id, id)).limit(1)
    );
    return rows[0];
  }

  async create({ data }: { data: NewCategoryRow }): Promise<CategoryRow[]> {
    const row = { ...data, id: data.id ?? crypto.randomUUID() };
    return this.db.ormQuery((tx) => tx.insert(categoryTable).values(row).returning());
  }

  async update({
    id,
    data,
  }: {
    id: string;
    data: Partial<NewCategoryRow>;
  }): Promise<CategoryRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .update(categoryTable)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .set({ ...data, updated_at: new Date().toISOString() } as any)
        .where(eq(categoryTable.id, id))
        .returning()
    );
  }

  async delete({ id }: { id: string }): Promise<void> {
    await this.db.ormQuery((tx) => tx.delete(categoryTable).where(eq(categoryTable.id, id)));
  }

  async softDelete({ id }: { id: string }): Promise<CategoryRow[]> {
    const now = new Date().toISOString();
    return this.db.ormQuery((tx) =>
      tx
        .update(categoryTable)
        .set({ deleted_at: now, updated_at: now } as Partial<CategoryRow>)
        .where(eq(categoryTable.id, id))
        .returning()
    );
  }

  async restore({ id }: { id: string }): Promise<CategoryRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .update(categoryTable)
        .set({ deleted_at: null, updated_at: new Date().toISOString() } as Partial<CategoryRow>)
        .where(eq(categoryTable.id, id))
        .returning()
    );
  }

  async search({
    query,
    parentId,
    isActive,
    includeDeleted,
    limit = 50,
    offset = 0,
    orderBy: orderByField,
    orderDir = 'asc',
  }: CategorySearchParams): Promise<CategoryRow[]> {
    return this.db.ormQuery((tx) => {
      const conditions = [];

      if (!includeDeleted) conditions.push(isNull(categoryTable.deleted_at));

      if (query) {
        const pattern = `%${query}%`;
        conditions.push(
          or(ilike(categoryTable.name, pattern), ilike(categoryTable.description, pattern))
        );
      }

      if (parentId !== undefined) {
        conditions.push(
          parentId === null
            ? isNull(categoryTable.parent_id)
            : eq(categoryTable.parent_id, parentId)
        );
      }

      if (isActive !== undefined) conditions.push(eq(categoryTable.is_active, isActive));

      let q = tx.select().from(categoryTable);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      if (conditions.length > 0) q = q.where(and(...conditions)) as typeof q;

      const col =
        orderByField === 'name'
          ? categoryTable.name
          : orderByField === 'created_at'
            ? categoryTable.created_at
            : categoryTable.order;
      q = q.orderBy(orderDir === 'desc' ? desc(col) : asc(col)) as typeof q;
      q = q.limit(limit).offset(offset) as typeof q;

      return q;
    });
  }

  // Devuelve arbol jerárquico plano (las categorías con su parent_id para que el frontend arme el árbol)
  async listTree(): Promise<CategoryRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(categoryTable)
        .where(and(isNull(categoryTable.deleted_at), eq(categoryTable.is_active, true)))
        .orderBy(asc(categoryTable.order), asc(categoryTable.name))
    );
  }

  async listByParent({ parentId }: { parentId: string | null }): Promise<CategoryRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(categoryTable)
        .where(
          and(
            isNull(categoryTable.deleted_at),
            parentId === null
              ? isNull(categoryTable.parent_id)
              : eq(categoryTable.parent_id, parentId)
          )
        )
        .orderBy(asc(categoryTable.order), asc(categoryTable.name))
    );
  }

  async countProducts({ id }: { id: string }): Promise<number> {
    // Importar productTable dinámicamente para evitar dependencia circular
    const { productTable } = await import('../schema/product.js');
    const rows = await this.db.ormQuery((tx) =>
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(productTable)
        .where(and(eq(productTable.category_id, id), isNull(productTable.deleted_at)))
    );
    return rows[0]?.count ?? 0;
  }
}
