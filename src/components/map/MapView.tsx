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

type MapStyleType = 'streets' | 'satellite' | 'outdoors' | 'dark';

const MAP_STYLES: Record<MapStyleType, { label: string; url: string }> = {
  streets: { label: 'Ruas', url: 'mapbox://styles/mapbox/streets-v12' },
  satellite: { label: 'Satélite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  outdoors: { label: 'Relevo', url: 'mapbox://styles/mapbox/outdoors-v12' },
  dark: { label: 'Escuro', url: 'mapbox://styles/mapbox/dark-v11' },
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

  const [currentStyle, setCurrentStyle] = useState<MapStyleType>('streets');
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
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

  // Adiciona a camada de rota
  const addRouteLayer = () => {
    if (!map.current) return;

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
          'line-width': 5,
          'line-opacity': 0.85,
        },
      });
    }
  };

  // Inicializa o mapa
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const initialCenter: [number, number] = origin
      ? [origin.longitude, origin.latitude]
      : [-38.6217, -3.8798]; // Centralizado na região de Maracanaú/CE

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLES.streets.url,
      center: initialCenter,
      zoom: 13,
      pitch: 0,
      bearing: 0,
    });

    // Adiciona controle padrão do Mapbox com bússola (permite girar 360 clicando na bússola)
    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.current.on('style.load', () => {
      addRouteLayer();
      // Atualiza rota se já existir dados calculados
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

  // Alterna o estilo visual do mapa (Ruas, Satélite, Relevo)
  const handleChangeStyle = (styleKey: MapStyleType) => {
    if (!map.current || currentStyle === styleKey) return;
    setCurrentStyle(styleKey);
    map.current.setStyle(MAP_STYLES[styleKey].url);
    setShowStyleMenu(false);
  };

  // Alterna visão 3D / Inclinação (Pitch de 60 graus)
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

  // Girar 360 Graus ao redor do ponto central
  const rotate360 = () => {
    if (!map.current) return;
    const currentBearing = map.current.getBearing();
    map.current.easeTo({
      bearing: currentBearing + 180,
      pitch: is3DMode ? 60 : 45,
      duration: 2500,
    });
  };

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
        maxZoom: 15,
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
      {/* Barra de Controles de Câmera e Visualização */}
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

        {/* Seletor de Camadas / Estilos */}
        <div className="style-selector-container" ref={styleMenuRef}>
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={() => setShowStyleMenu(!showStyleMenu)}
            title="Mudar camada do mapa"
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
        💡 <strong>Controles 360°:</strong> Arraste com o <strong>botão direito do mouse</strong> (ou segure <code>Ctrl</code> + botão esquerdo) para girar 360° livremente em 3D!
      </div>

      <div ref={mapContainer} className="map-container" />
    </div>
  );
};
