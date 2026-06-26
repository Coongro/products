/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { getHostReact, getHostUI, actions, views } from '@coongro/plugin-sdk';

import { computeBatchStatus, formatExpiration, expirationRelative } from './batch-status.js';
import type { BatchListItem } from './batch-status.js';

const UI = getHostUI();
const React = getHostReact();
const { useState, useEffect } = React;
const h = React.createElement;

/** Info ya resuelta de la referencia de un movimiento (la inyecta el kit por dominio). */
export interface BatchRefInfo {
  label: string;
  sublabel?: string;
  icon?: string;
  /**
   * Destino navegable del consumo (la aplicación/receta/consulta de origen). Si viene,
   * la fila es clickeable y abre esa vista. Lo provee el kit, que conoce las vistas.
   */
  nav?: { viewId: string; params?: Record<string, unknown> };
}

interface BatchDetailProps {
  open: boolean;
  onClose: () => void;
  batch: BatchListItem | null;
  onEdit?: () => void;
  onBaja?: () => void;
  resolveSupplier?: (supplierId: string) => string | undefined;
  resolveReference?: (referenceType: string | null, referenceId: string | null) => BatchRefInfo;
  /** Línea extra bajo el nº de lote (ej. "Frasco 100ml · Holliday"). La provee el kit. */
  resolveProductSubtitle?: (productId: string) => string | undefined;
  /**
   * A dónde lleva el "origen" del lote (la salida/compra de la que vino). products guarda
   * el vínculo como metadata opaca; el kit, que conoce las vistas, decide el destino.
   */
  resolveOriginLink?: (meta: {
    sourceType?: string;
    sourceAccountId?: string;
  }) => { label: string; viewId: string; params?: Record<string, unknown> } | undefined;
}

interface BatchRow {
  supplier_id: string | null;
  supplier: string | null;
  purchase_price: string | null;
  purchase_date: string | null;
  notes: string | null;
  metadata: { bajaMotivo?: string; sourceAccountId?: string; sourceType?: string } | null;
}

interface MovementRow {
  id: string;
  type: string;
  quantity: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

// Neutros = tokens del repo (se adaptan a dark mode). Acentos = paleta del diseño.
const N = {
  100: 'var(--cg-bg-secondary)',
  200: 'var(--cg-bg-secondary)',
  300: 'var(--cg-border)',
  500: 'var(--cg-text-muted)',
  700: 'var(--cg-text)',
  950: 'var(--cg-text)',
  white: 'var(--cg-bg)',
};
const PAL = {
  teal: { soft: '#d7f2ec', mid: '#0d9488', deep: '#0f766e' },
  gold: { soft: '#fbeecb', mid: '#d97706', deep: '#b45309' },
  sky: { soft: '#e2f0fb', mid: '#2f7cc4', deep: '#0369a1' },
  pink: { soft: '#fbe4ee', mid: '#db2777', deep: '#be185d' },
  red: { soft: '#fbe3e1', mid: '#dc2626', deep: '#b91c1c' },
};

const FONT_MONO = "'SF Mono', ui-monospace, 'Menlo', monospace";

const EYEBROW: any = {
  fontWeight: 700,
  fontSize: '11px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: N[500],
};
const SECTION_LABEL: any = { ...EYEBROW, fontSize: '10.5px', letterSpacing: '0.06em' };

/** Tono del stock según cuánto queda del lote. */
function stockTone(qty: number, received: number, recalled: boolean): keyof typeof TONE {
  if (recalled) return 'muted';
  if (qty <= 0) return 'empty';
  const r = received > 0 ? qty / received : 0;
  if (r > 0.34) return 'ok';
  if (r > 0.12) return 'warn';
  return 'low';
}
const TONE = {
  ok: { fill: PAL.teal.mid, num: PAL.teal.deep, dot: PAL.teal.deep },
  warn: { fill: PAL.gold.mid, num: PAL.gold.deep, dot: PAL.gold.deep },
  low: { fill: PAL.red.mid, num: PAL.red.deep, dot: PAL.red.mid },
  empty: { fill: 'transparent', num: N[700], dot: N[500] },
  muted: { fill: N[300], num: N[500], dot: N[500] },
};

/** kind del consumo → icono + tono del nodo del timeline (paleta del diseño). */
function consumoKind(referenceType: string | null): 'paciente' | 'consulta' | 'receta' | 'otro' {
  if (referenceType === 'vaccination_application') return 'paciente';
  if (referenceType === 'consultation_medication') return 'consulta';
  if (referenceType === 'prescription') return 'receta';
  return 'otro';
}
const KIND_NODE: Record<string, { icon: string; bg: string; fg: string }> = {
  paciente: { icon: 'PawPrint', bg: PAL.pink.soft, fg: PAL.pink.deep },
  consulta: { icon: 'Pill', bg: PAL.gold.soft, fg: PAL.gold.deep },
  receta: { icon: 'FileText', bg: PAL.gold.soft, fg: PAL.gold.deep },
  otro: { icon: 'ArrowDownRight', bg: N[200], fg: N[500] },
  aggregate: { icon: 'Layers', bg: N[200], fg: N[500] },
};

/** Tipo del producto → label + colores del chip (vac=azul, med=dorado, como el diseño). */
function tipoMeta(
  kind: string | null
): { label: string; bg: string; fg: string; icon: string } | null {
  if (kind === 'vaccine')
    return { label: 'Vacuna', bg: PAL.sky.soft, fg: PAL.sky.deep, icon: 'Syringe' };
  if (kind === 'medication')
    return { label: 'Medicamento', bg: PAL.gold.soft, fg: PAL.gold.deep, icon: 'Pill' };
  if (kind) return { label: kind, bg: N[200], fg: N[700], icon: 'Box' };
  return null;
}

function defaultRefLabel(type: string | null): string {
  switch (type) {
    case 'vaccination_application':
      return 'Aplicación de vacuna';
    case 'consultation_medication':
      return 'Medicamento en consulta';
    case 'prescription':
      return 'Dispensación (receta)';
    default:
      return type ?? 'Movimiento';
  }
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "mar 2026" para el período del agregado de consumos viejos. */
function fmtMonthYear(iso: string): string {
  if (!iso) return '';
  const [y, m] = iso.slice(0, 10).split('-');
  const mi = Number(m) - 1;
  return y && MONTHS[mi] ? `${MONTHS[mi]} ${y}` : iso;
}

/** Máximo de consumos individuales en el timeline; el resto se agrupa. */
const MAX_TIMELINE_ROWS = 6;

/**
 * Detalle de un lote (COONG-220+) — diseño Claude Design "Detalle de lote": header con
 * tipo/estado/vencimiento, ciclo de stock (recibido − consumido = disponible) con barra +
 * leyenda, banner de baja, origen (compra o carga manual) y línea de tiempo de consumos
 * (génesis + cada salida con su nodo por tipo, conectados por una línea). products es
 * genérico: el "a qué paciente/receta" lo humaniza el kit (resolveReference), el proveedor
 * resolveSupplier.
 */
export function BatchDetail(props: BatchDetailProps) {
  const {
    open,
    onClose,
    batch,
    onEdit,
    onBaja,
    resolveSupplier,
    resolveReference,
    resolveProductSubtitle,
    resolveOriginLink,
  } = props;

  const [origin, setOrigin] = useState<BatchRow | null>(null);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !batch) return;
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const [row, mvs] = await Promise.all([
          actions.execute<BatchRow>('products.batches.getById', { id: batch.id }),
          actions.execute<MovementRow[]>('products.stock.listByBatch', { batchId: batch.id }),
        ]);
        if (!active) return;
        setOrigin(row ?? null);
        setMovements(mvs ?? []);
      } catch {
        if (active) {
          setOrigin(null);
          setMovements([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, batch]);

  if (!batch) return null;

  const recalled = batch.status === 'recalled';
  const consumed = movements
    .filter((m) => m.type === 'out')
    .reduce((s, m) => s + Math.abs(Number(m.quantity) || 0), 0);
  const received = batch.quantity + consumed;
  const pct = received > 0 ? Math.round((batch.quantity / received) * 100) : 0;
  const tone = TONE[stockTone(batch.quantity, received, recalled)];

  const outflows = movements
    .filter((m) => m.type === 'out')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Si hay muchos consumos, agrupo los más viejos en un único nodo "N consumos
  // anteriores · período" y muestro individuales solo los más recientes.
  const shownOut =
    outflows.length > MAX_TIMELINE_ROWS ? outflows.slice(-MAX_TIMELINE_ROWS) : outflows;
  const olderOut = outflows.length > MAX_TIMELINE_ROWS ? outflows.slice(0, -MAX_TIMELINE_ROWS) : [];
  const aggregate =
    olderOut.length > 0
      ? {
          count: olderOut.length,
          total: olderOut.reduce((s, m) => s + Math.abs(Number(m.quantity) || 0), 0),
          period: `${fmtMonthYear(olderOut[0].created_at)} – ${fmtMonthYear(olderOut[olderOut.length - 1].created_at)}`,
        }
      : null;

  const supplierName =
    (origin?.supplier_id && resolveSupplier?.(origin.supplier_id)) || origin?.supplier || null;
  const bajaMotivo = origin?.metadata?.bajaMotivo || 'Sin especificar';
  const notes = origin?.notes;
  const tipo = tipoMeta(batch.kind);
  const subtitle = resolveProductSubtitle?.(batch.productId);
  const originLink = origin?.metadata?.sourceAccountId
    ? resolveOriginLink?.({
        sourceType: origin.metadata.sourceType,
        sourceAccountId: origin.metadata.sourceAccountId,
      })
    : undefined;

  const rel = expirationRelative(batch.expirationDate);
  const vencChip =
    rel.tone === 'over'
      ? { bg: PAL.red.soft, fg: PAL.red.deep, border: 'transparent', icon: 'TriangleAlert' }
      : rel.tone === 'soon'
        ? { bg: PAL.gold.soft, fg: PAL.gold.deep, border: 'transparent', icon: 'Calendar' }
        : {
            bg: 'transparent',
            fg: N[500],
            border: N[300],
            icon: rel.tone === 'none' ? 'Info' : 'Calendar',
          };

  // ── helpers de UI ──
  const chip = (label: any, bg: string, fg: string, border?: string, icon?: string) =>
    h(
      'span',
      {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontWeight: 500,
          fontSize: '11.5px',
          borderRadius: '6px',
          padding: '4px 9px',
          whiteSpace: 'nowrap',
          background: bg,
          color: fg,
          border: border ? `0.5px solid ${border}` : undefined,
        },
      },
      icon ? h(UI.DynamicIcon, { icon, size: 12 } as any) : null,
      label
    );

  const sectionHead = (text: string, note?: string) =>
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        },
      },
      h('span', { style: SECTION_LABEL }, text),
      note ? h('span', { style: { fontSize: '11.5px', color: N[500] } }, note) : null
    );

  const sectionStyle = (last?: boolean): any => ({
    padding: '20px 0',
    borderBottom: last ? 'none' : `0.5px dashed ${N[300]}`,
  });

  const node = (icon: string, bg: string, fg: string) =>
    h(
      'span',
      {
        style: {
          width: '32px',
          height: '32px',
          borderRadius: '9px',
          background: bg,
          color: fg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          zIndex: 1,
          position: 'relative',
        },
      },
      h(UI.DynamicIcon, { icon, size: 15 } as any)
    );

  // fila del timeline (con línea conectora salvo la última; clickeable si hay onClick)
  const tlRow = (
    key: string,
    nodeEl: any,
    label: any,
    sub: any,
    right: any,
    isLast: boolean,
    bold?: boolean,
    onClick?: () => void
  ) =>
    h(
      onClick ? 'button' : 'div',
      {
        key,
        onClick,
        style: {
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          paddingBottom: isLast ? '0' : '20px',
          width: onClick ? '100%' : undefined,
          textAlign: onClick ? 'left' : undefined,
          border: 'none',
          background: 'none',
          cursor: onClick ? 'pointer' : undefined,
          font: 'inherit',
        },
      } as any,
      isLast
        ? null
        : h('span', {
            style: {
              position: 'absolute',
              left: '15px',
              top: '32px',
              bottom: '-2px',
              width: '0.5px',
              background: N[300],
            },
          }),
      nodeEl,
      h(
        'div',
        { style: { flex: 1, minWidth: 0, paddingTop: '1px' } },
        h(
          'div',
          {
            style: {
              fontWeight: bold ? 700 : 500,
              fontSize: '13.5px',
              color: N[950],
              lineHeight: 1.3,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            },
          },
          h(
            'span',
            {
              style: onClick
                ? { textDecoration: 'underline', textDecorationColor: N[300] }
                : undefined,
            } as any,
            label
          ),
          onClick
            ? h(UI.DynamicIcon, {
                icon: 'ChevronRight',
                size: 13,
                style: { color: N[500], flexShrink: 0 },
              } as any)
            : null
        ),
        sub ? h('div', { style: { fontSize: '12px', color: N[500], marginTop: '3px' } }, sub) : null
      ),
      right
    );

  const genesisRow = tlRow(
    'genesis',
    node('ArrowDownToLine', PAL.teal.soft, PAL.teal.deep),
    supplierName ? 'Ingreso del lote' : 'Carga manual de stock',
    supplierName ?? 'Sin compra asociada',
    h(
      'span',
      { style: { fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 600, color: PAL.teal.deep } },
      `+${received}`
    ),
    outflows.length === 0,
    true
  );

  // Agregado de consumos viejos (va justo bajo la génesis, antes de los recientes).
  const aggregateRow = aggregate
    ? tlRow(
        'aggregate',
        node(KIND_NODE.aggregate.icon, KIND_NODE.aggregate.bg, KIND_NODE.aggregate.fg),
        `${aggregate.count} consumos anteriores`,
        aggregate.period,
        h(
          'span',
          { style: { fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 600, color: N[500] } },
          `−${aggregate.total}`
        ),
        false
      )
    : null;

  const consumoRows = shownOut.map((m, i) => {
    const meta = KIND_NODE[consumoKind(m.reference_type)];
    const info = resolveReference?.(m.reference_type, m.reference_id) ?? {
      label: defaultRefLabel(m.reference_type),
    };
    const nav = info.nav;
    return tlRow(
      m.id,
      node(info.icon ?? meta.icon, meta.bg, meta.fg),
      info.label,
      info.sublabel,
      h(
        'div',
        { style: { textAlign: 'right', flexShrink: 0 } },
        h(
          'div',
          { style: { fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 600, color: N[950] } },
          `−${Math.abs(Number(m.quantity) || 0)}`
        ),
        h(
          'div',
          { style: { fontSize: '11px', color: N[500], marginTop: '3px' } },
          fmtDate(m.created_at)
        )
      ),
      i === shownOut.length - 1,
      false,
      nav ? () => views.open(nav.viewId, nav.params) : undefined
    );
  });

  return h(
    UI.Sheet,
    { open, onOpenChange: (v: boolean) => !v && onClose(), side: 'right' } as any,
    h(
      UI.SheetContent,
      {
        style: {
          width: '540px',
          maxWidth: '94vw',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        },
      } as any,

      // ── Header ──
      h(
        'div',
        {
          style: {
            padding: '22px 24px 16px',
            borderBottom: `0.5px solid ${N[200]}`,
            flexShrink: 0,
          },
        },
        h('div', { style: EYEBROW }, batch.productName),
        h(
          UI.SheetTitle,
          {
            style: {
              fontFamily: FONT_MONO,
              fontWeight: 600,
              fontSize: '27px',
              letterSpacing: '-1px',
              color: N[950],
              margin: '5px 0 0',
              lineHeight: 1,
            },
          } as any,
          batch.batchNumber
        ),
        subtitle
          ? h('div', { style: { fontSize: '13px', color: N[700], marginTop: '7px' } }, subtitle)
          : null,
        h(
          'div',
          { style: { display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '16px' } },
          tipo ? chip(tipo.label, tipo.bg, tipo.fg, undefined, tipo.icon) : null,
          chip(
            recalled ? 'Dado de baja' : statusLabel(batch),
            recalled ? 'transparent' : statusBg(batch),
            recalled ? N[500] : statusFg(batch),
            recalled ? N[300] : undefined
          ),
          chip(
            batch.expirationDate
              ? `Vence ${formatExpiration(batch.expirationDate)}`
              : 'Sin vencimiento',
            vencChip.bg,
            vencChip.fg,
            vencChip.border === 'transparent' ? undefined : vencChip.border,
            vencChip.icon
          )
        )
      ),

      // ── Body ──
      h(
        'div',
        { style: { flex: 1, overflowY: 'auto', padding: '4px 24px 24px' } },

        // Banner baja
        recalled
          ? h(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginTop: '18px',
                  padding: '14px 15px',
                  background: N[100],
                  border: `0.5px solid ${N[300]}`,
                  borderRadius: '12px',
                },
              },
              h(
                'span',
                {
                  style: {
                    width: '34px',
                    height: '34px',
                    borderRadius: '9px',
                    flexShrink: 0,
                    background: N.white,
                    border: `0.5px solid ${N[300]}`,
                    color: N[700],
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                },
                h(UI.DynamicIcon, { icon: 'Ban', size: 17 } as any)
              ),
              h(
                'div',
                null,
                h(
                  'div',
                  { style: { fontWeight: 700, fontSize: '13.5px', color: N[950] } },
                  'Lote dado de baja'
                ),
                h(
                  'div',
                  {
                    style: {
                      fontSize: '12.5px',
                      color: N[700],
                      marginTop: '3px',
                      lineHeight: 1.45,
                    },
                  },
                  'Motivo: ',
                  h('strong', null, bajaMotivo),
                  ` · las ${batch.quantity} u. no cuentan para el stock.`
                )
              )
            )
          : null,

        // 1 · Ciclo de stock
        h(
          'div',
          { style: sectionStyle() },
          sectionHead('Ciclo de stock'),
          h(
            'div',
            {
              style: {
                border: `0.5px solid ${N[300]}`,
                borderRadius: '14px',
                padding: '18px',
                background: N.white,
                opacity: recalled ? 0.72 : 1,
              },
            },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
              cycleStat(String(received), 'Recibidas'),
              cycleOp('−'),
              cycleStat(String(consumed), 'Consumidas'),
              cycleOp('='),
              cycleStat(String(batch.quantity), 'Disponibles', tone.num)
            ),
            // barra + leyenda
            h(
              'div',
              { style: { marginTop: '20px' } },
              h(
                'div',
                {
                  style: {
                    height: '10px',
                    borderRadius: '999px',
                    background: N[200],
                    overflow: 'hidden',
                  },
                },
                h('div', {
                  style: {
                    height: '100%',
                    borderRadius: '999px',
                    width: `${Math.max(batch.quantity > 0 ? 3 : 0, pct)}%`,
                    background: tone.fill,
                    transition: 'width .32s',
                  },
                })
              ),
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '9px',
                  },
                },
                h(
                  'span',
                  {
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: tone.dot,
                    },
                  },
                  h('span', {
                    style: {
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: tone.dot,
                    },
                  }),
                  `${batch.quantity} disponibles`
                ),
                h(
                  'span',
                  { style: { fontSize: '12px', color: N[500] } },
                  `${consumed} consumidas de ${received}`
                )
              )
            )
          )
        ),

        // 2 · Origen
        h(
          'div',
          { style: sectionStyle() },
          sectionHead('Origen'),
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'flex-start',
                gap: '13px',
                padding: '14px 15px',
                border: `0.5px solid ${N[300]}`,
                borderRadius: '12px',
              },
            },
            h(
              'span',
              {
                style: {
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  flexShrink: 0,
                  background: supplierName ? N[200] : N.white,
                  border: supplierName ? undefined : `0.5px solid ${N[300]}`,
                  color: supplierName ? N[700] : N[500],
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              },
              h(UI.DynamicIcon, { icon: supplierName ? 'Truck' : 'Inbox', size: 18 } as any)
            ),
            supplierName
              ? h(
                  'div',
                  { style: { flex: 1, minWidth: 0 } },
                  h(
                    'div',
                    { style: { fontWeight: 500, fontSize: '14px', color: N[950] } },
                    supplierName
                  ),
                  h(
                    'div',
                    {
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '12.5px',
                        color: N[700],
                        marginTop: '3px',
                        flexWrap: 'wrap',
                      },
                    },
                    h(
                      'span',
                      null,
                      origin?.purchase_date ? `Compra · ${fmtDate(origin.purchase_date)}` : 'Compra'
                    ),
                    origin?.purchase_price
                      ? h(
                          'span',
                          { style: { fontWeight: 600, color: N[950] } },
                          `$ ${Number(origin.purchase_price).toLocaleString('es-AR')}`
                        )
                      : null
                  ),
                  // Link a la salida/compra de la que vino el lote (lo provee el kit).
                  originLink
                    ? h(
                        'button',
                        {
                          onClick: () => views.open(originLink.viewId, originLink.params),
                          style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '11px',
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontWeight: 500,
                            fontSize: '12.5px',
                            color: PAL.gold.deep,
                          },
                        } as any,
                        h(UI.DynamicIcon, { icon: 'ExternalLink', size: 13 } as any),
                        originLink.label
                      )
                    : null
                )
              : h(
                  'div',
                  { style: { flex: 1, minWidth: 0 } },
                  h(
                    'div',
                    { style: { fontWeight: 500, fontSize: '14px', color: N[950] } },
                    'Cargado manualmente'
                  ),
                  h(
                    'div',
                    { style: { fontSize: '12.5px', color: N[700], marginTop: '3px' } },
                    'Sin compra asociada · no afecta costos'
                  )
                )
          )
        ),

        // 3 · Consumos (timeline)
        h(
          'div',
          { style: sectionStyle(!notes) },
          sectionHead('Consumos', consumed > 0 ? `${consumed} u. usadas` : '—'),
          loading
            ? h('div', { style: { fontSize: '13px', color: N[500] } }, 'Cargando…')
            : outflows.length === 0
              ? h(
                  'div',
                  {
                    style: {
                      textAlign: 'center',
                      padding: '26px 18px',
                      border: `0.5px dashed ${N[300]}`,
                      borderRadius: '12px',
                    },
                  },
                  h(
                    'span',
                    {
                      style: {
                        width: '44px',
                        height: '44px',
                        borderRadius: '11px',
                        background: N[100],
                        color: N[500],
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '12px',
                      },
                    },
                    h(UI.DynamicIcon, { icon: 'PackageCheck', size: 20 } as any)
                  ),
                  h(
                    'div',
                    { style: { fontWeight: 500, fontSize: '14px', color: N[950] } },
                    'Todavía no se usó nada de este lote'
                  ),
                  h(
                    'div',
                    {
                      style: {
                        fontSize: '12.5px',
                        color: N[500],
                        marginTop: '6px',
                        lineHeight: 1.5,
                        maxWidth: '320px',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                      },
                    },
                    'Cuando apliques una vacuna o dispenses con este lote, cada salida aparece acá.'
                  )
                )
              : h('div', null, genesisRow, aggregateRow, ...consumoRows)
        ),

        // Notas
        notes
          ? h(
              'div',
              { style: sectionStyle(true) },
              sectionHead('Notas'),
              h(
                'p',
                {
                  style: {
                    fontSize: '13px',
                    color: N[700],
                    lineHeight: 1.55,
                    margin: 0,
                    padding: '13px 15px',
                    background: N[100],
                    borderRadius: '10px',
                  },
                },
                notes
              )
            )
          : null
      ),

      // ── Footer ──
      h(
        'div',
        {
          style: {
            flexShrink: 0,
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderTop: `0.5px solid ${N[200]}`,
          },
        },
        onBaja && !recalled
          ? h(
              UI.Button,
              {
                variant: 'outline',
                size: 'sm',
                className: 'text-cg-danger hover:bg-cg-danger-bg',
                onClick: onBaja,
              } as any,
              h(UI.DynamicIcon, { icon: 'Ban', size: 14, className: 'mr-1' } as any),
              'Dar de baja'
            )
          : null,
        h('span', { style: { flex: 1 } }),
        h(UI.Button, { variant: 'outline', size: 'sm', onClick: onClose } as any, 'Cerrar'),
        onEdit
          ? h(
              UI.Button,
              { variant: 'brand', size: 'sm', onClick: onEdit } as any,
              h(UI.DynamicIcon, { icon: 'Pencil', size: 14, className: 'mr-1' } as any),
              'Editar'
            )
          : null
      )
    )
  );

  // ── helpers de ciclo (definidos al final para legibilidad del render) ──
  function cycleStat(num: string, cap: string, accentColor?: string) {
    return h(
      'div',
      { style: { flex: 1, textAlign: 'center' } },
      h(
        'div',
        {
          style: {
            fontSize: '30px',
            fontWeight: 600,
            letterSpacing: '-1.4px',
            lineHeight: 1,
            color: accentColor ?? N[950],
          },
        },
        num
      ),
      h(
        'div',
        { style: { ...SECTION_LABEL, fontSize: '11px', fontWeight: 500, marginTop: '7px' } },
        cap
      )
    );
  }
  function cycleOp(op: string) {
    return h(
      'span',
      {
        style: {
          fontFamily: FONT_MONO,
          fontSize: '18px',
          color: N[300],
          paddingBottom: '18px',
          flexShrink: 0,
        },
      },
      op
    );
  }
}

// Estado (badge del header): label + colores según el estado visual del lote.
function statusLabel(b: BatchListItem): string {
  const st = computeBatchStatus(b);
  if (st === 'activo') return 'Activo';
  if (st === 'vencido') return 'Vencido';
  if (st === 'agotado') return 'Agotado';
  if (st === 'baja') return 'Dado de baja';
  return 'Por vencer';
}
function statusBg(b: BatchListItem): string {
  const st = computeBatchStatus(b);
  if (st === 'vencido') return PAL.red.soft;
  if (st === 'agotado') return N[950];
  if (typeof st === 'object') return PAL.gold.soft;
  return PAL.teal.soft;
}
function statusFg(b: BatchListItem): string {
  const st = computeBatchStatus(b);
  if (st === 'vencido') return PAL.red.deep;
  if (st === 'agotado') return N.white;
  if (typeof st === 'object') return PAL.gold.deep;
  return PAL.teal.deep;
}
