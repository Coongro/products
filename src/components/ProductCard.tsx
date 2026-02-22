import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

import { useProduct } from '../hooks/useProduct.js';
import type { ProductCardProps } from '../types/components.js';

import { StockBadge } from './StockBadge.js';

const React = getHostReact();

const DEFAULT_SHOW_FIELDS = ['sku', 'sale_price', 'unit'];

export function ProductCard(props: ProductCardProps) {
  const {
    productId,
    product: productProp,
    showFields = DEFAULT_SHOW_FIELDS,
    extraInfo,
    actions: cardActions = [],
  } = props;

  const UI = getHostUI();
  const { product: fetchedProduct, loading } = useProduct(productProp ? null : productId);
  const product = productProp ?? fetchedProduct;

  if (loading) {
    return React.createElement(
      UI.Card,
      null,
      React.createElement(
        UI.CardBody,
        null,
        React.createElement(
          'div',
          { className: 'flex items-center gap-3' },
          React.createElement(UI.Skeleton, { className: 'w-10 h-10 rounded-lg' }),
          React.createElement(
            'div',
            { className: 'flex flex-col gap-1.5 flex-1' },
            React.createElement(UI.Skeleton, { className: 'h-4 w-32' }),
            React.createElement(UI.Skeleton, { className: 'h-3 w-20' })
          )
        )
      )
    );
  }

  if (!product) {
    return React.createElement(UI.EmptyState, {
      title: 'Producto no encontrado',
    });
  }

  const fieldLabels: Record<string, string> = {
    sku: 'SKU',
    barcode: 'Código de barras',
    sale_price: 'Precio',
    purchase_price: 'Costo',
    unit: 'Unidad',
    category_id: 'Categoría',
  };

  function formatFieldValue(field: string, value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (field === 'sale_price' || field === 'purchase_price') {
      return `$${Number(value).toFixed(2)}`;
    }
    return String(value);
  }

  return React.createElement(
    UI.Card,
    null,
    React.createElement(
      UI.CardBody,
      null,

      // Header
      React.createElement(
        'div',
        { className: 'flex items-center gap-3' },
        React.createElement(UI.Avatar, {
          src: product.image_url || undefined,
          name: product.name,
          size: 'sm',
        }),
        React.createElement(
          'div',
          { className: 'flex flex-col min-w-0 flex-1' },
          React.createElement(
            'span',
            { className: 'text-sm font-medium text-cg-text truncate' },
            product.name
          ),
          React.createElement(
            'span',
            { className: 'text-xs text-cg-text-muted' },
            product.sku ?? ''
          )
        ),
        React.createElement(StockBadge, {
          stock: product.stock_current,
          minimum: product.stock_minimum,
        })
      ),

      // Campos
      showFields.length > 0 &&
        React.createElement(
          'div',
          { className: 'mt-3 flex flex-col gap-1' },
          showFields.map((field) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            const value = (product as any)[field];
            if ((value === null || value === undefined) && field !== 'sale_price') return null;
            return React.createElement(
              'div',
              { key: field, className: 'flex items-center gap-2 text-xs' },
              React.createElement(
                'span',
                { className: 'text-cg-text-muted w-20 flex-shrink-0' },
                fieldLabels[field] ?? field
              ),
              React.createElement(
                'span',
                { className: 'text-cg-text truncate' },
                formatFieldValue(field, value)
              )
            );
          })
        ),

      // Extra info
      extraInfo &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement(UI.Separator, null),
          React.createElement('div', { className: 'mt-3' },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            extraInfo() as any
          )
        ),

      // Acciones
      cardActions.length > 0 &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement(UI.Separator, null),
          React.createElement(
            'div',
            { className: 'mt-3 flex gap-2' },
            cardActions
              .filter((a) => !a.hidden || !a.hidden(product))
              .map((action, i) =>
                React.createElement(
                  UI.Button,
                  {
                    key: i,
                    variant: action.variant === 'danger' ? 'destructive' : 'outline',
                    size: 'sm',
                    onClick: () => action.onClick(product),
                  },
                  action.label
                )
              )
          )
        )
    )
  );
}
