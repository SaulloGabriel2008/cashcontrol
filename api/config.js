// Returns the API base URL used by the frontend.
// Defaults to local Vercel Functions path (/api).

function normalizeApiBase(rawValue) {
  if (!rawValue) return '/api';

  let value = String(rawValue).trim();
  if (!value || value === '/' || value === './') return '/api';

  // Remove trailing slash to avoid double slashes in `${base}/route`.
  value = value.replace(/\/+$/, '');

  // If user sets only a host (for example https://cashcontroll.online),
  // append /api because functions are mounted there.
  if (/^https?:\/\/[^/]+$/i.test(value)) {
    return `${value}/api`;
  }

  return value;
}

export default function handler(req, res) {
  const apiBaseUrl = normalizeApiBase(process.env.API_BASE_URL);
  res.status(200).json({ apiBaseUrl });
}
