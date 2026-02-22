import { getHostReact, actions } from '@coongro/plugin-sdk';

import type { StockMovement } from '../types/domain.js';

const React = getHostReact();
const { useState, useEffect, useCallback, useRef } = React;

export interface StockBalance {
  totalIn: number;
  totalOut: number;
  balance: number;
}

export interface UseStockMovementsResult {
  movements: StockMovement[];
  balance: StockBalance | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStockMovements(productId: string | null | undefined): UseStockMovementsResult {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [balance, setBalance] = useState<StockBalance | null>(null);
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
      setMovements([]);
      setBalance(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [movs, bal] = await Promise.all([
        actions.execute<StockMovement[]>('products.stock.listByProduct', { productId }),
        actions.execute<StockBalance>('products.stock.getBalance', { productId }),
      ]);
      if (!mountedRef.current) return;
      setMovements(movs);
      setBalance(bal);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error al cargar movimientos');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { movements, balance, loading, error, refetch: fetch };
}
