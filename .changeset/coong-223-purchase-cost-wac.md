---
'@coongro/products': minor
---

feat(costing): auto-fill product purchase cost via moving weighted average on stock-in. New pure `weightedAverageCost` engine in `services/costing.ts`, wired into `BatchRepository.create` (batches) and `StockMovementRepository.create` (direct `in` movements with unit_cost) — `product.purchase_price` is recomputed in the same transaction as the stock update (COONG-223)
