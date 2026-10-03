import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Product, Category } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import {
  Plus, Pencil, Search, Package, X, Save, Star, ToggleLeft, ToggleRight,
} from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [tab, setTab] = useState<'products' | 'categories'>('products');

  // Form state
  const [form, setForm] = useState({
    name: '', barcode: '', category_id: '', sale_price: '', cost_price: '',
    stock: '', image_url: '', is_quick_access: false, is_active: true,
  });
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const loadProducts = useCallback(async () => {
    let query = supabase
      .from('products')
      .select('*, categories(*)')
      .order('name');
    if (search) query = query.or(`name.ilike.%${search}%,barcode.ilike.%${search}%`);
    if (filterCategory) query = query.eq('category_id', filterCategory);
    const { data } = await query;
    setProducts(data ?? []);
  }, [search, filterCategory]);

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
    setCategories(data ?? []);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  const resetForm = () => {
    setForm({ name: '', barcode: '', category_id: '', sale_price: '', cost_price: '', stock: '', image_url: '', is_quick_access: false, is_active: true });
    setEditing(null);
    setShowForm(false);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, barcode: p.barcode ?? '', category_id: p.category_id ?? '',
      sale_price: String(p.sale_price), cost_price: String(p.cost_price),
      stock: String(p.stock), image_url: p.image_url ?? '',
      is_quick_access: p.is_quick_access, is_active: p.is_active,
    });
    setShowForm(true);
  };

  const saveProduct = async () => {
    if (!form.name || !form.sale_price) return;
    const payload = {
      name: form.name,
      barcode: form.barcode || null,
      category_id: form.category_id || null,
      sale_price: parseFloat(form.sale_price) || 0,
      cost_price: parseFloat(form.cost_price) || 0,
      stock: parseInt(form.stock) || 0,
      image_url: form.image_url || null,
      is_quick_access: form.is_quick_access,
      is_active: form.is_active,
    };
    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('products').insert(payload);
    }
    resetForm();
    loadProducts();
  };

  const toggleProductActive = async (p: Product) => {
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
    loadProducts();
  };

  const resetCatForm = () => { setCatForm({ name: '', description: '' }); setEditingCat(null); };

  const openEditCat = (c: Category) => {
    setEditingCat(c);
    setCatForm({ name: c.name, description: c.description ?? '' });
  };

  const saveCategory = async () => {
    if (!catForm.name) return;
    if (editingCat) {
      await supabase.from('categories').update({ name: catForm.name, description: catForm.description || null }).eq('id', editingCat.id);
    } else {
      await supabase.from('categories').insert({ name: catForm.name, description: catForm.description || null });
    }
    resetCatForm();
    loadCategories();
  };

  const toggleCategoryActive = async (c: Category) => {
    await supabase.from('categories').update({ is_active: !c.is_active }).eq('id', c.id);
    loadCategories();
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Gestion de Productos</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {(['products', 'categories'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'products' ? 'Productos' : 'Categorias'}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <>
          {/* Search & filter */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="">Todas las categorias</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Plus size={16} /> Nuevo
            </button>
          </div>

          {/* Product form modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b">
                  <h3 className="text-lg font-bold text-slate-800">{editing ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                  <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Nombre *</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Codigo de barras</label>
                    <input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Categoria</label>
                    <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
                      <option value="">Sin categoria</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">Precio venta *</label>
                      <input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">Costo</label>
                      <input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">Stock</label>
                      <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1">URL imagen</label>
                      <input type="text" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.is_quick_access} onChange={(e) => setForm({ ...form, is_quick_access: e.target.checked })}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className="text-sm text-slate-700">Acceso rapido</span>
                      <Star size={14} className="text-amber-400" />
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className="text-sm text-slate-700">Activo</span>
                    </label>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={resetForm} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
                    <button onClick={saveProduct} className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-2">
                      <Save size={16} /> Guardar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Products table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Producto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Categoria</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Precio</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Costo</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Stock</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Rapido</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className={`border-b border-slate-50 hover:bg-slate-25 ${!p.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package size={16} className="text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.barcode ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{p.categories?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-600 text-right">{formatCurrency(p.sale_price)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 text-right">{formatCurrency(p.cost_price)}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`font-medium ${p.stock <= 5 ? 'text-red-500' : 'text-slate-700'}`}>{p.stock}</span>
                      </td>
                      <td className="px-4 py-3 text-center">{p.is_quick_access ? <Star size={14} className="text-amber-400 mx-auto" /> : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleProductActive(p)} className="text-slate-400 hover:text-slate-600">
                          {p.is_active ? <ToggleRight size={20} className="text-emerald-500 mx-auto" /> : <ToggleLeft size={20} className="text-slate-300 mx-auto" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"><Pencil size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">No hay productos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'categories' && (
        <>
          <div className="flex gap-3 mb-4">
            <div className="flex-1" />
            <button
              onClick={() => { resetCatForm(); setEditingCat(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              <Plus size={16} /> Nueva Categoria
            </button>
          </div>

          {/* Category form */}
          {editingCat !== null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Editar Categoria</h3>
                <input type="text" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="Nombre" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                <input type="text" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  placeholder="Descripcion" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                <div className="flex gap-3">
                  <button onClick={resetCatForm} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm">Cancelar</button>
                  <button onClick={saveCategory} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm">Guardar</button>
                </div>
              </div>
            </div>
          )}

          {!editingCat && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <div className="flex gap-3">
                <input type="text" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="Nombre de la categoria" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                <input type="text" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  placeholder="Descripcion (opcional)" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                <button onClick={saveCategory} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-2">
            {categories.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.description ?? 'Sin descripcion'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleCategoryActive(c)} className="text-slate-400 hover:text-slate-600">
                    {c.is_active ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} className="text-slate-300" />}
                  </button>
                  <button onClick={() => openEditCat(c)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600">
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
