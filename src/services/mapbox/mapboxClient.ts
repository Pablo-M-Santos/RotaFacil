export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export function validateMapboxToken(): boolean {
  return Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN.trim().length > 0 && MAPBOX_TOKEN.startsWith('pk.'));
}
