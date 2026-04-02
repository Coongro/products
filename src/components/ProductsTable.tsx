/**
 * Tabla de productos con búsqueda, sort y paginación.
 * Usa DataTable de ui-components para renderizado desktop + cards en móvil.
 */
import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

import { useProducts } from '../hooks/useProducts.js';
import type { ProductsTableProps } from '../types/components.js';
import type { Product } from '../types/domain.js';

import { StockBadge } from './StockBadge.js';

const React = getHostReact();
const UI = getHostUI();
const { useState, useCallback, useMemo } = React;

const SORTABLE_KEYS = new Set(['name', 'sale_price', 'stock']);

export function ProductsTable(props: ProductsTableProps) {
  const {
    columns: customColumns,
    extraColumns = [],
    extraActions = [],
    selectable = false,
    emptyMessage = 'No se encontraron productos',
    onRowClick,
    filters: initialFilters,
  } = props;

  const { data, loading, error, setFilters, pagination, refetch } = useProducts({
    initialFilters,
    pageSize: 25,
  });

  const [searchValue, setSearchValue] = useState('');
  const [sortKey, setSortKey] = useState<string>(initialFilters?.orderBy ?? '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(initialFilters?.orderDir ?? null);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value);
      setFilters({ query: value || undefined });
    },
    [setFilters]
  );

  const handleSort = useCallback(
    (key: string, direction: 'asc' | 'desc' | null) => {
      if (!SORTABLE_KEYS.has(key)) return;
      setSortKey(direction ? key : '');
      setSortDir(direction);
      setFilters({
        orderBy: direction ? key : undefined,
        orderDir: direction ?? undefined,
      });
    },
    [setFilters]
  );

  // Columnas para DataTable
  const dtColumns = useMemo(() => {
    const base = customColumns ?? [
      { key: 'name', header: 'Nombre', sortable: true },
      { key: 'sku', header: 'SKU', render: (p: Product) => p.sku ?? '—' },
      {
        key: 'sale_price',
        header: 'Precio',
        sortable: true,
        render: (p: Product) => (p.sale_price ? `$${Number(p.sale_price).toFixed(2)}` : '—'),
      },
      {
        key: 'stock',
        header: 'Stock',
        sortable: true,
        render: (p: Product) =>
          React.createElement(StockBadge, {
            stock: p.stock_current,
            minimum: p.stock_minimum,
          }),
      },
      {
        key: 'is_active',
        header: 'Estado',
        render: (p: Product) =>
          React.createElement(
            UI.Badge,
            { variant: p.is_active ? 'success' : 'secondary', size: 'sm' },
            p.is_active ? 'Activo' : 'Inactivo'
          ),
      },
    ];

    return [...base, ...extraColumns] as Array<{
      key: string;
      header: string;
      sortable?: boolean;
      render?: (item: Product) => React.ReactNode;
      className?: string;
    }>;
  }, [customColumns, extraColumns]);

  // Acciones para DataTable
  const dtActions = useMemo(() => {
    if (extraActions.length === 0) return undefined;
    return extraActions.map((a) => ({
      label: a.label,
      onClick: a.onClick,
      variant: a.variant as 'ghost' | 'destructive' | undefined,
      hidden: a.hidden,
    }));
  }, [extraActions]);

  // Mobile render: cada producto como card
  const mobileRender = useCallback(
    (product: Product) =>
      React.createElement(
        'div',
        { className: 'flex flex-col gap-1' },
        // Nombre
        React.createElement('span', { className: 'font-medium text-sm' }, product.name),
        // SKU
        product.sku &&
          React.createElement(
            'div',
            { className: 'text-xs', style: { color: 'var(--cg-text-muted)' } },
            `SKU: ${product.sku}`
          ),
        // Precio · Stock
        React.createElement(
          'div',
          { className: 'flex items-center gap-2 mt-1' },
          React.createElement(
            'span',
            { className: 'text-xs', style: { color: 'var(--cg-text-muted)' } },
            product.sale_price ? `$${Number(product.sale_price).toFixed(2)}` : 'Sin precio'
          ),
          React.createElement(StockBadge, {
            stock: product.stock_current,
            minimum: product.stock_minimum,
          })
        ),
        // Estado badge
        React.createElement(
          'div',
          { className: 'mt-1' },
          React.createElement(
            UI.Badge,
            { variant: product.is_active ? 'success' : 'secondary', size: 'sm' },
            product.is_active ? 'Activo' : 'Inactivo'
          )
        )
      ),
    []
  );

  return React.createElement(UI.DataTable, {
    data,
    rowKey: (product: Product) => product.id,
    loading,
    error: error ?? undefined,
    onRetry: () => void refetch(),
    columns: dtColumns,
    searchPlaceholder: 'Buscar productos...',
    searchValue,
    onSearchChange: handleSearch,
    sortKey: sortKey || null,
    sortDirection: sortDir,
    onSortChange: handleSort,
    selectable,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
    },
    onPageChange: pagination.setPage,
    actions: dtActions,
    onRowClick,
    emptyState: {
      title: emptyMessage,
      filteredTitle: emptyMessage,
      filteredDescription: 'Prueba con otros términos o ajusta los filtros.',
    },
    mobileRender,
  });
}
