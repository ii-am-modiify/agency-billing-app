/**
 * Global fetch interceptor that auto-injects auth token.
 * Also handles 401 responses by clearing token and forcing re-login.
 */

const originalFetch = window.fetch;

export function setupAuthFetch() {
  window.fetch = function(url, opts = {}) {
    const token = localStorage.getItem('token');
    if (token && typeof url === 'string' && url.startsWith('/api/') && !url.includes('/api/auth/login') && !url.includes('/api/auth/status')) {
      opts.headers = {
        ...opts.headers,
        'Authorization': `Bearer ${token}`,
      };
    }
    return originalFetch.call(window, url, opts).then(response => {
      // If any API returns 401, clear stale token and reload to show login
      if (response.status === 401 && typeof url === 'string' && url.startsWith('/api/') && !url.includes('/api/auth/')) {
        localStorage.removeItem('token');
        window.location.reload();
      }
      return response;
    });
  };
}

export function teardownAuthFetch() {
  window.fetch = originalFetch;
}
