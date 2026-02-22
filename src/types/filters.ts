export type SortDirection = 'asc' | 'desc';

export interface ProductFilters {
  query?: string;
  categoryId?: string;
  tags?: string[];
  isActive?: boolean;
  inStock?: boolean;
  lowStock?: boolean;
  priceMin?: number;
  priceMax?: number;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: SortDirection;
}

export interface CategoryFilters {
  query?: string;
  parentId?: string | null;
  isActive?: boolean;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: SortDirection;
}
