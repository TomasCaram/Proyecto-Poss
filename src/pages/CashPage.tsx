import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { CashRegister, CashMovement } from '../lib/types';
import { formatCurrency, formatDate } from '../lib/utils';
import {
  DollarSign, Plus, Minus, Lock, Unlock, TrendingUp, TrendingDown,
  X, History, CheckCircle,
} from 'lucide-react';

export default function CashPage() {
  const { user } = useAuth();
  const [openRegister, setOpenRegister] = useState<CashRegister | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [closings, setClosings] = useState<CashRegister[]>([]);
  const [tab, setTab] = useState<'current' | 'history'>('current');

  // Open register form
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');

  // Movement form
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementType, setMovementType] = useState<'income' | 'expense'>('income');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDesc, setMovementDesc] = useState('');

  // Close register form
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [countedAmount, setCountedAmount] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const loadCurrentRegister = useCallback(async () => {
    const { data } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setOpenRegister(data);
  }, []);

  const loadMovements = useCallback(async () => {
    if (!openRegister) return;
    const { data } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('cash_register_id', openRegister.id)
      .order('created_at', { ascending: false });
    setMovements(data ?? []);
  }, [openRegister]);

  const loadClosings = useCallback(async () => {
    const { data } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(30);
    setClosings(data ?? []);
  }, []);

  useEffect(() => { loadCurrentRegister(); }, [loadCurrentRegister]);
  useEffect(() => { loadMovements(); }, [loadMovements]);
  useEffect(() => { loadClosings(); }, [loadClosings]);

  const handleOpenRegister = async () => {
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) return;
    await supabase.from('cash_registers').insert({
      user_id: user!.id,
      opening_amount: amount,
      status: 'open',
    });
    setShowOpenForm(false);
    setOpeningAmount('');
    loadCurrentRegister();
  };

  const handleAddMovement = async () => {
    const amount = parseFloat(movementAmount);
    if (isNaN(amount) || amount <= 0 || !movementDesc) return;
    await supabase.from('cash_movements').insert({
      cash_register_id: openRegister!.id,
      user_id: user!.id,
      type: movementType,
      amount,
      description: movementDesc,
    });
    setShowMovementForm(false);
    setMovementAmount('');
    setMovementDesc('');
    loadMovements();
  };

  const handleCloseRegister = async () => {
    const counted = parseFloat(countedAmount);
    if (isNaN(counted) || !openRegister) return;

    // Calculate expected cash
    const { data: cashPayments } = await supabase
      .from('sales')
      .select('id')
      .eq('cash_register_id', openRegister.id)
      .eq('status', 'completed');

    let cashFromSales = 0;
    if (cashPayments && cashPayments.length > 0) {
      const saleIds = cashPayments.map((s) => s.id);
      const { data: pmts } = await supabase
        .from('payments')
        .select('method, amount, mixed_payment_details!inner(method, amount)')
        .in('sale_id', saleIds);

      if (pmts) {
        for (const p of pmts) {
          if (p.method === 'cash') cashFromSales += p.amount;
          if (p.method === 'mixed' && p.mixed_payment_details) {
            for (const d of p.mixed_payment_details) {
              if (d.method === 'cash') cashFromSales += d.amount;
            }
          }
        }
      }
    }

    const incomeMovements = movements.filter((m) => m.type === 'income').reduce((s, m) => s + m.amount, 0);
    const expenseMovements = movements.filter((m) => m.type === 'expense').reduce((s, m) => s + m.amount, 0);
    const expectedCash = openRegister.opening_amount + cashFromSales + incomeMovements - expenseMovements;
    const difference = counted - expectedCash;

    await supabase.from('cash_registers').update({
      closing_amount: expectedCash,
      counted_amount: counted,
      difference,
      closed_at: new Date().toISOString(),
      status: 'closed',
      notes: closeNotes || null,
    }).eq('id', openRegister.id);

    setShowCloseForm(false);
    setCountedAmount('');
    setCloseNotes('');
    loadCurrentRegister();
    loadClosings();
  };

  const totalIncome = movements.filter((m) => m.type === 'income').reduce((s, m) => s + m.amount, 0);
  const totalExpense = movements.filter((m) => m.type === 'expense').reduce((s, m) => s + m.amount, 0);

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Caja</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {(['current', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'current' ? 'Caja Actual' : 'Historial Cierres'}
          </button>
        ))}
      </div>

      {tab === 'current' && (
        <>
          {!openRegister ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Lock size={48} className="text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-2">Caja cerrada</h3>
              <p className="text-sm text-slate-400 mb-4">Debe abrir la caja para operar</p>
              {showOpenForm ? (
                <div className="max-w-xs mx-auto space-y-3">
                  <input type="number" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)}
                    placeholder="Monto inicial" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-center text-lg font-bold focus:ring-2 focus:ring-emerald-500" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowOpenForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm">Cancelar</button>
                    <button onClick={handleOpenRegister} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">Abrir Caja</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowOpenForm(true)}
                  className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors">
                  <Unlock size={18} className="inline mr-2" /> Abrir Caja
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 mb-1">Apertura</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(openRegister.opening_amount)}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                  <p className="text-xs text-emerald-600 mb-1">Ingresos extra</p>
                  <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalIncome)}</p>
                </div>
                <div className="bg-red-50 rounded-xl border border-red-200 p-4">
                  <p className="text-xs text-red-600 mb-1">Egresos</p>
                  <p className="text-lg font-bold text-red-700">{formatCurrency(totalExpense)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 mb-1">Apertura</p>
                  <p className="text-xs text-slate-400">{formatDate(openRegister.opened_at)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => { setMovementType('income'); setShowMovementForm(true); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
                  <Plus size={16} /> Ingreso
                </button>
                <button onClick={() => { setMovementType('expense'); setShowMovementForm(true); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600">
                  <Minus size={16} /> Egreso
                </button>
                <div className="flex-1" />
                <button onClick={() => setShowCloseForm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900">
                  <Lock size={16} /> Cerrar Caja
                </button>
              </div>

              {/* Movements list */}
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-4 py-3 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-700">Movimientos</h3>
                </div>
                {movements.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">Sin movimientos</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {movements.map((m) => (
                      <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {m.type === 'income' ? <TrendingUp size={16} className="text-emerald-500" /> : <TrendingDown size={16} className="text-red-500" />}
                          <div>
                            <p className="text-sm font-medium text-slate-800">{m.description}</p>
                            <p className="text-xs text-slate-400">{formatDate(m.created_at)}</p>
                          </div>
                        </div>
                        <span className={`text-sm font-bold ${m.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {m.type === 'income' ? '+' : '-'}{formatCurrency(m.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Movement form modal */}
          {showMovementForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-800">{movementType === 'income' ? 'Registrar Ingreso' : 'Registrar Egreso'}</h3>
                  <button onClick={() => setShowMovementForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <input type="number" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)}
                  placeholder="Monto" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                <input type="text" value={movementDesc} onChange={(e) => setMovementDesc(e.target.value)}
                  placeholder="Descripcion" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                <div className="flex gap-3">
                  <button onClick={() => setShowMovementForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm">Cancelar</button>
                  <button onClick={handleAddMovement} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold">Registrar</button>
                </div>
              </div>
            </div>
          )}

          {/* Close register modal */}
          {showCloseForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Cerrar Caja</h3>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Efectivo contado</label>
                  <input type="number" value={countedAmount} onChange={(e) => setCountedAmount(e.target.value)}
                    placeholder="Contar efectivo en caja" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Notas (opcional)</label>
                  <input type="text" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)}
                    placeholder="Observaciones" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowCloseForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm">Cancelar</button>
                  <button onClick={handleCloseRegister} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold">Confirmar Cierre</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {closings.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">Sin cierres registrados</div>
          ) : (
            closings.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Cierre del {formatDate(c.closed_at!)}</p>
                    <p className="text-xs text-slate-400">Apertura: {formatDate(c.opened_at)}</p>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-600">Cerrada</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Apertura</p>
                    <p className="font-semibold">{formatCurrency(c.opening_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Esperado</p>
                    <p className="font-semibold">{formatCurrency(c.closing_amount ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Contado</p>
                    <p className="font-semibold">{formatCurrency(c.counted_amount ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Diferencia</p>
                    <p className={`font-bold ${(c.difference ?? 0) < 0 ? 'text-red-500' : (c.difference ?? 0) > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {(c.difference ?? 0) >= 0 ? '+' : ''}{formatCurrency(c.difference ?? 0)}
                    </p>
                  </div>
                </div>
                {c.notes && <p className="text-xs text-slate-400 mt-2">Nota: {c.notes}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
