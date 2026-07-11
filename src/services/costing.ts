/**
 * Motor de costeo de inventario (COONG-223). Función pura, sin DB: dado el estado de stock/costo
 * previo de un producto y una entrada de mercadería, devuelve el nuevo costo unitario.
 *
 * Política: PROMEDIO PONDERADO MÓVIL (Weighted Average Cost). Es el estándar de facto en
 * Shopify/Square/QuickBooks/Odoo(AVCO): el costo del producto se recalcula en cada recepción
 * mezclando el valor del stock que ya había con el de la compra nueva. Se eligió por sobre
 * "último costo" (pisar con la última compra) porque refleja el costo real del stock que tenés
 * en mano, no el de una compra puntual. Si en el futuro se quiere cambiar a último costo o FIFO,
 * este es el ÚNICO lugar a tocar — los repos solo llaman a esta función.
 */

/** Estado para recalcular el costo unitario de un producto al entrar stock. */
export interface WeightedAverageCostInput {
  /** Unidades en stock ANTES de esta entrada. */
  currentQty: number;
  /**
   * Costo unitario promedio actual del producto (`product.purchase_price`).
   * `null` si nunca se cargó (producto sin costo previo).
   */
  currentCost: number | null;
  /** Unidades que entran en esta operación. */
  incomingQty: number;
  /**
   * Costo unitario de la mercadería entrante (`batch.purchase_price` o `stock_movement.unit_cost`).
   * `null` si la entrada no informó costo (ej. ajuste de stock sin precio).
   */
  incomingCost: number | null;
}

/** Redondeo a centavos: el costo es dinero y se muestra/edita con 2 decimales. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Nuevo costo unitario tras una entrada de stock, por promedio ponderado móvil.
 *
 * Casos de borde (en orden de precedencia):
 * - Entrada sin costo informado (`incomingCost` null o inválido) → no hay dato nuevo:
 *   se conserva el costo actual (puede ser null).
 * - Entrada no positiva (`incomingQty` <= 0) → no es una recepción válida: se conserva el actual.
 * - Sin base previa con valor (`currentCost` null, o `currentQty` <= 0, o costo actual inválido)
 *   → el costo nuevo es directamente el de la entrada (no hay con qué promediar).
 * - Caso general → (qtyPrev·costoPrev + qtyEntra·costoEntra) / (qtyPrev + qtyEntra).
 *
 * Devuelve `null` solo cuando no hay forma de determinar un costo (sin previo y sin entrante),
 * para que el caller deje `purchase_price` sin tocar.
 */
export function weightedAverageCost(input: WeightedAverageCostInput): number | null {
  const { currentQty, currentCost, incomingQty, incomingCost } = input;

  // Sin costo entrante válido → no se puede aportar info nueva de costo.
  if (incomingCost === null || !Number.isFinite(incomingCost) || incomingCost < 0) {
    return currentCost;
  }
  // Entrada no positiva → no es una recepción que mueva el costo.
  if (!Number.isFinite(incomingQty) || incomingQty <= 0) {
    return currentCost;
  }
  // Sin base previa con valor (producto nuevo, sin stock, o costo previo inválido) → toma el entrante.
  const hasPrevBase =
    currentCost !== null &&
    Number.isFinite(currentCost) &&
    currentCost >= 0 &&
    Number.isFinite(currentQty) &&
    currentQty > 0;
  if (!hasPrevBase) {
    return round2(incomingCost);
  }

  const prevValue = currentQty * currentCost;
  const incomingValue = incomingQty * incomingCost;
  const totalQty = currentQty + incomingQty;
  return round2((prevValue + incomingValue) / totalQty);
}
