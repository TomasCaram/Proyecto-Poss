import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Sale } from '../lib/types';
import { formatCurrency, formatDate, getPaymentMethodLabel } from '../lib/utils';
import { Search, Eye, RotateCcw, X } from 'lucide-react';

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const loadSales = useCallback(async () => {
    let query = supabase
      .from('sales')
      .select('*, sale_details(*), payments(*, mixed_payment_details(*))')
      .order('sale_date', { ascending: false })
      .limit(100);
    if (filterStatus) query = query.eq('status', filterStatus);
    const { data } = await query;
    setSales(data ?? []);
  }, [filterStatus]);

  useEffect(() => { loadSales(); }, [loadSales]);

  const filteredSales = search
    ? sales.filter((s) =>
        s.id.startsWith(search) ||
        s.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.sale_details?.some((d) => d.product_name.toLowerCase().includes(search.toLowerCase()))
      )
    : sales;

  const handleReturn = async (sale: Sale) => {
    if (!confirm('Confirma la devolucion de esta venta?')) return;
    await supabase.from('sales').update({ status: 'returned' }).eq('id', sale.id);
    // Restore stock
    for (const detail of sale.sale_details ?? []) {
      const { data: product } = await supabase.from('products').select('stock').eq('id', detail.product_id).single();
      if (product) {
        await supabase.from('products').update({ stock: product.stock + detail.quantity }).eq('id', detail.product_id);
      }
    }
    loadSales();
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Historial de Ventas</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto o ID..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
          <option value="">Todos los estados</option>
          <option value="completed">Completadas</option>
          <option value="cancelled">Canceladas</option>
          <option value="returned">Devueltas</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Productos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pago</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-25">
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(s.sale_date)}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-800">
                      {s.sale_details?.map((d) => d.product_name).join(', ') ?? '—'}
                    </p>
                    <p className="text-xs text-slate-400">{s.sale_details?.length ?? 0} items</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">{formatCurrency(s.total)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {s.payments?.map((p) => getPaymentMethodLabel(p.method)).join(', ') ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      s.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                      s.status === 'returned' ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {s.status === 'completed' ? 'Completada' : s.status === 'returned' ? 'Devuelta' : 'Cancelada'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setSelectedSale(s)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"><Eye size={14} /></button>
                      {s.status === 'completed' && (
                        <button onClick={() => handleReturn(s)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-amber-600"><RotateCcw size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">No hay ventas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-slate-800">Detalle de Venta</h3>
              <button onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Fecha</span>
                <span className="font-medium">{formatDate(selectedSale.sale_date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Estado</span>
                <span className="font-medium">{selectedSale.status}</span>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Productos</h4>
                {selectedSale.sale_details?.map((d) => (
                  <div key={d.id} className="flex justify-between py-1 text-sm">
                    <span className="text-slate-600">{d.product_name} x{d.quantity}</span>
                    <span className="font-medium">{formatCurrency(d.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span>{formatCurrency(selectedSale.subtotal)}</span>
                </div>
                {selectedSale.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Descuento</span>
                    <span>-{formatCurrency(selectedSale.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(selectedSale.total)}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Pagos</h4>
                {selectedSale.payments?.map((p) => (
                  <div key={p.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{getPaymentMethodLabel(p.method)}</span>
                      <span className="font-medium">{formatCurrency(p.amount)}</span>
                    </div>
                    {p.method === 'mixed' && p.mixed_payment_details?.map((d) => (
                      <div key={d.id} className="flex justify-between text-xs pl-4">
                        <span className="text-slate-400">{getPaymentMethodLabel(d.method)}</span>
                        <span>{formatCurrency(d.amount)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
