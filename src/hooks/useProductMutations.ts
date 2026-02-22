import { getHostReact, actions, usePlugin } from '@coongro/plugin-sdk';

import type { Product, ProductCreateData, ProductUpdateData } from '../types/domain.js';

const React = getHostReact();
const { useState, useCallback } = React;

export interface UseProductMutationsResult {
  create: (data: ProductCreateData) => Promise<Product | null>;
  update: (id: string, data: ProductUpdateData) => Promise<Product | null>;
  remove: (id: string) => Promise<boolean>;
  softDelete: (id: string) => Promise<boolean>;
  restore: (id: string) => Promise<boolean>;
  adjustStock: (id: string, delta: number) => Promise<boolean>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
}

export function useProductMutations(): UseProductMutationsResult {
  const { toast } = usePlugin();
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const create = useCallback(
    async (data: ProductCreateData): Promise<Product | null> => {
      setCreating(true);
      try {
        const result = await actions.execute<Product[]>('products.items.create', { data });
        toast.success('Producto creado', '');
        return result[0] ?? null;
      } catch (err) {
        toast.error('Error', err instanceof Error ? err.message : 'No se pudo crear el producto');
        return null;
      } finally {
        setCreating(false);
      }
    },
    [toast]
  );

  const update = useCallback(
    async (id: string, data: ProductUpdateData): Promise<Product | null> => {
      setUpdating(true);
      try {
        const result = await actions.execute<Product[]>('products.items.update', { id, data });
        toast.success('Producto actualizado', '');
        return result[0] ?? null;
      } catch (err) {
        toast.error('Error', err instanceof Error ? err.message : 'No se pudo actualizar');
        return null;
      } finally {
        setUpdating(false);
      }
    },
    [toast]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setDeleting(true);
      try {
        await actions.execute('products.items.delete', { id });
        toast.success('Producto eliminado', '');
        return true;
      } catch (err) {
        toast.error('Error', err instanceof Error ? err.message : 'No se pudo eliminar');
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [toast]
  );

  const softDelete = useCallback(
    async (id: string): Promise<boolean> => {
      setDeleting(true);
      try {
        await actions.execute('products.items.softDelete', { id });
        toast.success('Producto archivado', '');
        return true;
      } catch (err) {
        toast.error('Error', err instanceof Error ? err.message : 'No se pudo archivar');
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [toast]
  );

  const restore = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await actions.execute('products.items.restore', { id });
        toast.success('Producto restaurado', '');
        return true;
      } catch (err) {
        toast.error('Error', err instanceof Error ? err.message : 'No se pudo restaurar');
        return false;
      }
    },
    [toast]
  );

  const adjustStock = useCallback(
    async (id: string, delta: number): Promise<boolean> => {
      try {
        await actions.execute('products.items.adjustStock', { id, delta });
        toast.success('Stock actualizado', '');
        return true;
      } catch (err) {
        toast.error('Error', err instanceof Error ? err.message : 'No se pudo ajustar stock');
        return false;
      }
    },
    [toast]
  );

  return { create, update, remove, softDelete, restore, adjustStock, creating, updating, deleting };
}
