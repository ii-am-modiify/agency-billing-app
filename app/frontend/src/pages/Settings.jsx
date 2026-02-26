import React, { useState, useEffect, useRef, useMemo } from 'react';

function fmtNum(n) { return new Intl.NumberFormat('en-US').format(n || 0); }

const PER_PAGE = 30;

function useSearchPaginate(items, searchFields) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(item =>
      searchFields.some(fn => {
        const val = typeof fn === 'function' ? fn(item) : item[fn];
        return val && String(val).toLowerCase().includes(q);
      })
    );
  }, [items, search, searchFields]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [search]);

  return { search, setSearch, page: safePage, setPage, filtered, paginated, totalPages };
}

function PaginationBar({ page, totalPages, setPage, filteredCount, totalCount, label }) {
  if (totalCount <= PER_PAGE && !filteredCount) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t bg-gray-50 text-sm">
      <span className="text-gray-500">
        Showing {fmtNum(((page - 1) * PER_PAGE) + 1)}–{fmtNum(Math.min(page * PER_PAGE, filteredCount))} of {fmtNum(filteredCount)}
        {filteredCount !== totalCount && <span className="text-gray-400"> (filtered from {fmtNum(totalCount)})</span>}
        {label && <span className="text-gray-400"> {label}</span>}
      </span>
      <div className="flex gap-1">
        <button onClick={() => setPage(1)} disabled={page <= 1}
          className="px-2 py-1 rounded border text-xs disabled:opacity-30 hover:bg-gray-100">«</button>
        <button onClick={() => setPage(page - 1)} disabled={page <= 1}
          className="px-2 py-1 rounded border text-xs disabled:opacity-30 hover:bg-gray-100">‹</button>
        <span className="px-3 py-1 text-xs text-gray-600">{page} / {totalPages}</span>
        <button onClick={() => setPage(page + 1)} disabled={page >= totalPages}
          className="px-2 py-1 rounded border text-xs disabled:opacity-30 hover:bg-gray-100">›</button>
        <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
          className="px-2 py-1 rounded border text-xs disabled:opacity-30 hover:bg-gray-100">»</button>
      </div>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || 'Search...'}
      className="border rounded-lg px-3 py-2 text-sm w-full max-w-xs"
    />
  );
}

// ─── Agency Modal (with Rate Card Editor) ────────────────────────────────────

function AgencyModal({ agency, onClose, onSave }) {
  const [form, setForm] = useState(agency ? {
    name: agency.name || '',
    address: agency.address || '',
    contactName: agency.contactName || '',
    contactEmail: agency.contactEmail || '',
    contactPhone: agency.contactPhone || '',
    billingRate: agency.billingRate || { default: 0 },
    paymentTerms: agency.paymentTerms || 30,
    notes: agency.notes || ''
  } : {
    name: '', address: '', contactName: '', contactEmail: '', contactPhone: '',
    billingRate: { default: 0 }, paymentTerms: 30, notes: ''
  });

  // Rate card: billing code → rate (built from agency.rates or empty)
  const [localRates, setLocalRates] = useState(() => {
    if (!agency?.rates) return {};
    if (agency.rates instanceof Object) return { ...agency.rates };
    return {};
  });

  const [billingCodes, setBillingCodes] = useState([]);
  const [customCode, setCustomCode] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/billing-codes')
      .then(r => r.json())
      .then(setBillingCodes)
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = agency ? `/api/settings/agencies/${agency._id}` : '/api/settings/agencies';
      const method = agency ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, rates: localRates })
      });
      const saved = await res.json();
      onSave(saved);
      onClose();
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const addCustomCode = () => {
    const code = customCode.trim().toUpperCase();
    if (!code || !customRate) return;
    setLocalRates(r => ({ ...r, [code]: Number(customRate) }));
    setCustomCode('');
    setCustomRate('');
  };

  const standardCodes = new Set(billingCodes.map(bc => bc.code));
  const customCodesOnAgency = Object.keys(localRates).filter(c => !standardCodes.has(c));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b">
          <h2 className="font-bold">{agency ? 'Edit Agency' : 'Add Agency'}</h2>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Agency Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Contact Name</label>
              <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact Email</label>
              <input type="email" value={form.contactEmail}
                onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Default Rate ($/hr — fallback)</label>
              <input type="number" step="0.01"
                value={form.billingRate?.default || 0}
                onChange={e => setForm(f => ({ ...f, billingRate: { ...f.billingRate, default: Number(e.target.value) } }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Terms (days)</label>
              <input type="number" value={form.paymentTerms}
                onChange={e => setForm(f => ({ ...f, paymentTerms: Number(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* ── Rate Card */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Rate Card <span className="font-normal text-gray-400 text-xs">— rate per visit by billing code</span>
            </label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 w-20">Code</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 w-32">Rate ($/visit)</th>
                  </tr>
                </thead>
                <tbody>
                  {billingCodes.map(bc => (
                    <tr key={bc.code} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-semibold text-blue-700">{bc.code}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{bc.description}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-400 text-xs">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={localRates[bc.code] !== undefined ? localRates[bc.code] : bc.defaultRate}
                            onChange={e => setLocalRates(r => ({ ...r, [bc.code]: Number(e.target.value) }))}
                            className="w-24 border rounded px-2 py-1 text-right text-sm"
                            placeholder={bc.defaultRate}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}

                  {customCodesOnAgency.map(code => (
                    <tr key={code} className="border-t bg-blue-50/30">
                      <td className="px-3 py-2 font-mono font-semibold text-purple-700">{code}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs italic">Custom code</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-400 text-xs">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={localRates[code] || ''}
                            onChange={e => setLocalRates(r => ({ ...r, [code]: Number(e.target.value) }))}
                            className="w-24 border rounded px-2 py-1 text-right text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setLocalRates(r => { const n = { ...r }; delete n[code]; return n; })}
                            className="text-red-400 hover:text-red-600 text-xs ml-1"
                            title="Remove"
                          >✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  <tr className="border-t bg-gray-50">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={customCode}
                        onChange={e => setCustomCode(e.target.value.toUpperCase())}
                        placeholder="CODE"
                        maxLength={10}
                        className="border rounded px-2 py-1 text-sm w-20 font-mono"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">Add custom billing code</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-gray-400 text-xs">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customRate}
                          onChange={e => setCustomRate(e.target.value)}
                          placeholder="0.00"
                          className="w-20 border rounded px-2 py-1 text-right text-sm"
                        />
                        <button
                          type="button"
                          onClick={addCustomCode}
                          disabled={!customCode || !customRate}
                          className="text-blue-600 hover:underline text-xs disabled:opacity-40"
                        >+ Add</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              These rates override the default rate per billing code. Leave a rate at 0 to use the fallback default above.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Agency'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clinician Modal ─────────────────────────────────────────────────────────

function ClinicianModal({ clinician, agencies, onClose, onSave }) {
  const [form, setForm] = useState(clinician || {
    name: '', title: '', email: '', payRate: 0, agencies: []
  });
  const [saving, setSaving] = useState(false);

  const toggleAgency = (id) => {
    setForm(f => {
      const current = f.agencies || [];
      const has = current.includes(id);
      return { ...f, agencies: has ? current.filter(a => a !== id) : [...current, id] };
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = clinician
        ? `/api/settings/clinicians/${clinician._id}`
        : '/api/settings/clinicians';
      const res = await fetch(url, {
        method: clinician ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const saved = await res.json();
      onSave(saved);
      onClose();
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b">
          <h2 className="font-bold">{clinician ? 'Edit Clinician' : 'Add Clinician'}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="PTA, RN, OT..." className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pay Rate ($/hr)</label>
              <input type="number" step="0.01" value={form.payRate || 0}
                onChange={e => setForm(f => ({ ...f, payRate: Number(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Assigned Agencies</label>
            <div className="space-y-1 max-h-36 overflow-auto border rounded-lg p-2">
              {agencies.map(a => (
                <label key={a._id} className="flex items-center gap-2 cursor-pointer text-sm py-1">
                  <input type="checkbox"
                    checked={(form.agencies || []).includes(a._id)}
                    onChange={() => toggleAgency(a._id)}
                  />
                  {a.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Patient Modal ───────────────────────────────────────────────────────────

function PatientModal({ patient, agencies, onClose, onSave }) {
  const [form, setForm] = useState(patient ? {
    name: patient.name || '',
    agencyId: patient.agencyId?._id || patient.agencyId || '',
    clinicalRecordNumber: patient.clinicalRecordNumber || '',
    address: patient.address || '',
    notes: patient.notes || ''
  } : {
    name: '', agencyId: '', clinicalRecordNumber: '', address: '', notes: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = patient ? `/api/settings/patients/${patient._id}` : '/api/settings/patients';
      const method = patient ? 'PUT' : 'POST';
      const body = { ...form };
      if (!body.agencyId) delete body.agencyId;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const saved = await res.json();
      onSave(saved);
      onClose();
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b">
          <h2 className="font-bold">{patient ? 'Edit Patient' : 'Add Patient'}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Patient Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Last, First" className="w-full border rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Agency</label>
            <select value={form.agencyId} onChange={e => setForm(f => ({ ...f, agencyId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">— None —</option>
              {agencies.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Clinical Record #</label>
              <input value={form.clinicalRecordNumber} onChange={e => setForm(f => ({ ...f, clinicalRecordNumber: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

/* ── Agencies Tab with Search + Pagination ── */
function AgenciesTab({ agencies, onEdit, onDelete }) {
  const FIELDS = ['name', 'contactName', 'contactEmail', a => a.address];
  const { search, setSearch, page, setPage, filtered, paginated, totalPages } = useSearchPaginate(agencies, FIELDS);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold">Agencies ({fmtNum(filtered.length)} of {fmtNum(agencies.length)})</h2>
        <div className="flex items-center gap-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Search agencies..." />
          <button onClick={() => onEdit('new')} className="btn-primary text-sm">+ Add</button>
        </div>
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="table-header">Name</th>
              <th className="table-header">Contact</th>
              <th className="table-header">Default Rate</th>
              <th className="table-header">Rates</th>
              <th className="table-header">Status</th>
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">
                {search ? 'No agencies match your search' : 'No agencies yet'}
              </td></tr>
            ) : paginated.map(a => {
              const rateCount = Object.keys(a.rates || {}).length;
              return (
                <tr key={a._id} className="border-b hover:bg-gray-50">
                  <td className="table-cell font-medium">{a.name}</td>
                  <td className="table-cell text-sm">
                    <div>{a.contactName}</div>
                    <div className="text-gray-400 text-xs">{a.contactEmail}</div>
                  </td>
                  <td className="table-cell">${a.billingRate?.default || 0}/hr</td>
                  <td className="table-cell text-sm">
                    {rateCount > 0
                      ? <span className="badge bg-green-100 text-green-700">{rateCount} code{rateCount !== 1 ? 's' : ''}</span>
                      : <span className="text-gray-400 text-xs">Default</span>}
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {a.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(a)} className="text-blue-600 text-xs hover:underline">Edit</button>
                      {a.active && <button onClick={() => onDelete(a._id)} className="text-red-500 text-xs hover:underline">Deactivate</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <PaginationBar page={page} totalPages={totalPages} setPage={setPage}
          filteredCount={filtered.length} totalCount={agencies.length} />
      </div>
    </div>
  );
}

/* ── Patients Tab with Search + Pagination ── */
function PatientsTab({ patients, onEdit, onDelete }) {
  const FIELDS = ['name', p => p.agencyId?.name, 'address', 'clinicalRecordNumber'];
  const { search, setSearch, page, setPage, filtered, paginated, totalPages } = useSearchPaginate(patients, FIELDS);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold">Patients ({fmtNum(filtered.length)} of {fmtNum(patients.length)})</h2>
          <p className="text-xs text-gray-400 mt-0.5">OCR fuzzy-matches against this list</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Search patients..." />
          <button onClick={() => onEdit('new')} className="btn-primary text-sm">+ Add</button>
        </div>
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="table-header">Name</th>
              <th className="table-header">Agency</th>
              <th className="table-header">Record #</th>
              {/* address hidden */}
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">
                {search ? 'No patients match your search' : 'No patients yet'}
              </td></tr>
            ) : paginated.map(p => (
              <tr key={p._id} className="border-b hover:bg-gray-50">
                <td className="table-cell font-medium">{p.name}</td>
                <td className="table-cell text-sm">{p.agencyId?.name || <span className="text-gray-400">—</span>}</td>
                <td className="table-cell text-sm text-gray-500">{p.clinicalRecordNumber || '—'}</td>
                {/* address hidden for demo */}
                <td className="table-cell">
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(p)} className="text-blue-600 text-xs hover:underline">Edit</button>
                    <button onClick={() => onDelete(p._id)} className="text-red-500 text-xs hover:underline">Deactivate</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar page={page} totalPages={totalPages} setPage={setPage}
          filteredCount={filtered.length} totalCount={patients.length} />
      </div>
    </div>
  );
}

/* ── Clinicians Tab with Search + Pagination ── */
function CliniciansTab({ clinicians, onEdit, onDelete }) {
  const FIELDS = ['name', 'title', c => (c.agencies || []).map(a => a.name).join(' ')];
  const { search, setSearch, page, setPage, filtered, paginated, totalPages } = useSearchPaginate(clinicians, FIELDS);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold">Clinicians ({fmtNum(filtered.length)} of {fmtNum(clinicians.length)})</h2>
        <div className="flex items-center gap-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Search clinicians..." />
          <button onClick={() => onEdit('new')} className="btn-primary text-sm">+ Add</button>
        </div>
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="table-header">Name</th>
              <th className="table-header">Title</th>
              <th className="table-header">Pay Rate</th>
              <th className="table-header">Agencies</th>
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">
                {search ? 'No clinicians match your search' : 'No clinicians yet'}
              </td></tr>
            ) : paginated.map(c => (
              <tr key={c._id} className="border-b hover:bg-gray-50">
                <td className="table-cell font-medium">{c.name}</td>
                <td className="table-cell"><span className="badge bg-blue-100 text-blue-700">{c.title || '—'}</span></td>
                <td className="table-cell">{c.payRate ? `$${c.payRate}/hr` : '—'}</td>
                <td className="table-cell text-xs text-gray-500">{(c.agencies || []).map(a => a.name).join(', ') || '—'}</td>
                <td className="table-cell">
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(c)} className="text-blue-600 text-xs hover:underline">Edit</button>
                    <button onClick={() => onDelete(c._id)} className="text-red-500 text-xs hover:underline">Deactivate</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar page={page} totalPages={totalPages} setPage={setPage}
          filteredCount={filtered.length} totalCount={clinicians.length} />
      </div>
    </div>
  );
}

export default function Settings() {
  const [agencies,        setAgencies]        = useState([]);
  const [clinicians,      setClinicians]      = useState([]);
  const [periods,         setPeriods]         = useState([]);
  const [billingCodes,    setBillingCodes]    = useState([]);
  const [gmailStatus,     setGmailStatus]     = useState(null);
  const [generalSettings, setGeneralSettings] = useState({});
  const [loading,         setLoading]         = useState(true);
  const [tab,             setTab]             = useState('agencies');
  const [patients,        setPatients]        = useState([]);
  const [agencyModal,     setAgencyModal]     = useState(null);
  const [clinicianModal,  setClinicianModal]  = useState(null);
  const [patientModal,    setPatientModal]    = useState(null);
  const [savingSettings,  setSavingSettings]  = useState(false);

  // ── Billing Codes tab state
  const [editingCode,  setEditingCode]  = useState(null);
  const [editCodeForm, setEditCodeForm] = useState({});
  const [addingCode,   setAddingCode]   = useState(false);
  const [newCodeForm,  setNewCodeForm]  = useState({ code: '', description: '', defaultRate: 0 });

  // ── Billing Periods tab state
  const [editingPeriodId, setEditingPeriodId] = useState(null);
  const [editPeriodForm,  setEditPeriodForm]  = useState({ startDate: '', endDate: '' });

  // ── Cycle Settings state
  const [cycleSettings, setCycleSettings] = useState({
    startDay: 'Sunday',
    cycleLength: 'Biweekly',
    anchorDate: '2026-02-16'
  });
  const [savingCycle, setSavingCycle] = useState(false);

  // ── Backfill tab state
  const [backfillPeriodId, setBackfillPeriodId] = useState('');
  const [backfillFiles,    setBackfillFiles]    = useState(null);
  const [backfillProgress, setBackfillProgress] = useState([]);
  const [backfillLoading,  setBackfillLoading]  = useState(false);
  const backfillFileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const [agRes, clRes, perRes, gmRes, setRes, bcRes, ptRes] = await Promise.all([
        fetch('/api/settings/agencies/all'),
        fetch('/api/settings/clinicians'),
        fetch('/api/settings/billing-periods'),
        fetch('/api/settings/gmail/status'),
        fetch('/api/settings'),
        fetch('/api/settings/billing-codes'),
        fetch('/api/settings/patients')
      ]);
      setAgencies(await agRes.json());
      setClinicians(await clRes.json());
      setPeriods(await perRes.json());
      setGmailStatus(await gmRes.json());
      const settingsData = await setRes.json();
      setGeneralSettings(settingsData);
      setPatients(await ptRes.json());
      // Hydrate cycle settings if saved
      if (settingsData.billingCycle) {
        setCycleSettings(s => ({ ...s, ...settingsData.billingCycle }));
      }
      setBillingCodes(await bcRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Agencies helpers
  const deleteAgency = async (id) => {
    if (!confirm('Deactivate this agency?')) return;
    await fetch(`/api/settings/agencies/${id}`, { method: 'DELETE' });
    setAgencies(list => list.map(a => a._id === id ? { ...a, active: false } : a));
  };

  // ── Patients helpers
  const deletePatient = async (id) => {
    if (!confirm('Deactivate this patient?')) return;
    await fetch(`/api/settings/patients/${id}`, { method: 'DELETE' });
    setPatients(p => p.filter(x => x._id !== id));
  };

  // ── Clinicians helpers
  const deleteClinician = async (id) => {
    if (!confirm('Deactivate this clinician?')) return;
    await fetch(`/api/settings/clinicians/${id}`, { method: 'DELETE' });
    setClinicians(c => c.filter(x => x._id !== id));
  };

  // ── General Settings
  const saveGeneralSettings = async () => {
    setSavingSettings(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generalSettings)
      });
      alert('Settings saved');
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Billing Periods
  const createPeriod = async () => {
    const start = prompt('Start date (YYYY-MM-DD):');
    if (!start) return;
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000);
    const res = await fetch('/api/settings/billing-periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate })
    });
    const created = await res.json();
    setPeriods(p => [created, ...p]);
  };

  const startEditPeriod = (p) => {
    setEditingPeriodId(p._id);
    const fmt = (d) => new Date(d).toISOString().slice(0, 10);
    setEditPeriodForm({ startDate: fmt(p.startDate), endDate: fmt(p.endDate) });
  };

  const saveEditPeriod = async (id) => {
    const res = await fetch(`/api/settings/billing-periods/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editPeriodForm)
    });
    const updated = await res.json();
    setPeriods(list => list.map(p => p._id === id ? updated : p));
    setEditingPeriodId(null);
  };

  const deletePeriod = async (id) => {
    if (!confirm('Delete this billing period? Timesheets assigned to it will become unassigned.')) return;
    await fetch(`/api/settings/billing-periods/${id}`, { method: 'DELETE' });
    setPeriods(p => p.filter(x => x._id !== id));
  };

  // ── Cycle Settings
  const saveCycleSettings = async () => {
    setSavingCycle(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...generalSettings, billingCycle: cycleSettings })
      });
      setGeneralSettings(s => ({ ...s, billingCycle: cycleSettings }));
      alert('Cycle settings saved');
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setSavingCycle(false);
    }
  };

  // ── Billing Code CRUD
  const startEditCode = (bc) => {
    setEditingCode(bc._id);
    setEditCodeForm({ code: bc.code, description: bc.description, defaultRate: bc.defaultRate });
  };

  const saveEditCode = async (id) => {
    const res = await fetch(`/api/settings/billing-codes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editCodeForm)
    });
    const updated = await res.json();
    setBillingCodes(list => list.map(bc => bc._id === id ? updated : bc));
    setEditingCode(null);
  };

  const deleteCode = async (id) => {
    if (!confirm('Remove this billing code?')) return;
    await fetch(`/api/settings/billing-codes/${id}`, { method: 'DELETE' });
    setBillingCodes(list => list.filter(bc => bc._id !== id));
  };

  const createCode = async () => {
    if (!newCodeForm.code.trim()) { alert('Code is required'); return; }
    const res = await fetch('/api/settings/billing-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCodeForm)
    });
    const created = await res.json();
    if (created.error) { alert(created.error); return; }
    setBillingCodes(list => [...list, created]);
    setNewCodeForm({ code: '', description: '', defaultRate: 0 });
    setAddingCode(false);
  };

  // ── Backfill upload
  const handleBackfillUpload = async () => {
    if (!backfillPeriodId) { alert('Select a billing period first'); return; }
    if (!backfillFiles?.length) { alert('Select at least one image'); return; }

    setBackfillLoading(true);
    const progress = Array.from(backfillFiles).map(f => ({ name: f.name, status: 'pending' }));
    setBackfillProgress(progress);

    for (let i = 0; i < backfillFiles.length; i++) {
      const file = backfillFiles[i];
      setBackfillProgress(p => p.map((item, idx) => idx === i ? { ...item, status: 'uploading…' } : item));
      try {
        const fd = new FormData();
        fd.append('timesheet', file);
        fd.append('billingPeriodId', backfillPeriodId);
        const res = await fetch('/api/timesheets/upload', { method: 'POST', body: fd });
        const data = await res.json();
        setBackfillProgress(p => p.map((item, idx) => idx === i
          ? { ...item, status: data.success ? '✅ queued for OCR' : `❌ ${data.error}` }
          : item
        ));
      } catch (e) {
        setBackfillProgress(p => p.map((item, idx) => idx === i
          ? { ...item, status: `❌ ${e.message}` }
          : item
        ));
      }
    }
    setBackfillLoading(false);
  };

  const tabs = [
    { id: 'agencies',      label: 'Agencies' },
    { id: 'patients',      label: 'Patients' },
    { id: 'clinicians',    label: 'Clinicians' },
    { id: 'periods',       label: 'Billing Periods' },
    { id: 'billing-codes', label: 'Billing Codes' },
    { id: 'backfill',      label: 'Backfill' },
    { id: 'general',       label: 'General' },
    { id: 'gmail',         label: 'Gmail' }
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="animate-pulse space-y-3 py-6">{[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-gray-200 rounded"></div>)}</div> : (
        <>
          {/* ─── Agencies ─────────────────────────────────────────────── */}
          {tab === 'agencies' && (
            <AgenciesTab agencies={agencies} onEdit={setAgencyModal} onDelete={deleteAgency} />
          )}

          {tab === 'patients' && (
            <PatientsTab patients={patients} onEdit={setPatientModal} onDelete={deletePatient} />
          )}

          {tab === 'clinicians' && (
            <CliniciansTab clinicians={clinicians} onEdit={setClinicianModal} onDelete={deleteClinician} />
          )}

          {/* ─── Billing Periods ──────────────────────────────────────── */}
          {tab === 'periods' && (
            <div>
              {/* ── Cycle Settings section ── */}
              <div className="card mb-6">
                <h3 className="font-semibold mb-1">Cycle Settings</h3>
                <p className="text-xs text-gray-400 mb-4">Billing periods will auto-generate based on these rules</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Day</label>
                    <select
                      value={cycleSettings.startDay}
                      onChange={e => setCycleSettings(s => ({ ...s, startDay: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Cycle Length</label>
                    <select
                      value={cycleSettings.cycleLength}
                      onChange={e => setCycleSettings(s => ({ ...s, cycleLength: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="Biweekly">Biweekly (every 2 weeks)</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Anchor Date</label>
                    <input
                      type="date"
                      value={cycleSettings.anchorDate}
                      onChange={e => setCycleSettings(s => ({ ...s, anchorDate: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">Date of the first cycle start</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoGenPeriod"
                    checked={!!cycleSettings.autoGenerate}
                    onChange={e => setCycleSettings(s => ({ ...s, autoGenerate: e.target.checked }))}
                  />
                  <label htmlFor="autoGenPeriod" className="text-sm text-gray-600">
                    Auto-generate next period when current one closes
                  </label>
                </div>
                <div className="mt-4">
                  <button onClick={saveCycleSettings} disabled={savingCycle} className="btn-primary">
                    {savingCycle ? 'Saving...' : 'Save Cycle Settings'}
                  </button>
                </div>
              </div>

              <div className="flex justify-between mb-4">
                <h2 className="font-semibold">Billing Periods</h2>
                <button onClick={createPeriod} className="btn-primary">+ New Period</button>
              </div>
              <div className="card p-0 overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="table-header">Period</th>
                      <th className="table-header">Start</th>
                      <th className="table-header">End</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Invoiced</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-gray-400">
                        No billing periods. One will be auto-created when you upload a timesheet.
                      </td></tr>
                    ) : periods.map(p => (
                      editingPeriodId === p._id ? (
                        <tr key={p._id} className="border-b bg-blue-50/30">
                          <td className="table-cell font-medium text-gray-400 text-xs italic">editing…</td>
                          <td className="table-cell">
                            <input
                              type="date"
                              value={editPeriodForm.startDate}
                              onChange={e => setEditPeriodForm(f => ({ ...f, startDate: e.target.value }))}
                              className="border rounded px-2 py-1 text-sm w-36"
                            />
                          </td>
                          <td className="table-cell">
                            <input
                              type="date"
                              value={editPeriodForm.endDate}
                              onChange={e => setEditPeriodForm(f => ({ ...f, endDate: e.target.value }))}
                              className="border rounded px-2 py-1 text-sm w-36"
                            />
                          </td>
                          <td className="table-cell" />
                          <td className="table-cell" />
                          <td className="table-cell">
                            <div className="flex gap-2">
                              <button onClick={() => saveEditPeriod(p._id)} className="text-green-600 text-xs hover:underline">Save</button>
                              <button onClick={() => setEditingPeriodId(null)} className="text-gray-400 text-xs hover:underline">Cancel</button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={p._id} className="border-b hover:bg-gray-50">
                          <td className="table-cell font-medium">{p.label}</td>
                          <td className="table-cell text-xs">{new Date(p.startDate).toLocaleDateString()}</td>
                          <td className="table-cell text-xs">{new Date(p.endDate).toLocaleDateString()}</td>
                          <td className="table-cell">
                            <span className={`badge ${
                              p.status === 'open'     ? 'bg-green-100 text-green-700' :
                              p.status === 'closed'   ? 'bg-yellow-100 text-yellow-700' :
                                                         'bg-purple-100 text-purple-700'
                            }`}>{p.status}</span>
                          </td>
                          <td className="table-cell">{p.invoicesGenerated ? '✅' : '—'}</td>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              <button onClick={() => startEditPeriod(p)} className="text-blue-600 text-xs hover:underline">Edit</button>
                              <button onClick={() => deletePeriod(p._id)} className="text-red-500 text-xs hover:underline">Delete</button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── Billing Codes ────────────────────────────────────────── */}
          {tab === 'billing-codes' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold">Billing Codes</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Master list of visit types used in the rate matrix</p>
                </div>
                <button onClick={() => setAddingCode(true)} className="btn-primary">+ Add Code</button>
              </div>

              <div className="card p-0 overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="table-header w-24">Code</th>
                      <th className="table-header">Description</th>
                      <th className="table-header w-36">Default Rate</th>
                      <th className="table-header w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingCodes.map(bc => (
                      editingCode === bc._id ? (
                        <tr key={bc._id} className="border-b bg-blue-50/30">
                          <td className="table-cell">
                            <input value={editCodeForm.code}
                              onChange={e => setEditCodeForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                              className="border rounded px-2 py-1 text-sm w-20 font-mono" />
                          </td>
                          <td className="table-cell">
                            <input value={editCodeForm.description}
                              onChange={e => setEditCodeForm(f => ({ ...f, description: e.target.value }))}
                              className="border rounded px-2 py-1 text-sm w-full" />
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 text-xs">$</span>
                              <input type="number" step="0.01" value={editCodeForm.defaultRate}
                                onChange={e => setEditCodeForm(f => ({ ...f, defaultRate: Number(e.target.value) }))}
                                className="border rounded px-2 py-1 text-sm w-24 text-right" />
                            </div>
                          </td>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              <button onClick={() => saveEditCode(bc._id)} className="text-green-600 text-xs hover:underline">Save</button>
                              <button onClick={() => setEditingCode(null)} className="text-gray-400 text-xs hover:underline">Cancel</button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={bc._id} className="border-b hover:bg-gray-50">
                          <td className="table-cell font-mono font-semibold text-blue-700">{bc.code}</td>
                          <td className="table-cell text-sm text-gray-600">{bc.description || '—'}</td>
                          <td className="table-cell font-medium">${bc.defaultRate}/visit</td>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              <button onClick={() => startEditCode(bc)} className="text-blue-600 text-xs hover:underline">Edit</button>
                              <button onClick={() => deleteCode(bc._id)} className="text-red-500 text-xs hover:underline">Delete</button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}

                    {addingCode && (
                      <tr className="border-t bg-green-50/30">
                        <td className="table-cell">
                          <input value={newCodeForm.code}
                            onChange={e => setNewCodeForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                            placeholder="CODE" maxLength={10}
                            className="border rounded px-2 py-1 text-sm w-20 font-mono" autoFocus />
                        </td>
                        <td className="table-cell">
                          <input value={newCodeForm.description}
                            onChange={e => setNewCodeForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Description"
                            className="border rounded px-2 py-1 text-sm w-full" />
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-400 text-xs">$</span>
                            <input type="number" step="0.01" value={newCodeForm.defaultRate}
                              onChange={e => setNewCodeForm(f => ({ ...f, defaultRate: Number(e.target.value) }))}
                              className="border rounded px-2 py-1 text-sm w-24 text-right" />
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="flex gap-2">
                            <button onClick={createCode} className="text-green-600 text-xs hover:underline">Add</button>
                            <button onClick={() => setAddingCode(false)} className="text-gray-400 text-xs hover:underline">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {billingCodes.length === 0 && !addingCode && (
                      <tr><td colSpan={4} className="text-center py-10 text-gray-400">
                        No billing codes. Click "+ Add Code" or refresh to seed defaults.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── Backfill ────────────────────────────────────────────── */}
          {tab === 'backfill' && (
            <div className="max-w-xl">
              <h2 className="font-semibold mb-1">Backfill Timesheets</h2>
              <p className="text-sm text-gray-500 mb-4">
                Upload historical timesheet images and assign them to a specific billing period.
                Each image will be OCR-processed and attached to the selected period.
              </p>

              <div className="card space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Billing Period *</label>
                  <select value={backfillPeriodId} onChange={e => setBackfillPeriodId(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Select a period...</option>
                    {periods.map(p => <option key={p._id} value={p._id}>{p.label}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Don't see the period? Create it in the "Billing Periods" tab first.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Timesheet Images *</label>
                  <input
                    ref={backfillFileRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png"
                    onChange={e => {
                      setBackfillFiles(e.target.files);
                      setBackfillProgress([]);
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3
                               file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700
                               hover:file:bg-blue-100"
                  />
                  {backfillFiles?.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {backfillFiles.length} file{backfillFiles.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                {backfillProgress.length > 0 && (
                  <div className="border rounded-lg divide-y text-sm bg-gray-50">
                    {backfillProgress.map((item, i) => (
                      <div key={i} className="px-3 py-2 flex items-center justify-between">
                        <span className="text-gray-700 truncate max-w-[60%]" title={item.name}>{item.name}</span>
                        <span className={`text-xs font-medium ${
                          item.status.startsWith('✅') ? 'text-green-600' :
                          item.status.startsWith('❌') ? 'text-red-600' :
                          'text-blue-500'
                        }`}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleBackfillUpload}
                  disabled={backfillLoading || !backfillPeriodId || !backfillFiles?.length}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {backfillLoading
                    ? 'Uploading…'
                    : `Upload & Process ${backfillFiles?.length || 0} Timesheet${(backfillFiles?.length || 0) !== 1 ? 's' : ''}`
                  }
                </button>

                {backfillProgress.length > 0 && !backfillLoading && (
                  <p className="text-xs text-center text-gray-400">
                    Done! View results on the{' '}
                    <a href="/timesheets" className="text-blue-600 hover:underline">Timesheets page</a>.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ─── General Settings ─────────────────────────────────────── */}
          {tab === 'general' && (
            <div className="max-w-lg">
              <h2 className="font-semibold mb-4">General Settings</h2>
              <div className="card space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Biller Name</label>
                  <input
                    value={generalSettings.biller_name ?? ''}
                    onChange={e => setGeneralSettings(s => ({ ...s, biller_name: e.target.value }))}
                    placeholder="Tampa Bay OT LLC"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Default Billing Rate ($/hr)</label>
                  <input
                    type="number"
                    value={generalSettings.default_billing_rate ?? ''}
                    onChange={e => setGeneralSettings(s => ({ ...s, default_billing_rate: Number(e.target.value) }))}
                    placeholder="75"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Company Address</label>
                  <textarea
                    value={generalSettings.company_address ?? ''}
                    onChange={e => setGeneralSettings(s => ({ ...s, company_address: e.target.value }))}
                    rows={2}
                    placeholder="123 Main St, Tampa, FL 33601"
                    className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Invoice Footer / Notes</label>
                  <textarea
                    value={generalSettings.invoice_footer ?? ''}
                    onChange={e => setGeneralSettings(s => ({ ...s, invoice_footer: e.target.value }))}
                    rows={2}
                    placeholder="Thank you for your business."
                    className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoGen"
                    checked={!!generalSettings.auto_generate_invoices}
                    onChange={e => setGeneralSettings(s => ({ ...s, auto_generate_invoices: e.target.checked }))}
                  />
                  <label htmlFor="autoGen" className="text-sm">Auto-generate invoices when billing period closes</label>
                </div>
                <button onClick={saveGeneralSettings} disabled={savingSettings} className="btn-primary">
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}

          {/* ─── Gmail Settings ───────────────────────────────────────── */}
          {tab === 'gmail' && (
            <div className="max-w-lg">
              <h2 className="font-semibold mb-4">Gmail Integration</h2>
              <div className="card">
                <div className={`flex items-center gap-3 p-4 rounded-lg mb-4 ${
                  gmailStatus?.configured
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <span className={`w-3 h-3 rounded-full ${gmailStatus?.configured ? 'bg-green-500' : 'bg-yellow-500'}`}/>
                  <div>
                    <div className="font-medium text-sm">
                      {gmailStatus?.configured ? 'Connected' : 'Not Connected — Stub Mode'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {gmailStatus?.userEmail || 'No email configured'}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>To connect Gmail:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Create a Google Service Account with Gmail API access</li>
                    <li>Download the credentials JSON</li>
                    <li>Place it at <code className="bg-gray-100 px-1 rounded">/app/data/credentials/gmail.json</code></li>
                    <li>Set <code className="bg-gray-100 px-1 rounded">GMAIL_USER_EMAIL</code> in your .env</li>
                    <li>Restart the container</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Agency Modal */}
      {agencyModal && (
        <AgencyModal
          agency={agencyModal === 'new' ? null : agencyModal}
          onClose={() => setAgencyModal(null)}
          onSave={(saved) => {
            setAgencies(list => {
              const idx = list.findIndex(a => a._id === saved._id);
              if (idx >= 0) { const n = [...list]; n[idx] = saved; return n; }
              return [saved, ...list];
            });
            setAgencyModal(null);
          }}
        />
      )}

      {/* Patient Modal */}
      {patientModal && (
        <PatientModal
          patient={patientModal === 'new' ? null : patientModal}
          agencies={agencies.filter(a => a.active)}
          onClose={() => setPatientModal(null)}
          onSave={(saved) => {
            setPatients(list => {
              const idx = list.findIndex(p => p._id === saved._id);
              if (idx >= 0) { const n = [...list]; n[idx] = saved; return n; }
              return [saved, ...list];
            });
            setPatientModal(null);
          }}
        />
      )}

      {/* Clinician Modal */}
      {clinicianModal && (
        <ClinicianModal
          clinician={clinicianModal === 'new' ? null : clinicianModal}
          agencies={agencies.filter(a => a.active)}
          onClose={() => setClinicianModal(null)}
          onSave={(saved) => {
            setClinicians(list => {
              const idx = list.findIndex(c => c._id === saved._id);
              if (idx >= 0) { const n = [...list]; n[idx] = saved; return n; }
              return [saved, ...list];
            });
            setClinicianModal(null);
          }}
        />
      )}
    </div>
  );
}
