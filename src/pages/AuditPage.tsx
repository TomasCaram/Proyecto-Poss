import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { AuditLog } from '../lib/types';
import { formatDate } from '../lib/utils';
import { ShieldCheck, Search } from 'lucide-react';

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
    if (entityFilter) query = query.eq('entity_type', entityFilter);
    query.then(({ data }) => setLogs(data ?? []));
  }, [entityFilter]);

  const filtered = filter
    ? logs.filter((l) => l.action.toLowerCase().includes(filter.toLowerCase()) || l.entity_type.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  const actionColors: Record<string, string> = {
    INSERT: 'bg-emerald-50 text-emerald-700',
    UPDATE: 'bg-blue-50 text-blue-700',
    DELETE: 'bg-red-50 text-red-700',
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        <ShieldCheck size={24} className="inline mr-2" />Auditoria
      </h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" />
        </div>
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
          <option value="">Todas las entidades</option>
          <option value="products">Productos</option>
          <option value="categories">Categorias</option>
          <option value="promotions">Promociones</option>
          <option value="sales">Ventas</option>
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map((log) => (
          <div key={log.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[log.action] ?? 'bg-slate-50 text-slate-600'}`}>
                  {log.action}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-600">{log.entity_type}</span>
              </div>
              <p className="text-xs text-slate-400">{log.entity_id ?? '—'}</p>
              {log.details && (
                <p className="text-xs text-slate-400 mt-1 truncate">{JSON.stringify(log.details).slice(0, 100)}</p>
              )}
            </div>
            <p className="text-xs text-slate-400 whitespace-nowrap ml-4">{formatDate(log.created_at)}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">Sin registros</div>
        )}
      </div>
    </div>
  );
}
