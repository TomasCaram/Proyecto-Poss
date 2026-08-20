import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Product } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';

interface QuickProductsProps {
  onAddProduct: (product: Product) => void;
}

export default function QuickProducts({ onAddProduct }: QuickProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    supabase
      .from('products')
      .select('*, categories(*)')
      .eq('is_active', true)
      .eq('is_quick_access', true)
      .order('name')
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  if (products.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Acceso rapido</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => onAddProduct(product)}
            className="bg-white rounded-xl p-3 border border-slate-100 hover:border-emerald-300 hover:shadow-md transition-all text-center group"
          >
            <p className="text-xs font-semibold text-slate-700 group-hover:text-emerald-700 truncate">{product.name}</p>
            <p className="text-sm font-bold text-emerald-600 mt-1">{formatCurrency(product.sale_price)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
