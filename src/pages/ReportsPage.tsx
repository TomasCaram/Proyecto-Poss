import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, formatDateShort, getPaymentMethodLabel, getAdjustmentTypeLabel } from '../lib/utils';
import type { CashAdjustment } from '../lib/types';
import {
  BarChart3, FileSpreadsheet, FileText, Pencil, Plus, MinusCircle,
  X, Trash2, AlertTriangle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ReportType = 'daily' | 'period' | 'by_product' | 'top_products' | 'profit';

interface SaleRow {
  sale_date: string;
  total: number;
  subtotal: number;
  discount_amount: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  sale_detail_subtotal: number;
  cost_price: number;
  method: string;
  status: string;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Edit / adjustments state
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [adjustments, setAdjustments] = useState<CashAdjustment[]>([]);
  const [adjLoading, setAdjLoading] = useState(false);

  // New adjustment form
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjType, setAdjType] = useState<'withdrawal' | 'income' | 'correction'>('withdrawal');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjDesc, setAdjDesc] = useState('');
  const [adjRef, setAdjRef] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sales } = await supabase
        .from('sales')
        .select('sale_date, total, subtotal, discount_amount, status, payments(method), sale_details(product_name, quantity, unit_price, subtotal:subtotal, product_id)')
        .gte('sale_date', `${startDate}T00:00:00`)
        .lte('sale_date', `${endDate}T23:59:59`)
        .eq('status', 'completed');

      if (!sales) { setData([]); setLoading(false); setGenerated(true); return; }

      const rows: SaleRow[] = [];
      for (const s of sales as any[]) {
        const method = s.payments?.[0]?.method ?? '—';
        for (const d of s.sale_details ?? []) {
          const { data: prod } = await supabase.from('products').select('cost_price').eq('id', d.product_id).single();
          rows.push({
            sale_date: s.sale_date,
            total: s.total,
            subtotal: s.subtotal,
            discount_amount: s.discount_amount,
            product_name: d.product_name,
            quantity: d.quantity,
            unit_price: d.unit_price,
            sale_detail_subtotal: d.subtotal,
            cost_price: prod?.cost_price ?? 0,
            method,
            status: s.status,
          });
        }
      }
      setData(rows);
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const dailyTotals = data.reduce((acc, row) => {
    const day = row.sale_date.split('T')[0];
    if (!acc[day]) acc[day] = { total: 0, count: 0 };
    acc[day].total += row.total;
    acc[day].count++;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const productTotals = data.reduce((acc, row) => {
    if (!acc[row.product_name]) acc[row.product_name] = { quantity: 0, revenue: 0, cost: 0 };
    acc[row.product_name].quantity += row.quantity;
    acc[row.product_name].revenue += row.sale_detail_subtotal;
    acc[row.product_name].cost += row.cost_price * row.quantity;
    return acc;
  }, {} as Record<string, { quantity: number; revenue: number; cost: number }>);

  const topProducts = Object.entries(productTotals)
    .sort(([, a], [, b]) => b.quantity - a.quantity)
    .slice(0, 10);

  const totalRevenue = data.reduce((s, r) => s + r.sale_detail_subtotal, 0);
  const totalCost = data.reduce((s, r) => s + r.cost_price * r.quantity, 0);
  const estimatedProfit = totalRevenue - totalCost;

  const paymentTotals = data.reduce((acc, row) => {
    const m = row.method;
    if (!acc[m]) acc[m] = 0;
    acc[m] += row.sale_detail_subtotal;
    return acc;
  }, {} as Record<string, number>);

  // Adjustments logic
  const loadAdjustments = useCallback(async () => {
    setAdjLoading(true);
    const { data } = await supabase
      .from('cash_adjustments')
      .select('*')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false });
    setAdjustments(data ?? []);
    setAdjLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    if (showEditPanel) loadAdjustments();
  }, [showEditPanel, loadAdjustments]);

  const totalWithdrawals = adjustments.filter((a) => a.type === 'withdrawal').reduce((s, a) => s + a.amount, 0);
  const totalIncomes = adjustments.filter((a) => a.type === 'income').reduce((s, a) => s + a.amount, 0);
  const totalCorrections = adjustments.filter((a) => a.type === 'correction').reduce((s, a) => s + a.amount, 0);
  const netAdjustment = totalIncomes + totalCorrections - totalWithdrawals;

  const saveAdjustment = async () => {
    const amount = parseFloat(adjAmount);
    if (isNaN(amount) || amount <= 0 || !adjDesc) return;
    setSaving(true);

    // Get open cash register
    const { data: openRegister } = await supabase
      .from('cash_registers')
      .select('id')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // For corrections, allow negative amounts
    const finalAmount = adjType === 'correction' ? amount : amount;

    await supabase.from('cash_adjustments').insert({
      user_id: user!.id,
      cash_register_id: openRegister?.id ?? null,
      type: adjType,
      amount: finalAmount,
      description: adjDesc,
      reference: adjRef || null,
    });

    setSaving(false);
    setShowAdjForm(false);
    setAdjAmount('');
    setAdjDesc('');
    setAdjRef('');
    loadAdjustments();
  };

  const deleteAdjustment = async (id: string) => {
    await supabase.from('cash_adjustments').delete().eq('id', id);
    setDeleteId(null);
    loadAdjustments();
  };

  // Export functions
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('KioscoPOS - Reporte', 14, 20);
    doc.setFontSize(10);
    doc.text(`Periodo: ${startDate} a ${endDate}`, 14, 28);

    let y = 40;
    if (reportType === 'daily' || reportType === 'period') {
      autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Ventas', 'Total']],
        body: Object.entries(dailyTotals).map(([day, v]) => [day, String(v.count), formatCurrency(v.total)]),
      });
    } else if (reportType === 'by_product' || reportType === 'top_products') {
      autoTable(doc, {
        startY: y,
        head: [['Producto', 'Cantidad', 'Ingresos', 'Costo', 'Ganancia']],
        body: topProducts.map(([name, v]) => [name, String(v.quantity), formatCurrency(v.revenue), formatCurrency(v.cost), formatCurrency(v.revenue - v.cost)]),
      });
    } else if (reportType === 'profit') {
      autoTable(doc, {
        startY: y,
        head: [['Concepto', 'Monto']],
        body: [
          ['Ingresos totales', formatCurrency(totalRevenue)],
          ['Costo total', formatCurrency(totalCost)],
          ['Ganancia estimada', formatCurrency(estimatedProfit)],
        ],
      });
    }

    doc.save(`reporte_${reportType}_${startDate}_${endDate}.pdf`);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (reportType === 'daily' || reportType === 'period') {
      const ws = XLSX.utils.json_to_sheet(
        Object.entries(dailyTotals).map(([day, v]) => ({ Fecha: day, Ventas: v.count, Total: v.total }))
      );
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas por dia');
    } else if (reportType === 'by_product' || reportType === 'top_products') {
      const ws = XLSX.utils.json_to_sheet(
        topProducts.map(([name, v]) => ({
          Producto: name, Cantidad: v.quantity, Ingresos: v.revenue, Costo: v.cost, Ganancia: v.revenue - v.cost,
        }))
      );
      XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    } else if (reportType === 'profit') {
      const ws = XLSX.utils.json_to_sheet([
        { Concepto: 'Ingresos', Monto: totalRevenue },
        { Concepto: 'Costos', Monto: totalCost },
        { Concepto: 'Ganancia estimada', Monto: estimatedProfit },
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Ganancia');
    }

    const payWs = XLSX.utils.json_to_sheet(
      Object.entries(paymentTotals).map(([method, total]) => ({ Metodo: getPaymentMethodLabel(method), Total: total }))
    );
    XLSX.utils.book_append_sheet(wb, payWs, 'Medios de pago');

    // Adjustments sheet
    if (adjustments.length > 0) {
      const adjWs = XLSX.utils.json_to_sheet(
        adjustments.map((a) => ({
          Fecha: new Date(a.created_at).toLocaleString('es-AR'),
          Tipo: getAdjustmentTypeLabel(a.type),
          Monto: a.amount,
          Descripcion: a.description,
          Referencia: a.reference ?? '',
        }))
      );
      XLSX.utils.book_append_sheet(wb, adjWs, 'Ajustes');
    }

    XLSX.writeFile(wb, `reporte_${reportType}_${startDate}_${endDate}.xlsx`);
  };

  const reportTypes: { id: ReportType; label: string }[] = [
    { id: 'daily', label: 'Ventas del dia' },
    { id: 'period', label: 'Ventas por periodo' },
    { id: 'by_product', label: 'Ventas por producto' },
    { id: 'top_products', label: 'Mas vendidos' },
    { id: 'profit', label: 'Ganancia estimada' },
  ];

  const adjTypeConfig: Record<string, { color: string; bg: string; icon: typeof Plus }> = {
    withdrawal: { color: 'text-red-600', bg: 'bg-red-50', icon: MinusCircle },
    income: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Plus },
    correction: { color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle },
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          <BarChart3 size={24} className="inline mr-2" />Reportes
        </h1>
        {generated && (
          <button
            onClick={() => setShowEditPanel(!showEditPanel)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showEditPanel
                ? 'bg-slate-800 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <Pencil size={16} />
            {showEditPanel ? 'Ocultar Edicion' : 'Editar Reporte'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Tipo de reporte</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
              {reportTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Desde</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Hasta</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          <button onClick={generateReport} disabled={loading}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:bg-slate-300 transition-colors">
            {loading ? 'Generando...' : 'Generar'}
          </button>
        </div>
      </div>

      {generated && (
        <>
          {/* Edit panel */}
          {showEditPanel && (
            <div className="bg-white rounded-xl border-2 border-amber-200 mb-6 overflow-hidden">
              <div className="bg-amber-50 px-5 py-3 border-b border-amber-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-amber-800">Ajustes de caja</h3>
                  <p className="text-xs text-amber-600">Retiros, ingresos y correcciones para este periodo</p>
                </div>
                <button
                  onClick={() => { setShowAdjForm(true); setAdjType('withdrawal'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors"
                >
                  <Plus size={14} /> Nuevo ajuste
                </button>
              </div>

              {/* Adjustment summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-slate-100">
                <div className="rounded-lg bg-red-50 p-3 border border-red-100">
                  <p className="text-xs text-red-500 mb-0.5">Retiros</p>
                  <p className="text-base font-bold text-red-600">-{formatCurrency(totalWithdrawals)}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
                  <p className="text-xs text-emerald-500 mb-0.5">Ingresos extra</p>
                  <p className="text-base font-bold text-emerald-600">+{formatCurrency(totalIncomes)}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 border border-amber-100">
                  <p className="text-xs text-amber-500 mb-0.5">Correcciones</p>
                  <p className="text-base font-bold text-amber-600">{totalCorrections >= 0 ? '+' : ''}{formatCurrency(totalCorrections)}</p>
                </div>
                <div className={`rounded-lg p-3 border ${netAdjustment >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <p className={`text-xs mb-0.5 ${netAdjustment >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>Impacto neto</p>
                  <p className={`text-base font-bold ${netAdjustment >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {netAdjustment >= 0 ? '+' : ''}{formatCurrency(netAdjustment)}
                  </p>
                </div>
              </div>

              {/* Adjustments list */}
              <div className="max-h-64 overflow-y-auto">
                {adjLoading ? (
                  <div className="p-6 text-center text-slate-400 text-sm">Cargando ajustes...</div>
                ) : adjustments.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">
                    No hay ajustes para este periodo. Use "Nuevo ajuste" para agregar retiros o ingresos.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {adjustments.map((adj) => {
                      const cfg = adjTypeConfig[adj.type];
                      const Icon = cfg.icon;
                      return (
                        <div key={adj.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-25 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                              <Icon size={16} className={cfg.color} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{adj.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                                  {getAdjustmentTypeLabel(adj.type)}
                                </span>
                                <span className="text-xs text-slate-400">{formatDate(adj.created_at)}</span>
                                {adj.reference && <span className="text-xs text-slate-400">Ref: {adj.reference}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold ${adj.type === 'withdrawal' ? 'text-red-500' : 'text-emerald-600'}`}>
                              {adj.type === 'withdrawal' ? '-' : '+'}{formatCurrency(adj.amount)}
                            </span>
                            <button
                              onClick={() => setDeleteId(adj.id)}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Eliminar ajuste"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Adjusted totals */}
              {adjustments.length > 0 && (
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Ganancia ajustada</span>
                    <span className={`font-bold ${estimatedProfit + netAdjustment >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {formatCurrency(estimatedProfit + netAdjustment)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-slate-400">Ganancia original: {formatCurrency(estimatedProfit)} + ajustes: {netAdjustment >= 0 ? '+' : ''}{formatCurrency(netAdjustment)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* New adjustment form modal */}
          {showAdjForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800">Nuevo Ajuste</h3>
                  <button onClick={() => setShowAdjForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <div className="p-5 space-y-4">
                  {/* Type selector */}
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Tipo de ajuste</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([['withdrawal', 'Retiro', MinusCircle], ['income', 'Ingreso', Plus], ['correction', 'Correccion', AlertTriangle]] as const).map(([type, label, Icon]) => (
                        <button
                          key={type}
                          onClick={() => setAdjType(type)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-medium transition-all border-2 ${
                            adjType === type
                              ? `${adjTypeConfig[type].bg} ${adjTypeConfig[type].color} border-current`
                              : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100'
                          }`}
                        >
                          <Icon size={18} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Monto</label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Descripcion *</label>
                    <input
                      type="text"
                      value={adjDesc}
                      onChange={(e) => setAdjDesc(e.target.value)}
                      placeholder={adjType === 'withdrawal' ? 'Ej: Retiro para pago proveedor' : adjType === 'income' ? 'Ej: Ingreso por alquiler' : 'Ej: Ajuste por diferencia'}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Referencia (opcional)</label>
                    <input
                      type="text"
                      value={adjRef}
                      onChange={(e) => setAdjRef(e.target.value)}
                      placeholder="Ej: Factura nro, recibo"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowAdjForm(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveAdjustment}
                      disabled={saving || !adjAmount || !adjDesc}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:bg-slate-200 disabled:text-slate-400 ${
                        adjType === 'withdrawal'
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : adjType === 'income'
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-amber-500 text-white hover:bg-amber-600'
                      }`}
                    >
                      {saving ? 'Guardando...' : adjType === 'withdrawal' ? 'Registrar Retiro' : adjType === 'income' ? 'Registrar Ingreso' : 'Registrar Correccion'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete confirmation modal */}
          {deleteId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={24} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Eliminar ajuste</h3>
                <p className="text-sm text-slate-500 mb-6">Esta accion no se puede deshacer. El ajuste sera eliminado permanentemente.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteId(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => deleteAdjustment(deleteId)}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Ingresos</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Costos</p>
              <p className="text-lg font-bold text-red-500">{formatCurrency(totalCost)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
              <p className="text-xs text-emerald-600 mb-1">Ganancia estimada</p>
              <p className="text-lg font-bold text-emerald-700">{formatCurrency(estimatedProfit)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Transacciones</p>
              <p className="text-lg font-bold text-slate-800">{data.length}</p>
            </div>
          </div>

          {/* Report content */}
          {(reportType === 'daily' || reportType === 'period') && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ventas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(dailyTotals).sort().map(([day, v]) => (
                    <tr key={day} className="border-b border-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-700">{formatDateShort(day)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">{v.count}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-right">{formatCurrency(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(reportType === 'by_product' || reportType === 'top_products') && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Producto</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Cantidad</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ingresos</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Costo</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map(([name, v]) => (
                    <tr key={name} className="border-b border-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">{v.quantity}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600 text-right">{formatCurrency(v.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-red-500 text-right">{formatCurrency(v.cost)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">{formatCurrency(v.revenue - v.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reportType === 'profit' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Ingresos totales</span>
                  <span className="text-lg font-bold text-emerald-600">{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Costos totales</span>
                  <span className="text-lg font-bold text-red-500">{formatCurrency(totalCost)}</span>
                </div>
                {adjustments.length > 0 && showEditPanel && (
                  <div className="flex justify-between items-center py-3 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Ajustes netos</span>
                    <span className={`text-lg font-bold ${netAdjustment >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {netAdjustment >= 0 ? '+' : ''}{formatCurrency(netAdjustment)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-3">
                  <span className="text-lg font-bold text-slate-800">Ganancia estimada</span>
                  <span className={`text-2xl font-bold ${
                    (showEditPanel && adjustments.length > 0 ? estimatedProfit + netAdjustment : estimatedProfit) >= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {formatCurrency(showEditPanel && adjustments.length > 0 ? estimatedProfit + netAdjustment : estimatedProfit)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payment breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Desglose por medio de pago</h3>
            <div className="space-y-2">
              {Object.entries(paymentTotals).map(([method, total]) => (
                <div key={method} className="flex justify-between text-sm">
                  <span className="text-slate-600">{getPaymentMethodLabel(method)}</span>
                  <span className="font-medium text-slate-800">{formatCurrency(total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Export buttons */}
          <div className="flex gap-3">
            <button onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors">
              <FileText size={16} /> Exportar PDF
            </button>
            <button onClick={exportExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-colors">
              <FileSpreadsheet size={16} /> Exportar Excel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
