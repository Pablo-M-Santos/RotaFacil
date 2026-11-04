import React, { useState } from 'react';
import { useRoutePlanner } from '../hooks/useRoutePlanner';
import { Sidebar } from '../components/layout/Sidebar';
import { MapView } from '../components/map/MapView';
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

  // Guarda a localização detectada do usuário para calibrar a proximidade da busca
  const [userCoords, setUserCoords] = useState<[number, number] | undefined>(undefined);

  const isTokenConfigured = validateMapboxToken();

  const handleMapClickPoint = (feature: GeocodingFeature, actionType: 'origin' | 'destination') => {
    if (actionType === 'origin') {
      selectOrigin(feature);
    } else {
      addDestination(feature);
    }
  };

  const handleUserLocationFound = (lng: number, lat: number) => {
    setUserCoords([lng, lat]);
  };

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
        />

        <MapView
          origin={origin}
          destinations={destinations}
          route={route}
          onMapClickPoint={handleMapClickPoint}
          onUserLocationFound={handleUserLocationFound}
        />
      </main>
    </div>
  );
};
