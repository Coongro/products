import type { Product, Variant, ProductCreateData, ProductUpdateData } from './domain.js';
import type { ProductFilters } from './filters.js';

// --- Extensibilidad genérica ---

export interface ColumnDef<T = any> {
  key: string;
  header: string;
  render?: (item: T) => unknown;
  sortable?: boolean;
  width?: string;
}

export interface ActionDef<T = any> {
  label: string;
  onClick: (item: T) => void;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  hidden?: (item: T) => boolean;
}

export interface FilterDef {
  key: string;
  label: string;
  type: 'text' | 'select' | 'range' | 'boolean';
  options?: { label: string; value: string }[];
}

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'boolean' | 'date';
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

export interface SectionDef {
  title: string;
  order: number;
  render: () => unknown;
}

// --- ProductsTable ---

export interface ProductsTableProps {
  extraColumns?: ColumnDef<Product>[];
  extraActions?: ActionDef<Product>[];
  extraFilters?: FilterDef[];
  columns?: ColumnDef<Product>[];
  selectable?: boolean;
  emptyMessage?: string;
  onRowClick?: (product: Product) => void;
  filters?: Partial<ProductFilters>;
}

// --- ProductForm ---

export interface ProductFormProps {
  product?: Product | null;
  extraFields?: FieldDef[];
  hiddenFields?: string[];
  defaults?: Partial<ProductCreateData>;
  onSubmit?: (
    data: ProductCreateData | ProductUpdateData,
    extraData?: Record<string, unknown>
  ) => void;
  onCancel?: () => void;
  onExtraFieldsData?: (data: Record<string, unknown>) => void;
  loading?: boolean;
}

// --- ProductPicker ---

export interface ProductPickerProps {
  value?: string | string[] | null;
  onChange?: (value: string | null) => void;
  filters?: Partial<ProductFilters>;
  allowCreate?: boolean;
  onCreateClick?: () => void;
  showVariants?: boolean;
  placeholder?: string;
  multiple?: boolean;
}

// --- ProductCard ---

export interface ProductCardProps {
  productId?: string;
  product?: Product;
  showFields?: string[];
  extraInfo?: () => unknown;
  actions?: ActionDef<Product>[];
}

// --- ProductDetail ---

export interface ProductDetailProps {
  productId: string;
  extraSections?: SectionDef[];
  extraActions?: ActionDef<Product>[];
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onBack?: () => void;
}

// --- CategoryPicker ---

export interface CategoryPickerProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  allowCreate?: boolean;
  treeMode?: boolean;
  placeholder?: string;
}

// --- CreateProductButton ---

export interface CreateProductButtonProps {
  defaults?: Partial<ProductCreateData>;
  label?: string;
  extraFields?: FieldDef[];
  hiddenFields?: string[];
  onSuccess?: (product: Product) => void;
  variant?: 'primary' | 'outline';
  className?: string;
}

// --- StockBadge ---

export interface StockBadgeProps {
  productId?: string;
  stock?: string | number;
  minimum?: string | number;
  variant?: Variant;
}
