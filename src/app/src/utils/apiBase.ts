/**
 * Base URL for all Cyclo REST API requests.
 *
 * In local dev this is '' (empty string) so Vite's /api proxy forwards calls
 * to http://localhost:3001 transparently.
 *
 * In production, set VITE_API_URL to the Railway API origin
 * (e.g. https://api-cyclo.up.railway.app) so fetch reaches the right server.
 */
export const API_BASE: string =
    (import.meta.env.VITE_API_URL as string | undefined) ?? ''
