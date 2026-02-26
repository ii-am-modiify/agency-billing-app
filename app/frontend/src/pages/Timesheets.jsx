import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SkeletonTable } from '../components/Skeleton';

function fmtNum(n) { return new Intl.NumberFormat('en-US').format(n || 0); }

const STATUS_COLORS = {
  pending:    'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-600',
  processed:  'bg-green-100 text-green-600',
  flagged:    'bg-yellow-100 text-yellow-600',
  reviewed:   'bg-teal-100 text-teal-700',
  invoiced:   'bg-purple-100 text-purple-600',
  error:      'bg-red-100 text-red-600'
};

const PER_PAGE = 30;

/* ── Detail Panel ── */
function TimesheetDetail({ ts, agencies, clinicians, onClose, onSave, onDelete }) {
  if (!ts) return null;
  const data = ts.manualData || ts.ocrData || {};
  const visits = data.visits || [];

  const [editData, setEditData] = useState({ ...data });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/timesheets/${ts._id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualData: editData })
      });
      onSave(await res.json());
      onClose();
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full md:w-[520px] bg-white shadow-2xl flex flex-col animate-slide-in z-50">
        <div className="px-6 py-4 border-b flex items-start justify-between">
          <div>
            <h2 className="font-bold text-lg">{data.patientName || 'Unknown Patient'}</h2>
            <p className="text-sm text-gray-500">{data.employeeName} · {ts.agencyId?.name || '—'}</p>
            <span className={`badge mt-1 ${STATUS_COLORS[ts.status] || ''}`}>{ts.status}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Patient Name</label>
              <input value={editData.patientName || ''} onChange={e => setEditData(d => ({ ...d, patientName: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Clinician</label>
              <input value={editData.employeeName || ''} onChange={e => setEditData(d => ({ ...d, employeeName: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {visits.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Visits ({visits.length})</h3>
              <div className="space-y-2">
                {visits.map((v, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm grid grid-cols-4 gap-2">
                    <div><span className="text-xs text-gray-400">Date</span><br/>{v.date}</div>
                    <div><span className="text-xs text-gray-400">In</span><br/>{v.timeIn}</div>
                    <div><span className="text-xs text-gray-400">Out</span><br/>{v.timeOut}</div>
                    <div><span className="text-xs text-gray-400">Mins</span><br/>{v.durationMinutes}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ts.ocrConfidence && (
            <div className="text-xs text-gray-400">
              OCR Confidence: {(ts.ocrConfidence * 100).toFixed(1)}%
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex gap-2 justify-between">
          <button onClick={() => { if (confirm('Delete this timesheet?')) onDelete(ts._id); onClose(); }}
            className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50">Delete</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Saving...' : 'Save & Mark Reviewed'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Timesheets Page ── */
export default function Timesheets() {
  const [timesheets, setTimesheets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const fileRef = useRef();

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    agency: '',
    clinician: '',
    dateFrom: '',
    dateTo: '',
    careType: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Unique values for filter dropdowns
  const [agencies, setAgencies] = useState([]);
  const [clinicianNames, setClinicianNames] = useState([]);
  const [careTypes, setCareTypes] = useState([]);

  // Load dropdown options once
  useEffect(() => {
    fetch('/api/settings/agencies').then(r => r.json()).then(d => setAgencies(d || [])).catch(() => {});
  }, []);

  const load = useCallback(async (pageNum) => {
    setLoading(true);
    const pg = pageNum || page;
    try {
      const q = new URLSearchParams({ limit: PER_PAGE, page: pg });
      if (filters.status) q.set('status', filters.status);
      if (filters.dateFrom) q.set('startDate', filters.dateFrom);
      if (filters.dateTo) q.set('endDate', filters.dateTo);
      if (filters.agency) q.set('agencyId', filters.agency);
      if (filters.search) q.set('search', filters.search);
      if (filters.clinician) q.set('clinician', filters.clinician);
      if (filters.careType) q.set('careType', filters.careType);

      const res = await fetch(`/api/timesheets?${q}`);
      const data = await res.json();

      setTimesheets(data.data || []);
      setTotal(data.total || 0);

      // Load dropdown options once (lightweight)
      if (clinicianNames.length === 0) {
        fetch('/api/timesheets/filter-options').then(r => r.json()).then(d => {
          setClinicianNames(d.clinicians || []);
          setCareTypes(d.careTypes || []);
        }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { setPage(1); load(1); }, [filters.status, filters.agency, filters.dateFrom, filters.dateTo, filters.clinician, filters.careType]);
  useEffect(() => { load(); }, [page]);

  // Debounce text search
  const searchTimeout = useRef(null);
  const handleSearchChange = (val) => {
    setFilters(f => ({ ...f, search: val }));
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setPage(1); load(1); }, 300);
  };

  const updateFilter = (key, val) => {
    setFilters(f => ({ ...f, [key]: val }));
  };

  const clearFilters = () => {
    setFilters({ status: '', search: '', agency: '', clinician: '', dateFrom: '', dateTo: '', careType: '' });
  };

  const activeFilterCount = Object.values(filters).filter(v => v).length;

  // Pagination (server-side)
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = timesheets; // already paginated from server

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('timesheet', file);
      const res = await fetch('/api/timesheets/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        alert(data.documentType === 'discharge' ? `📄 Discharge doc — ${data.message}` : 'Uploaded! OCR processing started.');
        setTimeout(load, 1500);
      } else if (data.duplicate) {
        alert('⚠️ Duplicate image already uploaded.');
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (e) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id) => {
    await fetch(`/api/timesheets/${id}`, { method: 'DELETE' });
    setTimesheets(ts => ts.filter(t => t._id !== id));
    setTotal(t => t - 1);
  };

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Timesheets</h1>
          <p className="text-gray-500 text-sm">{fmtNum(total)} results</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-primary text-sm">
            {uploading ? 'Uploading...' : '+ Upload'}
          </button>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary text-sm ${activeFilterCount > 0 ? 'border-blue-400 text-blue-600' : ''}`}>
            🔍 Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <button onClick={load} className="btn-secondary text-sm">↻</button>
        </div>
      </div>

      {/* Search bar — always visible */}
      <div className="mb-3">
        <input
          type="text"
          value={filters.search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search by patient, clinician, or agency name..."
          className="w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card mb-4 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-700">Filters</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline">Clear all</button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={filters.status} onChange={e => updateFilter('status', e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm">
                <option value="">All</option>
                {['pending','processing','processed','flagged','reviewed','invoiced','error'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Agency</label>
              <select value={filters.agency} onChange={e => updateFilter('agency', e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm">
                <option value="">All</option>
                {agencies.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Clinician</label>
              <select value={filters.clinician} onChange={e => { updateFilter('clinician', e.target.value); setTimeout(load, 50); }}
                className="w-full border rounded-lg px-2 py-2 text-sm">
                <option value="">All</option>
                {clinicianNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Care Type</label>
              <select value={filters.careType} onChange={e => { updateFilter('careType', e.target.value); setTimeout(load, 50); }}
                className="w-full border rounded-lg px-2 py-2 text-sm">
                <option value="">All</option>
                {careTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date From</label>
              <input type="date" value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date To</label>
              <input type="date" value={filters.dateTo} onChange={e => updateFilter('dateTo', e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[600px] text-[11px] md:text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="table-header">Date</th>
              <th className="table-header">Patient</th>
              <th className="table-header">Clinician</th>
              <th className="table-header">Agency</th>
              <th className="table-header">Type</th>
              <th className="table-header">Visits</th>
              <th className="table-header">Status</th>
              <th className="table-header">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTable rows={15} cols={8} />
            ) : paginated.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                {activeFilterCount > 0 ? 'No timesheets match your filters.' : 'No timesheets yet.'}
              </td></tr>
            ) : (
              paginated.map(ts => {
                const data = ts.manualData || ts.ocrData || {};
                const visits = data.visits || [];
                const careType = visits[0]?.visitCode || '—';
                return (
                  <tr key={ts._id} className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => setSelected(ts)}>
                    <td className="table-cell text-xs">{new Date(ts.createdAt).toLocaleDateString()}</td>
                    <td className="table-cell font-medium">
                      {ts.documentType === 'discharge' ? (
                        <span className="text-gray-400 italic">📄 Discharge</span>
                      ) : (
                        <>
                          {data.patientName || '—'}
                          {ts.dischargeDocs?.length > 0 && (
                            <span className="ml-1 text-xs text-blue-500">📎{ts.dischargeDocs.length}</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="table-cell text-sm">
                      {data.employeeName || '—'}
                      {data.employeeTitle && <span className="ml-1 text-xs text-gray-400">({data.employeeTitle})</span>}
                    </td>
                    <td className="table-cell text-xs">{ts.agencyId?.name || '—'}</td>
                    <td className="table-cell">
                      <span className="badge bg-blue-100 text-blue-700">{careType}</span>
                    </td>
                    <td className="table-cell text-center">{visits.length}</td>
                    <td className="table-cell">
                      <span className={`badge ${STATUS_COLORS[ts.status] || ''}`}>{ts.status}</span>
                    </td>
                    <td className="table-cell text-xs">
                      {ts.ocrConfidence ? (
                        <span className={ts.ocrConfidence > 0.9 ? 'text-green-600' : ts.ocrConfidence > 0.8 ? 'text-yellow-600' : 'text-red-600'}>
                          {(ts.ocrConfidence * 100).toFixed(0)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {total > PER_PAGE && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t bg-gray-50 text-sm">
            <span className="text-gray-500">
              {fmtNum((safePage - 1) * PER_PAGE + 1)}–{fmtNum(Math.min(safePage * PER_PAGE, total))} of {fmtNum(total)}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(1)} disabled={safePage <= 1}
                className="px-2 py-1 rounded border text-xs disabled:opacity-30 hover:bg-gray-100">«</button>
              <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}
                className="px-2 py-1 rounded border text-xs disabled:opacity-30 hover:bg-gray-100">‹</button>
              <span className="px-3 py-1 text-xs text-gray-600">{safePage} / {totalPages}</span>
              <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages}
                className="px-2 py-1 rounded border text-xs disabled:opacity-30 hover:bg-gray-100">›</button>
              <button onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}
                className="px-2 py-1 rounded border text-xs disabled:opacity-30 hover:bg-gray-100">»</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <TimesheetDetail
          ts={selected}
          agencies={agencies}
          onClose={() => setSelected(null)}
          onSave={(updated) => {
            setTimesheets(list => list.map(t => t._id === updated._id ? updated : t));
            setSelected(null);
          }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
