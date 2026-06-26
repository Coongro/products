import type { ModuleDatabaseAPI } from '@coongro/plugin-sdk';
import { eq, and, sql, desc } from 'drizzle-orm';

import { productTable } from '../schema/product.js';
import { stockMovementTable } from '../schema/stock-movement.js';
import type { StockMovementRow, NewStockMovementRow } from '../schema/stock-movement.js';
import { variantTable } from '../schema/variant.js';

export interface StockMovementListParams {
  productId?: string;
  variantId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface StockBalanceResult {
  totalIn: number;
  totalOut: number;
  balance: number;
}

export interface StockSummaryResult {
  type: string;
  totalQuantity: number;
  count: number;
}

export class StockMovementRepository {
  constructor(private readonly db: ModuleDatabaseAPI) {}

  async list(params: StockMovementListParams = {}): Promise<StockMovementRow[]> {
    const { productId, variantId, type, limit = 50, offset = 0 } = params;
    return this.db.ormQuery((tx) => {
      const conditions = [];

      if (productId) conditions.push(eq(stockMovementTable.product_id, productId));
      if (variantId) conditions.push(eq(stockMovementTable.variant_id, variantId));
      if (type) conditions.push(eq(stockMovementTable.type, type));

      let q = tx.select().from(stockMovementTable);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      if (conditions.length > 0) q = q.where(and(...conditions)) as typeof q;
      q = q.orderBy(desc(stockMovementTable.created_at)) as typeof q;
      q = q.limit(limit).offset(offset) as typeof q;

      return q;
    });
  }

  async getById({ id }: { id: string }): Promise<StockMovementRow | undefined> {
    const rows = await this.db.ormQuery((tx) =>
      tx.select().from(stockMovementTable).where(eq(stockMovementTable.id, id)).limit(1)
    );
    return rows[0];
  }

  // Crea movimiento y actualiza stock_current atómicamente
  async create({ data }: { data: NewStockMovementRow }): Promise<StockMovementRow[]> {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
    const row: any = { ...data, id: data.id ?? crypto.randomUUID() };

    const result = await this.db.ormQuery((tx) =>
      tx.insert(stockMovementTable).values(row).returning()
    );

    // Actualizar stock_current en producto
    const qty = Number(row.quantity);
    await this.db.ormQuery((tx) =>
      tx
        .update(productTable)
        .set({
          // stock_current es numeric: NO castear el resultado a ::text (rompía el
          // update con "column is of type numeric but expression is of type text").
          stock_current: sql`(${productTable.stock_current}::numeric + ${qty})`,
          updated_at: new Date().toISOString(),
        } as any)
        .where(eq(productTable.id, row.product_id))
    );

    // Actualizar stock_current en variante si aplica
    if (row.variant_id) {
      await this.db.ormQuery((tx) =>
        tx
          .update(variantTable)
          .set({
            stock_current: sql`(${variantTable.stock_current}::numeric + ${qty})`,
            updated_at: new Date().toISOString(),
          } as any)
          .where(eq(variantTable.id, row.variant_id))
      );
    }
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

    return result;
  }

  async listByProduct({ productId }: { productId: string }): Promise<StockMovementRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(stockMovementTable)
        .where(eq(stockMovementTable.product_id, productId))
        .orderBy(desc(stockMovementTable.created_at))
    );
  }

  async listByVariant({ variantId }: { variantId: string }): Promise<StockMovementRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(stockMovementTable)
        .where(eq(stockMovementTable.variant_id, variantId))
        .orderBy(desc(stockMovementTable.created_at))
    );
  }

  /**
   * Movimientos de un lote (entradas `in` por la compra/alta, salidas `out` por
   * cada consumo) ordenados cronológicamente. Es la base de la trazabilidad del
   * lote: ciclo recibido/consumido + historial de a qué se usó cada salida.
   */
  async listByBatch({ batchId }: { batchId: string }): Promise<StockMovementRow[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select()
        .from(stockMovementTable)
        .where(eq(stockMovementTable.batch_id, batchId))
        .orderBy(stockMovementTable.created_at)
    );
  }

  /**
   * Total consumido (salidas `out`) por lote, agregado. Permite derivar el
   * "recibido" de cada lote como disponible + consumido, sin guardar la cantidad
   * original aparte: lo que entró = lo que queda + lo que salió.
   */
  async consumedByBatch(): Promise<Array<{ batchId: string; consumed: number }>> {
    const rows = await this.db.ormQuery((tx) =>
      tx
        .select({
          batchId: stockMovementTable.batch_id,
          consumed: sql<number>`coalesce(sum(abs(${stockMovementTable.quantity}::numeric)), 0)::float`,
        })
        .from(stockMovementTable)
        .where(eq(stockMovementTable.type, 'out'))
        .groupBy(stockMovementTable.batch_id)
    );
    return rows
      .filter((r) => r.batchId)
      .map((r) => ({ batchId: r.batchId, consumed: Number(r.consumed) || 0 }));
  }

  async getBalance({ productId }: { productId: string }): Promise<StockBalanceResult> {
    const rows = await this.db.ormQuery((tx) =>
      tx
        .select({
          totalIn: sql<number>`coalesce(sum(case when ${stockMovementTable.quantity}::numeric > 0 then ${stockMovementTable.quantity}::numeric else 0 end), 0)::float`,
          totalOut: sql<number>`coalesce(sum(case when ${stockMovementTable.quantity}::numeric < 0 then abs(${stockMovementTable.quantity}::numeric) else 0 end), 0)::float`,
          balance: sql<number>`coalesce(sum(${stockMovementTable.quantity}::numeric), 0)::float`,
        })
        .from(stockMovementTable)
        .where(eq(stockMovementTable.product_id, productId))
    );
    return rows[0] ?? { totalIn: 0, totalOut: 0, balance: 0 };
  }

  async getSummary({ productId }: { productId: string }): Promise<StockSummaryResult[]> {
    return this.db.ormQuery((tx) =>
      tx
        .select({
          type: stockMovementTable.type,
          totalQuantity: sql<number>`coalesce(sum(${stockMovementTable.quantity}::numeric), 0)::float`,
          count: sql<number>`count(*)::int`,
        })
        .from(stockMovementTable)
        .where(eq(stockMovementTable.product_id, productId))
        .groupBy(stockMovementTable.type)
    );
  }
}
