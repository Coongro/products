import { getHostReact, actions } from '@coongro/plugin-sdk';

import type { Category } from '../types/domain.js';

const React = getHostReact();
const { useState, useEffect, useCallback, useRef, useMemo } = React;

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

export interface UseCategoriesOptions {
  autoLoad?: boolean;
  treeMode?: boolean;
}

export interface UseCategoriesResult {
  categories: Category[];
  tree: CategoryTreeNode[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function buildTree(categories: Category[]): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function useCategories(options: UseCategoriesOptions = {}): UseCategoriesResult {
  const { autoLoad = true } = options;
  const [categories, setCategories] = useState<Category[]>([]);
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
    setLoading(true);
    setError(null);
    try {
      const result = await actions.execute<Category[]>('products.categories.listTree');
      if (!mountedRef.current) return;
      setCategories(result);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Error al cargar categorías');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      void fetch();
    }
  }, [fetch, autoLoad]);

  const tree = useMemo(() => buildTree(categories), [categories]);

  return { categories, tree, loading, error, refetch: fetch };
}
