import React from 'react';
import { DestinationItem } from './DestinationItem';
import { Destination } from '../../types';

interface DestinationListProps {
  destinations: Destination[];
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onRemove: (id: string) => void;
}

export const DestinationList: React.FC<DestinationListProps> = ({
  destinations,
  onMoveUp,
  onMoveDown,
  onRemove,
}) => {
  if (destinations.length === 0) {
    return (
      <div className="empty-destinations">
        <p>Nenhum destino adicionado à rota.</p>
        <small>Pesquise um endereço acima para incluir como parada.</small>
      </div>
    );
  }

  return (
    <div className="destination-list">
      {destinations.map((destination, index) => (
        <DestinationItem
          key={destination.id}
          destination={destination}
          isFirst={index === 0}
          isLast={index === destinations.length - 1}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};
