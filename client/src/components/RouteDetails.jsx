import React from 'react';

const RouteDetails = ({ routeData }) => {
  if (!routeData?.origin) return null;

  return (
    <div className="route-details">
      <div className="route-header">
        <h3>Chi tiết tuyến đường</h3>
        <div className="addresses">
          <div className="address">
            <i className="fas fa-map-marker-alt"></i>
            <strong>Điểm đi:</strong> 
            <span>{routeData.origin.fullAddress || 'Chưa xác định'}</span>
          </div>
          <div className="address">
            <i className="fas fa-map-pin"></i>
            <strong>Điểm đến:</strong> 
            <span>{routeData.destination.fullAddress || 'Chưa xác định'}</span>
          </div>
        </div>
      </div>

      <div className="route-summary">
        <div className="summary-item">
          <i className="fas fa-road"></i>
          <span>{routeData.distance}</span>
        </div>
        <div className="summary-item">
          <i className="fas fa-clock"></i>
          <span>{routeData.duration}</span>
        </div>
      </div>

      {routeData.warnings?.length > 0 && (
        <div className="route-warnings">
          {routeData.warnings.map((warning, i) => (
            <div key={i} className="warning">
              <i className="fas fa-exclamation-triangle"></i>
              {warning}
            </div>
          ))}
        </div>
      )}

      <div className="route-steps">
        <h4>Hướng dẫn chi tiết:</h4>
        {routeData.steps.map((step, index) => (
          <div key={index} className="step">
            <div className="step-header">
              <span className="step-number">{index + 1}</span>
              <div className="step-maneuver">
                {step.maneuver === 'turn-left' && <i className="fas fa-undo-alt"></i>}
                {step.maneuver === 'turn-right' && <i className="fas fa-redo-alt"></i>}
                {!step.maneuver && <i className="fas fa-arrow-up"></i>}
              </div>
              <div className="step-instructions" 
                   dangerouslySetInnerHTML={{ __html: step.instructions }} />
            </div>
            <div className="step-distance">
              <i className="fas fa-ruler"></i>
              {step.distance} ({step.duration})
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RouteDetails;
