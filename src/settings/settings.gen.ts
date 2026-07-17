/**
 * AUTO-GENERADO por Coongro Builder — NO editar a mano.
 * Se regenera al guardar la página de settings desde /dev/builder.
 * La lógica de negocio va en un hook de dominio que consume esto.
 */
/* eslint-disable */

import { useSettings } from '@coongro/plugin-sdk';

function toNum(v: unknown, fallback: number): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return fallback;
}

function toEnum<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

export const STOCK_EXPIRED_LOTS = {
  block: 'block',
  warn: 'warn',
} as const;

/** Tipo de cada setting por su key punteada (para getSetting). */
export interface ProductsSettingsByKey {
  'products.stock.alertDays': number;
  'products.stock.expiredLots': 'block' | 'warn';
  'products.stock.autoDeduct': boolean;
}

/** Settings del plugin con defaults aplicados y coerción por tipo. */
export interface ProductsSettings {
  /** Días de aviso de vencimiento — Con cuántos días de anticipación un lote se marca "por vencer" en el inventario. · `products.stock.alertDays` · default: `30` */
  readonly stockAlertDays: number;
  /** Lotes vencidos — Qué hacer al intentar usar un lote vencido: bloquearlo, o avisar y permitir usarlo igual. · `products.stock.expiredLots` · default: `"block"` */
  readonly stockExpiredLots: 'block' | 'warn';
  /** Descontar stock automáticamente — Al registrar el uso de un producto (medicación en consulta, venta o receta), descontar su stock de los lotes. · `products.stock.autoDeduct` · default: `true` */
  readonly stockAutoDeduct: boolean;
}

/** Nombre de prop → key punteada del manifest. */
export const SETTING_KEYS = {
  stockAlertDays: 'products.stock.alertDays',
  stockExpiredLots: 'products.stock.expiredLots',
  stockAutoDeduct: 'products.stock.autoDeduct',
} as const;

/** Valores por defecto (los mismos del manifest). */
export const SETTING_DEFAULTS = {
  'products.stock.alertDays': 30,
  'products.stock.expiredLots': 'block',
  'products.stock.autoDeduct': true,
} as const;

const COERCE: {
  [K in keyof ProductsSettingsByKey]: (values: Record<string, unknown>) => ProductsSettingsByKey[K];
} = {
  'products.stock.alertDays': (values) => toNum(values['products.stock.alertDays'], 30),
  'products.stock.expiredLots': (values) =>
    toEnum(values['products.stock.expiredLots'], ['block', 'warn'], 'block'),
  'products.stock.autoDeduct': (values) => toBool(values['products.stock.autoDeduct'], true),
};

/** Lee UNA setting tipada desde los valores crudos del tenant (para handlers). */
export function getSetting<K extends keyof ProductsSettingsByKey>(
  values: Record<string, unknown>,
  key: K
): ProductsSettingsByKey[K] {
  return COERCE[key](values);
}

/** Construye el objeto tipado desde los valores crudos (sin hook: handlers/tests). */
export function readProductsSettings(values: Record<string, unknown>): ProductsSettings {
  return {
    stockAlertDays: COERCE['products.stock.alertDays'](values),
    stockExpiredLots: COERCE['products.stock.expiredLots'](values),
    stockAutoDeduct: COERCE['products.stock.autoDeduct'](values),
  };
}

/**
 * Hook reactivo: settings tipadas del plugin con defaults aplicados.
 * Envolvé esto en un hook de dominio si necesitás lógica de negocio.
 */
export function useProductsSettings(): { settings: ProductsSettings; loading: boolean } {
  const { values, loading } = useSettings('products.');
  return { settings: readProductsSettings(values), loading };
}
