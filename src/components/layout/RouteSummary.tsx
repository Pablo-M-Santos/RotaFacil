import React from 'react';
import { Route, Clock } from 'lucide-react';
import { CalculatedRoute } from '../../types';
import { formatDistance, formatDuration } from '../../utils/formatters';

interface RouteSummaryProps {
  route: CalculatedRoute | null;
  isLoading: boolean;
  error: string | null;
}

export const RouteSummary: React.FC<RouteSummaryProps> = ({ route, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="summary-box loading">
        <span>Calculando rota em tempo real...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="summary-box error">
        <span>{error}</span>
      </div>
    );
  }

  if (!route) {
    return null;
  }

  return (
    <div className="summary-box active">
      <div className="summary-metric">
        <Route size={20} className="metric-icon" />
        <div>
          <span className="metric-label">Distância Total</span>
          <strong className="metric-value">{formatDistance(route.distanceMeters)}</strong>
        </div>
      </div>

      <div className="summary-metric">
        <Clock size={20} className="metric-icon" />
        <div>
          <span className="metric-label">Tempo Estimado</span>
          <strong className="metric-value">{formatDuration(route.durationSeconds)}</strong>
        </div>
      </div>
    </div>
  );
};
