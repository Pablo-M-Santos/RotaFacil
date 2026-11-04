import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { Origin, Destination, CalculatedRoute } from '../../types';
import { MAPBOX_TOKEN } from '../../services/mapbox/mapboxClient';

interface MapViewProps {
  origin: Origin | null;
  destinations: Destination[];
  route: CalculatedRoute | null;
}

export const MapView: React.FC<MapViewProps> = ({ origin, destinations, route }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Inicializa o mapa
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-46.6333, -23.5505], // Padrão: São Paulo
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      if (!map.current) return;

      // Adiciona source da rota GeoJSON vazia
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [],
          },
        },
      });

      // Linha da rota
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#2563eb',
          'line-width': 5,
          'line-opacity': 0.85,
        },
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Atualiza marcadores no mapa
  useEffect(() => {
    if (!map.current) return;

    // Remove marcadores anteriores
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;

    // Marcador de Origem (Verde)
    if (origin) {
      const el = document.createElement('div');
      el.className = 'custom-marker origin-marker';
      el.innerHTML = '<span>O</span>';
      el.title = `Origem: ${origin.name}`;

      const originMarker = new mapboxgl.Marker(el)
        .setLngLat([origin.longitude, origin.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>Origem</strong><p>${origin.address}</p>`)
        )
        .addTo(map.current);

      markersRef.current.push(originMarker);
      bounds.extend([origin.longitude, origin.latitude]);
      hasPoints = true;
    }

    // Marcadores de Destinos (Azul com número de ordem)
    destinations.forEach((dest) => {
      const el = document.createElement('div');
      el.className = 'custom-marker destination-marker';
      el.innerHTML = `<span>${dest.order}</span>`;
      el.title = `Parada ${dest.order}: ${dest.name}`;

      const destMarker = new mapboxgl.Marker(el)
        .setLngLat([dest.longitude, dest.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<strong>Parada #${dest.order} - ${dest.name}</strong><p>${dest.address}</p>`
          )
        )
        .addTo(map.current!);

      markersRef.current.push(destMarker);
      bounds.extend([dest.longitude, dest.latitude]);
      hasPoints = true;
    });

    // Se não tiver rota desenhada mas tiver pontos, centraliza os pontos
    if (hasPoints && !route) {
      map.current.fitBounds(bounds, {
        padding: 80,
        maxZoom: 15,
        duration: 1000,
      });
    }
  }, [origin, destinations, route]);

  // Atualiza o traçado da rota
  useEffect(() => {
    if (!map.current) return;

    const source = map.current.getSource('route') as mapboxgl.GeoJSONSource | undefined;

    if (!source) return;

    if (route && route.geometry && route.geometry.coordinates.length > 0) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: route.geometry,
      });

      // Ajusta o mapa para enquadrar toda a rota percorrida
      const bounds = new mapboxgl.LngLatBounds();
      route.geometry.coordinates.forEach((coord) => bounds.extend(coord));

      map.current.fitBounds(bounds, {
        padding: 70,
        duration: 1200,
      });
    } else {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [],
        },
      });
    }
  }, [route]);

  return (
    <div className="map-view-wrapper">
      <div ref={mapContainer} className="map-container" />
    </div>
  );
};
