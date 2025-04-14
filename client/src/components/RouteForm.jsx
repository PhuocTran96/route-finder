import React, { useState, useEffect } from 'react';
import { StandaloneSearchBox } from '@react-google-maps/api';

const RouteForm = ({ onFindRoute, onOptimizeRoute, previousWaypoints = [] }) => {
  const [waypoints, setWaypoints] = useState([
    { address: '', coords: null, ref: React.createRef() },
    { address: '', coords: null, ref: React.createRef() }
  ]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Kiểm tra xem Google Maps API đã tải chưa
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      setIsLoaded(true);
    } else {
      const checkGoogleMapsLoaded = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          setIsLoaded(true);
          clearInterval(checkGoogleMapsLoaded);
        }
      }, 100);
      
      return () => clearInterval(checkGoogleMapsLoaded);
    }
  }, []);

  // Xử lý khi địa điểm thay đổi
  const handlePlacesChanged = (index) => {
    if (!waypoints[index].ref.current) return;
    
    const places = waypoints[index].ref.current.getPlaces();
    if (places && places.length > 0) {
      const place = places[0];
      const newWaypoints = [...waypoints];
      newWaypoints[index].address = place.formatted_address || place.name;

      // Lấy tọa độ GPS từ địa điểm
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        newWaypoints[index].coords = { lat, lng };
        console.log(`Waypoint ${index} coordinates:`, { lat, lng });
      }
      
      setWaypoints(newWaypoints);
    }
  };

  // Cập nhật địa chỉ khi nhập thủ công
  const handleAddressChange = (index, value) => {
    const newWaypoints = [...waypoints];
    newWaypoints[index].address = value;
    setWaypoints(newWaypoints);
  };

  // Thêm điểm dừng mới
  const addWaypoint = () => {
    setWaypoints([...waypoints, { address: '', coords: null, ref: React.createRef() }]);
  };

  // Xóa điểm dừng
  const removeWaypoint = (index) => {
    if (waypoints.length <= 2) return; // Giữ ít nhất 2 điểm (đi và đến)
    const newWaypoints = [...waypoints];
    newWaypoints.splice(index, 1);
    setWaypoints(newWaypoints);
  };

  // Xử lý khi gửi form
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Chuẩn bị dữ liệu gửi đi
    const waypointsData = waypoints.map(wp => 
      wp.coords ? `${wp.coords.lat},${wp.coords.lng}` : wp.address
    );
    
    // Gửi cả waypoints hiện tại và trước đó để so sánh
    onFindRoute(waypointsData, previousWaypoints);
  };
  
  const handleOptimize = () => {
    const waypointsData = waypoints.map(wp => 
      wp.coords ? `${wp.coords.lat},${wp.coords.lng}` : wp.address
    );
    onOptimizeRoute(waypointsData);
  };

  return (
    <form className="route-form" onSubmit={handleSubmit}>
      <div className="input-container">
        {waypoints.map((waypoint, index) => (
          <div className="input-group" key={index}>
            <i className={index === 0 ? "fas fa-map-marker-alt origin-icon" : 
               index === waypoints.length - 1 ? "fas fa-map-pin destination-icon" : 
               "fas fa-map-marker waypoint-icon"}></i>
            
            {isLoaded ? (
              <div style={{ width: '100%' }}>
                <StandaloneSearchBox
                  onLoad={(ref) => (waypoint.ref.current = ref)}
                  onPlacesChanged={() => handlePlacesChanged(index)}
                  options={{
                    componentRestrictions: { country: 'vn' },
                  }}
                >
                  <input
                    type="text"
                    value={waypoint.address}
                    onChange={(e) => handleAddressChange(index, e.target.value)}
                    placeholder={index === 0 ? "Nhập điểm xuất phát" : 
                                 index === waypoints.length - 1 ? "Nhập điểm đến cuối cùng" : 
                                 `Nhập điểm dừng ${index}`}
                    className="location-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </StandaloneSearchBox>
              </div>
            ) : (
              <input
                type="text"
                value={waypoint.address}
                onChange={(e) => handleAddressChange(index, e.target.value)}
                placeholder={index === 0 ? "Nhập điểm xuất phát" : 
                             index === waypoints.length - 1 ? "Nhập điểm đến cuối cùng" : 
                             `Nhập điểm dừng ${index}`}
                className="location-input"
              />
            )}
            
            {index > 0 && index < waypoints.length - 1 && (
              <button 
                type="button" 
                className="remove-waypoint" 
                onClick={() => removeWaypoint(index)}
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        ))}
        
        <button type="button" className="add-waypoint" onClick={addWaypoint}>
          <i className="fas fa-plus"></i> Thêm điểm dừng
        </button>
      </div>
      <div className="button-group">
        <button type="submit" className="search-button">
          <i className="fas fa-search"></i> Tìm đường
        </button>
        <button type="button" className="optimize-button" onClick={handleOptimize}>
          <i className="fas fa-magic"></i> Tối ưu hóa tuyến đường
        </button>
      </div>
    </form>
  );
};

export default RouteForm;
