import { MAPBOX_TOKEN } from './mapboxClient';
import { GeocodingFeature } from '../../types';

export interface SearchOptions {
  proximity?: [number, number]; // [lng, lat]
  country?: string;
  limit?: number;
}

/**
 * Busca no OpenStreetMap / Nominatim (altamente preciso para POIs locais no Brasil como North Shopping Maracanaú)
 */
async function searchWithNominatim(
  query: string,
  proximity?: [number, number],
  limit = 6
): Promise<GeocodingFeature[]> {
  try {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&addressdetails=1&countrycodes=br&limit=${limit}`;

    // Se tiver coordenadas, orienta a visualização para a região
    if (proximity && proximity.length === 2) {
      const [lng, lat] = proximity;
      const delta = 0.8; // ~80km ao redor
      const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;
      url += `&viewbox=${viewbox}&bounded=0`;
    }

    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.map((item: any) => {
      // Extrai o nome principal mais limpo (ex: "North Shopping Maracanaú")
      const title = item.name || item.display_name.split(',')[0];
      return {
        id: `osm-${item.place_id}`,
        text: title,
        place_name: item.display_name,
        center: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
      };
    });
  } catch (err) {
    console.warn('Falha no fallback Nominatim:', err);
    return [];
  }
}

/**
 * Busca no Mapbox Geocoding API v5
 */
async function searchWithMapbox(
  query: string,
  options: SearchOptions = {}
): Promise<GeocodingFeature[]> {
  if (!MAPBOX_TOKEN) return [];

  const { proximity, country = 'br', limit = 6 } = options;
  const encodedQuery = encodeURIComponent(query);
  let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_TOKEN}&country=${country}&language=pt&autocomplete=true&limit=${limit}&types=poi,address,neighborhood,locality,place`;

  if (proximity && proximity.length === 2) {
    url += `&proximity=${proximity[0]},${proximity[1]}`;
  }

  const response = await fetch(url);
  if (!response.ok) return [];

  const data = await response.json();
  return (data.features || []).map((feat: any) => ({
    id: feat.id,
    place_name: feat.place_name,
    text: feat.text,
    center: feat.center as [number, number],
  }));
}

/**
 * Busca Híbrida Inteligente: Combina Mapbox + OpenStreetMap (Nominatim)
 * Garante que tanto ruas comuns quanto shoppings e pontos de referência locais sejam encontrados
 */
export async function searchPlaces(
  query: string,
  options: SearchOptions = {}
): Promise<GeocodingFeature[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  // Executa busca em paralelo em ambos os provedores
  const [mapboxResults, osmResults] = await Promise.all([
    searchWithMapbox(trimmed, options),
    searchWithNominatim(trimmed, options.proximity, options.limit || 6),
  ]);

  // Junta e deduplica resultados por proximidade de coordenadas (< 200 metros)
  const combined: GeocodingFeature[] = [...osmResults, ...mapboxResults];
  const uniqueResults: GeocodingFeature[] = [];

  for (const item of combined) {
    const isDuplicate = uniqueResults.some((existing) => {
      const dLng = Math.abs(existing.center[0] - item.center[0]);
      const dLat = Math.abs(existing.center[1] - item.center[1]);
      return dLng < 0.002 && dLat < 0.002;
    });

    if (!isDuplicate) {
      uniqueResults.push(item);
    }
  }

  return uniqueResults.slice(0, 10);
}

/**
 * Geocodificação Reversa: converte coordenadas [lng, lat] em nome e endereço
 */
export async function reverseGeocode(lng: number, lat: number): Promise<GeocodingFeature | null> {
  // Tenta Mapbox primeiro
  if (MAPBOX_TOKEN) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=pt&limit=1`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const feat = data.features && data.features[0];
        if (feat) {
          return {
            id: feat.id,
            place_name: feat.place_name,
            text: feat.text || feat.place_name,
            center: feat.center as [number, number],
          };
        }
      }
    } catch {
      // continua para fallback
    }
  }

  // Fallback para Nominatim caso o Mapbox não encontre detalhes
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const resp = await fetch(osmUrl);
    if (resp.ok) {
      const data = await resp.json();
      return {
        id: `osm-${data.place_id}`,
        place_name: data.display_name,
        text: data.name || data.display_name.split(',')[0],
        center: [lng, lat],
      };
    }
  } catch {
    // fallback para ponto genérico
  }

  return {
    id: `point-${lng}-${lat}`,
    place_name: `Coordenadas: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    text: 'Ponto selecionado',
    center: [lng, lat],
  };
}