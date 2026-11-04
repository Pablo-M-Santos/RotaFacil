import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Origin, Destination, CalculatedRoute, GeocodingFeature } from '../../types';
import { MAPBOX_TOKEN } from '../../services/mapbox/mapboxClient';
import { reverseGeocode } from '../../services/mapbox/geocoding';
import { LocateFixed, Layers, Box, RotateCw } from 'lucide-react';

interface MapViewProps {
  origin: Origin | null;
  destinations: Destination[];
  route: CalculatedRoute | null;
  onMapClickPoint?: (feature: GeocodingFeature, actionType: 'origin' | 'destination') => void;
  onUserLocationFound?: (lng: number, lat: number) => void;
}

type MapStyleType = 'standard' | 'realistic' | 'satellite' | 'streets' | 'outdoors' | 'dark';

const MAP_STYLES: Record<MapStyleType, { label: string; url: string }> = {
  standard: { label: 'Padrão', url: 'mapbox://styles/mapbox/streets-v12' },
  realistic: { label: 'Realista (3D)', url: 'mapbox://styles/mapbox/standard' },
  satellite: { label: 'Satélite HD', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  streets: { label: 'Ruas', url: 'mapbox://styles/mapbox/streets-v12' },
  outdoors: { label: 'Relevo', url: 'mapbox://styles/mapbox/outdoors-v12' },
  dark: { label: 'Escuro 3D', url: 'mapbox://styles/mapbox/dark-v11' },
};

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

  const [currentStyle, setCurrentStyle] = useState<MapStyleType>('standard');
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [showStyleMenu, setShowStyleMenu] = useState<boolean>(false);
  const styleMenuRef = useRef<HTMLDivElement>(null);

  // Fecha menu de estilos ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (styleMenuRef.current && !styleMenuRef.current.contains(event.target as Node)) {
        setShowStyleMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Adiciona a camada de rota e edifícios 3D se o estilo for antigo
  const configureLayersAnd3D = () => {
    if (!map.current) return;

    // 1. Configurar rota GeoJSON
    if (!map.current.getSource('route')) {
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
    }

    if (!map.current.getLayer('route-line')) {
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
          'line-width': 6,
          'line-opacity': 0.9,
        },
      });
    }

    // 2. Extrusão 3D de edifícios volumétricos coloridos em estilos vetoriais
    const styleId = currentStyle;
    if (styleId !== 'standard' && styleId !== 'satellite') {
      const layers = map.current.getStyle().layers;
      const labelLayerId = layers?.find(
        (layer) => layer.type === 'symbol' && layer.layout && (layer.layout as any)['text-field']
      )?.id;

      if (!map.current.getLayer('3d-buildings')) {
        map.current.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['get', 'height'],
                0,
                '#e2e8f0',
                20,
                '#94a3b8',
                50,
                '#64748b',
                100,
                '#3b82f6',
              ],
              'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14,
                0,
                14.05,
                ['get', 'height'],
              ],
              'fill-extrusion-base': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14,
                0,
                14.05,
                ['get', 'min_height'],
              ],
              'fill-extrusion-opacity': 0.85,
            },
          },
          labelLayerId
        );
      }
    }
  };

  // Inicializa o mapa com estilo 3D Standard de alta fidelidade
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const initialCenter: [number, number] = origin
      ? [origin.longitude, origin.latitude]
      : [-38.6217, -3.8798]; // Região de Maracanaú/CE

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLES.standard.url,
      center: initialCenter,
      zoom: 15,
      pitch: 55, // Inicia inclinado em perspectiva 3D
      bearing: -15,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.current.on('style.load', () => {
      configureLayersAnd3D();

      // Se já houver rota calculada, desenha no novo estilo
      if (route && route.geometry && map.current) {
        const source = map.current.getSource('route') as mapboxgl.GeoJSONSource | undefined;
        source?.setData({
          type: 'Feature',
          properties: {},
          geometry: route.geometry,
        });
      }
    });

    // Clique no mapa para Reverse Geocoding
    map.current.on('click', async (e) => {
      if (!onMapClickPoint || !map.current) return;

      const { lng, lat } = e.lngLat;

      if (clickPopupRef.current) {
        clickPopupRef.current.remove();
      }

      const popupDiv = document.createElement('div');
      popupDiv.className = 'map-click-popup';
      popupDiv.innerHTML = `<div class="popup-title">Buscando endereço...</div>`;

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

  const handleChangeStyle = (styleKey: MapStyleType) => {
    if (!map.current || currentStyle === styleKey) return;
    setCurrentStyle(styleKey);
    map.current.setStyle(MAP_STYLES[styleKey].url);
    setShowStyleMenu(false);
  };

  const toggle3DView = () => {
    if (!map.current) return;
    const nextMode = !is3DMode;
    setIs3DMode(nextMode);

    map.current.easeTo({
      pitch: nextMode ? 60 : 0,
      bearing: nextMode ? -20 : 0,
      duration: 1000,
    });
  };

  const rotate360 = () => {
    if (!map.current) return;
    const currentBearing = map.current.getBearing();
    map.current.easeTo({
      bearing: currentBearing + 180,
      pitch: is3DMode ? 60 : 45,
      duration: 2500,
    });
  };

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
            zoom: 15,
            pitch: 55,
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

  // Marcadores no mapa
  useEffect(() => {
    if (!map.current) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;

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
        maxZoom: 16,
        duration: 1000,
      });
    }
  }, [origin, destinations, route]);

  // Atualiza traçado da rota
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
        pitch: is3DMode ? 50 : 0,
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
  }, [route, is3DMode]);

  return (
    <div className="map-view-wrapper">
      <div className="map-top-bar">
        <button
          type="button"
          className="map-ctrl-btn"
          onClick={handleLocateMe}
          title="Centralizar na minha localização"
        >
          <LocateFixed size={17} />
          <span>GPS</span>
        </button>

        <button
          type="button"
          className={`map-ctrl-btn ${is3DMode ? 'active' : ''}`}
          onClick={toggle3DView}
          title="Alternar visão 3D e 2D (inclinação)"
        >
          <Box size={17} />
          <span>{is3DMode ? 'Visão 2D' : 'Visão 3D'}</span>
        </button>

        <button
          type="button"
          className="map-ctrl-btn"
          onClick={rotate360}
          title="Rotacionar câmera 360°"
        >
          <RotateCw size={17} />
          <span>Girar 360°</span>
        </button>

        <div className="style-selector-container" ref={styleMenuRef}>
          <button
            type="button"
            className="map-ctrl-btn highlight"
            onClick={() => setShowStyleMenu(!showStyleMenu)}
            title="Mudar estilo visual"
          >
            <Layers size={17} />
            <span>{MAP_STYLES[currentStyle].label}</span>
          </button>

          {showStyleMenu && (
            <div className="style-dropdown">
              {(Object.keys(MAP_STYLES) as MapStyleType[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`style-dropdown-item ${currentStyle === key ? 'selected' : ''}`}
                  onClick={() => handleChangeStyle(key)}
                >
                  {MAP_STYLES[key].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="map-instruction-banner">
        🏙️ <strong>Visão 3D Ativa:</strong> Dê zoom para ver prédios, shoppings e estruturas em volume real! Use o botão direito do mouse para girar livremente.
      </div>

      <div ref={mapContainer} className="map-container" />
    </div>
  );
};
