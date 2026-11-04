import React from 'react';
import { useRoutePlanner } from '../hooks/useRoutePlanner';
import { Sidebar } from '../components/layout/Sidebar';
import { MapView } from '../components/map/MapView';
import { validateMapboxToken } from '../services/mapbox/mapboxClient';
import { AlertTriangle } from 'lucide-react';

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

  const isTokenConfigured = validateMapboxToken();

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
        />
      </main>
    </div>
  );
};
