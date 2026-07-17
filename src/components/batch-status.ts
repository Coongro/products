/* getHostUI() llega como tipo `error` en este archivo .ts (resolución de tipos de eslint;
   tsc compila bien). Los accesos a UI.* son seguros en runtime — silenciamos el falso positivo. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

const UI = getHostUI();
const React = getHostReact();
const h = React.createElement;

/**
 * Forma normalizada de un lote (batch) que consume la vista genérica de Lotes.
 * Espeja `module_products_batches` (products.batches) más el nombre del producto
 * y el tipo resuelto por el clasificador. Reutilizable por cualquier kit — no
 * asume semántica vet (medicamento/vacuna/perecedero son solo `kind` opacos).
 */
export interface BatchListItem {
  id: string;
  productId: string;
  productName: string;
  /** kind del clasificador al que pertenece el producto (ej. 'vaccine'), o null si no clasifica. */
  kind: string | null;
  batchNumber: string;
  /** ISO timestamp o '' si el producto no vence. */
  expirationDate: string;
  /** Stock remanente del lote. */
  quantity: number;
  /** Cantidad recibida = disponible + consumido (para la barra de stock). */
  received: number;
  supplier: string | null;
  /** Proveedor como entidad del maestro (para precargar la edición). */
  supplierId: string | null;
  notes: string | null;
  /** status crudo de la fila (active | depleted | expired | recalled). */
  status: string;
}

/**
 * Estado derivado para mostrar. `por-vencer` incluye los días restantes para el label.
 * Se deriva en runtime de status + vencimiento + stock (el campo `status` de la fila
 * solo marca la baja manual / agotado explícito; vencido y por-vencer se calculan).
 */
export type BatchVisualStatus =
  | 'activo'
  | 'vencido'
  | 'agotado'
  | 'baja'
  | { kind: 'por-vencer'; days: number };

/** Umbral de días para considerar un lote "próximo a vencer". */
export const EXPIRING_SOON_DAYS = 30;

function todayMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

/** Toma solo la parte de fecha (yyyy-mm-dd) de un ISO/date-string. */
function dateKey(expiration: string): string {
  return expiration ? expiration.slice(0, 10) : '';
}

/** Días hasta el vencimiento (negativo = ya vencido). null si no vence. */
export function daysUntil(expiration: string): number | null {
  const key = dateKey(expiration);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return null;
  const exp = new Date(y, m - 1, d);
  return Math.round((exp.getTime() - todayMidnight().getTime()) / 86400000);
}

/** Formatea el vencimiento como dd/mm/aaaa (o '—' si no vence). */
export function formatExpiration(expiration: string): string {
  const key = dateKey(expiration);
  if (!key) return '—';
  const [y, m, d] = key.split('-');
  if (!y || !m || !d) return key;
  return `${d}/${m}/${y}`;
}

/**
 * Prioridad: baja > agotado > vencido > por-vencer > activo. El umbral de
 * "por-vencer" (`alertDays`) es configurable — default `EXPIRING_SOON_DAYS`
 * (setting `products.stock.alertDays`, que la vista lee y pasa).
 */
export function computeBatchStatus(
  batch: BatchListItem,
  alertDays: number = EXPIRING_SOON_DAYS
): BatchVisualStatus {
  if (batch.status === 'recalled') return 'baja';
  if (batch.quantity <= 0) return 'agotado';
  const days = daysUntil(batch.expirationDate);
  if (days !== null) {
    if (days < 0) return 'vencido';
    if (days <= alertDays) return { kind: 'por-vencer', days };
  }
  return 'activo';
}

/** True si el lote se puede usar (activo o por vencer, con stock). */
export function isUsable(status: BatchVisualStatus): boolean {
  return status === 'activo' || (typeof status === 'object' && status.kind === 'por-vencer');
}

/** Ventana (días) del health card "Vencen pronto". Más amplia que el badge por-vencer. */
export const SOON_HEALTH_DAYS = 60;

/** Conteos de salud del inventario para las health cards. La baja no cuenta. */
export interface BatchHealth {
  porVencer: number;
  vencidos: number;
  agotados: number;
  activos: number;
}

export function batchHealthCounts(batches: BatchListItem[]): BatchHealth {
  const health: BatchHealth = { porVencer: 0, vencidos: 0, agotados: 0, activos: 0 };
  for (const b of batches) {
    if (b.status === 'recalled') continue;
    if (b.quantity <= 0) {
      health.agotados++;
      continue;
    }
    const days = daysUntil(b.expirationDate);
    if (days !== null && days < 0) health.vencidos++;
    else if (days !== null && days <= SOON_HEALTH_DAYS) health.porVencer++;
    else health.activos++;
  }
  return health;
}

/** Texto + tono del vencimiento relativo a hoy, para la columna de la tabla. */
export function expirationRelative(expiration: string): {
  text: string;
  tone: 'over' | 'soon' | 'far' | 'none';
} {
  const days = daysUntil(expiration);
  if (days === null) return { text: 'sin venc.', tone: 'none' };
  if (days < 0) return { text: `hace ${Math.abs(days)} d`, tone: 'over' };
  if (days <= SOON_HEALTH_DAYS) return { text: `en ${days} d`, tone: 'soon' };
  return { text: `en ${days} d`, tone: 'far' };
}

export function statusBadge(status: BatchVisualStatus): unknown {
  if (status === 'activo') return h(UI.Badge, { variant: 'success' } as any, 'Activo');
  if (status === 'vencido') return h(UI.Badge, { variant: 'danger' } as any, 'Vencido');
  if (status === 'agotado') return h(UI.Badge, { variant: 'secondary' } as any, 'Agotado');
  if (status === 'baja') return h(UI.Badge, { variant: 'secondary' } as any, 'Dado de baja');
  // por-vencer
  const label =
    status.days <= 0
      ? 'Vence hoy'
      : status.days === 1
        ? 'Vence mañana'
        : `Vence en ${status.days} días`;
  return h(UI.Badge, { variant: 'warning' } as any, label);
}
