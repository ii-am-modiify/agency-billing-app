import React, { useState, useEffect, useRef } from 'react';

// Capture console errors globally
const capturedErrors = [];
const capturedNetworkErrors = [];

// Intercept console.error
const origError = console.error;
console.error = (...args) => {
  capturedErrors.push({
    timestamp: new Date().toISOString(),
    message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
  });
  if (capturedErrors.length > 50) capturedErrors.shift();
  origError.apply(console, args);
};

// Intercept window errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    capturedErrors.push({
      timestamp: new Date().toISOString(),
      message: `${e.message} at ${e.filename}:${e.lineno}:${e.colno}`
    });
    if (capturedErrors.length > 50) capturedErrors.shift();
  });

  window.addEventListener('unhandledrejection', (e) => {
    capturedErrors.push({
      timestamp: new Date().toISOString(),
      message: `Unhandled rejection: ${e.reason?.message || e.reason || 'unknown'}`
    });
    if (capturedErrors.length > 50) capturedErrors.shift();
  });

  // Intercept fetch for network errors
  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    try {
      const res = await origFetch.apply(window, args);
      if (!res.ok && url.startsWith('/api/')) {
        let body = '';
        try { body = await res.clone().text(); } catch {}
        capturedNetworkErrors.push({
          timestamp: new Date().toISOString(),
          url,
          method: args[1]?.method || 'GET',
          status: res.status,
          body: body.slice(0, 500)
        });
        if (capturedNetworkErrors.length > 30) capturedNetworkErrors.shift();
      }
      return res;
    } catch (err) {
      capturedNetworkErrors.push({
        timestamp: new Date().toISOString(),
        url,
        method: args[1]?.method || 'GET',
        status: 0,
        body: err.message
      });
      if (capturedNetworkErrors.length > 30) capturedNetworkErrors.shift();
      throw err;
    }
  };
}

export default function BugReporter() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const descRef = useRef();

  const captureScreenshot = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        scale: 1,
        logging: false,
        ignoreElements: (el) => el.closest?.('[data-bug-reporter]')
      });
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error('[BugReporter] Screenshot failed:', e);
      return null;
    }
  };

  const handleOpen = async () => {
    setOpen(true);
    setSent(false);
    setDescription('');
    // Capture screenshot immediately when they click the button
    const screenshot = await captureScreenshot();
    setScreenshotPreview(screenshot);
    setTimeout(() => descRef.current?.focus(), 100);
  };

  const handleSubmit = async () => {
    setSending(true);
    try {
      const payload = {
        screenshot: screenshotPreview,
        consoleErrors: [...capturedErrors].slice(-20),
        networkErrors: [...capturedNetworkErrors].slice(-15),
        url: window.location.href,
        description,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      const res = await origFetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSent(true);
        setTimeout(() => { setOpen(false); setSent(false); }, 2000);
      } else {
        alert('Failed to submit report. Please try again.');
      }
    } catch (e) {
      alert('Failed to submit: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div data-bug-reporter>
      {/* Floating button */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-4 right-4 z-50 bg-red-500 hover:bg-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all hover:scale-110"
          title="Report a Problem"
        >
          🐛
        </button>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">🐛 Report a Problem</h2>
                <p className="text-xs text-gray-400 mt-0.5">A screenshot and error logs will be included automatically</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {sent ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="font-semibold text-green-700">Report submitted!</p>
                  <p className="text-sm text-gray-500 mt-1">We'll look into it. Thank you!</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">What went wrong?</label>
                    <textarea
                      ref={descRef}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Describe the problem — what were you trying to do and what happened instead?"
                      className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                    />
                  </div>

                  {/* Screenshot preview */}
                  {screenshotPreview && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Screenshot captured</label>
                      <div className="border rounded-lg overflow-hidden bg-gray-100">
                        <img src={screenshotPreview} alt="Screenshot" className="w-full" />
                      </div>
                    </div>
                  )}

                  {/* What's being sent */}
                  <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                    <p className="font-medium text-gray-600">This report will include:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Screenshot of current page</li>
                      <li>{capturedErrors.length} console error{capturedErrors.length !== 1 ? 's' : ''}</li>
                      <li>{capturedNetworkErrors.length} failed network request{capturedNetworkErrors.length !== 1 ? 's' : ''}</li>
                      <li>Current page URL</li>
                      <li>Browser info</li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            {!sent && (
              <div className="px-6 py-4 border-t flex gap-2 justify-end">
                <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
                <button
                  onClick={handleSubmit}
                  disabled={sending}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Submit Report'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
