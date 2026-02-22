import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

import { useProducts } from '../hooks/useProducts.js';
import type { ProductsTableProps, ColumnDef } from '../types/components.js';
import type { Product } from '../types/domain.js';

import { StockBadge } from './StockBadge.js';

const React = getHostReact();
const { useState, useCallback, useMemo, useEffect } = React;

type SortDir = 'asc' | 'desc' | null;

const DEFAULT_COLUMNS: ColumnDef<Product>[] = [
  { key: 'name', header: 'Nombre', sortable: true },
  { key: 'sku', header: 'SKU', render: (p) => p.sku ?? '—' },
  {
    key: 'sale_price',
    header: 'Precio',
    sortable: true,
    render: (p) => (p.sale_price ? `$${Number(p.sale_price).toFixed(2)}` : '—'),
  },
  {
    key: 'stock',
    header: 'Stock',
    sortable: true,
    render: (p) =>
      React.createElement(StockBadge, {
        stock: p.stock_current,
        minimum: p.stock_minimum,
      }),
  },
  {
    key: 'is_active',
    header: 'Estado',
    render: (p) => {
      const UI = getHostUI();
      return React.createElement(
        UI.Badge,
        { variant: p.is_active ? 'success' : 'secondary', size: 'sm' },
        p.is_active ? 'Activo' : 'Inactivo'
      );
    },
  },
];

export function ProductsTable(props: ProductsTableProps) {
  const {
    columns,
    extraColumns = [],
    extraActions = [],
    extraFilters: _extraFilters = [],
    selectable = false,
    emptyMessage = 'No se encontraron productos',
    onRowClick,
    filters: initialFilters,
  } = props;

  const UI = getHostUI();
  const { data, loading, error, setFilters, pagination, refetch } = useProducts({
    initialFilters,
    pageSize: 25,
  });

  const [searchValue, setSearchValue] = useState('');
  const debouncedSearch = UI.useDebounce(searchValue, 300);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string | null>(initialFilters?.orderBy ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(initialFilters?.orderDir ?? null);

  // Aplicar filtro de búsqueda solo cuando el valor debounceado cambie
  useEffect(() => {
    setFilters({ query: debouncedSearch || undefined });
  }, [debouncedSearch, setFilters]);

  const handleSort = useCallback(
    (key: string) => {
      let nextDir: SortDir;
      if (sortBy !== key) {
        nextDir = 'asc';
      } else if (sortDir === 'asc') {
        nextDir = 'desc';
      } else {
        nextDir = null;
      }

      const nextKey = nextDir ? key : null;
      setSortBy(nextKey);
      setSortDir(nextDir);
      setFilters({
        orderBy: nextKey ?? undefined,
        orderDir: nextDir ?? undefined,
      });
    },
    [sortBy, sortDir, setFilters]
  );

  const allColumns = useMemo(
    () => [...(columns ?? DEFAULT_COLUMNS), ...extraColumns],
    [columns, extraColumns]
  );

  const handleSearch = useCallback(
    (e: { target: { value: string } }) => {
      setSearchValue(e.target.value);
    },
    []
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Loading
  if (loading && data.length === 0) {
    return React.createElement(UI.LoadingOverlay, {
      variant: 'skeleton',
      rows: 6,
      inline: true,
    });
  }

  // Error
  if (error) {
    return React.createElement(UI.ErrorDisplay, {
      title: 'Error al cargar productos',
      message: error,
      onRetry: () => refetch(),
    });
  }

  // Mapear sortDirection para TableHead
  function getSortDirection(col: ColumnDef<Product>) {
    if (!col.sortable) return undefined; // no sortable
    if (sortBy !== col.key) return false as const; // sortable sin dir
    return sortDir === 'asc' ? ('asc' as const) : sortDir === 'desc' ? ('desc' as const) : (false as const);
  }

  return React.createElement(
    'div',
    { className: 'flex flex-col gap-4' },

    // Search bar
    React.createElement(UI.Input, {
      type: 'text',
      value: searchValue,
      onChange: handleSearch,
      placeholder: 'Buscar productos...',
    }),

    // Table
    data.length === 0
      ? React.createElement(UI.EmptyState, { title: emptyMessage })
      : React.createElement(
          UI.Table,
          null,

          // Head
          React.createElement(
            UI.TableHeader,
            null,
            React.createElement(
              UI.TableRow,
              null,
              selectable && React.createElement(UI.TableHead, { className: 'w-10' }),
              allColumns.map((col) =>
                React.createElement(
                  UI.TableHead,
                  {
                    key: col.key,
                    sortDirection: getSortDirection(col),
                    onSort: col.sortable ? () => handleSort(col.key) : undefined,
                  },
                  col.header
                )
              ),
              extraActions.length > 0 &&
                React.createElement(UI.TableHead, { className: 'text-right' }, 'Acciones')
            )
          ),

          // Body
          React.createElement(
            UI.TableBody,
            null,
            data.map((product) =>
              React.createElement(
                UI.TableRow,
                {
                  key: product.id,
                  onClick: onRowClick ? () => onRowClick(product) : undefined,
                  className: [
                    onRowClick ? 'cursor-pointer' : '',
                    selectedIds.has(product.id) ? 'bg-cg-accent-bg' : '',
                  ]
                    .filter(Boolean)
                    .join(' '),
                },
                selectable &&
                  React.createElement(
                    UI.TableCell,
                    null,
                    React.createElement(UI.Checkbox, {
                      checked: selectedIds.has(product.id),
                      onCheckedChange: () => toggleSelect(product.id),
                    })
                  ),
                allColumns.map((col) =>
                  React.createElement(
                    UI.TableCell,
                    { key: col.key },
                    /* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
                    col.render ? (col.render(product) as any) : ((product as any)[col.key] ?? '—')
                    /* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
                  )
                ),
                extraActions.length > 0 &&
                  React.createElement(
                    UI.TableCell,
                    { className: 'text-right' },
                    React.createElement(
                      'div',
                      { className: 'flex gap-1 justify-end' },
                      extraActions
                        .filter((a) => !a.hidden || !a.hidden(product))
                        .map((action, i) =>
                          React.createElement(
                            UI.Button,
                            {
                              key: i,
                              variant: action.variant === 'danger' ? 'destructive' : 'ghost',
                              size: 'xs',
                              onClick: (e: { stopPropagation: () => void }) => {
                                e.stopPropagation();
                                action.onClick(product);
                              },
                            },
                            action.label
                          )
                        )
                    )
                  )
              )
            )
          )
        ),

    // Pagination
    pagination.total > pagination.pageSize &&
      React.createElement(
        'div',
        { className: 'flex items-center justify-between text-sm text-cg-text-muted' },
        React.createElement('span', null, `Página ${pagination.page}`),
        React.createElement(
          UI.Pagination,
          null,
          React.createElement(
            UI.PaginationContent,
            null,
            React.createElement(UI.PaginationPrevious, {
              onClick: () => pagination.setPage(Math.max(1, pagination.page - 1)),
              className: pagination.page <= 1 ? 'pointer-events-none opacity-40' : '',
            }),
            React.createElement(UI.PaginationNext, {
              onClick: () => pagination.setPage(pagination.page + 1),
              className: data.length < pagination.pageSize ? 'pointer-events-none opacity-40' : '',
            })
          )
        )
      )
  );
}
