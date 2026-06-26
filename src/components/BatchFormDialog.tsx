/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { getHostReact, getHostUI, actions } from '@coongro/plugin-sdk';

import { daysUntil } from './batch-status.js';

const UI = getHostUI();
const React = getHostReact();
const { useState, useEffect, useCallback, useMemo, useRef } = React;
const h = React.createElement;

/** Producto loteable elegible para cargar un lote (unión de los clasificadores). */
export interface BatchProductOption {
  productId: string;
  name: string;
  /** kind del clasificador, para agrupar/mostrar en el selector. */
  kind: string | null;
  /** Etiqueta del tipo, ej. 'Vacuna'. */
  kindLabel: string | null;
}

export interface BatchFormData {
  productId: string;
  batchNumber: string;
  /** yyyy-mm-dd ('' = sin vencimiento). */
  expirationDate: string;
  quantity: number;
  /** Proveedor como entidad del maestro (si se eligió/creó uno). */
  supplierId: string | null;
  /** Nombre del proveedor (del maestro o texto libre de fallback). */
  supplier: string | null;
  notes: string | null;
}

/** Lote existente para edición (subset de lo que muestra la vista). */
export interface BatchEditTarget {
  id: string;
  productId: string;
  batchNumber: string;
  expirationDate: string;
  quantity: number;
  supplierId: string | null;
  supplier: string | null;
  notes: string | null;
}

/** Componente de fecha inyectable (ej. el DatePicker de @coongro/calendar). value en yyyy-mm-dd. */
export type DateFieldComponent = (props: {
  value?: string;
  onChange?: (date: string) => void;
  placeholder?: string;
  minDate?: string;
  className?: string;
}) => unknown;

interface BatchFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: BatchProductOption[];
  /** Si viene, el dialog está en modo edición. */
  batch?: BatchEditTarget | null;
  onSubmit: (data: BatchFormData) => Promise<void>;
  /** DatePicker inyectado por el integrador. Si no viene, cae al input de fecha nativo. */
  DateField?: DateFieldComponent;
  /**
   * Producto prefijado (al cargar desde la cabecera de un producto o la ficha del catálogo).
   * El form lo muestra fijo y oculta el selector — versión simplificada del alta.
   */
  lockedProduct?: { productId: string; name: string } | null;
}

interface FormState {
  productId: string;
  batchNumber: string;
  expirationDate: string;
  /** true = el producto no vence (oculta el datepicker, guarda sin fecha). */
  noVence: boolean;
  quantity: string;
  /** id del proveedor elegido del maestro ('' = ninguno / texto libre). */
  supplierId: string;
  supplier: string;
  notes: string;
}

const INITIAL_FORM: FormState = {
  productId: '',
  batchNumber: '',
  expirationDate: '',
  noVence: false,
  quantity: '',
  supplierId: '',
  supplier: '',
  notes: '',
};

/** Proveedor del maestro (purchases.suppliers). */
interface SupplierOption {
  id: string;
  name: string;
}

const FIELD_CLASS = 'flex flex-col gap-1.5';

function FieldGroup({ label, required, error, hint, children }: any) {
  return h(
    'div',
    { className: FIELD_CLASS },
    h(UI.Label, null, label, required && h('span', { className: 'text-cg-danger ml-0.5' }, '*')),
    children,
    error
      ? h('span', { className: 'text-xs text-cg-danger' }, error)
      : hint
        ? h('span', { className: 'text-xs text-cg-text-muted' }, hint)
        : null
  );
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.productId) errors.productId = 'Elegí el producto.';
  if (!form.batchNumber.trim()) errors.batchNumber = 'El número de lote es obligatorio.';
  const quantity = parseInt(form.quantity, 10);
  if (!form.quantity || isNaN(quantity) || quantity < 1)
    errors.quantity = 'Ingresá la cantidad recibida.';
  return errors;
}

export function BatchFormDialog(props: BatchFormDialogProps) {
  const { open, onClose, onSuccess, products, batch, onSubmit, DateField, lockedProduct } = props;

  const isEditing = !!batch;
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const savingChangeRef = useRef<((v: boolean) => void) | null>(null);

  // Proveedores del maestro (purchases). Acoplamiento BLANDO: si purchases no está,
  // hasSupplierMaster queda false y el campo cae a texto libre (products sigue usable solo).
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [hasSupplierMaster, setHasSupplierMaster] = useState(false);

  useEffect(() => {
    savingChangeRef.current?.(saving);
  }, [saving]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      try {
        const list = await actions.execute<SupplierOption[]>('purchases.suppliers.list');
        if (active) {
          setSuppliers(list ?? []);
          setHasSupplierMaster(true);
        }
      } catch {
        if (active) setHasSupplierMaster(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setForm(
        batch
          ? {
              productId: batch.productId,
              batchNumber: batch.batchNumber,
              expirationDate: batch.expirationDate ? batch.expirationDate.slice(0, 10) : '',
              noVence: !batch.expirationDate,
              quantity: String(batch.quantity),
              supplierId: batch.supplierId ?? '',
              supplier: batch.supplier ?? '',
              notes: batch.notes ?? '',
            }
          : { ...INITIAL_FORM, productId: lockedProduct?.productId ?? '' }
      );
      setTouched(new Set());
    }
  }, [open, batch, lockedProduct]);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev: FormState) => ({ ...prev, [key]: value }));
  }, []);

  const touch = useCallback((key: string) => {
    setTouched((prev: Set<string>) => new Set(prev).add(key));
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => p.productId === form.productId) ?? null,
    [products, form.productId]
  );

  // El lote ya vencido se puede cargar igual (queda con estado "Vencido"); solo avisamos.
  const expiredWarning = useMemo(() => {
    const days = daysUntil(form.expirationDate);
    return days !== null && days < 0;
  }, [form.expirationDate]);

  // Crear un proveedor nuevo desde el propio combobox (opción "Crear «texto»").
  const handleCreateSupplier = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      try {
        const created = await actions.execute<{ id: string }[] | { id: string }>(
          'purchases.suppliers.create',
          { data: { name: trimmed } }
        );
        const row = Array.isArray(created) ? created[0] : created;
        if (row?.id) {
          setSuppliers((prev) => [...prev, { id: row.id, name: trimmed }]);
          setField('supplierId', row.id);
        }
      } catch {
        /* purchases no disponible */
      }
    },
    [setField]
  );

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      // Proveedor: elegido/creado del maestro (supplierId) o texto libre de fallback.
      const supplierId: string | null = form.supplierId || null;
      const supplierName = supplierId
        ? (suppliers.find((s) => s.id === supplierId)?.name ?? null)
        : form.supplier.trim() || null;
      await onSubmit({
        productId: form.productId,
        batchNumber: form.batchNumber.trim(),
        expirationDate: form.noVence ? '' : form.expirationDate,
        quantity: parseInt(form.quantity, 10),
        supplierId,
        supplier: supplierName,
        notes: form.notes.trim() || null,
      });
      onSuccess();
    } finally {
      setSaving(false);
    }
  }, [form, isValid, onSubmit, onSuccess, suppliers]);

  // `eyebrow` existe en runtime pero el tipo FormDialogSubmitProps de esta versión
  // de plugin-sdk aún no lo declara → casteamos el objeto de props (patrón del repo).
  return h(UI.FormDialogSubmit, {
    open,
    onOpenChange: (val: boolean) => !val && onClose(),
    title: isEditing ? 'Editar lote' : 'Cargar lote',
    eyebrow: isEditing ? 'EDITAR LOTE' : 'NUEVO LOTE',
    subtitle: isEditing
      ? 'Actualizá los datos del lote.'
      : 'Registrá un lote que recibís en el inventario.',
    size: 'md',
    submitLabel: isEditing ? 'Guardar cambios' : 'Guardar',
    onCancel: onClose,
    disabled: !isValid || saving,
    children: ({ formRef, onSavingChange }: any) => {
      savingChangeRef.current = onSavingChange;
      return h(
        'form',
        {
          ref: formRef,
          onSubmit: (e: Event) => {
            e.preventDefault();
            void handleSubmit();
          },
          className: 'flex flex-col gap-4',
        },

        // === Producto ===
        h(
          UI.FormSection,
          { icon: 'Package', title: 'Producto' } as any,
          h(
            FieldGroup,
            {
              label: 'Producto',
              required: true,
              error: touched.has('productId') && errors.productId,
              hint: selectedProduct?.kindLabel
                ? h(
                    'span',
                    null,
                    'Tipo: ',
                    h('strong', { className: 'text-cg-text' }, selectedProduct.kindLabel)
                  )
                : null,
            },
            isEditing || lockedProduct
              ? // Producto fijo: en edición (no descuadrar inventario) o prefijado desde
                // la cabecera/ficha (alta simplificada — el producto ya se conoce).
                h(UI.Input, {
                  value: lockedProduct?.name ?? selectedProduct?.name ?? '',
                  disabled: true,
                } as any)
              : h(
                  UI.Combobox,
                  {
                    value: form.productId,
                    onValueChange: (v: string) => {
                      setField('productId', v);
                      touch('productId');
                    },
                  } as any,
                  h(UI.ComboboxChipTrigger, {
                    placeholder: 'Buscar producto…',
                    renderChip: (val: string, onRemove: () => void) => {
                      const p = products.find((x) => x.productId === val);
                      return h(UI.Chip, { size: 'sm', onRemove } as any, p?.name ?? val);
                    },
                  } as any),
                  h(
                    UI.ComboboxContent,
                    null,
                    ...products.map((p) =>
                      h(UI.ComboboxItem, { key: p.productId, value: p.productId } as any, p.name)
                    )
                  )
                )
          )
        ),

        // === Datos del lote ===
        h(
          UI.FormSection,
          { icon: 'Box', title: 'Datos del lote' } as any,
          h(
            FieldGroup,
            {
              label: 'Nro. de lote',
              required: true,
              error: touched.has('batchNumber') && errors.batchNumber,
            },
            h(UI.Input, {
              value: form.batchNumber,
              onChange: (e: any) => setField('batchNumber', e.target.value),
              onBlur: () => touch('batchNumber'),
              placeholder: 'Ej: L2025C-00441',
              className: 'font-mono',
            } as any)
          ),

          h(
            'div',
            { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
            h(
              FieldGroup,
              {
                label: 'Fecha de vencimiento',
                hint: form.noVence ? null : 'Cuándo vence este lote',
              },
              form.noVence
                ? h(
                    'div',
                    {
                      className:
                        'text-sm text-cg-text-muted py-2.5 px-3 rounded-md border border-cg-border bg-cg-bg-secondary',
                    },
                    'Sin vencimiento'
                  )
                : DateField
                  ? h(DateField as any, {
                      value: form.expirationDate,
                      onChange: (d: string) => setField('expirationDate', d),
                      placeholder: 'Elegí el vencimiento',
                    })
                  : h(UI.Input, {
                      type: 'date',
                      value: form.expirationDate,
                      onChange: (e: any) => setField('expirationDate', e.target.value),
                    } as any)
            ),
            h(
              FieldGroup,
              {
                label: 'Cantidad recibida',
                required: true,
                error: touched.has('quantity') && errors.quantity,
              },
              h(UI.Input, {
                type: 'number',
                min: 1,
                value: form.quantity,
                onChange: (e: any) => setField('quantity', e.target.value),
                onBlur: () => touch('quantity'),
                placeholder: 'Ej: 25',
                disabled: isEditing,
              } as any)
            )
          ),

          // Switch "no vence" — oculta el datepicker y guarda el lote sin vencimiento.
          h(
            'div',
            {
              className:
                'flex items-center justify-between rounded-lg border border-cg-border px-3 py-2.5',
            },
            h(
              'div',
              null,
              h('div', { className: 'text-sm font-medium text-cg-text' }, 'Este producto no vence'),
              h(
                'div',
                { className: 'text-xs text-cg-text-muted' },
                'Algunos insumos no tienen fecha de vencimiento.'
              )
            ),
            h(UI.Switch, {
              checked: form.noVence,
              onCheckedChange: (v: boolean) => {
                setField('noVence', v);
                if (v) setField('expirationDate', '');
              },
            } as any)
          ),

          // Aviso de lote vencido (no bloquea el guardado).
          expiredWarning &&
            h(
              'div',
              {
                className:
                  'flex items-start gap-2 rounded-lg border border-cg-warning-border bg-cg-warning-bg px-3 py-2.5 text-xs text-cg-warning-text leading-relaxed',
              },
              h(UI.DynamicIcon, {
                icon: 'TriangleAlert',
                size: 14,
                className: 'mt-0.5 shrink-0',
              } as any),
              h(
                'span',
                null,
                h('strong', null, 'Este lote está vencido.'),
                ' Igual lo podés guardar — queda registrado con estado "Vencido" y no se usará al consumir.'
              )
            ),

          isEditing &&
            h(
              'p',
              { className: 'text-xs text-cg-text-muted leading-relaxed' },
              'La cantidad no se edita acá para no descuadrar el stock. Para ajustarla, dá de baja el lote y cargá uno nuevo.'
            )
        ),

        // === Proveedor y notas ===
        h(
          UI.FormSection,
          { icon: 'FileText', title: 'Más datos' } as any,
          h(
            FieldGroup,
            {
              label: 'Proveedor',
              hint: hasSupplierMaster
                ? 'Sale del maestro de Proveedores (igual que en Compras).'
                : 'Opcional · de quién comprás el lote.',
            },
            hasSupplierMaster
              ? h(
                  UI.Combobox,
                  {
                    value: form.supplierId,
                    onValueChange: (v: string) => setField('supplierId', v),
                  } as any,
                  h(UI.ComboboxChipTrigger, {
                    placeholder: 'Buscar o crear proveedor',
                    renderChip: (val: string, onRemove: () => void) =>
                      h(
                        UI.Chip,
                        { size: 'sm', onRemove } as any,
                        suppliers.find((s) => s.id === val)?.name ?? val
                      ),
                  } as any),
                  h(
                    UI.ComboboxContent,
                    null,
                    ...suppliers.map((s) =>
                      h(UI.ComboboxItem, { key: s.id, value: s.id } as any, s.name)
                    ),
                    // Si lo que se escribe no existe, ofrece crearlo (mismo campo).
                    h(UI.ComboboxCreate, {
                      onCreate: (name: string) => void handleCreateSupplier(name),
                      label: 'Crear «{search}»',
                    } as any)
                  )
                )
              : h(UI.Input, {
                  value: form.supplier,
                  onChange: (e: any) => setField('supplier', e.target.value),
                  placeholder: 'Opcional · ej: Distribuidora X',
                } as any)
          ),
          h(
            FieldGroup,
            { label: 'Notas' },
            h(UI.Textarea, {
              value: form.notes,
              onChange: (e: any) => setField('notes', e.target.value),
              placeholder: 'Opcional · ej: lote refrigerado, comprado en…',
              rows: 2,
            } as any)
          )
        )
      );
    },
  } as any);
}
