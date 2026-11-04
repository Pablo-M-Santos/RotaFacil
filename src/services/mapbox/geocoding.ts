import { MAPBOX_TOKEN } from './mapboxClient';
import { GeocodingFeature } from '../../types';

export async function searchPlaces(query: string, country = 'br'): Promise<GeocodingFeature[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 3) {
    return [];
  }

  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox Access Token não configurado. Verifique seu arquivo .env.local.');
  }

  const encodedQuery = encodeURIComponent(trimmed);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_TOKEN}&country=${country}&language=pt&autocomplete=true&limit=5`;

  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Erro no Geocoding (${response.status})`);
  }

  const data = await response.json();
  return (data.features || []).map((feat: any) => ({
    id: feat.id,
    place_name: feat.place_name,
    text: feat.text,
    center: feat.center as [number, number],
  }));
}
