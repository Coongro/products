import { getHostReact, actions } from '@coongro/plugin-sdk';

import type { Product } from '../types/domain.js';

const React = getHostReact();
const { useState, useEffect, useCallback, useRef } = React;

export interface UseProductResult {
  product: Product | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProduct(id: string | null | undefined): UseProductResult {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    if (!id) {
      setProduct(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await actions.execute<Product | undefined>('products.items.getById', { id });
      if (!mountedRef.current) return;
      setProduct(result ?? null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error al cargar producto');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { product, loading, error, refetch: fetch };
}
