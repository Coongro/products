import { getHostReact, getHostUI, actions } from '@coongro/plugin-sdk';

import type { ProductPickerProps } from '../types/components.js';
import type { Product } from '../types/domain.js';

const React = getHostReact();
const { useState, useCallback, useEffect, useRef } = React;

export function ProductPicker(props: ProductPickerProps) {
  const {
    value,
    onChange,
    filters: extraFilters = {},
    allowCreate = false,
    onCreateClick,
    placeholder = 'Buscar producto...',
  } = props;

  const UI = getHostUI();
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Normalizar valor (puede ser string, string[] o null)
  const selectedId = Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

  // Cargar producto seleccionado por ID
  useEffect(() => {
    if (!selectedId) {
      setSelectedProduct(null);
      return;
    }
    actions
      .execute<Product | undefined>('products.items.getById', { id: selectedId })
      .then((p) => {
        if (mountedRef.current) setSelectedProduct(p ?? null);
      })
      .catch(() => {});
  }, [selectedId]);

  const doSearch = useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        const result = await actions.execute<Product[]>('products.items.search', {
          query: query || undefined,
          ...extraFilters,
          limit: 10,
        });
        if (mountedRef.current) setResults(result);
      } catch {
        if (mountedRef.current) setResults([]);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [extraFilters]
  );

  const handleValueChange = useCallback(
    (productId: string) => {
      if (!productId) {
        setSelectedProduct(null);
        onChange?.(null);
        return;
      }
      const product = results.find((p) => p.id === productId);
      if (product) {
        setSelectedProduct(product);
      }
      onChange?.(productId);
    },
    [results, onChange]
  );

  // Subtítulo para cada item (SKU · precio)
  function formatSubtitle(p: Product): string | undefined {
    const parts: string[] = [];
    if (p.sku) parts.push(p.sku);
    if (p.sale_price) parts.push(`$${Number(p.sale_price).toFixed(2)}`);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }

  // Contenido del dropdown
  const contentChildren: React.ReactNode[] = [];

  if (loading) {
    contentChildren.push(
      React.createElement(UI.LoadingOverlay, {
        key: 'loading',
        variant: 'spinner',
        inline: true,
        label: 'Buscando...',
      })
    );
  } else if (results.length === 0) {
    contentChildren.push(React.createElement(UI.ComboboxEmpty, { key: 'empty' }, 'Sin resultados'));
  } else {
    results.forEach((p) => {
      contentChildren.push(
        React.createElement(
          UI.ComboboxItem,
          {
            key: p.id,
            value: p.id,
            subtitle: formatSubtitle(p),
          },
          p.name
        )
      );
    });
  }

  if (allowCreate && onCreateClick) {
    contentChildren.push(
      React.createElement(UI.ComboboxCreate, {
        key: 'create',
        onCreate: onCreateClick,
        label: 'Crear nuevo producto',
      })
    );
  }

  return React.createElement(
    UI.Combobox,
    {
      value: selectedId ?? '',
      onValueChange: handleValueChange,
      onSearchChange: (q: string) => void doSearch(q),
      debounceMs: 300,
    },
    React.createElement(UI.ComboboxChipTrigger, {
      placeholder,
      renderChip: selectedProduct
        ? (_: string, onRemove: () => void) =>
            React.createElement(UI.Chip, { size: 'sm', onRemove }, selectedProduct.name)
        : undefined,
    }),
    React.createElement(UI.ComboboxContent, null, ...contentChildren)
  );
}
