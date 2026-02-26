/**
 * Sanitize request body/query to prevent NoSQL injection.
 * Strips any keys starting with $ from objects.
 */
function sanitize(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue; // Strip MongoDB operators
    clean[key] = typeof value === 'object' ? sanitize(value) : value;
  }
  return clean;
}

module.exports = function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitize(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitize(req.query);
  }
  next();
};
