import React, { useState, useEffect, useCallback } from 'react';
import PeriodSelector from '../components/PeriodSelector';
import { SkeletonDashboard } from '../components/Skeleton';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

function fmtNum(n) {
  return new Intl.NumberFormat('en-US').format(n || 0);
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PctChange({ current, previous, invert = false }) {
  if (previous == null || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.1) return null;
  const isUp = pct > 0;
  const isGood = invert ? !isUp : isUp;
  return (
    <span className={`text-xs font-medium ml-1 ${isGood ? 'text-green-400' : 'text-red-400'}`}>
      {isUp ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/* ── Collapsible Section ── */
function Section({ title, icon, badge, defaultOpen = false, onOpen, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const [loaded, setLoaded] = useState(defaultOpen);

  const toggle = () => {
    if (!open && !loaded) {
      setLoaded(true);
      if (onOpen) onOpen();
    }
    setOpen(!open);
  };

  return (
    <div className="card mb-3">
      <button onClick={toggle} className="w-full flex items-center justify-between py-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h2 className="font-semibold text-gray-800">{title}</h2>
          {badge && (
            <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="mt-3">{loaded ? children : <div className="py-4 text-center text-gray-400">Loading...</div>}</div>}
    </div>
  );
}

/* ── Invoice Previews (lazy loaded) ── */
function InvoicePreviews({ period }) {
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (period?.startDate) q.set('startDate', period.startDate);
    if (period?.endDate) q.set('endDate', period.endDate);
    fetch(`/api/invoices/preview?${q}`).then(r => r.json()).then(d => {
      setPreviews(d.previews || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period?.startDate, period?.endDate]);

  if (loading) return <div className="py-4 text-center text-gray-400">Loading previews...</div>;
  if (!previews.length) return <div className="py-4 text-center text-gray-400">No previews for current period.</div>;

  return (
    <div className="space-y-4">
      {previews.slice(0, 5).map((p, i) => (
        <div key={i} className="border rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-gray-800">{p.agency.name}</span>
              <span className="text-gray-400 text-sm ml-2">({fmtNum(p.timesheetCount)} timesheets)</span>
            </div>
            <div className="text-lg font-bold text-green-600">{fmt(p.total)}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[450px] text-[11px] md:text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Patient</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Clinician</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Date</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Type</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {p.lineItems.slice(0, 20).map((li, j) => (
                  <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-800">{li.patientName}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {li.clinicianName}
                      {li.clinicianTitle && <span className="ml-1 text-gray-400 text-xs">({li.clinicianTitle})</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">{li.date}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="badge bg-blue-100 text-blue-700">{li.careType || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-800">{fmt(li.amount)}</td>
                  </tr>
                ))}
                {p.lineItems.length > 20 && (
                  <tr><td colSpan={5} className="px-3 py-2 text-center text-gray-400 text-xs">
                    +{fmtNum(p.lineItems.length - 20)} more line items
                  </td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-green-50 font-semibold">
                  <td colSpan="4" className="px-3 py-2 text-right text-gray-700">Total ({fmtNum(p.totalVisits)} visits):</td>
                  <td className="px-3 py-2 text-right text-green-700">{fmt(p.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
      {previews.length > 5 && (
        <p className="text-center text-gray-400 text-sm">+{previews.length - 5} more agencies</p>
      )}
    </div>
  );
}

/* ── Timesheet Summary by Agency (lazy loaded) ── */
function TimesheetSummary({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const q = new URLSearchParams({ limit: 5000 });
    if (period?.startDate) q.set('startDate', period.startDate);
    if (period?.endDate) q.set('endDate', period.endDate);
    fetch(`/api/timesheets?${q}`).then(r => r.json()).then(d => {
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="py-4 text-center text-gray-400">Loading timesheet data...</div>;
  if (!data?.data?.length) return <div className="py-4 text-center text-gray-400">No timesheets found.</div>;

  const summary = {};
  for (const ts of data.data) {
    const d = ts.manualData || ts.ocrData || {};
    const agency = d.company || ts.agencyId?.name || 'Unknown Agency';
    const employee = d.employeeName || ts.clinicianId?.name || 'Unknown';
    const title = d.employeeTitle || ts.clinicianId?.title || '';
    if (!summary[agency]) summary[agency] = {};
    if (!summary[agency][employee]) summary[agency][employee] = { title, timesheets: 0, visits: 0, minutes: 0 };
    summary[agency][employee].timesheets += 1;
    const visits = d.visits || [];
    summary[agency][employee].visits += visits.length;
    summary[agency][employee].minutes += visits.reduce((s, v) => s + (v.durationMinutes || 0), 0);
  }
  const sortedAgencies = Object.keys(summary).sort();

  return (
    <div className="space-y-2">
      {sortedAgencies.map(agency => {
        const employees = summary[agency];
        const sortedEmps = Object.entries(employees).sort((a, b) => a[0].localeCompare(b[0]));
        const agencyTotalVisits = sortedEmps.reduce((s, [, e]) => s + e.visits, 0);
        const agencyTotalMins = sortedEmps.reduce((s, [, e]) => s + e.minutes, 0);
        const isExpanded = expanded[agency];

        return (
          <div key={agency} className="border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(p => ({ ...p, [agency]: !p[agency] }))}
              className="w-full bg-gray-50 px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <span className="font-semibold text-gray-800">{agency}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{fmtNum(agencyTotalVisits)} visits · {(agencyTotalMins / 60).toFixed(1)} hrs</span>
                <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
              </div>
            </button>
            {isExpanded && (
              <table className="w-full text-[11px] md:text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Employee</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Title</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Timesheets</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Visits</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEmps.map(([emp, info], j) => (
                    <tr key={emp} className={j % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-medium text-gray-800">{emp}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="badge bg-blue-100 text-blue-700">{info.title || '—'}</span>
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600">{fmtNum(info.timesheets)}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{fmtNum(info.visits)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{(info.minutes / 60).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Overview ── */
export default function Overview() {
  const [invoiceStats, setInvoiceStats] = useState(null);
  const [payrollStats, setPayrollStats] = useState(null);
  const [revenueStats, setRevenueStats] = useState(null);
  const [tsStatusCounts, setTsStatusCounts] = useState({});
  const [totalTimesheets, setTotalTimesheets] = useState(0);
  const [gmailStatus, setGmailStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({ startDate: null, endDate: null, label: 'Previous Bi-Weekly' });
  const [prevPeriodStats, setPrevPeriodStats] = useState(null);

  function getPrevPeriod(p) {
    if (!p?.startDate || !p?.endDate) return null;
    const start = new Date(p.startDate + 'T00:00:00');
    const end = new Date(p.endDate + 'T00:00:00');
    const days = Math.round((end - start) / 86400000) + 1;
    const prevEnd = new Date(start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
    return { startDate: prevStart.toISOString().split('T')[0], endDate: prevEnd.toISOString().split('T')[0] };
  }

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const statsQ = new URLSearchParams();
      if (p?.startDate) statsQ.set('startDate', p.startDate);
      if (p?.endDate) statsQ.set('endDate', p.endDate);

      // Only fetch lightweight stats — no full timesheet list
      const [invRes, prRes, healthRes, revRes, tsCountRes] = await Promise.all([
        fetch(`/api/invoices/stats/summary?${statsQ}`),
        fetch(`/api/payroll?${statsQ}`),
        fetch('/api/health'),
        fetch(`/api/timesheets/revenue?${statsQ}`),
        fetch(`/api/timesheets?${statsQ}&limit=1&countOnly=true`)
      ]);

      setInvoiceStats(await invRes.json());
      setPayrollStats(await prRes.json());
      setGmailStatus((await healthRes.json()).gmail);
      setRevenueStats(await revRes.json());

      const tsData = await tsCountRes.json();
      setTotalTimesheets(tsData.total || 0);

      // Build status counts from the stats if available
      if (tsData.statusCounts) {
        setTsStatusCounts(tsData.statusCounts);
      }

      // Fetch previous period for comparison
      const prev = getPrevPeriod(p);
      if (prev) {
        try {
          const prevQ = new URLSearchParams();
          prevQ.set('startDate', prev.startDate);
          prevQ.set('endDate', prev.endDate);
          const [prevPrRes, prevRevRes] = await Promise.all([
            fetch(`/api/payroll?${prevQ}`),
            fetch(`/api/timesheets/revenue?${prevQ}`)
          ]);
          const prevPr = await prevPrRes.json();
          const prevRev = await prevRevRes.json();
          setPrevPeriodStats({
            payroll: prevPr?.totals?.payroll || 0,
            hours: prevPr?.totals?.hours || 0,
            revenue: prevRev?.totalRevenue || 0
          });
        } catch { setPrevPeriodStats(null); }
      } else {
        setPrevPeriodStats(null);
      }
    } catch (e) {
      console.error('Overview load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePeriodChange = (p) => { setPeriod(p); load(p); };
  // Don't load on mount — PeriodSelector fires onChange on init which triggers load

  const projectedRevenue = revenueStats?.totalRevenue || 0;
  const totalVisits = revenueStats?.totalVisits || 0;
  const agencyCount = revenueStats?.byAgency ? Object.keys(revenueStats.byAgency).length : 0;
  const invoicedRevenue = invoiceStats?.totalRevenue || 0;
  const payroll = payrollStats?.totals?.payroll || 0;
  const hours = payrollStats?.totals?.hours || 0;
  const profit = projectedRevenue - payroll;
  const clinicianCount = payrollStats?.rows?.length || payrollStats?.data?.length || 0;

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-gray-500 text-sm mt-1">
            Billing dashboard — <span className="font-medium">{period.label}</span>
            {period.startDate && period.endDate && (
              <span className="text-gray-400 ml-1">({fmtDate(period.startDate)} – {fmtDate(period.endDate)})</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodSelector onChange={handlePeriodChange} />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            gmailStatus?.configured ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${gmailStatus?.configured ? 'bg-green-500' : 'bg-yellow-500'}`}/>
            Gmail: {gmailStatus?.mode || '...'}
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonDashboard />
      ) : (
        <>
          {/* Main stats — always visible */}
          <div className="bg-gray-900 rounded-xl p-2 md:p-3 mb-3 md:mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="text-white font-semibold text-xs md:text-sm">📊 Billing Overview — {period.label}</h2>
              {prevPeriodStats && <span className="text-gray-500 text-[10px]">vs prior</span>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2 mb-2">
              <div className="bg-gray-800 rounded-lg p-1.5 md:p-2 text-center">
                <div className="text-[10px] md:text-xs text-gray-400">Timesheets</div>
                <div className="text-base md:text-2xl font-bold text-white">{fmtNum(totalTimesheets)}</div>
                <div className="text-[10px] md:text-xs text-gray-500">processed</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-1.5 md:p-2 text-center">
                <div className="text-[10px] md:text-xs text-gray-400">Projected Revenue</div>
                <div className="text-sm md:text-2xl font-bold text-green-400 truncate">
                  {fmt(projectedRevenue)}
                  <PctChange current={projectedRevenue} previous={prevPeriodStats?.revenue} />
                </div>
                <div className="text-[10px] md:text-xs text-gray-500">{fmtNum(totalVisits)} visits × rate</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-1.5 md:p-2 text-center">
                <div className="text-[10px] md:text-xs text-gray-400">Agencies</div>
                <div className="text-base md:text-2xl font-bold text-blue-400">{fmtNum(agencyCount)}</div>
                <div className="text-[10px] md:text-xs text-gray-500">active</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-1.5 md:p-2 text-center">
                <div className="text-[10px] md:text-xs text-gray-400">Clinicians</div>
                <div className="text-base md:text-2xl font-bold text-orange-400">{fmtNum(clinicianCount)}</div>
                <div className="text-[10px] md:text-xs text-gray-500">active</div>
              </div>
            </div>
            <div className="border-t border-gray-700 pt-2">
              <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                <div className="bg-gray-800 rounded-lg p-1.5 md:p-2 text-center">
                  <div className="text-[10px] md:text-xs text-gray-400">Hours</div>
                  <div className="text-sm md:text-xl font-bold text-white truncate">
                    {fmtNum(Math.round(hours))}h
                    <PctChange current={hours} previous={prevPeriodStats?.hours} />
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-1.5 md:p-2 text-center">
                  <div className="text-[10px] md:text-xs text-gray-400">Payroll</div>
                  <div className="text-sm md:text-xl font-bold text-red-400 truncate">
                    {fmt(payroll)}
                    <PctChange current={payroll} previous={prevPeriodStats?.payroll} invert />
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-1.5 md:p-2 text-center">
                  <div className="text-[10px] md:text-xs text-gray-400">Profit</div>
                  <div className={`text-sm md:text-xl font-bold truncate ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmt(profit)}
                  </div>
                  {projectedRevenue > 0 && (
                    <div className={`text-[10px] md:text-xs font-semibold mt-0.5 ${profit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {((profit / projectedRevenue) * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Invoice & Payment stats — always visible */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4">
            <div className="rounded-lg md:rounded-xl border bg-green-50 border-green-200 p-2 md:p-4">
              <div className="text-[10px] md:text-xs font-medium text-green-600">Paid</div>
              <div className="text-sm md:text-xl font-bold text-green-700 mt-0.5 truncate">{fmt(invoiceStats?.paid?.amount)}</div>
              <div className="text-[10px] md:text-xs text-green-500">{fmtNum(invoiceStats?.paid?.count || 0)} inv</div>
            </div>
            <div className="rounded-lg md:rounded-xl border bg-yellow-50 border-yellow-200 p-2 md:p-4">
              <div className="text-[10px] md:text-xs font-medium text-yellow-600">Outstanding</div>
              <div className="text-sm md:text-xl font-bold text-yellow-700 mt-0.5 truncate">{fmt(invoiceStats?.outstanding?.amount)}</div>
              <div className="text-[10px] md:text-xs text-yellow-500">{fmtNum(invoiceStats?.outstanding?.count || 0)} inv</div>
            </div>
            <div className="rounded-lg md:rounded-xl border bg-red-50 border-red-200 p-2 md:p-4">
              <div className="text-[10px] md:text-xs font-medium text-red-600">Overdue</div>
              <div className="text-sm md:text-xl font-bold text-red-700 mt-0.5 truncate">{fmt(invoiceStats?.overdue?.amount)}</div>
              <div className="text-[10px] md:text-xs text-red-500">{fmtNum(invoiceStats?.overdue?.count || 0)} inv</div>
            </div>
            <div className="rounded-lg md:rounded-xl border bg-gray-50 border-gray-200 p-2 md:p-4">
              <div className="text-[10px] md:text-xs font-medium text-gray-600">Drafts</div>
              <div className="text-sm md:text-xl font-bold text-gray-700 mt-0.5">{fmtNum(invoiceStats?.drafts || 0)}</div>
              <div className="text-[10px] md:text-xs text-gray-500">pending</div>
            </div>
          </div>

          {/* Collapsible sections — keyed by period to reset on change */}
          <Section key={`inv-${period.startDate}-${period.endDate}`} title="Invoice Previews" icon="📄" badge={period.label}>
            <InvoicePreviews period={period} />
          </Section>

          <Section key={`ts-${period.startDate}-${period.endDate}`} title="Timesheet Summary by Agency" icon="📋" badge={`${fmtNum(totalTimesheets)} timesheets`}>
            <TimesheetSummary period={period} />
          </Section>

          <Section title="Timesheet Status" icon="📊" defaultOpen={true}>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 md:gap-3">
              {[
                { key: 'pending',    label: 'Pending',    color: 'text-gray-500 bg-gray-100' },
                { key: 'processing', label: 'Processing', color: 'text-blue-600 bg-blue-100' },
                { key: 'processed',  label: 'Processed',  color: 'text-green-600 bg-green-100' },
                { key: 'flagged',    label: 'Flagged',    color: 'text-yellow-600 bg-yellow-100' },
                { key: 'reviewed',   label: 'Reviewed',   color: 'text-teal-600 bg-teal-100' },
                { key: 'invoiced',   label: 'Invoiced',   color: 'text-purple-600 bg-purple-100' }
              ].map(({ key, label, color }) => (
                <div key={key} className={`rounded-lg p-2 md:p-3 text-center ${color}`}>
                  <div className="text-base md:text-xl font-bold">{fmtNum(tsStatusCounts[key] || 0)}</div>
                  <div className="text-[10px] md:text-xs mt-0.5 font-medium">{label}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Quick Actions — always visible */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/dashboard/timesheets" className="btn-primary">Upload Timesheet</a>
              <a href="/dashboard/invoices" className="btn-secondary">View Invoices</a>
              <a href="/dashboard/payroll" className="btn-secondary">View Payroll</a>
              <a href="/dashboard/settings" className="btn-secondary">Manage Agencies</a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
