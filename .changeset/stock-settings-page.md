---
'@coongro/products': minor
---

feat(stock): página de settings "Stock y vencimientos" + umbral de vencimiento configurable

- Nueva página de settings en products con `stock.alertDays` (umbral "por vencer", default 30), `stock.autoDeduct` (default true) y `stock.expiredLots` (block/warn, default block). Son conceptos genéricos de stock, así que viven en products —el motor de lotes que todos los kits dependen— y no en un plugin de kit (evita el nudo de dependencias circulares).
- La vista de lotes (`BatchesView`) lee `stock.alertDays` para el badge "por vencer" (antes fijo en `EXPIRING_SOON_DAYS = 30`).
