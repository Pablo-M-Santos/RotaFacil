import React from 'react';
import { MapPin, Navigation, Plus, RotateCcw } from 'lucide-react';
import { AddressSearch } from '../destinations/AddressSearch';
import { DestinationList } from '../destinations/DestinationList';
import { RouteSummary } from './RouteSummary';
import { Origin, Destination, CalculatedRoute, GeocodingFeature } from '../../types';

interface SidebarProps {
  origin: Origin | null;
  destinations: Destination[];
  route: CalculatedRoute | null;
  isCalculating: boolean;
  routeError: string | null;
  onSelectOrigin: (feature: GeocodingFeature) => void;
  onClearOrigin: () => void;
  onAddDestination: (feature: GeocodingFeature) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onRemoveDestination: (id: string) => void;
  onResetAll: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  origin,
  destinations,
  route,
  isCalculating,
  routeError,
  onSelectOrigin,
  onClearOrigin,
  onAddDestination,
  onMoveUp,
  onMoveDown,
  onRemoveDestination,
  onResetAll,
}) => {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="brand">
          <Navigation className="brand-icon" size={26} />
          <div>
            <h1>RotaFácil</h1>
            <p className="subtitle">Planejador de Entregas</p>
          </div>
        </div>

        {(origin || destinations.length > 0) && (
          <button
            type="button"
            className="btn-text-danger"
            onClick={onResetAll}
            title="Limpar todos os dados"
          >
            <RotateCcw size={15} /> Limpar
          </button>
        )}
      </header>

      <div className="sidebar-content">
        {/* Seção 1: Origem */}
        <section className="section-group">
          <label className="section-label">
            <MapPin size={16} className="text-green" /> Ponto de Partida (Origem)
          </label>

          {origin ? (
            <div className="origin-card">
              <div className="origin-details">
                <strong>{origin.name}</strong>
                <p>{origin.address}</p>
              </div>
              <button
                type="button"
                className="btn-change"
                onClick={onClearOrigin}
                title="Alterar ponto de partida"
              >
                Trocar
              </button>
            </div>
          ) : (
            <AddressSearch
              placeholder="Digite o endereço de partida..."
              onSelect={onSelectOrigin}
            />
          )}
        </section>

        {/* Seção 2: Adicionar Destinos */}
        <section className="section-group">
          <label className="section-label">
            <Plus size={16} className="text-blue" /> Adicionar Paradas / Destinos
          </label>
          <AddressSearch
            placeholder="Digite um destino para adicionar..."
            onSelect={onAddDestination}
            disabled={destinations.length >= 24}
          />
          {destinations.length >= 24 && (
            <span className="warning-text">Limite de 24 destinos atingido.</span>
          )}
        </section>

        {/* Resumo da Rota */}
        <RouteSummary
          route={route}
          isLoading={isCalculating}
          error={routeError}
        />

        {/* Seção 3: Lista Ordenada de Destinos */}
        <section className="section-group flex-fill">
          <div className="section-title-row">
            <label className="section-label">
              Destinos ({destinations.length})
            </label>
            {destinations.length > 1 && (
              <span className="hint-label">Use as setas para reordenar</span>
            )}
          </div>

          <DestinationList
            destinations={destinations}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onRemove={onRemoveDestination}
          />
        </section>
      </div>
    </aside>
  );
};
