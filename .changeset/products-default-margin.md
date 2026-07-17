---
'@coongro/products': minor
---

feat(settings): margen por defecto para sugerir precio de venta (COONG-248)

Nueva setting `products.pricing.defaultMargin` (%), en la página "Precios" de settings. Al cargar un producto, el precio de venta se prellena desde el precio de compra aplicando el margen (ej.: costo $100 con margen 50% sugiere $150), solo si el precio de venta sigue vacío — nunca pisa un valor puesto a mano. En el formulario aparece además un atajo "Sugerido: $X (margen Y%) · usar" para reaplicar la sugerencia. Default 0 = no sugerir (comportamiento actual).
