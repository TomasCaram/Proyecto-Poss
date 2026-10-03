import { useState, useCallback } from 'react';
import type { CartItem } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';
import { Plus, Minus, Trash2, Percent, DollarSign } from 'lucide-react';

interface CartPanelProps {
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  onCheckout: () => void;
  globalDiscount: number;
  setGlobalDiscount: (v: number) => void;
}

export default function CartPanel({ cart, setCart, onCheckout, globalDiscount, setGlobalDiscount }: CartPanelProps) {
  const [discountType, setDiscountType] = useState<'percent' | 'fixed' | null>(null);
  const [discountValue, setDiscountValue] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const total = Math.max(0, subtotal - globalDiscount);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(
      cart.map((item) => {
        if (item.product.id === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty, subtotal: newQty * item.unit_price - item.discount_amount };
        }
        return item;
      })
    );
  }, [cart, setCart]);

  const removeItem = useCallback((productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  }, [cart, setCart]);

  const applyDiscount = () => {
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) return;
    if (discountType === 'percent') {
      setGlobalDiscount(subtotal * (val / 100));
    } else {
      setGlobalDiscount(Math.min(val, subtotal));
    }
    setDiscountType(null);
    setDiscountValue('');
  };

  const clearDiscount = () => {
    setGlobalDiscount(0);
  };

  const canCheckout = cart.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-200 bg-white">
        <h2 className="text-lg font-bold text-slate-800">Carrito</h2>
        <p className="text-xs text-slate-500">{cart.length} productos</p>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">Carrito vacio</p>
            <p className="text-xs mt-1">Agregue productos para comenzar</p>
          </div>
        )}
        {cart.map((item) => (
          <div key={item.product.id} className="bg-white rounded-lg p-3 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{item.product.name}</p>
                <p className="text-xs text-slate-500">{formatCurrency(item.unit_price)} c/u</p>
                {item.discount_amount > 0 && (
                  <p className="text-xs text-red-500">Desc: -{formatCurrency(item.discount_amount)}</p>
                )}
              </div>
              <button
                onClick={() => removeItem(item.product.id)}
                className="text-red-400 hover:text-red-600 p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQuantity(item.product.id, -1)}
                  className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.product.id, 1)}
                  className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                >
                  <Plus size={14} />
                </button>
              </div>
              <span className="font-bold text-sm text-slate-800">{formatCurrency(item.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Discount buttons */}
      <div className="px-3 py-2 border-t border-slate-200 bg-white space-y-2">
        {discountType === null ? (
          <div className="flex gap-2">
            <button
              onClick={() => setDiscountType('percent')}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
            >
              <Percent size={14} /> Descuento %
            </button>
            <button
              onClick={() => setDiscountType('fixed')}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
            >
              <DollarSign size={14} /> Descuento fijo
            </button>
            {globalDiscount > 0 && (
              <button
                onClick={clearDiscount}
                className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
              >
                Quitar
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percent' ? '%' : '$'}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && applyDiscount()}
            />
            <button
              onClick={applyDiscount}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              Aplicar
            </button>
            <button
              onClick={() => { setDiscountType(null); setDiscountValue(''); }}
              className="px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 transition-colors"
            >
              X
            </button>
          </div>
        )}
      </div>

      {/* Totals & checkout */}
      <div className="px-4 py-3 bg-white border-t border-slate-200 space-y-2">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {globalDiscount > 0 && (
          <div className="flex justify-between text-sm text-red-500">
            <span>Descuento</span>
            <span>-{formatCurrency(globalDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold text-slate-900 pt-1 border-t border-slate-200">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
        <button
          onClick={onCheckout}
          disabled={!canCheckout}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
            canCheckout
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          Cobrar
        </button>
      </div>
    </div>
  );
}
