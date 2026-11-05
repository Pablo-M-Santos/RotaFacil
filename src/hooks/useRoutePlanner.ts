import { useState, useEffect, useCallback, useRef } from 'react';
import { Origin, Destination, CalculatedRoute, GeocodingFeature } from '../types';
import { destinationStorage } from '../services/storage/destinationStorage';
import { calculateRoute } from '../services/mapbox/directions';

export function useRoutePlanner() {
  const [origin, setOrigin] = useState<Origin | null>(() => destinationStorage.getOrigin());
  const [destinations, setDestinations] = useState<Destination[]>(() =>
    destinationStorage.getDestinations()
  );
  const [route, setRoute] = useState<CalculatedRoute | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Ref para evitar recálculos redundantes e controlar race conditions / debounce
  const lastCalculatedKeyRef = useRef<string>('');

  // Persistir alterações no LocalStorage
  useEffect(() => {
    destinationStorage.saveOrigin(origin);
  }, [origin]);

  useEffect(() => {
    destinationStorage.saveDestinations(destinations);
  }, [destinations]);

  // Recalcular rota quando os pontos mudarem
  const triggerRouteCalculation = useCallback(async () => {
    if (!origin || destinations.length === 0) {
      setRoute(null);
      setRouteError(null);
      lastCalculatedKeyRef.current = '';
      return;
    }

    // Cria uma chave única baseada nas coordenadas e ordem atual para evitar chamadas idênticas
    const routeKey = JSON.stringify({
      origin: [origin.longitude, origin.latitude],
      dests: destinations.map((d) => [d.id, d.longitude, d.latitude, d.order]),
    });

    if (routeKey === lastCalculatedKeyRef.current) {
      return; // Já calculado para esta exata configuração
    }

    setIsCalculating(true);
    setRouteError(null);

    try {
      const allWaypoints = [origin, ...destinations];
      const result = await calculateRoute(allWaypoints);
      
      setRoute(result);
      lastCalculatedKeyRef.current = routeKey;
    } catch (err: any) {
      setRoute(null);
      setRouteError(err.message || 'Falha ao calcular o trajeto da rota.');
    } finally {
      setIsCalculating(false);
    }
  }, [origin, destinations]);

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerRouteCalculation();
    }, 300); // Debounce de 300ms para reordenações rápidas

    return () => clearTimeout(timer);
  }, [triggerRouteCalculation]);

  const selectOrigin = (feature: GeocodingFeature) => {
    const newOrigin: Origin = {
      id: feature.id,
      name: feature.text,
      address: feature.place_name,
      longitude: feature.center[0],
      latitude: feature.center[1],
    };
    setOrigin(newOrigin);
  };

  const clearOrigin = () => {
    setOrigin(null);
    setRoute(null);
  };

  const addDestination = (feature: GeocodingFeature) => {
    const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    
    const newDest: Destination = {
      id: `${feature.id}-${uniqueId}`,
      name: feature.text,
      address: feature.place_name,
      longitude: feature.center[0],
      latitude: feature.center[1],
      order: destinations.length + 1,
    };

    setDestinations((prev) => [...prev, newDest]);
  };

  const moveUp = (id: string) => {
    setDestinations((prev) => {
      const index = prev.findIndex((d) => d.id === id);
      if (index <= 0) return prev;
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy.map((item, idx) => ({ ...item, order: idx + 1 }));
    });
  };

  const moveDown = (id: string) => {
    setDestinations((prev) => {
      const index = prev.findIndex((d) => d.id === id);
      if (index === -1 || index >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy.map((item, idx) => ({ ...item, order: idx + 1 }));
    });
  };

  const removeDestination = (id: string) => {
    setDestinations((prev) => {
      const filtered = prev.filter((d) => d.id !== id);
      return filtered.map((item, idx) => ({ ...item, order: idx + 1 }));
    });
  };

  const resetAll = () => {
    destinationStorage.clearAll();
    setOrigin(null);
    setDestinations([]);
    setRoute(null);
    setRouteError(null);
    lastCalculatedKeyRef.current = '';
  };

  return {
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
  };
}