import React from 'react';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Destination } from '../../types';

interface DestinationItemProps {
  destination: Destination;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onRemove: (id: string) => void;
}

export const DestinationItem: React.FC<DestinationItemProps> = ({
  destination,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
}) => {
  return (
    <div className="destination-item">
      <div className="destination-badge">{destination.order}</div>

      <div className="destination-info">
        <h4 className="destination-name">{destination.name}</h4>
        <p className="destination-address">{destination.address}</p>
      </div>

      <div className="destination-actions">
        <button
          type="button"
          onClick={() => onMoveUp(destination.id)}
          disabled={isFirst}
          title="Mover para cima"
          className="action-btn"
        >
          <ArrowUp size={16} />
        </button>

        <button
          type="button"
          onClick={() => onMoveDown(destination.id)}
          disabled={isLast}
          title="Mover para baixo"
          className="action-btn"
        >
          <ArrowDown size={16} />
        </button>

        <button
          type="button"
          onClick={() => onRemove(destination.id)}
          title="Remover destino"
          className="action-btn remove-btn"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
