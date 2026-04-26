/**
 * Boton para crear producto. Abre un FormDialogSubmit con ProductForm.
 * Usa useProductMutations para la creacion y muestra toast de exito.
 */
import { getHostReact, getHostUI } from '@coongro/plugin-sdk';

import { useProductMutations } from '../hooks/useProductMutations.js';
import type { CreateProductButtonProps } from '../types/components.js';
import type { ProductCreateData } from '../types/domain.js';

import { ProductForm } from './ProductForm.js';

const React = getHostReact();
const { useState, useCallback } = React;

export function CreateProductButton(props: CreateProductButtonProps) {
  const {
    defaults = {},
    label = 'Nuevo producto',
    extraFields = [],
    hiddenFields = [],
    onSuccess,
    variant = 'primary',
    className = '',
  } = props;

  const UI = getHostUI();
  const [open, setOpen] = useState(false);
  const { create, creating } = useProductMutations();

  const handleSubmit = useCallback(
    async (data: ProductCreateData) => {
      const product = await create(data);
      if (product) {
        setOpen(false);
        onSuccess?.(product);
      }
    },
    [create, onSuccess]
  );

  const isPrimary = variant === 'primary';

  return React.createElement(
    React.Fragment,
    null,

    // Boton
    React.createElement(
      UI.Button,
      {
        type: 'button',
        variant: isPrimary ? 'default' : 'outline',
        onClick: () => setOpen(true),
        className,
      },
      React.createElement(UI.DynamicIcon, { icon: 'Plus', size: 16 }),
      label
    ),

    // FormDialogSubmit con footer sticky
    React.createElement(UI.FormDialogSubmit, {
      open,
      onOpenChange: setOpen,
      title: label,
      size: 'lg',
      submitLabel: 'Crear producto',
      onCancel: () => setOpen(false),
      disabled: creating,
      children: ({ formRef }: { formRef: React.RefObject<HTMLFormElement> }) =>
        React.createElement(ProductForm, {
          defaults,
          extraFields,
          hiddenFields,
          loading: creating,
          formRef,
          hideActions: true,
          onSubmit: (data) => {
            void handleSubmit(data as ProductCreateData);
          },
        }),
    })
  );
}
