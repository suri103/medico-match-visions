/**
 * Feature-flag gate for the astrology consultation feature.
 *
 * Introduced later (not deleted): the entire feature — backend sell-side, the
 * booking path and this page/route — ships in the repo but is disabled unless
 * this flag is enabled at build time. Vite statically inlines
 * `import.meta.env.VITE_ASTROLOGY_ENABLED`; when it is not 'true' the route is
 * simply never registered, so the page is unreachable and its lazy chunk is
 * never fetched. To launch: build with `VITE_ASTROLOGY_ENABLED=true`
 * (frontend) and run the backend with `ASTROLOGY_ENABLED=true`.
 */
export const astrologyEnabled = import.meta.env.VITE_ASTROLOGY_ENABLED === "true";