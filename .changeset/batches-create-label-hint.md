---
'@coongro/products': minor
---

feat(batches): `createLabel` y `createHint` para matizar el alta de lote (COONG-254)

`BatchesView` acepta dos props nuevas, para que el integrador (un kit) ajuste el alta manual sin que products aprenda nada de su dominio:

- **`createLabel`** — cambia la etiqueta de la acción de alta en los tres lugares donde aparece (header, cabecera de grupo y empty state) y en el título del diálogo. Default: `Cargar lote`.
- **`createHint`** — aviso opcional arriba del formulario **solo en alta** (no en edición), con título, descripción y un botón opcional que navega a otra vista vía `views.open`.

Sirve para encauzar al usuario cuando el alta manual no es la vía principal de abastecimiento — en el kit veterinario, la compra real va por Salidas → Compra (que además registra el gasto y el costo del lote). products sigue siendo genérico: no sabe qué es una "compra"; el texto y el destino los inyecta el kit.
