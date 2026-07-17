---
'@coongro/products': patch
---

fix(batches): el consumo de stock ya no elige lotes vencidos

El motor de lotes (`products.batches.consume`) ordenaba por vencimiento ascendente pero incluía lotes vencidos (status `active` con fecha pasada), así que el FIFO despachaba primero justamente lo vencido. Ahora:

- El FIFO **excluye lotes vencidos por defecto**; en modo manual, rechaza el lote elegido si venció.
- Nuevo `allowExpired` (opcional en `ConsumeParams`) habilita la política "avisar": consume vencidos pero marca cada lote tocado con `expired` para que el llamador pueda advertir.
- Se agrega el flag `expired` a `BatchConsumePlanItem` y `ConsumedBatch`.
