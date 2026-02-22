import { getHostReact, actions } from '@coongro/plugin-sdk';

import type { Variant } from '../types/domain.js';

const React = getHostReact();
const { useState, useEffect, useCallback, useRef } = React;

export interface UseVariantsResult {
  variants: Variant[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useVariants(productId: string | null | undefined): UseVariantsResult {
  const [variants, setVariants] = useState<Variant[]>([]);
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
    if (!productId) {
      setVariants([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await actions.execute<Variant[]>('products.variants.listByProduct', {
        productId,
      });
      if (!mountedRef.current) return;
      setVariants(result);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error al cargar variantes');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { variants, loading, error, refetch: fetch };
}
