import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  realistic: { label: 'Realista 3D (Standard)', url: 'mapbox://styles/mapbox/standard' },
  standard: { label: 'Vetor Padrão', url: 'mapbox://styles/mapbox/streets-v12' },
  satellite: { label: 'Satélite HD', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  streets: { label: 'Ruas', url: 'mapbox://styles/mapbox/streets-v12' },
  outdoors: { label: 'Relevo Topográfico', url: 'mapbox://styles/mapbox/outdoors-v12' },
  dark: { label: 'Modo Escuro', url: 'mapbox://styles/mapbox/dark-v11' },
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

  const [currentStyle, setCurrentStyle] = useState<MapStyleType>('realistic');
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [showStyleMenu, setShowStyleMenu] = useState<boolean>(false);
  const styleMenuRef = useRef<HTMLDivElement>(null);

  // Guardar refs de props para callbacks sem causar re-renders/leaks
  const onMapClickPointRef = useRef(onMapClickPoint);
  onMapClickPointRef.current = onMapClickPoint;

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

  // Configura / Re-injeta fontes e camadas de rota e 3D após carregamento do estilo
  const setupMapLayers = useCallback(() => {
    if (!map.current) return;

    // 1. Configurar Terreno 3D (para estilos clássicos/outdoors/satélite)
    if (currentStyle !== 'realistic' && !map.current.getSource('mapbox-dem')) {
      try {
        map.current.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
        map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      } catch (e) {
        // Fonte já pode ter sido adicionada
      }
    }

    // 2. Fonte de dados GeoJSON da rota
    if (!map.current.getSource('route')) {
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route?.geometry?.coordinates || [],
          },
        },
      });
    }

    // 3. Camada externa (Glow / Brilho de fundo da rota)
    if (!map.current.getLayer('route-line-casing')) {
      map.current.addLayer({
        id: 'route-line-casing',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 10,
          'line-opacity': 0.4,
        },
      });
    }

    // 4. Camada principal da linha de rota
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
          'line-color': '#3b82f6',
          'line-width': 6,
          'line-opacity': 0.95,
        },
      });
    }

    // 5. Prédios 3D (para estilos vetoriais legados quando não for 'standard/realistic')
    if (currentStyle !== 'realistic' && currentStyle !== 'satellite') {
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
                30,
                '#cbd5e1',
                70,
                '#94a3b8',
                120,
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
              'fill-extrusion-opacity': 0.8,
            },
          },
          labelLayerId
        );
      }
    }
  }, [currentStyle, route]);

  // Inicialização única do Mapa
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const initialCenter: [number, number] = origin
      ? [origin.longitude, origin.latitude]
      : [-38.6217, -3.8798];

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLES.realistic.url,
      center: initialCenter,
      zoom: 15.5,
      pitch: 55,
      bearing: -15,
      antialias: true, // Melhora a qualidade das bordas 3D
    });

    map.current = mapInstance;

    mapInstance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    // Recarregar camadas sempre que o estilo mudar
    mapInstance.on('style.load', () => {
      setupMapLayers();
    });

    // Clique no mapa com limpeza adequada de eventos (evita memory leaks)
    mapInstance.on('click', async (e) => {
      if (!onMapClickPointRef.current || !map.current) return;

      const { lng, lat } = e.lngLat;

      if (clickPopupRef.current) {
        clickPopupRef.current.remove();
        clickPopupRef.current = null;
      }

      const popupDiv = document.createElement('div');
      popupDiv.className = 'map-click-popup';
      popupDiv.innerHTML = `<div class="popup-title">Buscando endereço...</div>`;

      const popup = new mapboxgl.Popup({ offset: 15, closeButton: true })
        .setLngLat([lng, lat])
        .setDOMContent(popupDiv)
        .addTo(map.current);

      clickPopupRef.current = popup;

      try {
        const feature = await reverseGeocode(lng, lat);
        if (!feature || !clickPopupRef.current) return;

        popupDiv.innerHTML = `
          <div class="popup-title">${feature.text}</div>
          <div class="popup-address">${feature.place_name}</div>
          <div class="popup-actions">
            <button type="button" data-action="origin" class="btn-popup btn-popup-orig">Definir como Origem</button>
            <button type="button" data-action="destination" class="btn-popup btn-popup-dest">Adicionar Parada</button>
          </div>
        `;

        // Delegação de evento limpa no container
        popupDiv.onclick = (event) => {
          const target = event.target as HTMLElement;
          const action = target.getAttribute('data-action');
          if (action === 'origin' || action === 'destination') {
            onMapClickPointRef.current?.(feature, action);
            popup.remove();
          }
        };
      } catch (err) {
        popupDiv.innerHTML = `<div class="popup-error">Não foi possível obter endereço deste ponto.</div>`;
      }
    });

    return () => {
      if (clickPopupRef.current) {
        clickPopupRef.current.remove();
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  // Troca de Estilo
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
            zoom: 16,
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

  // Atualização dos Marcadores (Origem e Destinos)
  useEffect(() => {
    if (!map.current) return;

    // Limpa marcadores anteriores para liberar memória
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;

    if (origin) {
      const el = document.createElement('div');
      el.className = 'custom-marker origin-marker';
      el.innerHTML = '<span>O</span>';
      el.title = `Origem: ${origin.name}`;

      const originMarker = new mapboxgl.Marker({ element: el })
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

      const destMarker = new mapboxgl.Marker({ element: el })
        .setLngLat([dest.longitude, dest.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<strong>Parada #${dest.order}: ${dest.name}</strong><p>${dest.address}</p>`
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

  // Atualização da Geometria da Rota
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
        padding: 80,
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
        🏙️ <strong>Modo Realista 3D:</strong> Dê zoom para explorar estruturas e inclinação em tempo real! Arraste com o botão direito para orbitar.
      </div>

      <div ref={mapContainer} className="map-container" />
    </div>
  );
};