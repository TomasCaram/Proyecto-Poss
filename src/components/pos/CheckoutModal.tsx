import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { CartItem, Payment, MixedPaymentDetail } from '../../lib/types';
import { formatCurrency, getPaymentMethodLabel } from '../../lib/utils';
import { X, CreditCard, Banknote, Smartphone, ArrowRightLeft, CheckCircle } from 'lucide-react';

interface CheckoutModalProps {
  cart: CartItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  onClose: () => void;
  onComplete: () => void;
}

interface MixedEntry {
  method: string;
  amount: string;
}

export default function CheckoutModal({ cart, subtotal, discountAmount, total, onClose, onComplete }: CheckoutModalProps) {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [reference, setReference] = useState('');
  const [mixedEntries, setMixedEntries] = useState<MixedEntry[]>([
    { method: 'cash', amount: '' },
  ]);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const change = paymentMethod === 'cash'
    ? Math.max(0, (parseFloat(cashReceived) || 0) - total)
    : 0;

  const mixedTotal = mixedEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const mixedRemaining = Math.max(0, total - mixedTotal);
  const mixedValid = Math.abs(mixedTotal - total) < 0.01;

  const addMixedEntry = () => {
    setMixedEntries([...mixedEntries, { method: 'debit', amount: '' }]);
  };

  const removeMixedEntry = (index: number) => {
    setMixedEntries(mixedEntries.filter((_, i) => i !== index));
  };

  const updateMixedEntry = (index: number, field: 'method' | 'amount', value: string) => {
    const updated = [...mixedEntries];
    updated[index] = { ...updated[index], [field]: value };
    setMixedEntries(updated);
  };

  const handleCheckout = useCallback(async () => {
    if (processing) return;
    if (paymentMethod === 'cash' && (parseFloat(cashReceived) || 0) < total) return;
    if (paymentMethod === 'mixed' && !mixedValid) return;

    setProcessing(true);
    try {
      // Get open cash register
      const { data: openRegister } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .single();

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          user_id: user!.id,
          cash_register_id: openRegister?.id ?? null,
          subtotal,
          discount_amount: discountAmount,
          total,
          status: 'completed',
        })
        .select()
        .single();

      if (saleError || !sale) throw saleError;

      // Create sale details
      const details = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        subtotal: item.subtotal,
        promotion_id: item.promotion_id,
      }));
      await supabase.from('sale_details').insert(details);

      // Update stock
      for (const item of cart) {
        await supabase
          .from('products')
          .update({ stock: item.product.stock - item.quantity })
          .eq('id', item.product.id);
      }

      // Create payments
      if (paymentMethod === 'mixed') {
        const { data: payment } = await supabase
          .from('payments')
          .insert({
            sale_id: sale.id,
            method: 'mixed',
            amount: total,
          })
          .select()
          .single();

        if (payment) {
          const mixedDetails = mixedEntries
            .filter((e) => parseFloat(e.amount) > 0)
            .map((e) => ({
              payment_id: payment.id,
              method: e.method,
              amount: parseFloat(e.amount),
              reference: null,
            }));
          await supabase.from('mixed_payment_details').insert(mixedDetails);
        }
      } else {
        await supabase.from('payments').insert({
          sale_id: sale.id,
          method: paymentMethod,
          amount: total,
          reference: reference || null,
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Error al procesar la venta. Intente nuevamente.');
    } finally {
      setProcessing(false);
    }
  }, [processing, paymentMethod, cashReceived, mixedValid, cart, subtotal, discountAmount, total, user, mixedEntries, reference, onComplete]);

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm mx-4">
          <CheckCircle size={64} className="text-emerald-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800">Venta completada</h3>
          <p className="text-sm text-slate-500 mt-2">{formatCurrency(total)}</p>
        </div>
      </div>
    );
  }

  const paymentMethods = [
    { id: 'cash', label: 'Efectivo', icon: Banknote },
    { id: 'debit', label: 'Debito', icon: CreditCard },
    { id: 'credit', label: 'Credito', icon: CreditCard },
    { id: 'transfer', label: 'Transferencia', icon: ArrowRightLeft },
    { id: 'mercadopago', label: 'Mercado Pago', icon: Smartphone },
    { id: 'mixed', label: 'Mixto', icon: ArrowRightLeft },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Cobrar</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Total */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>Descuento</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-slate-900 pt-2 border-t border-slate-200 mt-2">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment methods */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Medio de pago</label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPaymentMethod(id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-medium transition-all ${
                    paymentMethod === id
                      ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-700'
                      : 'bg-slate-50 border-2 border-transparent text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Cash received */}
          {paymentMethod === 'cash' && (
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Monto recibido</label>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-lg font-bold focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                autoFocus
              />
              {(parseFloat(cashReceived) || 0) >= total && (
                <div className="mt-3 bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-sm text-emerald-600">Vuelto</p>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(change)}</p>
                </div>
              )}
            </div>
          )}

          {/* Reference for card/transfer */}
          {['debit', 'credit', 'transfer', 'mercadopago'].includes(paymentMethod) && (
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Referencia (opcional)</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Nro autorizacion / referencia"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Mixed payment */}
          {paymentMethod === 'mixed' && (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700 block">Desglose de pagos</label>
              {mixedEntries.map((entry, index) => (
                <div key={index} className="flex gap-2">
                  <select
                    value={entry.method}
                    onChange={(e) => updateMixedEntry(index, 'method', e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="debit">Debito</option>
                    <option value="credit">Credito</option>
                    <option value="transfer">Transferencia</option>
                    <option value="mercadopago">Mercado Pago</option>
                  </select>
                  <input
                    type="number"
                    value={entry.amount}
                    onChange={(e) => updateMixedEntry(index, 'amount', e.target.value)}
                    placeholder="Monto"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                  {mixedEntries.length > 1 && (
                    <button onClick={() => removeMixedEntry(index)} className="text-red-400 hover:text-red-600 p-1">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addMixedEntry}
                className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
              >
                + Agregar otro medio
              </button>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="flex justify-between text-sm">
                  <span>Restante</span>
                  <span className={mixedRemaining <= 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                    {formatCurrency(mixedRemaining)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleCheckout}
            disabled={
              processing ||
              (paymentMethod === 'cash' && (parseFloat(cashReceived) || 0) < total) ||
              (paymentMethod === 'mixed' && !mixedValid)
            }
            className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
              processing
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg'
            }`}
          >
            {processing ? 'Procesando...' : `Confirmar cobro - ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
