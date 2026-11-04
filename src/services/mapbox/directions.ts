import { MAPBOX_TOKEN } from './mapboxClient';
import { LocationPoint, CalculatedRoute } from '../../types';

export async function calculateRoute(points: LocationPoint[]): Promise<CalculatedRoute | null> {
  if (points.length < 2) {
    return null;
  }

  if (points.length > 25) {
    throw new Error('A API Mapbox Directions suporta no máximo 25 pontos no trajeto.');
  }

  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox Access Token não configurado.');
  }

  // Coordenadas devem ser no formato: lng,lat;lng,lat;...
  const coordinatesString = points
    .map((pt) => `${pt.longitude},${pt.latitude}`)
    .join(';');

  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`;

  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Erro ao calcular rota (${response.status})`);
  }

  const data = await response.json();
  const route = data.routes && data.routes[0];

  if (!route) {
    throw new Error('Nenhuma rota encontrada para os pontos fornecidos.');
  }

  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry,
  };
}
