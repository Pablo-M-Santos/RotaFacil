import React, { useState } from 'react';
import {
  Navigation,
  MapPin,
  Plus,
  RotateCcw,
  LocateFixed,
  Box,
  RotateCw,
  Layers,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { AddressSearch } from '../destinations/AddressSearch';
import { DestinationList } from '../destinations/DestinationList';
import { RouteSummary } from './RouteSummary';
import { Origin, Destination, CalculatedRoute, GeocodingFeature } from '../../types';

type MapStyleType = 'standard' | 'realistic' | 'satellite' | 'streets' | 'outdoors' | 'dark';

const MAP_STYLES: Record<MapStyleType, string> = {
  realistic: 'Realista 3D',
  standard: 'Vetor Padrão',
  satellite: 'Satélite HD',
  streets: 'Ruas',
  outdoors: 'Topográfico',
  dark: 'Modo Escuro',
};

interface SidebarProps {
  // Route planner
  origin: Origin | null;
  destinations: Destination[];
  route: CalculatedRoute | null;
  isCalculating: boolean;
  routeError: string | null;
  userProximity?: [number, number];
  onSelectOrigin: (feature: GeocodingFeature) => void;
  onClearOrigin: () => void;
  onAddDestination: (feature: GeocodingFeature) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onRemoveDestination: (id: string) => void;
  onResetAll: () => void;
  // Map controls
  is3DMode: boolean;
  currentStyle: MapStyleType;
  onLocateMe: () => void;
  onToggle3D: () => void;
  onRotate: () => void;
  onChangeStyle: (style: MapStyleType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  origin,
  destinations,
  route,
  isCalculating,
  routeError,
  userProximity,
  onSelectOrigin,
  onClearOrigin,
  onAddDestination,
  onMoveUp,
  onMoveDown,
  onRemoveDestination,
  onResetAll,
  is3DMode,
  currentStyle,
  onLocateMe,
  onToggle3D,
  onRotate,
  onChangeStyle,
}) => {
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const searchProximity: [number, number] | undefined = origin
    ? [origin.longitude, origin.latitude]
    : userProximity;

  return (
    <aside className="sidebar-floating-wrap">
      {/* Painel — o botão de toggle fica dentro do header */}
      <div className={`sidebar-panel${isOpen ? '' : ' sidebar-panel--collapsed'}`}>

        {/* Header */}
        <header className="sfp-header">
          <div className="sfp-brand">
            <div className="sfp-brand-icon">
              <Navigation size={18} color="#fff" />
            </div>
            {isOpen && (
              <div>
                <h1 className="sfp-title">RotaFácil</h1>
                <p className="sfp-subtitle">Planejador de Entregas</p>
              </div>
            )}
          </div>

          <div className="sfp-header-actions">
            {isOpen && (origin || destinations.length > 0) && (
              <button type="button" className="sfp-btn-clear" onClick={onResetAll} title="Limpar tudo">
                <RotateCcw size={13} />
                Limpar
              </button>
            )}
            <button
              type="button"
              className="sfp-toggle-btn"
              onClick={() => setIsOpen((v) => !v)}
              title={isOpen ? 'Fechar painel' : 'Abrir painel'}
              aria-label={isOpen ? 'Fechar painel' : 'Abrir painel'}
            >
              {isOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
          </div>
        </header>

        {/* Hub de controles do mapa */}
        <div className="sfp-map-controls">
          <button
            type="button"
            className="sfp-ctrl-btn"
            onClick={onLocateMe}
            title="Minha localização (GPS)"
          >
            <LocateFixed size={15} />
            <span>GPS</span>
          </button>

          <button
            type="button"
            className={`sfp-ctrl-btn${is3DMode ? ' sfp-ctrl-active' : ''}`}
            onClick={onToggle3D}
            title="Alternar 2D / 3D"
          >
            <Box size={15} />
            <span>{is3DMode ? '2D' : '3D'}</span>
          </button>

          <button
            type="button"
            className="sfp-ctrl-btn"
            onClick={onRotate}
            title="Girar câmera 180°"
          >
            <RotateCw size={15} />
            <span>Girar</span>
          </button>

          <div className="sfp-style-wrap">
            <button
              type="button"
              className="sfp-ctrl-btn sfp-ctrl-layers"
              onClick={() => setShowStyleMenu((v) => !v)}
              title="Estilo do mapa"
            >
              <Layers size={15} />
              <span>{MAP_STYLES[currentStyle]}</span>
              <ChevronDown size={12} style={{ marginLeft: 2, opacity: 0.7 }} />
            </button>

            {showStyleMenu && (
              <div className="sfp-style-menu">
                {(Object.keys(MAP_STYLES) as MapStyleType[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`sfp-style-item${currentStyle === key ? ' sfp-style-selected' : ''}`}
                    onClick={() => { onChangeStyle(key); setShowStyleMenu(false); }}
                  >
                    {MAP_STYLES[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sfp-divider" />

        {/* Conteúdo scrollável */}
        <div className="sfp-body">

          {/* Origem */}
          <section className="sfp-section">
            <label className="sfp-label">
              <MapPin size={13} className="sfp-label-icon green" />
              Ponto de Partida
            </label>

            {origin ? (
              <div className="sfp-origin-card">
                <div className="sfp-origin-dot" />
                <div className="sfp-origin-info">
                  <strong>{origin.name}</strong>
                  <span>{origin.address}</span>
                </div>
                <button type="button" className="sfp-btn-swap" onClick={onClearOrigin}>
                  Trocar
                </button>
              </div>
            ) : (
              <AddressSearch
                placeholder="Digite o endereço de partida..."
                onSelect={onSelectOrigin}
                proximity={searchProximity}
              />
            )}
          </section>

          {/* Destinos */}
          <section className="sfp-section">
            <label className="sfp-label">
              <Plus size={13} className="sfp-label-icon blue" />
              Adicionar Paradas
            </label>
            <AddressSearch
              placeholder="Nome do local ou endereço..."
              onSelect={onAddDestination}
              disabled={destinations.length >= 24}
              proximity={searchProximity}
            />
            {destinations.length >= 24 && (
              <span className="sfp-warn">Limite de 24 destinos atingido.</span>
            )}
          </section>

          {/* Métricas */}
          <RouteSummary route={route} isLoading={isCalculating} error={routeError} />

          {/* Lista de destinos */}
          {destinations.length > 0 && (
            <section className="sfp-section sfp-section-list">
              <div className="sfp-section-row">
                <label className="sfp-label">Destinos ({destinations.length})</label>
                {destinations.length > 1 && (
                  <span className="sfp-hint">Use as setas para reordenar</span>
                )}
              </div>
              <DestinationList
                destinations={destinations}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onRemove={onRemoveDestination}
              />
            </section>
          )}
        </div>

        {/* Footer */}
        <footer className="sfp-footer">
          <span className="sfp-status">
            <span className="sfp-status-dot" /> Sistema operacional
          </span>
          <span className="sfp-version">v1.0</span>
        </footer>
      </div>
    </aside>
  );
};
