---
'@coongro/products': minor
---

refactor(ui): adopt FormSection + FormDialogSubmit from `@coongro/ui-components` 0.28.0 (COONG-112)

- `ProductForm` ahora envuelve cada sección (Información básica, Precios, Inventario, Estado, Datos adicionales) en `UI.FormSection` (Card + ícono + título), reemplazando el helper local `renderSectionHeader`.
- `CreateProductButton` migra a `UI.FormDialogSubmit`: footer sticky con botones Cancelar/Crear producto.
- `ProductFormProps` extendida con `formRef`, `hideActions`. Compatible hacia atrás (todas opcionales).
