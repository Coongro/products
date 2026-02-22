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
} from './domain.js';

export type { ProductFilters, CategoryFilters, SortDirection } from './filters.js';

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
} from './components.js';
