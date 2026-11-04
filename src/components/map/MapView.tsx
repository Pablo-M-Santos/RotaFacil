import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { Origin, Destination, CalculatedRoute, GeocodingFeature } from '../../types';
import { MAPBOX_TOKEN } from '../../services/mapbox/mapboxClient';
import { reverseGeocode } from '../../services/mapbox/geocoding';
import { LocateFixed } from 'lucide-react';

interface MapViewProps {
  origin: Origin | null;
  destinations: Destination[];
  route: CalculatedRoute | null;
  onMapClickPoint?: (feature: GeocodingFeature, actionType: 'origin' | 'destination') => void;
  onUserLocationFound?: (lng: number, lat: number) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  origin,
  destinations,
  route,
  onMapClickPoint,
  onUserLocationFound,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const clickPopupRef = useRef<mapboxgl.Popup | null>(null);

  // Inicializa o mapa
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Se já tiver uma origem salva, centra nela; senão, inicia em uma visão padrão
    const initialCenter: [number, number] = origin
      ? [origin.longitude, origin.latitude]
      : [-38.6258, -3.8767]; // Coordenadas aproximadas de Maracanaú/CE

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter,
      zoom: 12,
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

    // Evento de clique no mapa para Reverse Geocoding
    map.current.on('click', async (e) => {
      if (!onMapClickPoint || !map.current) return;

      const { lng, lat } = e.lngLat;

      // Fecha popup anterior se houver
      if (clickPopupRef.current) {
        clickPopupRef.current.remove();
      }

      // Mostra popup de carregamento rápido
      const popupDiv = document.createElement('div');
      popupDiv.className = 'map-click-popup';
      popupDiv.innerHTML = `
        <div class="popup-title">Buscando endereço...</div>
      `;

      clickPopupRef.current = new mapboxgl.Popup({ offset: 15, closeButton: true })
        .setLngLat([lng, lat])
        .setDOMContent(popupDiv)
        .addTo(map.current);

      try {
        const feature = await reverseGeocode(lng, lat);
        if (!feature) return;

        popupDiv.innerHTML = `
          <div class="popup-title">${feature.text}</div>
          <div class="popup-address">${feature.place_name}</div>
          <div class="popup-actions">
            <button id="btn-popup-origin" class="btn-popup btn-popup-orig">Definir como Origem</button>
            <button id="btn-popup-dest" class="btn-popup btn-popup-dest">Adicionar Parada</button>
          </div>
        `;

        document.getElementById('btn-popup-origin')?.addEventListener('click', () => {
          onMapClickPoint(feature, 'origin');
          clickPopupRef.current?.remove();
        });

        document.getElementById('btn-popup-dest')?.addEventListener('click', () => {
          onMapClickPoint(feature, 'destination');
          clickPopupRef.current?.remove();
        });
      } catch (err) {
        popupDiv.innerHTML = `<div class="popup-error">Não foi possível obter endereço deste ponto.</div>`;
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Botão "Minha Localização" (GPS)
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        if (map.current) {
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 14,
            essential: true,
          });
        }
        if (onUserLocationFound) {
          onUserLocationFound(longitude, latitude);
        }
      },
      (err) => {
        console.warn('Erro ao obter localização:', err);
        alert('Não foi possível obter sua localização atual.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Atualiza marcadores no mapa
  useEffect(() => {
    if (!map.current) return;

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
      <button
        type="button"
        className="btn-locate-gps"
        onClick={handleLocateMe}
        title="Centralizar na minha localização"
      >
        <LocateFixed size={18} />
        <span>Minha Localização</span>
      </button>

      <div className="map-instruction-banner">
        💡 <strong>Dica:</strong> Clique em qualquer ponto no mapa para definir a Origem ou adicionar uma Parada!
      </div>

      <div ref={mapContainer} className="map-container" />
    </div>
  );
};
