import React, { useState, useRef, useCallback } from 'react';
import { useRoutePlanner } from '../hooks/useRoutePlanner';
import { Sidebar } from '../components/layout/Sidebar';
import { MapView, MapViewHandle, MapStyleType } from '../components/map/MapView';
import { validateMapboxToken } from '../services/mapbox/mapboxClient';
import { AlertTriangle } from 'lucide-react';
import { GeocodingFeature } from '../types';

export const RoutePlanner: React.FC = () => {
  const {
    origin,
    destinations,
    route,
    isCalculating,
    routeError,
    selectOrigin,
    clearOrigin,
    addDestination,
    moveUp,
    moveDown,
    removeDestination,
    resetAll,
  } = useRoutePlanner();

  const mapRef = useRef<MapViewHandle>(null);

  // Estado espelhado para a sidebar refletir o estado atual do mapa
  const [mapIs3D, setMapIs3D] = useState(true);
  const [mapStyle, setMapStyle] = useState<MapStyleType>('realistic');
  const [userCoords, setUserCoords] = useState<[number, number] | undefined>(undefined);

  const isTokenConfigured = validateMapboxToken();

  const handleMapClickPoint = (feature: GeocodingFeature, actionType: 'origin' | 'destination') => {
    if (actionType === 'origin') selectOrigin(feature);
    else addDestination(feature);
  };

  const handleUserLocationFound = (lng: number, lat: number) => {
    setUserCoords([lng, lat]);
  };

  const handleMapStateChange = useCallback((is3D: boolean, style: MapStyleType) => {
    setMapIs3D(is3D);
    setMapStyle(style);
  }, []);

  return (
    <div className="app-container">
      {!isTokenConfigured && (
        <div className="banner-token-warning">
          <AlertTriangle size={20} />
          <span>
            <strong>Atenção:</strong> O token do Mapbox não foi detectado em <code>.env.local</code> (chave <code>VITE_MAPBOX_ACCESS_TOKEN</code>).
            Insira sua chave pública iniciada por <code>pk.</code> e reinicie o servidor Vite.
          </span>
        </div>
      )}

      <main className="main-layout">
        {/* Mapa ocupa toda a área */}
        <MapView
          ref={mapRef}
          origin={origin}
          destinations={destinations}
          route={route}
          onMapClickPoint={handleMapClickPoint}
          onUserLocationFound={handleUserLocationFound}
          onStateChange={handleMapStateChange}
        />

        {/* Sidebar flutuante sobre o mapa */}
        <Sidebar
          origin={origin}
          destinations={destinations}
          route={route}
          isCalculating={isCalculating}
          routeError={routeError}
          userProximity={userCoords}
          onSelectOrigin={selectOrigin}
          onClearOrigin={clearOrigin}
          onAddDestination={addDestination}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
          onRemoveDestination={removeDestination}
          onResetAll={resetAll}
          is3DMode={mapIs3D}
          currentStyle={mapStyle}
          onLocateMe={() => mapRef.current?.locateMe()}
          onToggle3D={() => mapRef.current?.toggle3D()}
          onRotate={() => mapRef.current?.rotate()}
          onChangeStyle={(style) => mapRef.current?.changeStyle(style)}
        />
      </main>
    </div>
  );
};
