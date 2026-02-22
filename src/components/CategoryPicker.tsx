import { getHostReact, getHostUI, actions, usePlugin } from '@coongro/plugin-sdk';

import { useCategories } from '../hooks/useCategories.js';
import type { CategoryTreeNode } from '../hooks/useCategories.js';
import type { CategoryPickerProps } from '../types/components.js';
import type { Category } from '../types/domain.js';

const React = getHostReact();
const { useState, useCallback, useMemo } = React;

export function CategoryPicker(props: CategoryPickerProps) {
  const {
    value,
    onChange,
    allowCreate = false,
    treeMode = false,
    placeholder = 'Seleccionar categoría...',
  } = props;

  const UI = getHostUI();
  const { categories, tree, loading } = useCategories();
  const { toast } = usePlugin();
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  const selectedName = useMemo(() => {
    if (!value) return '';
    const cat = categories.find((c) => c.id === value);
    return cat?.name ?? '';
  }, [value, categories]);

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const data: Record<string, unknown> = { name: createName.trim() };
      if (createParentId) {
        data.parent_id = createParentId;
      }
      const result = await actions.execute<Category[]>('products.categories.create', { data });
      if (result[0]) {
        onChange?.(result[0].id);
        toast.success('Categoría creada', '');
      }
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Error al crear categoría');
    } finally {
      setCreating(false);
      setShowCreateDialog(false);
      setCreateName('');
      setCreateParentId(null);
    }
  }, [createName, createParentId, onChange, toast]);

  // Construir opciones flat con indentación para selector de padre
  const parentFlatOptions = useMemo(() => {
    const childrenMap = new Map<string, Category[]>();
    for (const cat of categories) {
      if (cat.parent_id) {
        const list = childrenMap.get(cat.parent_id) ?? [];
        list.push(cat);
        childrenMap.set(cat.parent_id, list);
      }
    }
    const roots = categories.filter((c) => !c.parent_id);
    const result: { id: string; label: string }[] = [];
    const walk = (items: Category[], depth: number) => {
      for (const item of items) {
        const prefix = '\u00A0\u00A0'.repeat(depth);
        result.push({ id: item.id, label: `${prefix}${depth > 0 ? '└ ' : ''}${item.name}` });
        const children = childrenMap.get(item.id) ?? [];
        if (children.length > 0) walk(children, depth + 1);
      }
    };
    walk(roots, 0);
    return result;
  }, [categories]);

  // Construir items flat desde tree
  function flattenTree(nodes: CategoryTreeNode[], depth: number): { id: string; name: string; depth: number }[] {
    const result: { id: string; name: string; depth: number }[] = [];
    for (const node of nodes) {
      result.push({ id: node.id, name: node.name, depth });
      result.push(...flattenTree(node.children, depth + 1));
    }
    return result;
  }

  if (loading) {
    return React.createElement(UI.Skeleton, { className: 'h-10 w-full rounded-lg' });
  }

  const flatItems = treeMode ? flattenTree(tree, 0) : categories.map((c) => ({ id: c.id, name: c.name, depth: 0 }));

  return React.createElement(
    React.Fragment,
    null,

    // Combobox
    React.createElement(
      UI.Combobox,
      {
        value: value ?? '',
        onValueChange: (val: string) => onChange?.(val || null),
      },
      React.createElement(UI.ComboboxChipTrigger, {
        placeholder,
        renderChip: value ? () => React.createElement('span', null, selectedName) : undefined,
      }),
      React.createElement(
        UI.ComboboxContent,
        null,
        // "Sin categoría"
        React.createElement(UI.ComboboxItem, { value: '', children: 'Sin categoría' }),
        // Categorías
        ...flatItems.map((item) =>
          React.createElement(
            UI.ComboboxItem,
            {
              key: item.id,
              value: item.id,
              style: item.depth > 0 ? { paddingLeft: `${12 + item.depth * 16}px` } : undefined,
            },
            item.name
          )
        ),
        // Crear nueva
        allowCreate &&
          React.createElement(UI.ComboboxCreate, {
            onCreate: (name: string) => {
              setCreateName(name);
              setShowCreateDialog(true);
            },
          })
      )
    ),

    // Dialog para crear categoría con padre
    showCreateDialog &&
      React.createElement(
        UI.FormDialog,
        {
          open: showCreateDialog,
          onOpenChange: (open: boolean) => {
            if (!open) {
              setShowCreateDialog(false);
              setCreateName('');
              setCreateParentId(null);
            }
          },
          title: 'Crear categoría',
          footer: React.createElement(
            'div',
            { className: 'flex gap-2 justify-end' },
            React.createElement(
              UI.Button,
              {
                variant: 'outline',
                onClick: () => {
                  setShowCreateDialog(false);
                  setCreateName('');
                  setCreateParentId(null);
                },
              },
              'Cancelar'
            ),
            React.createElement(
              UI.Button,
              {
                disabled: creating,
                onClick: () => { void handleCreate(); },
              },
              creating ? 'Creando...' : 'Crear'
            )
          ),
          children: React.createElement(
            'div',
            { className: 'flex flex-col gap-4' },
            // Nombre
            React.createElement(
              'div',
              { className: 'flex flex-col gap-1.5' },
              React.createElement(UI.Label, null, 'Nombre'),
              React.createElement(UI.Input, {
                value: createName,
                onChange: (e: { target: { value: string } }) => setCreateName(e.target.value),
                autoFocus: true,
              })
            ),
            // Padre
            React.createElement(
              'div',
              { className: 'flex flex-col gap-1.5' },
              React.createElement(UI.Label, null, 'Categoría padre'),
              React.createElement(
                UI.Select,
                {
                  value: createParentId ?? '',
                  onValueChange: (val: string) => setCreateParentId(val || null),
                  placeholder: 'Sin padre (raíz)',
                },
                ...parentFlatOptions.map((opt) =>
                  React.createElement(UI.SelectItem, { key: opt.id, value: opt.id }, opt.label)
                )
              )
            )
          ),
        }
      )
  );
}
