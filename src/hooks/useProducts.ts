import { getHostReact, actions } from '@coongro/plugin-sdk';

import type { Product } from '../types/domain.js';
import type { ProductFilters } from '../types/filters.js';

const React = getHostReact();
const { useState, useEffect, useCallback, useRef, useMemo } = React;

export interface UseProductsOptions {
  initialFilters?: Partial<ProductFilters>;
  autoLoad?: boolean;
  pageSize?: number;
}

export interface UseProductsResult {
  data: Product[];
  loading: boolean;
  error: string | null;
  filters: ProductFilters;
  setFilters: (filters: Partial<ProductFilters>) => void;
  search: (query: string) => void;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    setPage: (page: number) => void;
  };
  refetch: () => Promise<void>;
}

export function useProducts(options: UseProductsOptions = {}): UseProductsResult {
  const { initialFilters = {}, autoLoad = true, pageSize = 25 } = options;

  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFiltersState] = useState<ProductFilters>({
    limit: pageSize,
    offset: 0,
    ...initialFilters,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...filters,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      const result = await actions.execute<Product[]>('products.items.search', params);
      if (!mountedRef.current) return;
      setData(result);
      // Estimar total basado en si hay más resultados
      setTotal(
        result.length < pageSize ? (page - 1) * pageSize + result.length : page * pageSize + 1
      );
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error al cargar productos');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    if (autoLoad) {
      void fetchData();
    }
  }, [fetchData, autoLoad]);

  const setFilters = useCallback((newFilters: Partial<ProductFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  const searchFn = useCallback(
    (query: string) => {
      setFilters({ query: query || undefined });
    },
    [setFilters]
  );

  const pagination = useMemo(
    () => ({
      page,
      pageSize,
      total,
      setPage,
    }),
    [page, pageSize, total]
  );

  return {
    data,
    loading,
    error,
    filters,
    setFilters,
    search: searchFn,
    pagination,
    refetch: fetchData,
  };
}
