import { Destination, Origin } from '../../types';

const STORAGE_KEYS = {
  ORIGIN: 'rotafacil_origin',
  DESTINATIONS: 'rotafacil_destinations',
};

export const destinationStorage = {
  getOrigin(): Origin | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORIGIN);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Falha ao ler origem do LocalStorage:', e);
      return null;
    }
  },

  saveOrigin(origin: Origin | null): void {
    try {
      if (!origin) {
        localStorage.removeItem(STORAGE_KEYS.ORIGIN);
      } else {
        localStorage.setItem(STORAGE_KEYS.ORIGIN, JSON.stringify(origin));
      }
    } catch (e) {
      console.error('Falha ao salvar origem no LocalStorage:', e);
    }
  },

  getDestinations(): Destination[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DESTINATIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Falha ao ler destinos do LocalStorage:', e);
      return [];
    }
  },

  saveDestinations(destinations: Destination[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DESTINATIONS, JSON.stringify(destinations));
    } catch (e) {
      console.error('Falha ao salvar destinos no LocalStorage:', e);
    }
  },

  clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.ORIGIN);
      localStorage.removeItem(STORAGE_KEYS.DESTINATIONS);
    } catch (e) {
      console.error('Falha ao limpar LocalStorage:', e);
    }
  },
};
