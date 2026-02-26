import React, { useState, useEffect, useCallback } from 'react';
import PeriodSelector from '../components/PeriodSelector';
import { SkeletonTable } from '../components/Skeleton';

const STATUS_COLORS = {
  draft:   'bg-gray-100 text-gray-600',
  sent:    'bg-blue-100 text-blue-700',
  paid:    'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  void:    'bg-gray-100 text-gray-400'
};

const TABS = [
  { key: 'review',      label: 'Review',      statuses: ['draft'] },
  { key: 'outstanding', label: 'Outstanding',  statuses: ['sent', 'overdue'] },
  { key: 'paid',        label: 'Paid',         statuses: ['paid'] }
];

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}
function fmtNum(n) { return new Intl.NumberFormat('en-US').format(n || 0); }

/* ── Mark Paid Modal ── */
function MarkPaidModal({ invoice, onClose, onPaid }) {
  const [paidDate,   setPaidDate]   = useState(new Date().toISOString().split('T')[0]);
  const [paidAmount, setPaidAmount] = useState(invoice.total || 0);
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoice._id}/mark-paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidDate, paidAmount: Number(paidAmount), paymentNotes: notes })
      });
      onPaid(await res.json());
      onClose();
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h2 className="font-bold">Mark Invoice Paid</h2>
          <p className="text-sm text-gray-500">{invoice.invoiceNumber} — {invoice.agencyId?.name}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
            <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received</label>
            <input type="number" step="0.01" value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Check #, wire ref, etc."
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

/* ── Invoice Detail Panel (slide-out) ── */
function InvoicePanel({ invoice, onClose, onSend, onMarkPaid, onDelete }) {
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!confirm(`Send invoice ${invoice.invoiceNumber} to ${invoice.agencyId?.contactEmail || invoice.agencyId?.name}?`)) return;
    setSending(true);
    try {
      await onSend(invoice);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[560px] bg-white shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg">{invoice.invoiceNumber}</h2>
              <span className={`badge ${STATUS_COLORS[invoice.status]}`}>{invoice.status}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{invoice.agencyId?.name || '—'}</p>
            <p className="text-xs text-gray-400">{invoice.billingPeriodId?.label || '—'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Info bar */}
        <div className="px-6 py-3 bg-gray-50 border-b flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-500">Total:</span>{' '}
            <span className="font-bold text-lg">{fmt(invoice.total)}</span>
          </div>
          <div>
            <span className="text-gray-500">Due:</span>{' '}
            <span>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'On receipt'}</span>
          </div>
          {invoice.sentAt && (
            <div>
              <span className="text-gray-500">Sent:</span>{' '}
              <span>{new Date(invoice.sentAt).toLocaleDateString()}</span>
            </div>
          )}
          {invoice.paidAt && (
            <div>
              <span className="text-gray-500">Paid:</span>{' '}
              <span>{new Date(invoice.paidAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* PDF Preview */}
        <div className="flex-1 min-h-0 p-4">
          {invoice.pdfPath ? (
            <iframe
              src={`/api/invoices/${invoice._id}/pdf`}
              className="w-full h-full border rounded-lg"
              title="Invoice PDF Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-4xl mb-2">📄</p>
                <p>PDF not generated yet</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t flex flex-wrap gap-2 justify-between">
          <div className="flex gap-2">
            {invoice.pdfPath && (
              <a href={`/api/invoices/${invoice._id}/pdf`} target="_blank" rel="noopener"
                className="btn-secondary text-sm">↓ Download PDF</a>
            )}
          </div>
          <div className="flex gap-2">
            {invoice.status === 'draft' && (
              <>
                <button onClick={() => onDelete(invoice)} className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50">
                  Delete
                </button>
                <button onClick={handleSend} disabled={sending} className="btn-primary text-sm">
                  {sending ? 'Sending…' : '✉️ Send to Agency'}
                </button>
              </>
            )}
            {['sent', 'overdue'].includes(invoice.status) && (
              <button onClick={() => onMarkPaid(invoice)} className="btn-success text-sm">
                💰 Mark Paid
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Main Invoices Page ── */
export default function Invoices() {
  const [invoices,        setInvoices]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [activeTab,       setActiveTab]       = useState('review');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [markPaidTarget,  setMarkPaidTarget]  = useState(null);
  const [periods,         setPeriods]         = useState([]);
  const [selectedPeriod,  setSelectedPeriod]  = useState('');
  const [generating,      setGenerating]      = useState(false);
  const [datePeriod,      setDatePeriod]      = useState({ startDate: null, endDate: null, label: 'All Time' });

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: 200 });
      if (p?.startDate) q.set('startDate', p.startDate);
      if (p?.endDate)   q.set('endDate',   p.endDate);
      const res = await fetch(`/api/invoices?${q}`);
      const data = await res.json();
      setInvoices(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPeriods = async () => {
    try {
      const res = await fetch('/api/settings/billing-periods');
      setPeriods(await res.json() || []);
    } catch (e) {}
  };

  useEffect(() => { load(datePeriod); loadPeriods(); }, []);

  const handlePeriodChange = (p) => {
    setDatePeriod(p);
    load(p);
  };

  const handleGenerate = async () => {
    if (!selectedPeriod) { alert('Select a billing period first'); return; }
    if (!confirm('Generate invoices for this billing period?')) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingPeriodId: selectedPeriod })
      });
      const data = await res.json();
      alert(`Generated ${data.created} invoice(s)`);
      load(datePeriod);
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async (inv) => {
    try {
      const res = await fetch(`/api/invoices/${inv._id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Send failed'); return; }
      setInvoices(list => list.map(i => i._id === data._id ? data : i));
      setSelectedInvoice(data);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };

  const deleteInvoice = async (inv) => {
    const force = inv.status !== 'draft';
    if (force) {
      if (!confirm(`⚠️ This invoice is ${inv.status.toUpperCase()}. Delete anyway?`)) return;
    } else {
      if (!confirm(`Delete draft invoice ${inv.invoiceNumber}?`)) return;
    }
    const res = await fetch(`/api/invoices/${inv._id}${force ? '?force=true' : ''}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    setInvoices(list => list.filter(i => i._id !== inv._id));
    setSelectedInvoice(null);
  };

  // Filter by active tab
  const currentTab = TABS.find(t => t.key === activeTab);
  const filtered = invoices.filter(i => currentTab.statuses.includes(i.status));

  // Tab counts
  const counts = {};
  for (const tab of TABS) {
    counts[tab.key] = invoices.filter(i => tab.statuses.includes(i.status)).length;
  }

  // Tab totals
  const tabTotal = filtered.reduce((sum, i) => sum + (i.total || 0), 0);

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Invoices</h1>
          <p className="text-gray-500 text-sm">
            {fmtNum(invoices.length)} total — <span className="font-medium">{datePeriod.label}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector onChange={handlePeriodChange} />
          <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Select period to generate</option>
            {periods.map(p => <option key={p._id} value={p._id}>{p.label}</option>)}
          </select>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm">
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab summary */}
      {filtered.length > 0 && (
        <div className="mb-4 text-sm text-gray-500">
          {fmtNum(filtered.length)} invoice{filtered.length !== 1 ? 's' : ''} — {fmt(tabTotal)} total
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[450px] text-[11px] md:text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="table-header">Invoice #</th>
              <th className="table-header">Agency</th>
              <th className="table-header">Period</th>
              <th className="table-header">Total</th>
              <th className="table-header">Status</th>
              <th className="table-header">
                {activeTab === 'paid' ? 'Paid' : 'Due'}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTable rows={12} cols={6} />
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                {activeTab === 'review' && 'No draft invoices. Generate invoices from a billing period.'}
                {activeTab === 'outstanding' && 'No outstanding invoices. 🎉'}
                {activeTab === 'paid' && 'No paid invoices yet.'}
              </td></tr>
            ) : (
              filtered.map(inv => (
                <tr key={inv._id}
                  className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedInvoice(inv)}
                >
                  <td className="table-cell font-mono text-xs font-semibold">{inv.invoiceNumber}</td>
                  <td className="table-cell font-medium">{inv.agencyId?.name || '—'}</td>
                  <td className="table-cell text-xs">{inv.billingPeriodId?.label || '—'}</td>
                  <td className="table-cell font-semibold">{fmt(inv.total)}</td>
                  <td className="table-cell">
                    <span className={`badge ${STATUS_COLORS[inv.status] || ''}`}>{inv.status}</span>
                  </td>
                  <td className="table-cell text-xs">
                    {activeTab === 'paid'
                      ? (inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '—')
                      : (inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—')
                    }
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-out panel */}
      {selectedInvoice && (
        <InvoicePanel
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSend={handleSend}
          onMarkPaid={(inv) => { setMarkPaidTarget(inv); }}
          onDelete={deleteInvoice}
        />
      )}

      {/* Mark Paid modal */}
      {markPaidTarget && (
        <MarkPaidModal
          invoice={markPaidTarget}
          onClose={() => setMarkPaidTarget(null)}
          onPaid={(updated) => {
            setInvoices(list => list.map(i => i._id === updated._id ? updated : i));
            setMarkPaidTarget(null);
            setSelectedInvoice(updated);
          }}
        />
      )}
    </div>
  );
}
