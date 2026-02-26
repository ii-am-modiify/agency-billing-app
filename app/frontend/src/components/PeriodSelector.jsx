import React, { useState, useEffect } from 'react';

/**
 * Calculate the start of the Nth bi-weekly period from an anchor.
 * anchor: a Monday or Sunday that starts a known bi-weekly cycle.
 * offset: 0 = current period, -1 = previous, etc.
 */
function getBiWeeklyPeriod(offset = 0) {
  // Anchor: 2026-01-04 (a Sunday, start of a known bi-weekly cycle)
  const ANCHOR = new Date('2024-12-22T00:00:00');
  const MS_PER_DAY = 86_400_000;
  const MS_PER_2W = 14 * MS_PER_DAY;

  const now = new Date();
  const elapsed = now - ANCHOR;
  const periodIndex = Math.floor(elapsed / MS_PER_2W) + offset;

  const start = new Date(ANCHOR.getTime() + periodIndex * MS_PER_2W);
  const end = new Date(start.getTime() + 13 * MS_PER_DAY);

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

function getMonthPeriod(offset = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0); // last day
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

function getQuarterPeriod(q, year) {
  // q = 1..4
  const startMonth = (q - 1) * 3; // 0, 3, 6, 9
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0); // last day of quarter
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

function resolvePreset(preset, customStart, customEnd) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentYear = now.getFullYear();
  const prevYear = currentYear - 1;

  if (preset === 'all') return { startDate: null, endDate: null, label: 'All Time' };

  if (preset === 'ytd') {
    return { startDate: `${currentYear}-01-01`, endDate: today, label: 'Year to Date' };
  }

  if (preset === 'last_year') {
    return {
      startDate: `${prevYear}-01-01`,
      endDate: `${prevYear}-12-31`,
      label: `Last Year (${prevYear})`
    };
  }

  if (preset === 'current_month') return { ...getMonthPeriod(0), label: 'Current Month' };
  if (preset === 'prev_month')    return { ...getMonthPeriod(-1), label: 'Previous Month' };

  if (preset === 'current_bw') return { ...getBiWeeklyPeriod(0), label: 'Current Bi-Weekly' };
  if (preset === 'prev_bw')    return { ...getBiWeeklyPeriod(-1), label: 'Previous Bi-Weekly' };

  const qMatch = preset.match(/^q([1-4])_(\d{4})$/);
  if (qMatch) {
    const qNum = parseInt(qMatch[1]);
    const yr = parseInt(qMatch[2]);
    return { ...getQuarterPeriod(qNum, yr), label: `Q${qNum} ${yr}` };
  }

  if (preset === 'custom') {
    return {
      startDate: customStart || null,
      endDate: customEnd || null,
      label: customStart && customEnd ? `${customStart} → ${customEnd}` : 'Custom Range'
    };
  }

  return { startDate: null, endDate: null, label: 'All Time' };
}

/**
 * PeriodSelector
 *
 * Props:
 *   onChange({ startDate, endDate, label }) — called whenever the period changes
 *   defaultPreset — initial preset value (default: 'all')
 */
export default function PeriodSelector({ onChange, defaultPreset = 'current_bw' }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const prevYear = currentYear - 1;

  const [preset, setPreset] = useState(defaultPreset);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Fire initial value
  useEffect(() => {
    if (preset !== 'custom') {
      onChange(resolvePreset(preset, '', ''));
    }
  }, []);

  const presets = [
    { value: 'all',           label: 'All Time' },
    { value: 'ytd',           label: 'Year to Date' },
    { value: 'last_year',     label: `Last Year (${prevYear})` },
    { value: 'current_month', label: 'Current Month' },
    { value: 'prev_month',    label: 'Previous Month' },
    { value: 'current_bw',    label: 'Current Bi-Weekly' },
    { value: 'prev_bw',       label: 'Previous Bi-Weekly' },
    // Current year quarters
    { value: `q1_${currentYear}`, label: `Q1 ${currentYear}` },
    { value: `q2_${currentYear}`, label: `Q2 ${currentYear}` },
    { value: `q3_${currentYear}`, label: `Q3 ${currentYear}` },
    { value: `q4_${currentYear}`, label: `Q4 ${currentYear}` },
    // Previous year quarters
    { value: `q1_${prevYear}`, label: `Q1 ${prevYear}` },
    { value: `q2_${prevYear}`, label: `Q2 ${prevYear}` },
    { value: `q3_${prevYear}`, label: `Q3 ${prevYear}` },
    { value: `q4_${prevYear}`, label: `Q4 ${prevYear}` },
    { value: 'custom',         label: 'Custom Range…' },
  ];

  const handlePresetChange = (p) => {
    setPreset(p);
    if (p !== 'custom') {
      onChange(resolvePreset(p, '', ''));
    }
  };

  const handleCustomApply = () => {
    onChange(resolvePreset('custom', customStart, customEnd));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={preset}
        onChange={e => handlePresetChange(e.target.value)}
        className="border rounded-lg px-3 py-2 text-sm"
      >
        {presets.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      {preset === 'custom' && (
        <>
          <input
            type="date"
            value={customStart}
            onChange={e => setCustomStart(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleCustomApply}
            className="btn-primary text-sm px-3 py-2"
          >
            Apply
          </button>
        </>
      )}
    </div>
  );
}
