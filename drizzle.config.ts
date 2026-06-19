import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/schema/category.ts', './src/schema/product.ts', './src/schema/variant.ts', './src/schema/stock-movement.ts', './src/schema/batch.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  verbose: true,
  strict: true,
});
