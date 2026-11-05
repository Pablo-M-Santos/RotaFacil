import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  memo,
} from 'react';
import mapboxgl from 'mapbox-gl';
import { Origin, Destination, CalculatedRoute, GeocodingFeature } from '../../types';
import { MAPBOX_TOKEN } from '../../services/mapbox/mapboxClient';
import { reverseGeocode } from '../../services/mapbox/geocoding';

export type MapStyleType = 'standard' | 'realistic' | 'satellite' | 'streets' | 'outdoors' | 'dark';

export interface MapViewHandle {
  locateMe: () => void;
  toggle3D: () => void;
  rotate: () => void;
  changeStyle: (style: MapStyleType) => void;
  is3DMode: boolean;
  currentStyle: MapStyleType;
}

interface MapViewProps {
  origin: Origin | null;
  destinations: Destination[];
  route: CalculatedRoute | null;
  onMapClickPoint?: (feature: GeocodingFeature, actionType: 'origin' | 'destination') => void;
  onUserLocationFound?: (lng: number, lat: number) => void;
  onStateChange?: (is3D: boolean, style: MapStyleType) => void;
}

const MAP_STYLES: Record<MapStyleType, { label: string; url: string }> = {
  realistic: { label: 'Realista 3D', url: 'mapbox://styles/mapbox/standard' },
  standard: { label: 'Vetor Padrão', url: 'mapbox://styles/mapbox/streets-v12' },
  satellite: { label: 'Satélite HD', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  streets: { label: 'Ruas', url: 'mapbox://styles/mapbox/streets-v12' },
  outdoors: { label: 'Topográfico', url: 'mapbox://styles/mapbox/outdoors-v12' },
  dark: { label: 'Modo Escuro', url: 'mapbox://styles/mapbox/dark-v11' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de marcador (fora do componente → sem re-criação a cada render)
// ─────────────────────────────────────────────────────────────────────────────
function createOriginElement(name: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'custom-marker origin-marker';
  el.innerHTML = '<span>O</span>';
  el.title = `Origem: ${name}`;
  return el;
}

function createDestElement(order: number, name: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'custom-marker destination-marker';
  el.innerHTML = `<span>${order}</span>`;
  el.title = `Parada ${order}: ${name}`;
  return el;
}

// ─────────────────────────────────────────────────────────────────────────────
// MapView
// ─────────────────────────────────────────────────────────────────────────────
const MapViewInner = forwardRef<MapViewHandle, MapViewProps>(({
  origin,
  destinations,
  route,
  onMapClickPoint,
  onUserLocationFound,
  onStateChange,
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const clickPopupRef = useRef<mapboxgl.Popup | null>(null);

  // ── Estado interno do mapa em refs para evitar re-renders desnecessários ──
  const is3DModeRef = useRef(true);
  const currentStyleRef = useRef<MapStyleType>('realistic');
  // Estado mínimo para o useImperativeHandle e a sidebar
  const [is3DMode, setIs3DMode] = useState(true);
  const [currentStyle, setCurrentStyle] = useState<MapStyleType>('realistic');

  // ── Mapa de marcadores por ID para diffing eficiente ──
  const originMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // ── Refs de props para callbacks estáveis ──
  const onMapClickPointRef = useRef(onMapClickPoint);
  onMapClickPointRef.current = onMapClickPoint;
  const onUserLocationFoundRef = useRef(onUserLocationFound);
  onUserLocationFoundRef.current = onUserLocationFound;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  // ── setupMapLayers via ref para evitar re-registro no style.load ──
  const setupMapLayersRef = useRef<() => void>(() => {});
  setupMapLayersRef.current = () => {
    const m = map.current;
    if (!m) return;
    const style = currentStyleRef.current;

    if (style !== 'realistic' && !m.getSource('mapbox-dem')) {
      try {
        m.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
        m.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      } catch (_) {}
    }

    if (!m.getSource('route')) {
      m.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      });
    }

    if (!m.getLayer('route-line-casing')) {
      m.addLayer({
        id: 'route-line-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#1d4ed8', 'line-width': 10, 'line-opacity': 0.4 },
      });
    }

    if (!m.getLayer('route-line')) {
      m.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 0.95 },
      });
    }

    if (style !== 'realistic' && style !== 'satellite') {
      const layers = m.getStyle().layers;
      const labelLayerId = layers?.find(
        (l) => l.type === 'symbol' && l.layout && (l.layout as any)['text-field']
      )?.id;

      if (!m.getLayer('3d-buildings')) {
        m.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'height'],
                0, '#e2e8f0', 30, '#cbd5e1', 70, '#94a3b8', 120, '#3b82f6',
              ],
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'height'],
              ],
              'fill-extrusion-base': [
                'interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'min_height'],
              ],
              'fill-extrusion-opacity': 0.8,
            },
          },
          labelLayerId
        );
      }
    }
  };

  // ── Inicialização única ──
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
      antialias: true,
      // Limitar FPS quando o mapa está parado economiza CPU/GPU
      fadeDuration: 200,
    });

    map.current = mapInstance;

    mapInstance.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'top-right'
    );

    // style.load: usa ref para sempre ler a versão mais atual de setupMapLayers
    mapInstance.on('style.load', () => {
      setupMapLayersRef.current();
    });

    mapInstance.on('click', async (e) => {
      if (!onMapClickPointRef.current || !map.current) return;
      const { lng, lat } = e.lngLat;

      clickPopupRef.current?.remove();
      clickPopupRef.current = null;

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

        popupDiv.onclick = (event) => {
          const target = event.target as HTMLElement;
          const action = target.getAttribute('data-action');
          if (action === 'origin' || action === 'destination') {
            onMapClickPointRef.current?.(feature, action);
            popup.remove();
          }
        };
      } catch {
        popupDiv.innerHTML = `<div class="popup-error">Não foi possível obter endereço deste ponto.</div>`;
      }
    });

    return () => {
      clickPopupRef.current?.remove();
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      destMarkersRef.current.forEach((m) => m.remove());
      destMarkersRef.current.clear();
      mapInstance.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Controles do mapa (estáveis via useCallback com deps mínimas) ──
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords: { longitude, latitude } }) => {
        map.current?.flyTo({ center: [longitude, latitude], zoom: 16, pitch: 55, essential: true });
        onUserLocationFoundRef.current?.(longitude, latitude);
      },
      (err) => {
        console.warn('Erro ao obter localização:', err);
        alert('Não foi possível obter sua localização atual.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleToggle3D = useCallback(() => {
    if (!map.current) return;
    const next = !is3DModeRef.current;
    is3DModeRef.current = next;
    setIs3DMode(next);
    map.current.easeTo({ pitch: next ? 60 : 0, bearing: next ? -20 : 0, duration: 1000 });
    onStateChangeRef.current?.(next, currentStyleRef.current);
  }, []);

  const handleRotate = useCallback(() => {
    if (!map.current) return;
    map.current.easeTo({
      bearing: map.current.getBearing() + 180,
      pitch: is3DModeRef.current ? 60 : 45,
      duration: 2500,
    });
  }, []);

  const handleChangeStyle = useCallback((styleKey: MapStyleType) => {
    if (!map.current || currentStyleRef.current === styleKey) return;
    currentStyleRef.current = styleKey;
    setCurrentStyle(styleKey);
    map.current.setStyle(MAP_STYLES[styleKey].url);
    onStateChangeRef.current?.(is3DModeRef.current, styleKey);
  }, []);

  useImperativeHandle(ref, () => ({
    locateMe: handleLocateMe,
    toggle3D: handleToggle3D,
    rotate: handleRotate,
    changeStyle: handleChangeStyle,
    is3DMode,
    currentStyle,
  }), [handleLocateMe, handleToggle3D, handleRotate, handleChangeStyle, is3DMode, currentStyle]);

  // ── Diffing de marcadores: só cria/remove o que mudou ──
  useEffect(() => {
    if (!map.current) return;

    // ── Origem ──
    if (origin) {
      if (originMarkerRef.current) {
        // Apenas reposiciona se as coordenadas mudaram
        originMarkerRef.current.setLngLat([origin.longitude, origin.latitude]);
      } else {
        const el = createOriginElement(origin.name);
        originMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([origin.longitude, origin.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<strong>Origem</strong><p>${origin.address}</p>`
            )
          )
          .addTo(map.current);
      }
    } else {
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
    }

    // ── Destinos: diffing por ID ──
    const currentIds = new Set(destinations.map((d) => d.id));

    // Remover marcadores que sumiram
    for (const [id, marker] of destMarkersRef.current) {
      if (!currentIds.has(id)) {
        marker.remove();
        destMarkersRef.current.delete(id);
      }
    }

    // Adicionar novos / atualizar existentes
    for (const dest of destinations) {
      const existing = destMarkersRef.current.get(dest.id);
      if (existing) {
        // Reposiciona e atualiza o label de ordem se necessário
        existing.setLngLat([dest.longitude, dest.latitude]);
        const span = existing.getElement().querySelector('span');
        if (span && span.textContent !== String(dest.order)) {
          span.textContent = String(dest.order);
        }
      } else {
        const el = createDestElement(dest.order, dest.name);
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([dest.longitude, dest.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<strong>Parada #${dest.order}: ${dest.name}</strong><p>${dest.address}</p>`
            )
          )
          .addTo(map.current!);
        destMarkersRef.current.set(dest.id, marker);
      }
    }

    // FitBounds apenas quando não há rota calculada
    if (!route) {
      const bounds = new mapboxgl.LngLatBounds();
      let hasPoints = false;

      if (origin) { bounds.extend([origin.longitude, origin.latitude]); hasPoints = true; }
      destinations.forEach((d) => { bounds.extend([d.longitude, d.latitude]); hasPoints = true; });

      if (hasPoints) {
        map.current.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 1000 });
      }
    }
  }, [origin, destinations, route]);

  // ── Atualização da rota GeoJSON ──
  useEffect(() => {
    if (!map.current) return;
    const source = map.current.getSource('route') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    if (route?.geometry?.coordinates?.length) {
      source.setData({ type: 'Feature', properties: {}, geometry: route.geometry });
      const bounds = new mapboxgl.LngLatBounds();
      route.geometry.coordinates.forEach((coord) => bounds.extend(coord));
      map.current.fitBounds(bounds, { padding: 80, pitch: is3DModeRef.current ? 50 : 0, duration: 1200 });
    } else {
      source.setData({
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: [] },
      });
    }
  }, [route]);

  return (
    <div className="map-view-wrapper">
      <div ref={mapContainer} className="map-container" />
    </div>
  );
});

MapViewInner.displayName = 'MapView';

// memo: evita re-render do MapView quando apenas o estado da sidebar muda
export const MapView = memo(MapViewInner);
