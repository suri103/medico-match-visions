/**
 * Audit L11: generate a self-contained placeholder avatar (initials on a
 * gradient) as a data URI, so user-profile fallback portraits never hit the
 * third-party randomuser.me CDN (which would leak client IPs). Deterministic
 * per name — stable across renders.
 */
export function localAvatar(name?: string): string {
  const initials =
    (name || '?')
      .replace(/^dr\.?\s+/i, '')
      .split(/\s+/)
      .map((w) => (w[0] || ''))
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';
  const colors: Array<[string, string]> = [
    ['#0ea5e9', '#2563eb'],
    ['#10b981', '#0d9488'],
    ['#f59e0b', '#d97706'],
    ['#ef4444', '#b91c1c'],
    ['#8b5cf6', '#6d28d9'],
  ];
  const [c1, c2] = colors[initials.charCodeAt(0) % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="128" height="128" fill="url(#g)"/>
    <text x="64" y="66" fill="#fff" font-size="52" font-family="Arial,sans-serif"
      text-anchor="middle" dominant-baseline="central">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}