/**
 * @coongro/products — Entry point principal (browser-safe)
 *
 * Exportar aquí: hooks, componentes, tipos, utilidades.
 * NO exportar schema tables ni repositories (usan drizzle-orm, solo backend).
 * Para exports server-only → usar server.ts
 */

// Type-only exports de schema (server-only, seguro como tipo)
export type { CategoryRow, NewCategoryRow } from './schema/category.js';
export type { ProductRow, NewProductRow } from './schema/product.js';
export type { VariantRow, NewVariantRow } from './schema/variant.js';
export type { StockMovementRow, NewStockMovementRow } from './schema/stock-movement.js';

// Type-only exports de repositories
export type { CategorySearchParams } from './repositories/category.repository.js';
export type { ProductSearchParams } from './repositories/product.repository.js';
export type {
  StockMovementListParams,
  StockBalanceResult,
  StockSummaryResult,
} from './repositories/stock-movement.repository.js';

// Types de dominio
export type {
  Product,
  ProductCreateData,
  ProductUpdateData,
  Category,
  CategoryCreateData,
  CategoryUpdateData,
  Variant,
  VariantCreateData,
  VariantUpdateData,
  StockMovementType,
  StockMovement,
  StockMovementCreateData,
} from './types/domain.js';

export type { ProductFilters, CategoryFilters, SortDirection } from './types/filters.js';

export type {
  ColumnDef,
  ActionDef,
  FilterDef,
  FieldDef,
  SectionDef,
  ProductsTableProps,
  ProductFormProps,
  ProductPickerProps,
  ProductCardProps,
  ProductDetailProps,
  CategoryPickerProps,
  StockBadgeProps,
  CreateProductButtonProps,
} from './types/components.js';

// Hooks
export { useProducts } from './hooks/useProducts.js';
export type { UseProductsOptions, UseProductsResult } from './hooks/useProducts.js';

export { useProduct } from './hooks/useProduct.js';
export type { UseProductResult } from './hooks/useProduct.js';

export { useProductMutations } from './hooks/useProductMutations.js';
export type { UseProductMutationsResult } from './hooks/useProductMutations.js';

export { useCategories } from './hooks/useCategories.js';
export type {
  CategoryTreeNode,
  UseCategoriesOptions,
  UseCategoriesResult,
} from './hooks/useCategories.js';

export { useVariants } from './hooks/useVariants.js';
export type { UseVariantsResult } from './hooks/useVariants.js';

export { useStockMovements } from './hooks/useStockMovements.js';
export type { StockBalance, UseStockMovementsResult } from './hooks/useStockMovements.js';

// Components
export { ProductsTable } from './components/ProductsTable.js';
export { ProductForm } from './components/ProductForm.js';
export { ProductPicker } from './components/ProductPicker.js';
export { ProductCard } from './components/ProductCard.js';
export { ProductDetail } from './components/ProductDetail.js';
export { CreateProductButton } from './components/CreateProductButton.js';
export { CategoryPicker } from './components/CategoryPicker.js';
export { StockBadge } from './components/StockBadge.js';
