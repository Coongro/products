import { getHostReact, getHostUI, useViewContributions } from '@coongro/plugin-sdk';

import { useProduct } from '../hooks/useProduct.js';
import { useStockMovements } from '../hooks/useStockMovements.js';
import { useVariants } from '../hooks/useVariants.js';
import type { ProductDetailProps, SectionDef } from '../types/components.js';

import { StockBadge } from './StockBadge.js';

const React = getHostReact();
const { useMemo, useState } = React;

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function DetailSkeleton() {
  const UI = getHostUI();
  return React.createElement(
    'div',
    { className: 'flex flex-col gap-6' },
    // Hero skeleton
    React.createElement(
      UI.Card,
      null,
      React.createElement(
        UI.CardBody,
        null,
        React.createElement(
          'div',
          { className: 'flex items-start gap-5' },
          React.createElement(UI.Skeleton, { className: 'w-20 h-20 rounded-xl flex-shrink-0' }),
          React.createElement(
            'div',
            { className: 'flex-1 flex flex-col gap-2.5 pt-1' },
            React.createElement(UI.Skeleton, { className: 'h-6 w-48 rounded-lg' }),
            React.createElement(UI.Skeleton, { className: 'h-4 w-72 rounded-md' }),
            React.createElement(
              'div',
              { className: 'flex gap-2 mt-1' },
              React.createElement(UI.Skeleton, { className: 'h-5 w-16 rounded-full' }),
              React.createElement(UI.Skeleton, { className: 'h-5 w-20 rounded-full' })
            )
          )
        )
      )
    ),
    // Info cards skeleton
    React.createElement(
      'div',
      { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
      React.createElement(UI.Skeleton, { className: 'h-32 rounded-xl' }),
      React.createElement(UI.Skeleton, { className: 'h-32 rounded-xl' })
    )
  );
}

// ─── Data field row ───────────────────────────────────────────────────────────

function DataRow(props: { label: string; value: string; mono?: boolean }) {
  return React.createElement(
    'div',
    {
      className:
        'flex items-center justify-between py-2.5 border-b border-cg-border last:border-b-0',
    },
    React.createElement(
      'span',
      { className: 'text-xs text-cg-text-muted uppercase tracking-wide' },
      props.label
    ),
    React.createElement(
      'span',
      { className: `text-sm font-medium text-cg-text ${props.mono ? 'font-mono' : ''}` },
      props.value
    )
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ProductDetail(props: ProductDetailProps) {
  const { productId, extraSections = [], extraActions = [], onEdit, onDelete } = props;

  const UI = getHostUI();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { product, loading, error, refetch } = useProduct(productId);
  const { variants } = useVariants(productId);
  const { movements, balance } = useStockMovements(productId);

  // View contributions
  let contributions: { sections: any[]; actions: any[] } = { sections: [], actions: [] };
  try {
    contributions = useViewContributions('products.detail.open');
  } catch {
    // useViewContributions no disponible
  }

  const allSections = useMemo(() => {
    const sections: SectionDef[] = [...extraSections];
    if (contributions.sections) {
      for (const c of contributions.sections) {
        sections.push({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          title: (c.title ?? '') as string,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          order: (c.order ?? 50) as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          render: () => c.render(),
        });
      }
    }
    return sections.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  }, [extraSections, contributions.sections, productId]);

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return React.createElement(DetailSkeleton);
  }

  // ─── Error ──────────────────────────────────────────────────────────────
  if (error || !product) {
    return React.createElement(UI.ErrorDisplay, {
      title: 'Producto no encontrado',
      message: error ?? 'No se pudo cargar este producto',
      onRetry: refetch,
      icon: React.createElement(UI.DynamicIcon, { icon: 'Package', size: 48 }),
    });
  }

  // ─── Datos formateados ──────────────────────────────────────────────────
  const salePrice = product.sale_price ? `$${Number(product.sale_price).toFixed(2)}` : null;
  const purchasePrice = product.purchase_price
    ? `$${Number(product.purchase_price).toFixed(2)}`
    : null;
  const taxRate = product.tax_rate ? `${product.tax_rate}%` : null;
  const margin =
    product.sale_price && product.purchase_price
      ? (
          ((Number(product.sale_price) - Number(product.purchase_price)) /
            Number(product.sale_price)) *
          100
        ).toFixed(1)
      : null;

  // ─── Render ─────────────────────────────────────────────────────────────
  const children: React.ReactNode[] = [];

  // ═══ HERO CARD ══════════════════════════════════════════════════════════
  children.push(
    React.createElement(
      UI.Card,
      { key: 'hero' },
      React.createElement(
        UI.CardBody,
        null,
        React.createElement(
          'div',
          { className: 'flex items-start gap-5' },

          // Avatar / Image
          React.createElement(UI.Avatar, {
            src: product.image_url || undefined,
            name: product.name,
            size: 'lg',
            icon: !product.image_url
              ? React.createElement(UI.DynamicIcon, { icon: 'Package', size: 32 })
              : undefined,
          }),

          // Info
          React.createElement(
            'div',
            { className: 'flex-1 min-w-0 pt-0.5' },

            // Nombre
            React.createElement(
              'h2',
              { className: 'text-xl font-bold text-cg-text truncate' },
              product.name
            ),

            // Descripción
            product.description &&
              React.createElement(
                'p',
                { className: 'text-sm text-cg-text-muted mt-1 line-clamp-2' },
                product.description
              ),

            // Badges
            React.createElement(
              'div',
              { className: 'flex flex-wrap items-center gap-2 mt-3' },
              // Estado
              React.createElement(
                UI.Badge,
                {
                  variant: product.is_active ? 'success' : 'secondary',
                  size: 'sm',
                  icon: React.createElement('span', {
                    className: `w-1.5 h-1.5 rounded-full ${product.is_active ? 'bg-cg-success' : 'bg-cg-text-muted'}`,
                  }),
                },
                product.is_active ? 'Activo' : 'Inactivo'
              ),
              // Stock
              React.createElement(StockBadge, {
                stock: product.stock_current,
                minimum: product.stock_minimum,
              }),
              // SKU
              product.sku &&
                React.createElement(
                  UI.Badge,
                  { variant: 'outline', size: 'sm' },
                  product.sku
                ),
              // Precio principal
              salePrice &&
                React.createElement(
                  UI.Badge,
                  { variant: 'brand-soft', size: 'sm' },
                  salePrice
                )
            )
          ),

          // Acciones (derecha)
          React.createElement(
            'div',
            { className: 'flex items-center gap-2 flex-shrink-0' },
            onEdit &&
              React.createElement(
                UI.Button,
                {
                  variant: 'outline',
                  onClick: () => onEdit(product),
                },
                React.createElement(UI.DynamicIcon, { icon: 'SquarePen', size: 15 }),
                'Editar'
              ),
            onDelete &&
              (confirmDelete
                ? React.createElement(UI.InlineConfirm, {
                    message: '¿Eliminar?',
                    onConfirm: () => {
                      onDelete?.(product);
                      setConfirmDelete(false);
                    },
                    onCancel: () => setConfirmDelete(false),
                  })
                : React.createElement(
                    UI.Button,
                    {
                      variant: 'destructive',
                      onClick: () => setConfirmDelete(true),
                    },
                    React.createElement(UI.DynamicIcon, { icon: 'Trash2', size: 15 }),
                    'Eliminar'
                  )),
            // Extra actions
            ...extraActions
              .filter((a) => !a.hidden || !a.hidden(product))
              .map((action, i) =>
                React.createElement(
                  UI.Button,
                  {
                    key: `ea-${i}`,
                    variant: 'outline',
                    onClick: () => action.onClick(product),
                  },
                  action.label
                )
              ),
            // Contribution actions
            ...(contributions.actions || []).map((ca: any, i: number) =>
              React.createElement(
                UI.Button,
                {
                  key: `ca-${i}`,
                  variant: 'outline',
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
                  onClick: () => ca.onClick?.(product),
                },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                ca.label as string
              )
            )
          )
        )
      )
    )
  );

  // ═══ INFO CARDS GRID ════════════════════════════════════════════════════
  const hasIdentifiers = product.sku || product.barcode || product.unit;
  const hasPricing = purchasePrice || salePrice || taxRate;

  if (hasIdentifiers || hasPricing) {
    const gridCards: React.ReactNode[] = [];

    // Card: Identificación
    if (hasIdentifiers) {
      const rows: React.ReactNode[] = [];
      if (product.sku)
        rows.push(
          React.createElement(DataRow, { key: 'sku', label: 'SKU', value: product.sku, mono: true })
        );
      if (product.barcode)
        rows.push(
          React.createElement(DataRow, {
            key: 'barcode',
            label: 'Código de barras',
            value: product.barcode,
            mono: true,
          })
        );
      if (product.unit)
        rows.push(
          React.createElement(DataRow, { key: 'unit', label: 'Unidad', value: product.unit })
        );

      gridCards.push(
        React.createElement(
          UI.Card,
          { key: 'ident' },
          React.createElement(
            UI.CardHeader,
            null,
            React.createElement(
              'div',
              { className: 'flex items-center gap-2' },
              React.createElement(UI.DynamicIcon, { icon: 'Tag', size: 14, className: 'text-cg-text-muted' }),
              React.createElement(UI.CardTitle, null, 'Identificación')
            )
          ),
          React.createElement(UI.CardBody, null, ...rows)
        )
      );
    }

    // Card: Precios
    if (hasPricing) {
      const rows: React.ReactNode[] = [];
      if (purchasePrice)
        rows.push(
          React.createElement(DataRow, {
            key: 'purchase',
            label: 'Precio compra',
            value: purchasePrice,
          })
        );
      if (salePrice)
        rows.push(
          React.createElement(DataRow, { key: 'sale', label: 'Precio venta', value: salePrice })
        );
      if (taxRate)
        rows.push(React.createElement(DataRow, { key: 'tax', label: 'Impuesto', value: taxRate }));
      if (margin)
        rows.push(
          React.createElement(DataRow, { key: 'margin', label: 'Margen', value: `${margin}%` })
        );

      gridCards.push(
        React.createElement(
          UI.Card,
          { key: 'pricing' },
          React.createElement(
            UI.CardHeader,
            null,
            React.createElement(
              'div',
              { className: 'flex items-center gap-2' },
              React.createElement(UI.DynamicIcon, { icon: 'DollarSign', size: 14, className: 'text-cg-text-muted' }),
              React.createElement(UI.CardTitle, null, 'Precios')
            )
          ),
          React.createElement(UI.CardBody, null, ...rows)
        )
      );
    }

    children.push(
      React.createElement(
        'div',
        { key: 'info-grid', className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
        ...gridCards
      )
    );
  }

  // ═══ VARIANTES ══════════════════════════════════════════════════════════
  if (variants.length > 0) {
    children.push(
      React.createElement(
        UI.Card,
        { key: 'variants' },
        React.createElement(
          UI.CardHeader,
          null,
          React.createElement(
            'div',
            { className: 'flex items-center gap-2' },
            React.createElement(UI.DynamicIcon, { icon: 'Box', size: 14, className: 'text-cg-text-muted' }),
            React.createElement(UI.CardTitle, null, `Variantes (${variants.length})`)
          )
        ),
        React.createElement(
          UI.CardBody,
          null,
          React.createElement(
            'div',
            { className: 'divide-y divide-cg-border' },
            ...variants.map((v) =>
              React.createElement(
                'div',
                { key: v.id, className: 'flex items-center justify-between py-3' },
                React.createElement(
                  'div',
                  { className: 'flex items-center gap-3 min-w-0' },
                  React.createElement(UI.Avatar, {
                    name: v.name,
                    size: 'xs',
                  }),
                  React.createElement(
                    'div',
                    { className: 'min-w-0' },
                    React.createElement(
                      'span',
                      { className: 'text-sm font-medium text-cg-text block truncate' },
                      v.name
                    ),
                    v.sku &&
                      React.createElement(
                        'span',
                        { className: 'text-xs text-cg-text-muted font-mono' },
                        v.sku
                      )
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'flex items-center gap-3 flex-shrink-0' },
                  v.sale_price &&
                    React.createElement(
                      UI.Badge,
                      { variant: 'outline', size: 'sm' },
                      `$${Number(v.sale_price).toFixed(2)}`
                    ),
                  React.createElement(StockBadge, {
                    stock: v.stock_current,
                    minimum: v.stock_minimum,
                  })
                )
              )
            )
          )
        )
      )
    );
  }

  // ═══ HISTORIAL DE STOCK ═════════════════════════════════════════════════
  if (balance) {
    const stockChildren: React.ReactNode[] = [];

    // Summary stats
    stockChildren.push(
      React.createElement(
        'div',
        { key: 'stats', className: 'grid grid-cols-3 gap-3' },
        // Entradas
        React.createElement(UI.StatCard, {
          size: 'sm',
          variant: 'success',
          label: 'Entradas',
          value: String(balance.totalIn),
          icon: React.createElement(UI.DynamicIcon, { icon: 'ArrowDown', size: 12 }),
        }),
        // Salidas
        React.createElement(UI.StatCard, {
          size: 'sm',
          variant: 'danger',
          label: 'Salidas',
          value: String(balance.totalOut),
          icon: React.createElement(UI.DynamicIcon, { icon: 'ArrowUp', size: 12 }),
        }),
        // Balance
        React.createElement(UI.StatCard, {
          size: 'sm',
          variant: 'default',
          label: 'Balance',
          value: String(balance.balance),
        })
      )
    );

    // Movimientos recientes
    if (movements.length > 0) {
      stockChildren.push(
        React.createElement(
          'div',
          { key: 'movements', className: 'mt-4' },
          React.createElement(
            'span',
            {
              className: 'text-[10px] font-semibold text-cg-text-muted uppercase tracking-wider',
            },
            'Últimos movimientos'
          ),
          React.createElement(
            UI.Timeline,
            { className: 'mt-2 gap-0' },
            ...movements.slice(0, 8).map((m) => {
              const qty = Number(m.quantity);
              const isPositive = qty > 0;
              return React.createElement(
                UI.TimelineItem,
                { key: m.id, size: 'sm' },
                // Icono dirección
                React.createElement(
                  UI.TimelineIcon,
                  {
                    size: 'sm',
                    variant: isPositive ? 'success' : 'danger',
                  },
                  React.createElement(UI.DynamicIcon, {
                    icon: isPositive ? 'ArrowDown' : 'ArrowUp',
                    size: 12,
                  })
                ),
                // Contenido
                React.createElement(
                  UI.TimelineContent,
                  null,
                  React.createElement(
                    UI.TimelineTitle,
                    { className: 'text-xs capitalize' },
                    m.type
                  ),
                  m.notes &&
                    React.createElement(
                      UI.TimelineDescription,
                      { className: 'text-xs truncate' },
                      m.notes
                    )
                ),
                // Fecha
                React.createElement(
                  'span',
                  { className: 'text-[10px] text-cg-text-muted flex-shrink-0 ml-auto' },
                  new Date(m.created_at).toLocaleDateString()
                ),
                // Cantidad
                React.createElement(
                  UI.Badge,
                  {
                    variant: isPositive ? 'success-soft' : 'danger-soft',
                    size: 'sm',
                  },
                  isPositive ? `+${m.quantity}` : m.quantity
                )
              );
            })
          )
        )
      );
    }

    children.push(
      React.createElement(
        UI.Card,
        { key: 'stock' },
        React.createElement(
          UI.CardHeader,
          null,
          React.createElement(
            'div',
            { className: 'flex items-center gap-2' },
            React.createElement(UI.DynamicIcon, { icon: 'Box', size: 14, className: 'text-cg-text-muted' }),
            React.createElement(UI.CardTitle, null, 'Inventario')
          )
        ),
        React.createElement(UI.CardBody, null, ...stockChildren)
      )
    );
  }

  // ═══ SECCIONES EXTRA (bloques + view contributions) ═════════════════════
  for (let i = 0; i < allSections.length; i++) {
    const section = allSections[i];
    children.push(
      React.createElement(
        UI.Card,
        { key: `section-${i}` },
        React.createElement(
          UI.CardHeader,
          null,
          React.createElement(UI.CardTitle, null, section.title)
        ),
        React.createElement(
          UI.CardBody,
          null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          section.render() as any
        )
      )
    );
  }

  return React.createElement('div', { className: 'flex flex-col gap-5' }, ...children);
}
