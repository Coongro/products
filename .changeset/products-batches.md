---
"@coongro/products": minor
---

products gana un primitivo de LOTES (batches) genérico y reutilizable: tabla `module_products_batches` + repositorio `products.batches` (create/listByProduct FIFO/getExpiringSoon/getExpired/update/delete). Número de lote + vencimiento (opcional) + cantidad por producto, sin asumir semántica vet. Base para que vet-pharmacy y Salidas consuman un único sistema de lotes en vez de duplicarlo. (COONG-217, paso 1 — migración de vet-pharmacy a consumirlo viene en pasos siguientes.)
