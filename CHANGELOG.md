# @coongro/products

## 1.3.0

### Minor Changes

- 1f1c29c: feat(costing): auto-fill product purchase cost via moving weighted average on stock-in. New pure `weightedAverageCost` engine in `services/costing.ts`, wired into `BatchRepository.create` (batches) and `StockMovementRepository.create` (direct `in` movements with unit_cost) — `product.purchase_price` is recomputed in the same transaction as the stock update (COONG-223)
- 82f850f: fix(detail): ProductDetail now shows compact Card with Creado/Actualizado timestamps; delete migrated from InlineConfirm to UI.ConfirmDialog modal; product schema updated_at uses .$onUpdate() for proper timestamp refresh; action buttons use size sm + Pencil icon (COONG-112)
- 82f850f: refactor(ui): adopt FormSection + FormDialogSubmit from `@coongro/ui-components` 0.28.0 (COONG-112)

  - `ProductForm` ahora envuelve cada sección (Información básica, Precios, Inventario, Estado, Datos adicionales) en `UI.FormSection` (Card + ícono + título), reemplazando el helper local `renderSectionHeader`.
  - `CreateProductButton` migra a `UI.FormDialogSubmit`: footer sticky con botones Cancelar/Crear producto.
  - `ProductFormProps` extendida con `formRef`, `hideActions`. Compatible hacia atrás (todas opcionales).

- cc0346d: feat(batches): motor de lotes genérico y reusable sobre products.batches (COONG-220)

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

- be17799: products gana un primitivo de LOTES (batches) genérico y reutilizable: tabla `module_products_batches` + repositorio `products.batches` (create/listByProduct FIFO/getExpiringSoon/getExpired/update/delete). Número de lote + vencimiento (opcional) + cantidad por producto, sin asumir semántica vet. Base para que vet-pharmacy y Salidas consuman un único sistema de lotes en vez de duplicarlo. (COONG-217, paso 1 — migración de vet-pharmacy a consumirlo viene en pasos siguientes.)

### Patch Changes

- 56d72b3: Limpieza/fix de consistencia:
  - Se elimina el endpoint `GET /list` (`httpEndpoints` del manifest) que estaba **roto en builds limpios**: el manifest lo referenciaba (`dist/endpoints/products.js`) pero el source nunca se commiteó, así que en CI/publish/producción el handler apuntaba a un archivo inexistente. No lo consumía nadie (el listado usa la action `products.items.list`).
  - Se commitea `drizzle/meta/0001_snapshot.json`, que había quedado sin trackear (la migración de batches se mergeó sin su snapshot) — necesario para que el próximo `drizzle-kit generate` diffee bien.

## 1.2.0

### Minor Changes

- dd47859: fix(detail): ProductDetail now shows compact Card with Creado/Actualizado timestamps; delete migrated from InlineConfirm to UI.ConfirmDialog modal; product schema updated_at uses .$onUpdate() for proper timestamp refresh; action buttons use size sm + Pencil icon (COONG-112)
- dd47859: refactor(ui): adopt FormSection + FormDialogSubmit from `@coongro/ui-components` 0.28.0 (COONG-112)
  - `ProductForm` ahora envuelve cada sección (Información básica, Precios, Inventario, Estado, Datos adicionales) en `UI.FormSection` (Card + ícono + título), reemplazando el helper local `renderSectionHeader`.
  - `CreateProductButton` migra a `UI.FormDialogSubmit`: footer sticky con botones Cancelar/Crear producto.
  - `ProductFormProps` extendida con `formRef`, `hideActions`. Compatible hacia atrás (todas opcionales).

## 1.1.0

### Minor Changes

- 65ae493: Migrate ProductsTable to DataTable with mobile card view (mobileRender)

## 1.0.3

### Patch Changes

- 71fa268: fix(ci): correct release and publish workflows
  - Fix changesets/action version command (use shell script instead of inline &&)
  - Fix scoped registry override in production publish
  - Add tag creation and GitHub Release in publish workflow
  - Remove obsolete tag-release workflow
