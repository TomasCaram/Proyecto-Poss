import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Product, Promotion, PromotionProduct } from '../lib/types';
import { formatCurrency, getPromotionTypeLabel } from '../lib/utils';
import { Plus, Pencil, X, Save, ToggleLeft, ToggleRight, Tag } from 'lucide-react';

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);

  const [form, setForm] = useState({
    name: '',
    type: 'buy_x_get_y' as Promotion['type'],
    buy_quantity: '2',
    get_quantity: '1',
    discount_percent: '0',
    discount_fixed: '0',
    pack_price: '0',
    start_date: '',
    end_date: '',
    is_active: true,
    selectedProductIds: [] as string[],
  });

  const loadPromotions = useCallback(async () => {
    const { data } = await supabase
      .from('promotions')
      .select('*, promotion_products(product_id, products(name))')
      .order('created_at', { ascending: false });
    setPromotions(data ?? []);
  }, []);

  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name');
    setProducts(data ?? []);
  }, []);

  useEffect(() => { loadPromotions(); }, [loadPromotions]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const resetForm = () => {
    setForm({ name: '', type: 'buy_x_get_y', buy_quantity: '2', get_quantity: '1', discount_percent: '0', discount_fixed: '0', pack_price: '0', start_date: '', end_date: '', is_active: true, selectedProductIds: [] });
    setEditing(null);
    setShowForm(false);
  };

  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      name: p.name,
      type: p.type,
      buy_quantity: String(p.buy_quantity),
      get_quantity: String(p.get_quantity),
      discount_percent: String(p.discount_percent),
      discount_fixed: String(p.discount_fixed),
      pack_price: String(p.pack_price),
      start_date: p.start_date ?? '',
      end_date: p.end_date ?? '',
      is_active: p.is_active,
      selectedProductIds: p.promotion_products?.map((pp) => pp.product_id) ?? [],
    });
    setShowForm(true);
  };

  const toggleProduct = (id: string) => {
    setForm((prev) => ({
      ...prev,
      selectedProductIds: prev.selectedProductIds.includes(id)
        ? prev.selectedProductIds.filter((pid) => pid !== id)
        : [...prev.selectedProductIds, id],
    }));
  };

  const savePromotion = async () => {
    if (!form.name || form.selectedProductIds.length === 0) return;

    const payload = {
      name: form.name,
      type: form.type,
      buy_quantity: parseInt(form.buy_quantity) || 1,
      get_quantity: parseInt(form.get_quantity) || 0,
      discount_percent: parseFloat(form.discount_percent) || 0,
      discount_fixed: parseFloat(form.discount_fixed) || 0,
      pack_price: parseFloat(form.pack_price) || 0,
      is_active: form.is_active,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };

    let promoId: string;
    if (editing) {
      await supabase.from('promotions').update(payload).eq('id', editing.id);
      await supabase.from('promotion_products').delete().eq('promotion_id', editing.id);
      promoId = editing.id;
    } else {
      const { data } = await supabase.from('promotions').insert(payload).select('id').single();
      promoId = data.id;
    }

    const pp = form.selectedProductIds.map((pid) => ({ promotion_id: promoId, product_id: pid }));
    await supabase.from('promotion_products').insert(pp);
    resetForm();
    loadPromotions();
  };

  const toggleActive = async (p: Promotion) => {
    await supabase.from('promotions').update({ is_active: !p.is_active }).eq('id', p.id);
    loadPromotions();
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Promociones</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
          <Plus size={16} /> Nueva Promocion
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-slate-800">{editing ? 'Editar Promocion' : 'Nueva Promocion'}</h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nombre *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Tipo</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Promotion['type'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
                  <option value="buy_x_get_y">Lleva X paga Y (2x1, 3x2)</option>
                  <option value="quantity_discount">Descuento por cantidad</option>
                  <option value="combo">Combo de productos</option>
                  <option value="pack_price">Precio especial por pack</option>
                </select>
              </div>

              {form.type === 'buy_x_get_y' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Lleva</label>
                    <input type="number" value={form.buy_quantity} onChange={(e) => setForm({ ...form, buy_quantity: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Paga</label>
                    <input type="number" value={form.get_quantity} onChange={(e) => setForm({ ...form, get_quantity: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                  </div>
                </div>
              )}

              {form.type === 'quantity_discount' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Cantidad minima</label>
                    <input type="number" value={form.buy_quantity} onChange={(e) => setForm({ ...form, buy_quantity: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Descuento %</label>
                    <input type="number" step="0.01" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                  </div>
                </div>
              )}

              {form.type === 'pack_price' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Pack de</label>
                    <input type="number" value={form.buy_quantity} onChange={(e) => setForm({ ...form, buy_quantity: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Precio pack</label>
                    <input type="number" step="0.01" value={form.pack_price} onChange={(e) => setForm({ ...form, pack_price: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Fecha inicio</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Fecha fin</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Productos *</label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={form.selectedProductIds.includes(p.id)} onChange={() => toggleProduct(p.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className="text-sm text-slate-700">{p.name}</span>
                      <span className="text-xs text-slate-400 ml-auto">{formatCurrency(p.sale_price)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-sm text-slate-700">Activa</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button onClick={resetForm} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm">Cancelar</button>
                <button onClick={savePromotion} className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium flex items-center justify-center gap-2">
                  <Save size={16} /> Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {promotions.map((p) => (
          <div key={p.id} className={`bg-white rounded-xl border border-slate-200 p-4 ${!p.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Tag size={18} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-400">{getPromotionTypeLabel(p.type)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(p)} className="text-slate-400 hover:text-slate-600">
                  {p.is_active ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} className="text-slate-300" />}
                </button>
                <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600">
                  <Pencil size={14} />
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.promotion_products?.map((pp) => (
                <span key={pp.product_id} className="px-2 py-1 rounded-full bg-slate-100 text-xs text-slate-600">
                  {(pp as any).products?.name ?? pp.product_id}
                </span>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
              <span>Lleva {p.buy_quantity}</span>
              {p.type === 'buy_x_get_y' && <span>Paga {p.get_quantity}</span>}
              {p.type === 'quantity_discount' && <span>{p.discount_percent}% desc.</span>}
              {p.type === 'pack_price' && <span>A {formatCurrency(p.pack_price)}</span>}
              {p.start_date && <span>Desde {p.start_date}</span>}
              {p.end_date && <span>Hasta {p.end_date}</span>}
            </div>
          </div>
        ))}
        {promotions.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">No hay promociones configuradas</div>
        )}
      </div>
    </div>
  );
}
