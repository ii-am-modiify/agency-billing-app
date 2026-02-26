import React from 'react';

export default function Landing({ onEnter }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 text-white">
      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-8 text-center">
        <div className="inline-block bg-blue-600/20 border border-blue-500/30 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-6">
          🏥 Built by Tech Adventures for a real client
        </div>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          She was spending every weekend<br />
          <span className="text-blue-400">typing data from handwritten timecards.</span>
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
          We built a system that does it in seconds. Now she just reviews and clicks send.
        </p>
        <button
          onClick={onEnter}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all hover:scale-105 shadow-lg shadow-blue-600/30"
        >
          Try the Live Demo →
        </button>
        <p className="text-gray-500 text-sm mt-3">No login required. Fully interactive.</p>
      </div>

      {/* Dashboard Screenshot */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/10">
          <img src="/screenshots/dashboard.png" alt="Billing Dashboard" className="w-full" />
        </div>
      </div>

      {/* Pain Points */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-center text-2xl font-bold mb-2 text-gray-200">The Problem</h2>
        <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto">
          If you run a home health agency, staffing company, or any business that processes timesheets — this probably sounds familiar.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              emoji: '📱',
              title: 'Photos of Timecards',
              desc: 'Clinicians text photos of handwritten timesheets. Someone has to read every one and type the data into spreadsheets. Every. Single. Week.'
            },
            {
              emoji: '⏰',
              title: 'Weekends Gone',
              desc: 'The owner was spending 8-12 hours every weekend just on data entry. That\'s not running a business — that\'s being trapped by it.'
            },
            {
              emoji: '😤',
              title: 'Errors & Missed Revenue',
              desc: 'Manual entry means typos, missed visits, wrong rates. Each mistake is lost revenue or an angry agency calling about their invoice.'
            }
          ].map((item, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
              <div className="text-3xl mb-3">{item.emoji}</div>
              <h3 className="font-bold text-lg mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What We Built — with screenshots */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-center text-2xl font-bold mb-2 text-gray-200">What We Built</h2>
        <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto">
          A custom billing system that turns photos of timecards into professional invoices — automatically.
        </p>

        {/* Feature 1 — Timesheets */}
        <div className="mb-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="text-3xl mb-3">📋</div>
              <h3 className="font-bold text-xl mb-3">Search & Filter Like a Spreadsheet</h3>
              <p className="text-gray-400 leading-relaxed mb-4">
                Every timesheet, searchable and filterable. Find any patient, clinician, or agency in seconds. Filter by status, care type, date range — just like a spreadsheet but smarter.
              </p>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li className="flex gap-2"><span className="text-green-400">✓</span> Search across 20,000+ records instantly</li>
                <li className="flex gap-2"><span className="text-green-400">✓</span> Filter by agency, clinician, care type, date</li>
                <li className="flex gap-2"><span className="text-green-400">✓</span> 30 per page with full pagination</li>
              </ul>
            </div>
            <div className="rounded-xl overflow-hidden shadow-xl shadow-black/30 border border-white/10">
              <img src="/screenshots/timesheets.png" alt="Timesheets with search and filters" className="w-full" />
            </div>
          </div>
        </div>

        {/* Feature 2 — Invoices */}
        <div className="mb-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1 rounded-xl overflow-hidden shadow-xl shadow-black/30 border border-white/10">
              <img src="/screenshots/invoices.png" alt="Invoice management with tabs" className="w-full" />
            </div>
            <div className="order-1 md:order-2">
              <div className="text-3xl mb-3">🧾</div>
              <h3 className="font-bold text-xl mb-3">One-Click Invoices, Real PDF Previews</h3>
              <p className="text-gray-400 leading-relaxed mb-4">
                Select a billing period, hit generate. Professional PDF invoices for every agency — calculated, formatted, ready to preview and send. Track everything from draft to paid.
              </p>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li className="flex gap-2"><span className="text-green-400">✓</span> Review → Send → Paid workflow</li>
                <li className="flex gap-2"><span className="text-green-400">✓</span> Inline PDF preview before sending</li>
                <li className="flex gap-2"><span className="text-green-400">✓</span> One click sends email to agency</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Feature 3 — Payroll */}
        <div className="mb-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="text-3xl mb-3">💰</div>
              <h3 className="font-bold text-xl mb-3">Payroll That Calculates Itself</h3>
              <p className="text-gray-400 leading-relaxed mb-4">
                Same timesheets automatically calculate what each clinician is owed. See hours, visits, rates, and totals at a glance. Adjust, mark paid, and export — all in one place.
              </p>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li className="flex gap-2"><span className="text-green-400">✓</span> Auto-calculated from timesheets</li>
                <li className="flex gap-2"><span className="text-green-400">✓</span> Adjustments, bonuses, deductions</li>
                <li className="flex gap-2"><span className="text-green-400">✓</span> Mark paid with method tracking</li>
              </ul>
            </div>
            <div className="rounded-xl overflow-hidden shadow-xl shadow-black/30 border border-white/10">
              <img src="/screenshots/payroll.jpg" alt="Payroll tracking" className="w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-center text-2xl font-bold mb-12 text-gray-200">The Results</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { stat: '12+ hrs', label: 'Saved per week', color: 'text-green-400' },
            { stat: '50', label: 'Agencies managed', color: 'text-blue-400' },
            { stat: '$1.5M+', label: 'Revenue processed', color: 'text-purple-400' },
            { stat: '0', label: 'Weekends lost', color: 'text-yellow-400' }
          ].map((item, i) => (
            <div key={i}>
              <div className={`text-3xl md:text-4xl font-bold ${item.color}`}>{item.stat}</div>
              <div className="text-gray-400 text-sm mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Is your team stuck doing busy work<br />a system should handle?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            We build custom automation for agencies, medical practices, law firms, and anyone drowning in manual processes. Let's talk about what's eating your time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onEnter}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3.5 rounded-xl transition-all hover:scale-105"
            >
              Try the Live Demo →
            </button>
            <a
              href="https://fltechadventures.com"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-3.5 rounded-xl transition-all"
            >
              Visit fltechadventures.com
            </a>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center text-sm text-gray-400">
            <a href="mailto:alain@fltechadventures.com" className="hover:text-white transition-colors">
              📧 alain@fltechadventures.com
            </a>
            <span className="hidden sm:inline">•</span>
            <span>📍 Wesley Chapel, FL / Tampa Bay</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-gray-600 text-xs">
        Built by Tech Adventures — Custom Automation, Managed IT, Web Development
      </div>
    </div>
  );
}
