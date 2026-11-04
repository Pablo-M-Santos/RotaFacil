import { useState, useEffect, useCallback } from 'react';
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
      return;
    }

    setIsCalculating(true);
    setRouteError(null);

    try {
      const allWaypoints = [origin, ...destinations];
      const result = await calculateRoute(allWaypoints);
      setRoute(result);
    } catch (err: any) {
      setRoute(null);
      setRouteError(err.message || 'Falha ao calcular o trajeto da rota.');
    } finally {
      setIsCalculating(false);
    }
  }, [origin, destinations]);

  useEffect(() => {
    triggerRouteCalculation();
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
  };

  const addDestination = (feature: GeocodingFeature) => {
    const newDest: Destination = {
      id: `${feature.id}-${Date.now()}`,
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
