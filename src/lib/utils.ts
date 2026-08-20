export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    debit: 'Tarjeta Debito',
    credit: 'Tarjeta Credito',
    transfer: 'Transferencia',
    mercadopago: 'Mercado Pago / QR',
    mixed: 'Pago Mixto',
  };
  return labels[method] ?? method;
}

export function getPromotionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    buy_x_get_y: 'Lleva X paga Y (2x1, 3x2)',
    quantity_discount: 'Descuento por cantidad',
    combo: 'Combo de productos',
    pack_price: 'Precio especial por pack',
  };
  return labels[type] ?? type;
}

export function getAdjustmentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    withdrawal: 'Retiro',
    income: 'Ingreso',
    correction: 'Correccion',
  };
  return labels[type] ?? type;
}
