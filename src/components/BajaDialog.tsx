/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

import type { BatchListItem } from './batch-status.js';

const UI = getHostUI();
const React = getHostReact();
const { useState, useEffect } = React;
const h = React.createElement;

/** Motivos de baja de un lote (se guarda el elegido en metadata.bajaMotivo). */
export const BAJA_MOTIVOS = [
  'Vencido',
  'Rotura / derrame',
  'Cadena de frío cortada',
  'Recall del proveedor',
  'Otro',
];

interface BajaDialogProps {
  open: boolean;
  batch: BatchListItem | null;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}

/**
 * Confirmación de baja de lote con motivo (COONG-220+). El lote queda en el
 * historial (no se borra) y su stock disponible deja de contar. El motivo elegido
 * se guarda para trazar por qué se dio de baja (vencido, recall, cadena de frío…).
 */
export function BajaDialog(props: BajaDialogProps) {
  const { open, batch, onClose, onConfirm } = props;
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (open) setMotivo('');
  }, [open]);

  if (!batch) return null;

  return h(UI.FormDialogSubmit, {
    open,
    onOpenChange: (val: boolean) => !val && onClose(),
    title: `Dar de baja · ${batch.batchNumber}`,
    eyebrow: 'DAR DE BAJA',
    subtitle: `Las ${batch.quantity} u. disponibles dejan de contar para el stock. El lote queda en el historial, no se borra.`,
    size: 'sm',
    submitLabel: 'Dar de baja',
    submitVariant: 'danger',
    onCancel: onClose,
    children: ({ formRef }: any) =>
      h(
        'form',
        {
          ref: formRef,
          onSubmit: (e: Event) => {
            e.preventDefault();
            onConfirm(motivo || 'Sin especificar');
          },
          className: 'flex flex-col gap-3',
        },
        h(UI.Label, null, 'Motivo'),
        h(
          'div',
          { className: 'flex flex-wrap gap-2' },
          ...BAJA_MOTIVOS.map((m) =>
            h(
              UI.Chip,
              {
                key: m,
                variant: motivo === m ? 'brand' : 'default',
                onClick: () => setMotivo(m),
                className: 'cursor-pointer',
              } as any,
              m
            )
          )
        )
      ),
  } as any);
}
