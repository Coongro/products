---
'@coongro/products': minor
---

feat(batches): motor de lotes genérico y reusable sobre products.batches (COONG-220)

Convierte products.batches en el motor único de lotes para cualquier kit, sin
acoplar products a ningún dominio:

- `BatchesView` — vista de inventario de lotes con filtros por tipo / vencimiento /
  estado, búsqueda y alta/edición/baja. Descubre los "tipos" por inyección de
  `BatchClassifier[]` (cada clasificador resuelve qué product_ids le pertenecen),
  así products no conoce semántica de dominio.
- `consume(productId, qty, { batchId?, referenceType, referenceId })` — descuento
  manual (lote puntual) o FIFO por vencimiento (cascada), atómico: resta el stock
  del lote, marca `depleted`, registra el movimiento con trazabilidad y ajusta el
  cache `product.stock_current`, todo en una sola transacción.
- `previewConsume(...)` — plan de consumo sin modificar (para mostrar antes de
  confirmar).
- `listAvailable(productId)` — lotes con stock ordenados FIFO.
- `BatchPicker` — selector de lote reusable con pre-selección FIFO ("sugerido").
- Trazabilidad: `stock_movements.batch_id` (nueva columna) liga cada salida a su lote.
- Fix: el update de `stock_current` ya no castea a `::text` (rompía con la columna numeric).

Exportado desde el índice del plugin para consumo cross-plugin (vacunación, farmacia).
