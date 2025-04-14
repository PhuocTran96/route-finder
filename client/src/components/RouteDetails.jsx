import React from 'react';

const RouteDetails = ({ routeData, isOptimized = false }) => {
  if (!routeData || !routeData.legs || routeData.legs.length === 0) {
    return null;
  }

  return (
    <div className="route-details-summary">
      <div className="route-summary">
        <div className="summary-item">
          <i className="fas fa-road"></i>
          <span>Tổng khoảng cách: {routeData.totalDistance}</span>
        </div>
        <div className="summary-item">
          <i className="fas fa-clock"></i>
          <span>Tổng thời gian: {routeData.totalDuration}</span>
        </div>
      </div>
    </div>
  );
};

export default RouteDetails;
