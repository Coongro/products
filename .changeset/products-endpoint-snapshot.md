---
"@coongro/products": patch
---

Limpieza/fix de consistencia:
- Se elimina el endpoint `GET /list` (`httpEndpoints` del manifest) que estaba **roto en builds limpios**: el manifest lo referenciaba (`dist/endpoints/products.js`) pero el source nunca se commiteó, así que en CI/publish/producción el handler apuntaba a un archivo inexistente. No lo consumía nadie (el listado usa la action `products.items.list`).
- Se commitea `drizzle/meta/0001_snapshot.json`, que había quedado sin trackear (la migración de batches se mergeó sin su snapshot) — necesario para que el próximo `drizzle-kit generate` diffee bien.
