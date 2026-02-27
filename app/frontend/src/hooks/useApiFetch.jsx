/**
 * Global fetch interceptor that auto-injects auth token.
 * Call setupAuthFetch(token) once on login, and all fetch() calls get the header.
 */

const originalFetch = window.fetch;

export function setupAuthFetch() {
  window.fetch = function(url, opts = {}) {
    const token = localStorage.getItem('token');
    if (token && typeof url === 'string' && url.startsWith('/api/') && !url.startsWith('/api/auth/login')) {
      opts.headers = {
        ...opts.headers,
        'Authorization': `Bearer ${token}`,
      };
    }
    return originalFetch.call(window, url, opts);
  };
}

export function teardownAuthFetch() {
  window.fetch = originalFetch;
}
