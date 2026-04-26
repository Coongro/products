# @coongro/products

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
