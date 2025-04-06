import React, { useEffect, useRef, useState } from 'react';
import { GoogleMap } from '@react-google-maps/api';

const RouteMap = ({ routeData }) => {
  const mapRef = useRef(null);
  const polylineRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const mapContainerStyle = {
    width: '100%',
    height: '400px'
  };

  const center = {
    lat: routeData?.waypoints?.[0]?.lat || 10.8231,
    lng: routeData?.waypoints?.[0]?.lng || 106.6297,
  };

  const onMapLoad = (map) => {
    mapRef.current = map;
    setMapLoaded(true);
  };

  useEffect(() => {
    if (!mapLoaded || !routeData || !routeData.legs || !window.google?.maps?.geometry) return;

    try {
      // Xóa polyline cũ nếu có
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }

      // Tạo bounds để chứa tất cả các điểm
      const bounds = new window.google.maps.LatLngBounds();
      
      // Vẽ polyline cho từng chặng
      routeData.legs.forEach(leg => {
        try {
          if (!leg.polyline) return;
          
          // Giải mã polyline
          const decodedPath = window.google.maps.geometry.encoding.decodePath(leg.polyline);
          
          // Tạo polyline mới
          const legPolyline = new window.google.maps.Polyline({
            path: decodedPath,
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            strokeWeight: 4,
          });
          
          // Gắn polyline vào bản đồ
          legPolyline.setMap(mapRef.current);
          
          // Mở rộng bounds để chứa tất cả các điểm
          decodedPath.forEach(point => bounds.extend(point));
        } catch (error) {
          console.error('Lỗi khi vẽ polyline:', error);
        }
      });
      
      // Căn chỉnh bản đồ theo tuyến đường
      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds);
      }
    } catch (error) {
      console.error('Lỗi khi xử lý dữ liệu tuyến đường:', error);
    }
  }, [routeData, mapLoaded]);

  const onMapUnmount = () => {
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }
    mapRef.current = null;
    setMapLoaded(false);
  };

  if (!routeData) return null;

  return (
    <div className="route-map">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={12}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        options={{
          gestureHandling: 'cooperative',
          disableDefaultUI: false
        }}
      />
    </div>
  );
};

export default RouteMap;
