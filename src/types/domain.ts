export interface Product {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  sku: string | null;
  barcode: string | null;
  unit: string | null;
  purchase_price: string | null;
  sale_price: string | null;
  tax_rate: string | null;
  stock_current: string;
  stock_minimum: string;
  image_url: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCreateData {
  id?: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  sku?: string | null;
  barcode?: string | null;
  unit?: string | null;
  purchase_price?: string | null;
  sale_price?: string | null;
  tax_rate?: string | null;
  stock_current?: string;
  stock_minimum?: string;
  image_url?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  is_active?: boolean;
}

export type ProductUpdateData = Partial<ProductCreateData>;

export interface Category {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  slug: string | null;
  icon: string | null;
  color: string | null;
  order: number;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreateData {
  id?: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  slug?: string | null;
  icon?: string | null;
  color?: string | null;
  order?: number;
  metadata?: Record<string, unknown> | null;
  is_active?: boolean;
}

export type CategoryUpdateData = Partial<CategoryCreateData>;

export interface Variant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  purchase_price: string | null;
  sale_price: string | null;
  stock_current: string;
  stock_minimum: string;
  attributes: Record<string, unknown> | null;
  image_url: string | null;
  is_active: boolean;
  order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VariantCreateData {
  id?: string;
  product_id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  purchase_price?: string | null;
  sale_price?: string | null;
  stock_current?: string;
  stock_minimum?: string;
  attributes?: Record<string, unknown> | null;
  image_url?: string | null;
  is_active?: boolean;
  order?: number;
}

export type VariantUpdateData = Partial<Omit<VariantCreateData, 'product_id'>>;

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'transfer';

export interface StockMovement {
  id: string;
  product_id: string;
  variant_id: string | null;
  type: string;
  quantity: string;
  reference_type: string | null;
  reference_id: string | null;
  unit_cost: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface StockMovementCreateData {
  id?: string;
  product_id: string;
  variant_id?: string | null;
  type: StockMovementType;
  quantity: string;
  reference_type?: string | null;
  reference_id?: string | null;
  unit_cost?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}
