import { MAPBOX_TOKEN } from './mapboxClient';
import { GeocodingFeature } from '../../types';

export interface SearchOptions {
  proximity?: [number, number]; // [lng, lat] para dar prioridade a locais próximos
  country?: string;
  limit?: number;
}

/**
 * Busca direta de lugares por texto (com proximidade e tipos abrangentes)
 */
export async function searchPlaces(
  query: string,
  options: SearchOptions = {}
): Promise<GeocodingFeature[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox Access Token não configurado. Verifique seu arquivo .env.local.');
  }

  const { proximity, country = 'br', limit = 10 } = options;

  const encodedQuery = encodeURIComponent(trimmed);
  let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_TOKEN}&country=${country}&language=pt&autocomplete=true&limit=${limit}&types=poi,address,neighborhood,locality,place`;

  if (proximity && proximity.length === 2) {
    url += `&proximity=${proximity[0]},${proximity[1]}`;
  }

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

/**
 * Geocodificação Reversa: converte coordenadas [lng, lat] em nome e endereço
 */
export async function reverseGeocode(lng: number, lat: number): Promise<GeocodingFeature | null> {
  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox Access Token não configurado.');
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=pt&limit=1`;

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const feat = data.features && data.features[0];

  if (!feat) {
    return {
      id: `point-${lng}-${lat}`,
      place_name: `Coordenadas: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      text: 'Ponto selecionado',
      center: [lng, lat],
    };
  }

  return {
    id: feat.id,
    place_name: feat.place_name,
    text: feat.text || feat.place_name,
    center: feat.center as [number, number],
  };
}
