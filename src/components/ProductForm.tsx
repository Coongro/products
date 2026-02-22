import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

import type { ProductFormProps } from '../types/components.js';
import type { ProductCreateData } from '../types/domain.js';

import { CategoryPicker } from './CategoryPicker.js';

const React = getHostReact();
const { useState, useCallback, useEffect } = React;

const SECTION_BASIC = [
  { key: 'name', label: 'Nombre', type: 'text', required: true },
  { key: 'description', label: 'Descripción', type: 'textarea' },
  { key: 'sku', label: 'SKU', type: 'text' },
  { key: 'barcode', label: 'Código de barras', type: 'text' },
  { key: 'unit', label: 'Unidad', type: 'text', placeholder: 'ej: kg, unidades, litros' },
];

const SECTION_PRICING = [
  { key: 'purchase_price', label: 'Precio de compra', type: 'number', placeholder: '$0.00' },
  { key: 'sale_price', label: 'Precio de venta', type: 'number', placeholder: '$0.00' },
  { key: 'tax_rate', label: 'Tasa de impuesto (%)', type: 'number', placeholder: '$0.00' },
];

const SECTION_INVENTORY = [
  { key: 'stock_minimum', label: 'Stock mínimo', type: 'number' },
  { key: 'image_url', label: 'URL de imagen', type: 'text' },
];

export function ProductForm(props: ProductFormProps) {
  const {
    product,
    extraFields = [],
    hiddenFields = [],
    defaults = {},
    onSubmit,
    onCancel,
    onExtraFieldsData,
    loading = false,
  } = props;

  const UI = getHostUI();
  const isEdit = !!product;

  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    if (product) {
      return { ...product };
    }
    return { name: '', is_active: true, ...defaults };
  });

  const [extraData, setExtraData] = useState<Record<string, unknown>>({});
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({ ...product });
    }
  }, [product]);

  const handleChange = useCallback((key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleExtraChange = useCallback(
    (key: string, value: unknown) => {
      setExtraData((prev) => {
        const next = { ...prev, [key]: value };
        onExtraFieldsData?.(next);
        return next;
      });
    },
    [onExtraFieldsData]
  );

  const handleSubmit = useCallback(
    (e: { preventDefault: () => void }) => {
      e.preventDefault();
      setAttempted(true);

      if (!formData.name) {
        return;
      }

      const data: ProductCreateData = {
        name: String(formData.name || ''),
        description: formData.description as string | undefined,
        category_id: formData.category_id as string | undefined,
        sku: formData.sku as string | undefined,
        barcode: formData.barcode as string | undefined,
        unit: formData.unit as string | undefined,
        purchase_price:
          formData.purchase_price !== null && formData.purchase_price !== undefined
            ? String(formData.purchase_price)
            : undefined,
        sale_price:
          formData.sale_price !== null && formData.sale_price !== undefined
            ? String(formData.sale_price)
            : undefined,
        tax_rate:
          formData.tax_rate !== null && formData.tax_rate !== undefined
            ? String(formData.tax_rate)
            : undefined,
        stock_minimum:
          formData.stock_minimum !== null && formData.stock_minimum !== undefined
            ? String(formData.stock_minimum)
            : undefined,
        image_url: formData.image_url as string | undefined,
        is_active: formData.is_active !== false,
      };
      onSubmit?.(data, Object.keys(extraData).length > 0 ? extraData : undefined);
    },
    [formData, extraData, onSubmit]
  );

  const hiddenSet = new Set(hiddenFields);

  const nameHasError = attempted && !formData.name;

  function renderField(
    field: { key: string; label: string; type: string; required?: boolean; placeholder?: string },
    value: unknown,
    onChange: (key: string, value: unknown) => void
  ) {
    const fieldKey = field.key;
    const isPrice = SECTION_PRICING.some((f) => f.key === fieldKey);
    const hasValidationError = fieldKey === 'name' && nameHasError;

    const labelEl = React.createElement(
      UI.Label,
      { key: 'label' },
      field.label,
      field.required && React.createElement('span', { className: 'text-cg-danger ml-0.5' }, '*')
    );

    if (field.type === 'textarea') {
      return React.createElement(
        'div',
        { key: fieldKey, className: 'flex flex-col gap-1.5' },
        labelEl,
        React.createElement(UI.Textarea, {
          value: (value as string) ?? '',
          onChange: (e: { target: { value: string } }) => onChange(fieldKey, e.target.value),
          placeholder: field.placeholder,
          rows: 3,
        })
      );
    }

    const children: React.ReactNode[] = [
      labelEl,
      React.createElement(UI.Input, {
        key: 'input',
        type: field.type === 'number' ? 'number' : 'text',
        value: (value as string) ?? '',
        onChange: (e: { target: { value: string } }) => onChange(fieldKey, e.target.value),
        placeholder: field.placeholder,
        required: field.required,
        step: isPrice ? '0.01' : field.type === 'number' ? 'any' : undefined,
        className: hasValidationError ? 'border-cg-danger' : '',
      }),
    ];

    if (hasValidationError) {
      children.push(
        React.createElement(
          'span',
          { key: 'error', className: 'text-xs text-cg-danger' },
          'El nombre es obligatorio'
        )
      );
    }

    return React.createElement('div', { key: fieldKey, className: 'flex flex-col gap-1.5' }, ...children);
  }

  const visibleBasic = SECTION_BASIC.filter((f) => !hiddenSet.has(f.key));
  const visiblePricing = SECTION_PRICING.filter((f) => !hiddenSet.has(f.key));
  const visibleInventory = SECTION_INVENTORY.filter((f) => !hiddenSet.has(f.key));

  const showCategory = !hiddenSet.has('category_id');
  const showIsActive = !hiddenSet.has('is_active');

  function renderSectionHeader(title: string) {
    return React.createElement(
      'h3',
      { className: 'text-sm font-medium text-cg-text-muted uppercase tracking-wider' },
      title
    );
  }

  function renderToggleSwitch() {
    const isActive = formData.is_active !== false;

    return React.createElement(
      'div',
      { className: 'flex items-center gap-3' },
      React.createElement(UI.Switch, {
        checked: isActive,
        onCheckedChange: (checked: boolean) => handleChange('is_active', checked),
      }),
      React.createElement('span', { className: 'text-sm text-cg-text' }, 'Producto activo')
    );
  }

  const formChildren: React.ReactNode[] = [];

  // --- Sección: Información básica ---
  if (visibleBasic.length > 0 || showCategory) {
    const sectionItems: React.ReactNode[] = [renderSectionHeader('Información básica')];
    visibleBasic.forEach((field) => {
      sectionItems.push(renderField(field, formData[field.key], handleChange));
    });
    if (showCategory) {
      sectionItems.push(
        React.createElement(
          'div',
          { key: 'category_id', className: 'flex flex-col gap-1.5' },
          React.createElement(UI.Label, null, 'Categoría'),
          React.createElement(CategoryPicker, {
            value: formData.category_id as string | null,
            onChange: (val: string | null) => handleChange('category_id', val),
            allowCreate: true,
            treeMode: true,
          })
        )
      );
    }
    formChildren.push(
      React.createElement('div', { key: 'section-basic', className: 'space-y-3' }, ...sectionItems)
    );
  }

  // --- Sección: Precios ---
  if (visiblePricing.length > 0) {
    const sectionItems: React.ReactNode[] = [renderSectionHeader('Precios')];
    visiblePricing.forEach((field) => {
      sectionItems.push(renderField(field, formData[field.key], handleChange));
    });
    formChildren.push(
      React.createElement('div', { key: 'section-pricing', className: 'space-y-3' }, ...sectionItems)
    );
  }

  // --- Sección: Inventario ---
  if (visibleInventory.length > 0) {
    const sectionItems: React.ReactNode[] = [renderSectionHeader('Inventario')];
    visibleInventory.forEach((field) => {
      sectionItems.push(renderField(field, formData[field.key], handleChange));
    });
    formChildren.push(
      React.createElement('div', { key: 'section-inventory', className: 'space-y-3' }, ...sectionItems)
    );
  }

  // --- Toggle de activo ---
  if (showIsActive) {
    formChildren.push(
      React.createElement('div', { key: 'toggle-active', className: 'pt-1' }, renderToggleSwitch())
    );
  }

  // --- Campos extra de bloques ---
  if (extraFields.length > 0) {
    extraFields.forEach((field) => {
      formChildren.push(
        renderField(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          field as any,
          extraData[field.key],
          handleExtraChange
        )
      );
    });
  }

  // --- Botones ---
  formChildren.push(
    React.createElement(
      'div',
      { key: 'buttons', className: 'flex gap-3 pt-2' },
      React.createElement(
        UI.Button,
        { type: 'submit', disabled: loading },
        loading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear producto'
      ),
      onCancel &&
        React.createElement(
          UI.Button,
          { type: 'button', variant: 'outline', onClick: onCancel },
          'Cancelar'
        )
    )
  );

  return React.createElement(
    'form',
    { onSubmit: handleSubmit, className: 'flex flex-col gap-6' },
    ...formChildren
  );
}
