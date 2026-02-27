import React, { useState, useEffect, useCallback } from 'react';
import PeriodSelector from '../components/PeriodSelector';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

function exportCsv(rows) {
  const headers = ['Name', 'Title', 'Pay Rate (per visit)', 'Total Hours', 'Total Visits', 'Base Earnings', 'Adjustments', 'Total', 'Status'];
  const lines = [headers.join(','), ...rows.map(r => [
    `"${r.name}"`, `"${r.title}"`, r.payRate, r.totalHours, r.totalVisits,
    r.earnings, r.adjustmentTotal || 0, r.finalAmount || r.earnings,
    `"${r.paymentStatus || 'no record'}"`
  ].join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `payroll_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

/* ── Adjust Modal ── */
function AdjustModal({ row, payment, onClose, onSave }) {
  const [type, setType] = useState('bonus');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!amount) return;
    setSaving(true);
    try {
      const adj = { type, amount: type === 'deduction' ? -Math.abs(Number(amount)) : Number(amount), reason };

      if (payment) {
        // Add adjustment to existing payment
        const res = await fetch(`/api/payroll/payments/${payment._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adjustment: adj })
        });
        onSave(await res.json());
      } else {
        // Create new payment record with adjustment
        const res = await fetch('/api/payroll/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinicianId: row.clinicianId, clinicianName: row.name, clinicianTitle: row.title,
            baseAmount: row.earnings, baseHours: row.totalHours, baseVisits: row.totalVisits,
            payRate: row.payRate
          })
        });
        const newPayment = await res.json();
        // Now add the adjustment
        const res2 = await fetch(`/api/payroll/payments/${newPayment._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adjustment: adj })
        });
        onSave(await res2.json());
      }
      onClose();
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h2 className="font-bold">Adjust Payroll — {row.name}</h2>
          <p className="text-sm text-gray-500">Base: {fmt(row.earnings)}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="bonus">Bonus</option>
              <option value="deduction">Deduction</option>
              <option value="rate-correction">Rate Correction</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. Overtime, mileage, correction..."
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          {payment?.adjustments?.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">Existing Adjustments</p>
              {payment.adjustments.map((a, i) => (
                <div key={i} className="flex justify-between text-xs py-1">
                  <span className="text-gray-600">{a.type}: {a.reason || '—'}</span>
                  <span className={a.amount >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(a.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !amount} className="btn-primary">
            {saving ? 'Saving...' : 'Add Adjustment'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Mark Paid Modal ── */
function MarkPaidModal({ row, payment, onClose, onSave }) {
  const [paidDate,   setPaidDate]   = useState(new Date().toISOString().split('T')[0]);
  const [method,     setMethod]     = useState('check');
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);

  const finalAmount = payment ? payment.totalAmount : row.earnings;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      let paymentId = payment?._id;

      if (!paymentId) {
        // Create payment record first
        const res = await fetch('/api/payroll/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinicianId: row.clinicianId, clinicianName: row.name, clinicianTitle: row.title,
            baseAmount: row.earnings, baseHours: row.totalHours, baseVisits: row.totalVisits,
            payRate: row.payRate
          })
        });
        const newPayment = await res.json();
        paymentId = newPayment._id;
      }

      const res = await fetch(`/api/payroll/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid', paidDate, paymentMethod: method, notes })
      });
      onSave(await res.json());
      onClose();
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h2 className="font-bold">Mark Paid — {row.name}</h2>
          <p className="text-sm text-gray-500">Amount: <strong>{fmt(finalAmount)}</strong></p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
            <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="check">Check</option>
              <option value="direct-deposit">Direct Deposit</option>
              <option value="zelle">Zelle</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Check #, reference, etc."
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-success">
            {saving ? 'Saving...' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Payroll Page ── */
export default function Payroll() {
  const [data,            setData]            = useState(null);
  const [payments,        setPayments]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [period,          setPeriod]          = useState({ startDate: null, endDate: null, label: 'All Time' });
  const [statusFilter,    setStatusFilter]    = useState('all');
  const [adjustTarget,    setAdjustTarget]    = useState(null);
  const [markPaidTarget,  setMarkPaidTarget]  = useState(null);

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (p?.startDate) q.set('startDate', p.startDate);
      if (p?.endDate)   q.set('endDate',   p.endDate);
      const [payrollRes, paymentsRes] = await Promise.all([
        fetch(`/api/payroll?${q}`),
        fetch('/api/payroll/payments?limit=500')
      ]);
      setData(await payrollRes.json());
      const pData = await paymentsRes.json();
      setPayments(pData.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePeriodChange = (p) => { setPeriod(p); load(p); };
  useEffect(() => { load(period); }, []);

  // Merge payroll rows with payment records
  const rows = (data?.rows || []).map(r => {
    const payment = payments.find(p =>
      (p.clinicianId && p.clinicianId === r.clinicianId) ||
      p.clinicianName === r.name
    );
    const adjustmentTotal = payment ? (payment.adjustments || []).reduce((s, a) => s + a.amount, 0) : 0;
    const finalAmount = payment ? payment.totalAmount : r.earnings;
    return {
      ...r,
      payment,
      paymentStatus: payment?.status || null,
      adjustmentTotal,
      finalAmount
    };
  });

  const filteredRows = statusFilter === 'all' ? rows
    : statusFilter === 'paid' ? rows.filter(r => r.paymentStatus === 'paid')
    : rows.filter(r => r.paymentStatus !== 'paid');

  const totals = data?.totals || {};
  const paidTotal = rows.filter(r => r.paymentStatus === 'paid').reduce((s, r) => s + r.finalAmount, 0);
  const unpaidTotal = rows.filter(r => r.paymentStatus !== 'paid').reduce((s, r) => s + r.finalAmount, 0);

  const handlePaymentUpdate = (updated) => {
    setPayments(list => {
      const exists = list.find(p => p._id === updated._id);
      if (exists) return list.map(p => p._id === updated._id ? updated : p);
      return [...list, updated];
    });
  };

  return (
    <div className="p-2 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Payroll</h1>
          <p className="text-gray-500 text-sm">
            {rows.length} clinician{rows.length !== 1 ? 's' : ''} — <span className="font-medium">{period.label}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector onChange={handlePeriodChange} />
          <button onClick={() => exportCsv(filteredRows)} className="btn-secondary text-sm">↓ CSV</button>
          <button onClick={() => load(period)} className="btn-secondary text-sm">↻</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold text-purple-600">{fmt(totals.payroll)}</div>
          <div className="text-xs text-gray-500 mt-1">Total Payroll</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600">{totals.visits || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Total Visits</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{fmt(paidTotal)}</div>
          <div className="text-xs text-gray-500 mt-1">Paid</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-orange-600">{fmt(unpaidTotal)}</div>
          <div className="text-xs text-gray-500 mt-1">Unpaid</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: 'All' },
          { key: 'unpaid', label: 'Unpaid' },
          { key: 'paid', label: 'Paid' }
        ].map(f => (
          <button key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="table-header">Clinician</th>
              <th className="table-header">Rate</th>
              <th className="table-header">Hours</th>
              <th className="table-header">Visits</th>
              <th className="table-header">Base</th>
              <th className="table-header">Adj.</th>
              <th className="table-header">Total</th>
              <th className="table-header">Status</th>
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                No payroll data. Process timesheets first.
              </td></tr>
            ) : (
              filteredRows.map((r, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="table-cell">
                    <div className="font-medium">{r.name}</div>
                    {r.title && <div className="text-xs text-gray-400">{r.title}</div>}
                  </td>
                  <td className="table-cell text-sm">{r.payRate ? `${fmt(r.payRate)}/visit` : '—'}</td>
                  <td className="table-cell text-sm">{r.totalHours}h</td>
                  <td className="table-cell text-sm">{r.totalVisits}</td>
                  <td className="table-cell text-sm">{fmt(r.earnings)}</td>
                  <td className="table-cell text-sm">
                    {r.adjustmentTotal !== 0 ? (
                      <span className={r.adjustmentTotal > 0 ? 'text-green-600' : 'text-red-600'}>
                        {r.adjustmentTotal > 0 ? '+' : ''}{fmt(r.adjustmentTotal)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="table-cell font-semibold">{fmt(r.finalAmount)}</td>
                  <td className="table-cell">
                    {r.paymentStatus === 'paid' ? (
                      <span className="badge bg-green-100 text-green-700">Paid</span>
                    ) : r.payment ? (
                      <span className="badge bg-yellow-100 text-yellow-700">Pending</span>
                    ) : (
                      <span className="badge bg-gray-100 text-gray-500">—</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setAdjustTarget(r)}
                        className="text-blue-600 hover:underline text-xs">Adjust</button>
                      {r.paymentStatus !== 'paid' && (
                        <button onClick={() => setMarkPaidTarget(r)}
                          className="text-green-600 hover:underline text-xs">Mark Paid</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filteredRows.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td className="px-4 py-3 font-bold text-sm" colSpan={4}>Totals</td>
                <td className="px-4 py-3 font-bold text-sm">{fmt(filteredRows.reduce((s, r) => s + r.earnings, 0))}</td>
                <td className="px-4 py-3 font-bold text-sm">
                  {(() => {
                    const t = filteredRows.reduce((s, r) => s + (r.adjustmentTotal || 0), 0);
                    return t !== 0 ? <span className={t > 0 ? 'text-green-600' : 'text-red-600'}>{t > 0 ? '+' : ''}{fmt(t)}</span> : '—';
                  })()}
                </td>
                <td className="px-4 py-3 font-bold text-sm">{fmt(filteredRows.reduce((s, r) => s + r.finalAmount, 0))}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {adjustTarget && (
        <AdjustModal
          row={adjustTarget}
          payment={adjustTarget.payment}
          onClose={() => setAdjustTarget(null)}
          onSave={(updated) => { handlePaymentUpdate(updated); setAdjustTarget(null); }}
        />
      )}

      {markPaidTarget && (
        <MarkPaidModal
          row={markPaidTarget}
          payment={markPaidTarget.payment}
          onClose={() => setMarkPaidTarget(null)}
          onSave={(updated) => { handlePaymentUpdate(updated); setMarkPaidTarget(null); }}
        />
      )}
    </div>
  );
}
