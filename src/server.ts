/**
 * @coongro/products — Exportaciones server-only
 *
 * Schema tables y repositories (dependen de drizzle-orm).
 * NO importar desde el browser — usar '@coongro/products' para hooks/componentes.
 */

// Schema tables
export { categoryTable } from './schema/category.js';
export type { CategoryRow, NewCategoryRow } from './schema/category.js';

export { productTable } from './schema/product.js';
export type { ProductRow, NewProductRow } from './schema/product.js';

export { variantTable } from './schema/variant.js';
export type { VariantRow, NewVariantRow } from './schema/variant.js';

export { stockMovementTable } from './schema/stock-movement.js';
export type { StockMovementRow, NewStockMovementRow } from './schema/stock-movement.js';

// Repositories
export { CategoryRepository } from './repositories/category.repository.js';
export type { CategorySearchParams } from './repositories/category.repository.js';

export { ProductRepository } from './repositories/product.repository.js';
export type { ProductSearchParams } from './repositories/product.repository.js';

export { VariantRepository } from './repositories/variant.repository.js';

export { StockMovementRepository } from './repositories/stock-movement.repository.js';
export type {
  StockMovementListParams,
  StockBalanceResult,
  StockSummaryResult,
} from './repositories/stock-movement.repository.js';
