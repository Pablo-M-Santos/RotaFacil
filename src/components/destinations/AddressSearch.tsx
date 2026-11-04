import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { searchPlaces } from '../../services/mapbox/geocoding';
import { GeocodingFeature } from '../../types';

interface AddressSearchProps {
  placeholder?: string;
  onSelect: (feature: GeocodingFeature) => void;
  disabled?: boolean;
}

export const AddressSearch: React.FC<AddressSearchProps> = ({
  placeholder = 'Buscar endereço...',
  onSelect,
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<GeocodingFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.trim().length < 3) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    searchPlaces(debouncedSearchTerm)
      .then((features) => {
        if (isMounted) {
          setResults(features);
          setIsOpen(features.length > 0);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Falha ao buscar endereços.');
          setResults([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedSearchTerm]);

  const handleSelect = (item: GeocodingFeature) => {
    onSelect(item);
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="search-container" ref={wrapperRef}>
      <div className="search-input-wrapper">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="search-input"
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
        />
        {isLoading && <Loader2 className="spinner-icon animate-spin" size={18} />}
      </div>

      {error && <p className="search-error">{error}</p>}

      {isOpen && results.length > 0 && (
        <ul className="search-dropdown">
          {results.map((item) => (
            <li
              key={item.id}
              onClick={() => handleSelect(item)}
              className="search-dropdown-item"
            >
              <MapPin size={16} className="item-icon" />
              <div className="item-text">
                <strong>{item.text}</strong>
                <span>{item.place_name}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
