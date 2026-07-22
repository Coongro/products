/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { getHostReact, getHostUI, actions } from '@coongro/plugin-sdk';

import { useProductsSettings } from '../settings/settings.gen.js';
import type { BatchClassifier, BatchesViewProps } from '../types/batch.js';

import { BajaDialog } from './BajaDialog.js';
import {
  computeBatchStatus,
  statusBadge,
  formatExpiration,
  expirationRelative,
  batchHealthCounts,
  daysUntil,
  isUsable,
} from './batch-status.js';
import type { BatchListItem } from './batch-status.js';
import { BatchDetail } from './BatchDetail.js';
import { BatchFormDialog } from './BatchFormDialog.js';
import type { BatchFormData, BatchEditTarget, BatchProductOption } from './BatchFormDialog.js';

const UI = getHostUI();
const React = getHostReact();
const { useState, useEffect, useCallback, useMemo, useRef } = React;
const h = React.createElement;

const MODULE_ID = '@coongro/products';

function emitToast(title: string, message: string, type: 'success' | 'info'): void {
  const host = (globalThis as any).coongro?.toast as
    | {
        show?: (opts: { title: string; message: string; type?: string; moduleId?: string }) => void;
      }
    | undefined;
  host?.show?.({ title, message, type, moduleId: MODULE_ID });
}

const toast = {
  success: (title: string, message: string) => emitToast(title, message, 'success'),
  info: (title: string, message: string) => emitToast(title, message, 'info'),
};

type EstadoFilter = 'activos' | 'vencidos' | 'agotados' | 'bajas' | 'todos';

/** Fila cruda de products.batches.list. */
interface BatchRow {
  id: string;
  product_id: string;
  batch_number: string;
  expiration_date: string | null;
  quantity: string | null;
  received_quantity: string | null;
  supplier: string | null;
  supplier_id: string | null;
  notes: string | null;
  status: string;
}

interface ProductRow {
  id: string;
  name: string;
}

/** product_id → kind, resolviendo cada producto al primer clasificador que lo reclame. */
function buildKindByProductId(
  classified: Array<{ kind: string; ids: string[] }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const { kind, ids } of classified) {
    for (const id of ids) {
      if (!map.has(id)) map.set(id, kind);
    }
  }
  return map;
}

export function BatchesView(props: BatchesViewProps) {
  const {
    classifiers,
    title = 'Lotes',
    subtitle,
    createLabel = 'Cargar lote',
    createHint,
    resolveSupplier,
    resolveReference,
    resolveProductSubtitle,
    resolveOriginLink,
    DateField,
    productFilterParam,
  } = props;

  // Umbral configurable de "por vencer" (setting genérico de stock de products).
  const { settings: stockSettings } = useProductsSettings();
  const alertDays = stockSettings.stockAlertDays;

  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [productOptions, setProductOptions] = useState<BatchProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BatchEditTarget | null>(null);
  const [lockedProduct, setLockedProduct] = useState<{ productId: string; name: string } | null>(
    null
  );
  const [detailBatch, setDetailBatch] = useState<BatchListItem | null>(null);

  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('activos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [porVencer, setPorVencer] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [layout, setLayout] = useState<'plana' | 'agrupado'>('plana');
  const [density, setDensity] = useState<'comoda' | 'compacta'>('comoda');

  const loadingRef = useRef(false);

  // Metadatos de los clasificadores, indexados para resolver tipo/label/icono/color.
  const kindMetaByKind = useMemo(() => {
    const m = new Map<string, { label: string; icon?: string; color?: string }>();
    for (const c of classifiers) m.set(c.kind, { label: c.label, icon: c.icon, color: c.color });
    return m;
  }, [classifiers]);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // Lotes + nombres de producto. Los clasificadores resuelven, en paralelo,
      // qué product_ids son de cada tipo (un fallo de uno no tumba el resto).
      const [rows, products, consumedList, classified] = await Promise.all([
        actions.execute<BatchRow[]>('products.batches.list'),
        actions.execute<ProductRow[]>('products.items.list'),
        actions.execute<Array<{ batchId: string; consumed: number }>>(
          'products.stock.consumedByBatch'
        ),
        Promise.all(
          classifiers.map(async (c: BatchClassifier) => {
            try {
              return { kind: c.kind, ids: await c.listProductIds() };
            } catch {
              return { kind: c.kind, ids: [] as string[] };
            }
          })
        ),
      ]);

      const productNameById = new Map<string, string>();
      for (const p of products) productNameById.set(p.id, p.name);
      // Consumido por lote → el "recibido" se deriva como disponible + consumido.
      const consumedById = new Map((consumedList ?? []).map((c) => [c.batchId, c.consumed]));

      // product_id → kind (el primer clasificador que lo reclame gana).
      const kindByProductId = buildKindByProductId(classified);

      const items: BatchListItem[] = rows.map((r) => ({
        id: r.id,
        productId: r.product_id,
        productName: productNameById.get(r.product_id) ?? '—',
        kind: kindByProductId.get(r.product_id) ?? null,
        batchNumber: r.batch_number,
        expirationDate: r.expiration_date ?? '',
        quantity: Number(r.quantity ?? 0),
        // Recibido = disponible + consumido (verdad matemática, sin fallbacks).
        received: Number(r.quantity ?? 0) + (consumedById.get(r.id) ?? 0),
        supplier: r.supplier,
        supplierId: r.supplier_id,
        notes: r.notes,
        status: r.status,
      }));

      // Productos elegibles para el alta = los que algún clasificador reclama.
      const options: BatchProductOption[] = [];
      for (const [productId, kind] of kindByProductId) {
        options.push({
          productId,
          name: productNameById.get(productId) ?? '—',
          kind,
          kindLabel: kindMetaByKind.get(kind)?.label ?? null,
        });
      }
      options.sort((a, b) => a.name.localeCompare(b.name));

      setBatches(items);
      setProductOptions(options);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar lotes');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [classifiers, kindMetaByKind]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Deep-link desde la ficha del catálogo: filtrar por el producto y mostrar todos sus estados.
  useEffect(() => {
    if (productFilterParam) {
      setProductFilter([productFilterParam]);
      setEstadoFilter('todos');
      setPorVencer(null);
    }
  }, [productFilterParam]);

  const filteredBatches = useMemo(() => {
    let result = batches;

    if (estadoFilter !== 'todos') {
      result = result.filter((b) => {
        const st = computeBatchStatus(b, alertDays);
        if (estadoFilter === 'activos') return isUsable(st);
        if (estadoFilter === 'vencidos') return st === 'vencido';
        if (estadoFilter === 'agotados') return st === 'agotado';
        if (estadoFilter === 'bajas') return st === 'baja';
        return true;
      });
    }

    if (tipoFilter !== 'todos') {
      result = result.filter((b) => b.kind === tipoFilter);
    }

    if (porVencer !== null) {
      result = result.filter((b) => {
        const days = daysUntil(b.expirationDate);
        return b.quantity > 0 && days !== null && days >= 0 && days <= porVencer;
      });
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((b) => b.batchNumber.toLowerCase().includes(q));
    }
    if (productFilter.length > 0)
      result = result.filter((b) => productFilter.includes(b.productId));

    if (sortKey && sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1;
      const getValue = (b: BatchListItem): string | number => {
        switch (sortKey) {
          case 'lote':
            return b.batchNumber.toLowerCase();
          case 'producto':
            return b.productName.toLowerCase();
          case 'vencimiento':
            return b.expirationDate;
          case 'cantidad':
            return b.quantity;
          default:
            return '';
        }
      };
      result = [...result].sort((a, b) => {
        const av = getValue(a);
        const bv = getValue(b);
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }

    return result;
  }, [
    batches,
    estadoFilter,
    tipoFilter,
    porVencer,
    search,
    productFilter,
    sortKey,
    sortDir,
    alertDays,
  ]);

  const handleSort = useCallback((key: string, direction: 'asc' | 'desc' | null) => {
    setSortKey(direction ? key : null);
    setSortDir(direction);
  }, []);

  // Salud del inventario (sobre TODOS los lotes, no los filtrados) para las health cards.
  const health = useMemo(() => batchHealthCounts(batches), [batches]);

  /** Una health card clickeable: filtra el inventario al estado que representa. */
  const healthCard = (
    icon: string,
    tone: { bg: string; fg: string },
    num: number,
    label: string,
    sub: string,
    active: boolean,
    onClick: () => void
  ) =>
    h(
      'button',
      {
        key: label,
        onClick,
        className: 'text-left rounded-xl border p-3.5 transition-colors',
        style: {
          background: 'var(--cg-bg)',
          borderColor: active ? 'var(--cg-brand)' : 'var(--cg-border)',
          boxShadow: active ? '0 0 0 1px var(--cg-brand)' : 'none',
          cursor: 'pointer',
        },
      } as any,
      h(
        'div',
        { className: 'flex items-center justify-between mb-2' },
        h(
          'span',
          {
            style: {
              background: tone.bg,
              color: tone.fg,
              width: '32px',
              height: '32px',
              borderRadius: '9999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              lineHeight: 0,
            },
          },
          h(UI.DynamicIcon, { icon, size: 16 } as any)
        ),
        h('span', { className: 'text-xl font-bold font-mono text-cg-text' }, String(num))
      ),
      h('div', { className: 'text-sm font-semibold text-cg-text' }, label),
      h('div', { className: 'text-xs text-cg-text-muted mt-0.5' }, sub)
    );

  const healthRow = h(
    'div',
    // Grid inline (no clases responsive de Tailwind: no se generan bien en plugins → colapsan).
    { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' } },
    healthCard(
      'Clock',
      { bg: 'var(--cg-warning-bg)', fg: 'var(--cg-warning, #b45309)' },
      health.porVencer,
      'Vencen pronto',
      'en los próximos 60 días',
      porVencer === 60,
      () => {
        setEstadoFilter('todos');
        setPorVencer(60);
      }
    ),
    healthCard(
      'TriangleAlert',
      { bg: 'var(--cg-danger-bg, #fdeaea)', fg: 'var(--cg-danger, #c0392b)' },
      health.vencidos,
      'Vencidos',
      'hay que dar de baja',
      estadoFilter === 'vencidos',
      () => {
        setPorVencer(null);
        setEstadoFilter('vencidos');
      }
    ),
    healthCard(
      'CircleSlash',
      { bg: 'var(--cg-bg-secondary)', fg: 'var(--cg-text-muted)' },
      health.agotados,
      'Sin stock',
      'lotes agotados',
      estadoFilter === 'agotados',
      () => {
        setPorVencer(null);
        setEstadoFilter('agotados');
      }
    ),
    healthCard(
      'PackageCheck',
      { bg: 'var(--cg-success-bg, #e6f7f0)', fg: 'var(--cg-success, #0f766e)' },
      health.activos,
      'Lotes activos',
      'con stock y vigentes',
      estadoFilter === 'activos' && porVencer === null,
      () => {
        setPorVencer(null);
        setEstadoFilter('activos');
      }
    )
  );

  // Próximo a vencer (FIFO) entre los lotes usables de un producto.
  const fifoNext = (rows: BatchListItem[]): BatchListItem | undefined => {
    const usable = rows.filter((b) => isUsable(computeBatchStatus(b, alertDays)));
    return [...usable].sort((a, b) => {
      if (!a.expirationDate && !b.expirationDate) return 0;
      if (!a.expirationDate) return 1;
      if (!b.expirationDate) return -1;
      return a.expirationDate.localeCompare(b.expirationDate);
    })[0];
  };

  // Cabecera de grupo (vista "Por producto"): nombre, tipo, nº lotes, total disp., próx. vence.
  const renderGroupHeader = (productId: string, rows: BatchListItem[], collapsed: boolean) => {
    const first = rows[0];
    const meta = first?.kind ? kindMetaByKind.get(first.kind) : null;
    const total = rows
      .filter((b) => isUsable(computeBatchStatus(b, alertDays)))
      .reduce((s, b) => s + b.quantity, 0);
    const next = fifoNext(rows);
    return h(
      'div',
      { className: 'flex items-center gap-3' },
      h(UI.DynamicIcon, {
        icon: collapsed ? 'ChevronRight' : 'ChevronDown',
        size: 16,
        className: 'text-cg-text-muted shrink-0',
      } as any),
      meta?.icon
        ? h(UI.DynamicIcon, {
            icon: meta.icon,
            size: 15,
            style: { color: meta.color },
            className: 'shrink-0',
          } as any)
        : null,
      h(
        'div',
        { style: { minWidth: 0 } },
        h('div', { className: 'font-semibold text-cg-text text-sm' }, first?.productName ?? '—'),
        h(
          'div',
          { className: 'text-xs text-cg-text-muted' },
          `${meta?.label ?? ''}${meta ? ' · ' : ''}${rows.length} lote${rows.length !== 1 ? 's' : ''}`
        )
      ),
      h('span', { style: { flex: 1 } }),
      h(
        'div',
        { className: 'flex items-center gap-4' },
        h(
          'div',
          { className: 'text-right' },
          h('span', { className: 'font-mono font-bold text-cg-text' }, String(total)),
          h('span', { className: 'text-cg-text-muted text-xs' }, ' disp.')
        ),
        next
          ? h(
              'div',
              { className: 'text-xs text-cg-text-muted' },
              `próx. vence ${formatExpiration(next.expirationDate)}`
            )
          : null,
        h(
          UI.Button,
          {
            variant: 'brand',
            size: 'xs',
            onClick: (e: any) => {
              e.stopPropagation();
              setEditing(null);
              setLockedProduct({ productId, name: first?.productName ?? '' });
              setShowForm(true);
            },
          } as any,
          h(UI.DynamicIcon, { icon: 'Plus', size: 12 } as any),
          ` ${createLabel}`
        )
      )
    );
  };

  // Controles de vista: Lista plana / Por producto + densidad.
  const segBtn = (active: boolean, onClick: () => void, icon: string, label?: string) =>
    h(
      UI.Button,
      { variant: active ? 'brand' : 'ghost', size: 'xs', onClick } as any,
      h(UI.DynamicIcon, { icon, size: 14 } as any),
      label ? ` ${label}` : null
    );

  const viewControls = h(
    'div',
    { className: 'flex items-center justify-end gap-2' },
    h(
      'div',
      { className: 'inline-flex rounded-lg border border-cg-border overflow-hidden' },
      segBtn(layout === 'plana', () => setLayout('plana'), 'List', 'Lista plana'),
      segBtn(layout === 'agrupado', () => setLayout('agrupado'), 'Group', 'Por producto')
    ),
    h(
      'div',
      { className: 'inline-flex rounded-lg border border-cg-border overflow-hidden' },
      segBtn(density === 'comoda', () => setDensity('comoda'), 'Rows3'),
      segBtn(density === 'compacta', () => setDensity('compacta'), 'Rows4')
    )
  );

  const handleCreate = useCallback(
    async (data: BatchFormData) => {
      await actions.execute('products.batches.create', {
        data: {
          product_id: data.productId,
          batch_number: data.batchNumber,
          expiration_date: data.expirationDate || null,
          quantity: String(data.quantity),
          supplier: data.supplier,
          supplier_id: data.supplierId,
          notes: data.notes,
          status: 'active',
        },
      });
      toast.success('Lote cargado', `${data.batchNumber} · ${data.quantity} u.`);
      await loadData();
    },
    [loadData]
  );

  const handleUpdate = useCallback(
    async (data: BatchFormData) => {
      if (!editing) return;
      await actions.execute('products.batches.update', {
        id: editing.id,
        data: {
          batch_number: data.batchNumber,
          expiration_date: data.expirationDate || null,
          supplier: data.supplier,
          supplier_id: data.supplierId,
          notes: data.notes,
        },
      });
      toast.success('Lote actualizado', data.batchNumber);
      await loadData();
    },
    [editing, loadData]
  );

  const handleBaja = useCallback(
    async (batch: BatchListItem, motivo: string) => {
      await actions.execute('products.batches.update', {
        id: batch.id,
        data: { status: 'recalled', metadata: { bajaMotivo: motivo } },
      });
      toast.info('Lote dado de baja', `${batch.batchNumber} · ${motivo}`);
      await loadData();
    },
    [loadData]
  );

  const openEdit = useCallback((b: BatchListItem) => {
    setEditing({
      id: b.id,
      productId: b.productId,
      batchNumber: b.batchNumber,
      expirationDate: b.expirationDate,
      quantity: b.quantity,
      supplierId: b.supplierId,
      supplier: b.supplier,
      notes: b.notes,
    });
    setShowForm(true);
  }, []);

  const [bajaTarget, setBajaTarget] = useState<BatchListItem | null>(null);

  const columns = useMemo(
    () => [
      {
        key: 'lote',
        header: 'Nro. de lote',
        sortable: true,
        render: (b: BatchListItem) =>
          h('span', { className: 'font-mono font-semibold' }, b.batchNumber),
      },
      {
        key: 'producto',
        header: 'Producto',
        sortable: true,
        render: (b: BatchListItem) => b.productName,
      },
      {
        key: 'tipo',
        header: 'Tipo',
        render: (b: BatchListItem) => {
          const meta = b.kind ? kindMetaByKind.get(b.kind) : null;
          if (!meta) return h('span', { className: 'text-cg-text-muted' }, '—');
          return h(
            'span',
            {
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 9px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                background: meta.color ? `${meta.color}1a` : 'var(--cg-bg-secondary)',
                color: meta.color ?? 'var(--cg-text-muted)',
                lineHeight: 1.2,
              },
            },
            meta.icon ? h(UI.DynamicIcon, { icon: meta.icon, size: 12 } as any) : null,
            meta.label
          );
        },
      },
      {
        key: 'vencimiento',
        header: 'Vencimiento',
        sortable: true,
        render: (b: BatchListItem) => {
          const rel = expirationRelative(b.expirationDate);
          const color =
            rel.tone === 'over'
              ? 'var(--cg-danger, #c0392b)'
              : rel.tone === 'soon'
                ? 'var(--cg-warning, #b45309)'
                : 'var(--cg-text-muted)';
          return h(
            'div',
            null,
            h(
              'div',
              { className: 'font-mono text-sm text-cg-text' },
              formatExpiration(b.expirationDate)
            ),
            h('div', { className: 'text-xs', style: { color } }, rel.text)
          );
        },
      },
      {
        key: 'estado',
        header: 'Estado',
        render: (b: BatchListItem) => statusBadge(computeBatchStatus(b, alertDays)),
      },
      {
        key: 'cantidad',
        header: 'Disponible',
        className: 'text-right',
        sortable: true,
        render: (b: BatchListItem) => {
          // Recibido = disponible + consumido (ya derivado en el load). Sin fallbacks.
          const received = b.received;
          const ratio = received > 0 ? b.quantity / received : 1;
          const pct = Math.max(4, Math.round(ratio * 100));
          // Color = cuánto queda del lote respecto a lo recibido: verde > ámbar > rojo.
          const barColor =
            ratio <= 0.34
              ? 'var(--cg-danger, #c0392b)'
              : ratio <= 0.66
                ? 'var(--cg-warning, #d97706)'
                : 'var(--cg-success, #16a34a)';
          return h(
            'div',
            { className: 'flex items-center gap-2 justify-end' },
            h(
              'span',
              {
                className: 'font-mono',
                style: { color: b.quantity <= 0 ? 'var(--cg-text-muted)' : undefined },
              },
              String(b.quantity)
            ),
            received > 0 && b.quantity > 0
              ? h(
                  'div',
                  {
                    style: {
                      width: '56px',
                      height: '5px',
                      borderRadius: '3px',
                      background: 'var(--cg-border)',
                      overflow: 'hidden',
                    },
                  },
                  h('div', {
                    style: {
                      width: `${pct}%`,
                      height: '100%',
                      background: barColor,
                    },
                  })
                )
              : null
          );
        },
      },
      {
        key: 'acciones',
        header: '',
        className: 'text-right',
        // Envoltura que corta la propagación: sin esto, confirmar la baja burbujea
        // al onRowClick de la fila y abre el diálogo de edición por error.
        render: (b: BatchListItem) =>
          h(
            'div',
            { onClick: (e: any) => e.stopPropagation() } as any,
            h(
              UI.Button,
              {
                variant: 'outline',
                size: 'xs',
                className: 'text-cg-danger hover:bg-cg-danger-bg',
                onClick: () => setBajaTarget(b),
                disabled: b.status === 'recalled',
              } as any,
              h(UI.DynamicIcon, { icon: 'Ban', size: 12, className: 'mr-1' } as any),
              'Dar de baja'
            )
          ),
      },
    ],
    [kindMetaByKind, alertDays]
  );

  const tipoOptions = useMemo(
    () => [
      { value: 'todos', label: 'Todos' },
      ...classifiers.map((c) => ({ value: c.kind, label: c.label })),
    ],
    [classifiers]
  );

  const filterRightSlot = h(
    'div',
    { className: 'flex gap-2 flex-wrap items-center' },
    h(
      UI.MultiSelect,
      {
        values: productFilter,
        onValuesChange: (v: string[]) => setProductFilter(v),
        placeholder: 'Producto',
        className: 'w-[200px]',
        renderChip: (val: string, onRemove: () => void) =>
          h(
            UI.Chip,
            { size: 'sm', onRemove } as any,
            productOptions.find((p) => p.productId === val)?.name ?? val
          ),
      } as any,
      ...productOptions.map((p) =>
        h(UI.SelectItem, { key: p.productId, value: p.productId } as any, p.name)
      )
    ),
    h(
      UI.Chip,
      {
        variant: porVencer === 30 ? 'brand' : 'default',
        onClick: () => setPorVencer(porVencer === 30 ? null : 30),
        className: 'cursor-pointer',
      } as any,
      'Vence en 30 días'
    ),
    h(
      UI.Chip,
      {
        variant: porVencer === 60 ? 'brand' : 'default',
        onClick: () => setPorVencer(porVencer === 60 ? null : 60),
        className: 'cursor-pointer',
      } as any,
      'Vence en 60 días'
    )
  );

  const filterSections = useMemo(() => {
    const sections: any[] = [
      {
        label: 'Estado',
        options: [
          { value: 'activos', label: 'Activos' },
          { value: 'vencidos', label: 'Vencidos' },
          { value: 'agotados', label: 'Agotados' },
          { value: 'bajas', label: 'Dados de baja' },
          { value: 'todos', label: 'Todos' },
        ],
        value: estadoFilter,
        onChange: (v: string) => setEstadoFilter(v as EstadoFilter),
      },
    ];
    // El filtro por tipo solo tiene sentido con 2+ clasificadores.
    if (classifiers.length > 1) {
      sections.push({
        label: 'Tipo',
        options: tipoOptions,
        value: tipoFilter,
        onChange: (v: string) => setTipoFilter(v),
      });
    }
    return sections;
  }, [estadoFilter, tipoFilter, tipoOptions, classifiers.length]);

  return h(
    'div',
    { className: 'font-inter min-h-screen bg-cg-bg-secondary p-6' },

    h(
      'div',
      { className: 'w-full flex flex-col gap-6' },

      // Header
      h(
        'div',
        { className: 'flex items-center justify-between' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-cg-text' }, title),
          subtitle ? h('p', { className: 'text-sm text-cg-text-muted mt-1' }, subtitle) : null
        ),
        h(
          UI.Button,
          {
            variant: 'brand',
            onClick: () => {
              setEditing(null);
              setShowForm(true);
            },
          } as any,
          h(UI.DynamicIcon, { icon: 'Plus', size: 14 } as any),
          ` ${createLabel}`
        )
      ),

      // Salud del inventario (clickeable → filtra)
      healthRow,

      // Controles de vista (lista plana / por producto + densidad)
      viewControls,

      // Tabla
      h(
        'div',
        { className: 'bg-cg-bg rounded-xl border border-cg-border p-6 shadow-sm' },
        h(UI.DataTable, {
          data: filteredBatches,
          rowKey: (b: BatchListItem) => b.id,
          loading,
          error,
          onRetry: loadData,
          columns,
          searchPlaceholder: 'Número de lote',
          searchValue: search,
          onSearchChange: setSearch,
          sortKey,
          sortDirection: sortDir,
          onSortChange: handleSort,
          filterSections,
          filterRightSlot,
          onRowClick: (b: BatchListItem) => setDetailBatch(b),
          // Vista "Por producto" (agrupado) + densidad — soportado por la DataTable del core.
          groupBy: layout === 'agrupado' ? (b: BatchListItem) => b.productId : undefined,
          renderGroupHeader: layout === 'agrupado' ? renderGroupHeader : undefined,
          density: density === 'compacta' ? 'compact' : 'comfortable',
          emptyState: {
            title: 'No hay lotes cargados',
            description:
              'Cuando recibís mercadería loteable, cargá el lote acá para llevar el control de stock y vencimientos.',
            icon: h(UI.DynamicIcon, { icon: 'Box', size: 32 } as any),
            action: h(
              UI.Button,
              {
                variant: 'brand',
                onClick: () => {
                  setEditing(null);
                  setShowForm(true);
                },
              } as any,
              `+ ${createLabel}`
            ),
            filteredTitle: 'No se encontraron lotes con los filtros aplicados',
            filteredDescription: 'Probá cambiar los filtros o la búsqueda.',
          },
          skeletonRows: 8,
        } as any)
      )
    ),

    // Cargar / editar
    h(BatchFormDialog, {
      open: showForm,
      onClose: () => {
        setShowForm(false);
        setEditing(null);
        setLockedProduct(null);
      },
      onSuccess: () => {
        setShowForm(false);
        setEditing(null);
        setLockedProduct(null);
      },
      products: productOptions,
      batch: editing,
      lockedProduct,
      onSubmit: editing ? handleUpdate : handleCreate,
      DateField,
      createLabel,
      createHint,
    }),

    // Detalle del lote (trazabilidad: origen + consumos)
    h(BatchDetail, {
      open: !!detailBatch,
      onClose: () => setDetailBatch(null),
      batch: detailBatch,
      resolveSupplier,
      resolveReference,
      resolveProductSubtitle,
      resolveOriginLink,
      onEdit: () => {
        if (detailBatch) openEdit(detailBatch);
        setDetailBatch(null);
      },
      onBaja: () => {
        if (detailBatch) setBajaTarget(detailBatch);
        setDetailBatch(null);
      },
    }),

    // Confirmación de baja con motivo
    h(BajaDialog, {
      open: !!bajaTarget,
      batch: bajaTarget,
      onClose: () => setBajaTarget(null),
      onConfirm: (motivo: string) => {
        if (bajaTarget) void handleBaja(bajaTarget, motivo);
        setBajaTarget(null);
      },
    })
  );
}
