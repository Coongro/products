/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { getHostReact, getHostUI, actions } from '@coongro/plugin-sdk';

import { formatExpiration, daysUntil } from './batch-status.js';

const UI = getHostUI();
const React = getHostReact();
const { useState, useEffect } = React;
const h = React.createElement;

/** Lote disponible para elegir (forma mínima que el picker necesita). */
export interface BatchOption {
  id: string;
  batchNumber: string;
  /** ISO o '' si no vence. */
  expirationDate: string;
  quantity: number;
  /** status crudo (active|depleted|expired|recalled). Si falta, se asume usable. */
  status?: string;
}

interface BatchPickerProps {
  /** Producto cuyos lotes se eligen. Se ignora si `batches` viene provisto. */
  productId?: string;
  /** Lotes ya cargados por el caller (evita una segunda lectura). Si se omite, el picker los carga. */
  batches?: BatchOption[];
  /** batchId seleccionado. */
  value: string;
  onChange: (batchId: string) => void;
  /** Pre-seleccionar el lote FIFO (el que vence primero) cuando no hay selección. Default: true. */
  autoSelectFirst?: boolean;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** Fila cruda de products.batches.listByProduct. */
interface BatchRow {
  id: string;
  batch_number: string;
  expiration_date: string | null;
  quantity: string | null;
  status: string;
}

/** ¿El lote se puede consumir? (con stock, no vencido, no dado de baja). */
function isUsableOption(b: BatchOption): boolean {
  if (b.status === 'recalled') return false;
  if (b.quantity <= 0) return false;
  const days = daysUntil(b.expirationDate);
  return days === null || days >= 0;
}

/** Motivo por el que un lote no se puede usar (para mostrarlo deshabilitado). */
function blockedReason(b: BatchOption): string {
  if (b.status === 'recalled') return 'dado de baja';
  if (b.quantity <= 0) return 'agotado';
  const days = daysUntil(b.expirationDate);
  if (days !== null && days < 0) return 'vencido';
  return '';
}

/**
 * Selector de lote reusable (motor de lotes, COONG-220). Único lugar donde se
 * elige un lote para consumir: lo usan aplicar-vacuna, medicamentos en consulta
 * y recetas. Lista los lotes ordenados FIFO (vence primero), pre-selecciona el
 * primero usable como sugerencia, y muestra los NO disponibles (vencido/agotado/
 * baja) deshabilitados con su motivo — así el vet ve por qué no puede usarlos.
 */
export function BatchPicker(props: BatchPickerProps) {
  const {
    productId,
    batches: provided,
    value,
    onChange,
    autoSelectFirst = true,
    placeholder = 'Elegí un lote…',
    disabled,
    size = 'md',
    className,
  } = props;

  const [loaded, setLoaded] = useState<BatchOption[]>([]);
  const batches = provided ?? loaded;

  useEffect(() => {
    if (provided || !productId) return;
    let active = true;
    void (async () => {
      try {
        const rows = await actions.execute<BatchRow[]>('products.batches.listByProduct', {
          productId,
        });
        if (!active) return;
        setLoaded(
          (rows ?? []).map((r) => ({
            id: r.id,
            batchNumber: r.batch_number,
            expirationDate: r.expiration_date ?? '',
            quantity: Number(r.quantity ?? 0),
            status: r.status,
          }))
        );
      } catch {
        if (active) setLoaded([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [provided, productId]);

  // FIFO (vence primero; sin vencimiento al final) separado en usables / bloqueados.
  const sorted = [...batches].sort((a, b) => {
    if (!a.expirationDate && !b.expirationDate) return 0;
    if (!a.expirationDate) return 1;
    if (!b.expirationDate) return -1;
    return a.expirationDate.localeCompare(b.expirationDate);
  });
  const usables = sorted.filter(isUsableOption);
  const blocked = sorted.filter((b) => !isUsableOption(b));

  // Sugerencia FIFO: si no hay selección, pre-elige el primer lote usable.
  useEffect(() => {
    if (!autoSelectFirst) return;
    if (value) return;
    if (usables.length === 0) return;
    onChange(usables[0].id);
  }, [autoSelectFirst, value, usables, onChange]);

  const usableLabel = (b: BatchOption, isFirst: boolean): string => {
    const venc = b.expirationDate
      ? `vence ${formatExpiration(b.expirationDate)}`
      : 'sin vencimiento';
    return `${b.batchNumber} · ${venc} · ${b.quantity} disp.${isFirst ? ' · ★ sugerido' : ''}`;
  };

  return h(
    UI.Select,
    {
      value,
      onValueChange: onChange,
      placeholder,
      disabled: disabled || usables.length === 0,
      size,
      className,
      debounceMs: 0,
    } as any,
    ...usables.map((b, i) =>
      h(UI.SelectItem, { key: b.id, value: b.id } as any, usableLabel(b, i === 0))
    ),
    // No disponibles: visibles pero deshabilitados, con el motivo.
    ...blocked.map((b) =>
      h(
        UI.SelectItem,
        { key: b.id, value: b.id, disabled: true } as any,
        `${b.batchNumber} · ${blockedReason(b)}`
      )
    )
  );
}
