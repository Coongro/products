import { randomUUID } from 'node:crypto';

import type { ModuleDatabaseAPI } from '@coongro/plugin-sdk';
import { eq, and, lte, asc, gt, sql } from 'drizzle-orm';

import { batchTable } from '../schema/batch.js';
import type { BatchRow, NewBatchRow } from '../schema/batch.js';
import { productTable } from '../schema/product.js';
import { stockMovementTable } from '../schema/stock-movement.js';
import { weightedAverageCost } from '../services/costing.js';

/** Parámetros del consumo de stock por lotes (motor de lotes, COONG-220). */
export interface ConsumeParams {
  productId: string;
  /** Unidades a consumir (dosis, frascos, etc.). */
  quantity: number;
  /** Si viene, descuenta SOLO ese lote (modo manual). Si se omite, FIFO por vencimiento. */
  batchId?: string;
  /** Origen del consumo, para trazabilidad (ej. 'vaccination_application'). */
  referenceType?: string;
  /** Id de la entidad origen (appliedId, consultationId, prescriptionId). */
  referenceId?: string;
}

/** Un lote tocado por un consumo, con la cantidad efectivamente descontada. */
export interface ConsumedBatch {
  batchId: string;
  batchNumber: string;
  consumed: number;
}

/** Plan de consumo (preview): qué lote se tocaría y cuánto, sin modificar nada. */
export interface BatchConsumePlanItem {
  batchId: string;
  batchNumber: string;
  /** ISO o '' si no vence. */
  expirationDate: string;
  /** Stock actual del lote. */
  available: number;
  /** Cuánto se descontaría de este lote. */
  toConsume: number;
}

/** Resultado de un consumo: cuánto se descontó, de qué lotes, y faltante si no alcanzó. */
export interface ConsumeResult {
  consumed: number;
  batches: ConsumedBatch[];
  /** Unidades que no se pudieron descontar por falta de stock (0 = se cubrió todo). */
  shortfall: number;
}

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

  /**
   * Alta de lote. El lote ES stock que entra: además de insertarlo, registra un
   * movimiento `in` y suma a `product.stock_current` en la misma transacción.
   * Así el stock tiene UNA sola fuente (la suma de lotes); ni la compra ni nadie
   * más alimenta stock por separado (se eliminó el `feedStock` duplicado de Salidas).
   */
  async create({ data }: { data: NewBatchRow }): Promise<BatchRow[]> {
    // received_quantity = cantidad recibida original (fija); si no viene, = quantity.
    const received = (data as { received_quantity?: string | null }).received_quantity;
    const row = {
      ...data,
      id: data.id ?? randomUUID(),
      received_quantity: received ?? data.quantity,
    };
    const qty = Number(row.quantity) || 0;
    /* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- $inferInsert colapsa con strict:false; los objetos llevan campos válidos en runtime. */
    return this.db.ormQuery(async (tx) => {
      const inserted = await tx
        .insert(batchTable)
        .values(row as any)
        .returning();
      if (qty > 0) {
        await tx.insert(stockMovementTable).values({
          id: randomUUID(),
          product_id: row.product_id,
          batch_id: row.id,
          type: 'in',
          quantity: String(qty),
          reference_type: 'batch_in',
        } as any);
        // Recosteo (COONG-223): el lote ES una recepción de mercadería, así que recalcula el
        // costo del producto por promedio ponderado móvil con el precio de compra del lote.
        // Se lee el stock+costo previos en la MISMA transacción (antes de sumar el stock) para
        // que el promedio use la base correcta y el recálculo sea atómico con el alta del lote.
        const [prev] = await tx
          .select({
            stock_current: productTable.stock_current,
            purchase_price: productTable.purchase_price,
          })
          .from(productTable)
          .where(eq(productTable.id, row.product_id))
          .limit(1);
        // $inferInsert colapsa con strict:false y pierde los campos opcionales del shape de `row`
        // (mismo motivo que `received_quantity` arriba) → leer el precio del lote con cast.
        const batchCost = (data as { purchase_price?: string | null }).purchase_price;
        const prevCost = prev?.purchase_price;
        const newCost = weightedAverageCost({
          currentQty: Number(prev?.stock_current) || 0,
          currentCost: prevCost !== null && prevCost !== undefined ? Number(prevCost) : null,
          incomingQty: qty,
          incomingCost: batchCost !== null && batchCost !== undefined ? Number(batchCost) : null,
        });
        await tx
          .update(productTable)
          .set({
            stock_current: sql`(${productTable.stock_current}::numeric + ${qty})`,
            ...(newCost !== null ? { purchase_price: String(newCost) } : {}),
            updated_at: new Date().toISOString(),
          } as any)
          .where(eq(productTable.id, row.product_id));
      }
      return inserted;
    });
    /* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
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

  /**
   * Lotes disponibles para consumir: activos y con stock, ordenados FIFO
   * (vence primero; Postgres pone los NULL al final en ASC). El filtro de
   * stock se hace en memoria porque `quantity` es numeric-as-text.
   */
  async listAvailable({ productId }: { productId: string }): Promise<BatchRow[]> {
    const rows = await this.db.ormQuery((tx) =>
      tx
        .select()
        .from(batchTable)
        .where(and(eq(batchTable.product_id, productId), eq(batchTable.status, 'active')))
        .orderBy(asc(batchTable.expiration_date))
    );
    return rows.filter((b) => Number(b.quantity) > 0);
  }

  /**
   * Calcula el plan de consumo (qué lotes y cuánto) SIN modificar la BD. Útil
   * para mostrar al usuario qué se descontaría antes de confirmar. Mismo orden
   * que `consume` (manual si hay batchId, FIFO si no).
   */
  async previewConsume(params: ConsumeParams): Promise<BatchConsumePlanItem[]> {
    const needed = Number(params.quantity);
    if (!Number.isFinite(needed) || needed <= 0) return [];
    const targets = await this.resolveTargets(params);
    return this.planConsumption(targets, needed);
  }

  /**
   * Motor de consumo de stock por lotes (COONG-220). Único punto donde se
   * descuenta stock loteado: lo usan vacunación (aplicar dosis), farmacia
   * (dispensar en consulta) y recetas. Dos modos:
   *  - manual: `batchId` presente → descuenta de ese lote (caso vacuna: el
   *    frasco que el vet tiene abierto). No auto-completa con otros lotes para
   *    respetar la elección y la trazabilidad.
   *  - FIFO: sin `batchId` → descuenta en cascada de los lotes que vencen
   *    primero hasta cubrir la cantidad.
   *
   * Por cada lote tocado: resta `batch.quantity`, marca `depleted` al llegar a
   * 0, y registra un movimiento de stock (`out`) con `batch_id` + referencia
   * (trazabilidad lote→uso). El movimiento también mantiene `product.stock_current`
   * sincronizado como cache — la fuente de verdad del stock es la suma de lotes.
   */
  async consume(params: ConsumeParams): Promise<ConsumeResult> {
    const needed = Number(params.quantity);
    if (!Number.isFinite(needed) || needed <= 0) {
      return { consumed: 0, batches: [], shortfall: 0 };
    }

    const targets = await this.resolveTargets(params);
    const plan = this.planConsumption(targets, needed);
    const byId = new Map(targets.map((b) => [b.id, b]));
    const touched: ConsumedBatch[] = [];

    for (const item of plan) {
      const batch = byId.get(item.batchId);
      if (!batch) continue;
      await this.consumeOneAtomic(params, batch, item.toConsume);
      touched.push({
        batchId: batch.id,
        batchNumber: batch.batch_number,
        consumed: item.toConsume,
      });
    }

    const consumed = touched.reduce((acc, t) => acc + t.consumed, 0);
    return { consumed, batches: touched, shortfall: needed - consumed };
  }

  /**
   * Descuenta `take` de un lote en una sola transacción: resta el stock del lote
   * (marca depleted al llegar a 0), registra el movimiento de salida con
   * trazabilidad y ajusta el cache `product.stock_current`. Las tres escrituras
   * van en UN `ormQuery` — que ya corre dentro de una transacción con el
   * search_path del tenant — así un fallo a mitad revierte todo (atomicidad) sin
   * anidar transacciones (lo que rompería el search_path, COONG-136).
   */
  private async consumeOneAtomic(
    params: ConsumeParams,
    batch: BatchRow,
    take: number
  ): Promise<void> {
    const left = Number(batch.quantity) - take;
    /* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- $inferInsert colapsa con strict:false; los objetos llevan campos válidos en runtime. */
    await this.db.ormQuery(async (tx) => {
      await tx
        .update(batchTable)
        .set({ quantity: String(left), status: left <= 0 ? 'depleted' : batch.status } as any)
        .where(eq(batchTable.id, batch.id));

      await tx.insert(stockMovementTable).values({
        id: randomUUID(),
        product_id: params.productId,
        batch_id: batch.id,
        type: 'out',
        quantity: String(-take),
        reference_type: params.referenceType ?? null,
        reference_id: params.referenceId ?? null,
      } as any);

      await tx
        .update(productTable)
        .set({
          stock_current: sql`(${productTable.stock_current}::numeric - ${take})`,
          updated_at: new Date().toISOString(),
        } as any)
        .where(eq(productTable.id, params.productId));
    });
    /* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
  }

  /** Lotes objetivo del consumo: el puntual (manual) o todos los disponibles (FIFO). */
  private async resolveTargets(params: ConsumeParams): Promise<BatchRow[]> {
    if (params.batchId) {
      const batch = await this.getById({ id: params.batchId });
      return batch ? [batch] : [];
    }
    return this.listAvailable({ productId: params.productId });
  }

  /** Reparte `needed` entre los lotes en orden (cascada), sin modificar nada. */
  private planConsumption(targets: BatchRow[], needed: number): BatchConsumePlanItem[] {
    const plan: BatchConsumePlanItem[] = [];
    let remaining = needed;
    for (const batch of targets) {
      if (remaining <= 0) break;
      const available = Number(batch.quantity);
      if (!(available > 0)) continue;
      const toConsume = Math.min(available, remaining);
      plan.push({
        batchId: batch.id,
        batchNumber: batch.batch_number,
        expirationDate: batch.expiration_date ?? '',
        available,
        toConsume,
      });
      remaining -= toConsume;
    }
    return plan;
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
