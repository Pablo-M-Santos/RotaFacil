export interface LocationPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface Destination extends LocationPoint {
  order: number;
}

export type Origin = LocationPoint;

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [longitude, latitude]
}

export interface CalculatedRoute {
  distanceMeters: number;
  durationSeconds: number;
  geometry: RouteGeometry;
}

export interface GeocodingFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [lng, lat]
}
