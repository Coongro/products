/**
 * Contrato de la vista genérica de Lotes (BatchesView).
 *
 * El motor de lotes (`products.batches` / `module_products_batches`) es genérico:
 * no sabe qué es una vacuna ni un medicamento. El "tipo" de un lote es una
 * propiedad del PRODUCTO, y vive en los plugins que lo extienden (vaccination,
 * vet-pharmacy, ...). Para no acoplar products a ningún kit, la vista descubre
 * los tipos por INYECCIÓN: el integrador (un kit) le pasa un clasificador por
 * cada tipo, y cada clasificador sabe qué product_ids le pertenecen.
 *
 * Así products queda 100% reusable: otro kit monta la misma BatchesView con sus
 * propios clasificadores (perecederos, insumos, etc.) sin tocar este paquete.
 */
export interface BatchClassifier {
  /** Identificador opaco del tipo, ej. 'vaccine' | 'medication'. Único entre clasificadores. */
  kind: string;
  /** Etiqueta visible del tipo, ej. 'Vacunas'. */
  label: string;
  /** Nombre de icono Lucide para el chip de tipo (opcional). */
  icon?: string;
  /** Color (hex) del chip de tipo, ej. '#0f766e'. El fondo se deriva con alpha. */
  color?: string;
  /**
   * Resuelve los product_ids que pertenecen a este tipo. Se invoca al cargar la
   * vista; un fallo se trata como "sin productos de este tipo" (no rompe el resto).
   */
  listProductIds: () => Promise<string[]>;
}

export interface BatchesViewProps {
  /** Clasificadores de tipo inyectados por el integrador. El orden define el de los filtros. */
  classifiers: BatchClassifier[];
  /** Título de la vista. Default: 'Lotes'. */
  title?: string;
  /** Subtítulo opcional bajo el título. */
  subtitle?: string;
  /**
   * Etiqueta de la acción de alta manual de lote (botones de header/grupo/empty state y
   * título del diálogo). Default: 'Cargar lote'. Un kit donde el alta manual NO es la vía
   * principal de abastecimiento (la compra va por otro flujo) puede matizarla, ej.
   * 'Ingreso manual'. Solo cambia el texto: la acción sigue siendo el alta de lote.
   */
  createLabel?: string;
  /**
   * Aviso opcional arriba del formulario de alta manual (no en edición), para encauzar al
   * usuario al flujo correcto cuando el alta de lote no es la vía principal de abastecimiento.
   * products es genérico y no sabe de "compras": el kit provee el texto y, opcionalmente, un
   * destino de navegación (ej. el drawer de Compra de purchases), que se abre con views.open.
   */
  createHint?: {
    /** Título del aviso, ej. '¿Estás registrando una compra?'. Opcional. */
    title?: string;
    /** Cuerpo del aviso: cuándo usar cada flujo. */
    description: string;
    /** Botón que navega a otra vista (ej. abrir el drawer de Compra). Opcional. */
    action?: { label: string; viewId: string; params?: Record<string, unknown> };
  };
  /**
   * Resuelve el nombre del proveedor por id, para el origen del lote en el detalle
   * (inyectado por el integrador; ej. purchases.suppliers). Opcional.
   */
  resolveSupplier?: (supplierId: string) => string | undefined;
  /**
   * Humaniza una salida de stock (a qué se usó: paciente, receta…) en el detalle de
   * trazabilidad. Inyectado por el kit, que conoce vaccination/vet-pharmacy. Opcional.
   */
  resolveReference?: (
    referenceType: string | null,
    referenceId: string | null
  ) => import('../components/BatchDetail.js').BatchRefInfo;
  /**
   * Línea extra bajo el nº de lote en el detalle (ej. "Frasco 100ml · Holliday").
   * La provee el kit, que conoce la presentación/laboratorio del producto. Opcional.
   */
  resolveProductSubtitle?: (productId: string) => string | undefined;
  /**
   * A dónde lleva el "origen" del lote (la salida/compra de la que vino). products guarda
   * el vínculo como metadata opaca; el kit, que conoce las vistas, decide el destino. Opcional.
   */
  resolveOriginLink?: (meta: {
    sourceType?: string;
    sourceAccountId?: string;
  }) => { label: string; viewId: string; params?: Record<string, unknown> } | undefined;
  /**
   * Componente de fecha inyectado (ej. el DatePicker de @coongro/calendar) para el form
   * de alta/edición. Si no viene, el form usa el input de fecha nativo. Opcional.
   */
  DateField?: import('../components/BatchFormDialog.js').DateFieldComponent;
  /**
   * Producto por el que filtrar al abrir (deep-link desde la ficha del catálogo:
   * "Gestionar en Lotes y stock"). Filtra por ese producto y muestra todos sus estados.
   */
  productFilterParam?: string;
}
