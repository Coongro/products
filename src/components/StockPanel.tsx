/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { getHostReact, getHostUI, actions } from '@coongro/plugin-sdk';

import {
  computeBatchStatus,
  statusBadge,
  formatExpiration,
  expirationRelative,
  daysUntil,
  isUsable,
} from './batch-status.js';
import type { BatchListItem } from './batch-status.js';

const UI = getHostUI();
const React = getHostReact();
const { useState, useEffect } = React;
const h = React.createElement;

interface StockPanelProps {
  productId: string;
  /** Unidad para los conteos (ej. 'dosis', 'u.', 'frascos'). Default 'u.'. */
  unit?: string;
  /** Abrir el alta de lote para este producto (opcional). */
  onCargar?: () => void;
  /** Ir a "Lotes y stock" filtrado por este producto (deep-link, opcional). */
  onGestionar?: () => void;
}

/** Fila cruda de products.batches.listByProduct. */
interface BatchRow {
  id: string;
  batch_number: string;
  expiration_date: string | null;
  quantity: string | null;
  status: string;
}

const EYEBROW: any = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--cg-text-muted)',
};

/** Convierte una fila cruda en el shape que consumen los helpers de estado. */
function toItem(r: BatchRow): BatchListItem {
  return {
    id: r.id,
    productId: '',
    productName: '',
    kind: null,
    batchNumber: r.batch_number,
    expirationDate: r.expiration_date ?? '',
    quantity: Number(r.quantity ?? 0),
    received: 0,
    supplier: null,
    supplierId: null,
    notes: null,
    status: r.status,
  };
}

/**
 * Panel de stock/lotes para la ficha de un producto en el Catálogo (read-only).
 * El Catálogo informa y da acceso; la gestión vive en "Lotes y stock". Muestra
 * disponible total + próximo vencimiento + lista de lotes, y enlaza al inventario.
 * Reusable por cualquier kit (vacunas, medicamentos, …) — solo necesita el productId.
 */
export function StockPanel(props: StockPanelProps) {
  const { productId, unit = 'u.', onCargar, onGestionar } = props;
  const [items, setItems] = useState<BatchListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const rows = await actions.execute<BatchRow[]>('products.batches.listByProduct', {
          productId,
        });
        if (active) setItems((rows ?? []).map(toItem));
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [productId]);

  // FIFO (vence primero; sin vencimiento al final).
  const sorted = [...items].sort((a, b) => {
    if (!a.expirationDate && !b.expirationDate) return 0;
    if (!a.expirationDate) return 1;
    if (!b.expirationDate) return -1;
    return a.expirationDate.localeCompare(b.expirationDate);
  });
  const usable = sorted.filter((b) => isUsable(computeBatchStatus(b)));
  const total = usable.reduce((s, b) => s + b.quantity, 0);
  const next = usable[0];
  const nextDays = next ? daysUntil(next.expirationDate) : null;

  const stat = (cap: string, value: any, sub: any, subColor?: string) =>
    h(
      'div',
      { className: 'flex-1', style: { minWidth: 0 } },
      h('div', { style: EYEBROW }, cap),
      h('div', { className: 'text-lg font-bold text-cg-text font-mono mt-0.5' }, value),
      sub ? h('div', { className: 'text-xs mt-0.5', style: { color: subColor } }, sub) : null
    );

  return h(
    'div',
    { className: 'rounded-xl border border-cg-border bg-cg-bg' },

    // Header
    h(
      'div',
      {
        className: 'flex items-center gap-2 px-4 py-3 border-b border-cg-border',
      },
      h(UI.DynamicIcon, { icon: 'Boxes', size: 15, className: 'text-cg-text-muted' } as any),
      h('span', { style: EYEBROW }, 'Stock / Lotes'),
      h('span', { style: { flex: 1 } }),
      h(
        'span',
        { className: 'text-xs text-cg-text-muted flex items-center gap-1' },
        h(UI.DynamicIcon, { icon: 'Info', size: 12 } as any),
        'Solo lectura'
      )
    ),

    loading
      ? h('div', { className: 'px-4 py-6 text-sm text-cg-text-muted' }, 'Cargando stock…')
      : h(
          'div',
          { className: 'p-4 flex flex-col gap-4' },

          // Stats
          h(
            'div',
            {
              className: 'flex gap-4 rounded-lg bg-cg-bg-secondary border border-cg-border p-3',
            },
            stat(
              'Disponible total',
              h(
                'span',
                null,
                String(total),
                h('small', { className: 'text-cg-text-muted ml-1' }, unit)
              ),
              `${usable.length} lote${usable.length !== 1 ? 's' : ''} activo${usable.length !== 1 ? 's' : ''}`,
              total > 0 ? 'var(--cg-success, #0f766e)' : 'var(--cg-danger, #c0392b)'
            ),
            stat(
              'Próximo vencimiento',
              h(
                'span',
                { className: 'text-sm' },
                next ? formatExpiration(next.expirationDate) : '—'
              ),
              next ? `${expirationRelative(next.expirationDate).text} · ${next.batchNumber}` : null,
              nextDays !== null && nextDays <= 60
                ? 'var(--cg-warning, #b45309)'
                : 'var(--cg-text-muted)'
            ),
            stat(
              'Lotes totales',
              String(items.length),
              'incluye vencidos / baja',
              'var(--cg-text-muted)'
            )
          ),

          // Lista de lotes
          items.length === 0
            ? h(
                'div',
                { className: 'text-sm text-cg-text-muted text-center py-3' },
                'Sin lotes cargados para este producto.'
              )
            : h(
                'div',
                { className: 'flex flex-col' },
                ...sorted.map((b, i) =>
                  h(
                    'div',
                    {
                      key: b.id,
                      className: 'flex items-center gap-3 py-2 text-sm',
                      style: { borderTop: i > 0 ? '1px solid var(--cg-border)' : 'none' },
                    },
                    h(
                      'span',
                      { className: 'font-mono font-semibold', style: { minWidth: '90px' } },
                      b.batchNumber
                    ),
                    statusBadge(computeBatchStatus(b)) as any,
                    h(
                      'span',
                      { className: 'text-cg-text-muted text-xs', style: { flex: 1 } },
                      b.expirationDate
                        ? `vence ${formatExpiration(b.expirationDate)}`
                        : 'sin vencimiento'
                    ),
                    h(
                      'span',
                      { className: 'font-mono' },
                      String(b.quantity),
                      h('span', { className: 'text-cg-text-muted ml-1' }, unit)
                    )
                  )
                )
              ),

          // CTA
          (onCargar || onGestionar) &&
            h(
              'div',
              { className: 'flex gap-2 pt-1' },
              onCargar
                ? h(
                    UI.Button,
                    { variant: 'brand', size: 'sm', onClick: onCargar } as any,
                    h(UI.DynamicIcon, { icon: 'Plus', size: 14 } as any),
                    ' Cargar lote'
                  )
                : null,
              onGestionar
                ? h(
                    UI.Button,
                    { variant: 'outline', size: 'sm', onClick: onGestionar } as any,
                    h(UI.DynamicIcon, { icon: 'Boxes', size: 14 } as any),
                    ' Gestionar en Lotes y stock'
                  )
                : null
            ),

          h(
            'p',
            { className: 'text-xs text-cg-text-muted flex items-start gap-1.5' },
            h(UI.DynamicIcon, { icon: 'Info', size: 12, className: 'mt-0.5 shrink-0' } as any),
            'Acá el catálogo informa y da acceso. La gestión de lotes vive en "Lotes y stock".'
          )
        )
  );
}
