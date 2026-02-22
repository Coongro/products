import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

import { useProduct } from '../hooks/useProduct.js';
import type { StockBadgeProps } from '../types/components.js';

const React = getHostReact();

export function StockBadge(props: StockBadgeProps) {
  const { productId, stock: stockProp, minimum: minimumProp, variant: variantProp } = props;
  const UI = getHostUI();

  const { product, loading } = useProduct(stockProp !== undefined ? null : productId);

  if (loading) {
    return React.createElement(UI.Skeleton, { className: 'h-5 w-16 rounded-full' });
  }

  let stockNum: number;
  let minNum: number;

  if (variantProp) {
    stockNum = Number(variantProp.stock_current) || 0;
    minNum = Number(variantProp.stock_minimum) || 0;
  } else if (stockProp !== undefined) {
    stockNum = Number(stockProp) || 0;
    minNum = Number(minimumProp) || 0;
  } else if (product) {
    stockNum = Number(product.stock_current) || 0;
    minNum = Number(product.stock_minimum) || 0;
  } else {
    return null;
  }

  let badgeVariant: 'danger-soft' | 'warning-soft' | 'success-soft';
  let label: string;

  if (stockNum <= 0) {
    badgeVariant = 'danger-soft';
    label = 'Sin stock';
  } else if (minNum > 0 && stockNum <= minNum) {
    badgeVariant = 'warning-soft';
    label = `Bajo: ${stockNum}`;
  } else {
    badgeVariant = 'success-soft';
    label = `${stockNum}`;
  }

  return React.createElement(UI.Badge, { variant: badgeVariant, size: 'sm' }, label);
}
