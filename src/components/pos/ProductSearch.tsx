import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Product } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';
import { Search } from 'lucide-react';

interface ProductSearchProps {
  onAddProduct: (product: Product) => void;
  focusSignal?: number;
  onEnterEmpty?: () => void;
}

export default function ProductSearch({ onAddProduct, focusSignal, onEnterEmpty }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Foco automático al entrar a Ventas y cada vez que cambia focusSignal
  useEffect(() => {
    inputRef.current?.focus();
  }, [focusSignal]);

  const searchProducts = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from('products')
      .select('*, categories(*)')
      .eq('is_active', true)
      .or(`name.ilike.%${q}%,barcode.ilike.%${q}%`)
      .limit(12);
    setResults(data ?? []);
    setShowResults(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchProducts(query), 200);
    return () => clearTimeout(timer);
  }, [query, searchProducts]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addAndReset = (product: Product) => {
    onAddProduct(product);
    setQuery('');
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const q = query.trim();

    // Buscador vacío: abrir el cobro
    if (q === '') {
      onEnterEmpty?.();
      return;
    }

    // Código de barras exacto (lector): no espera a que carguen los resultados
    const { data: exact } = await supabase
      .from('products')
      .select('*, categories(*)')
      .eq('is_active', true)
      .eq('barcode', q)
      .limit(1);
    if (exact && exact.length === 1) {
      addAndReset(exact[0]);
      return;
    }

    // Si la búsqueda por nombre tiene un solo resultado, se agrega
    if (results.length === 1) {
      addAndReset(results[0]);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar producto o escanear codigo..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>
      {showResults && results.length > 0 && (
        <div
          ref={resultsRef}
          className="absolute top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-80 overflow-y-auto"
        >
          {results.map((product) => (
            <button
              key={product.id}
              onClick={() => addAndReset(product)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 transition-colors border-b border-slate-50 last:border-0"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-slate-800">{product.name}</p>
                <p className="text-xs text-slate-400">
                  {product.barcode ?? 'Sin codigo'} {product.categories ? `· ${product.categories.name}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-600">{formatCurrency(product.sale_price)}</p>
                <p className="text-xs text-slate-400">Stock: {product.stock}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}