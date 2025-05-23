import React, { useState, useEffect } from 'react';
import { LoadScript } from '@react-google-maps/api';
import Header from './components/Header';
import RouteForm from './components/RouteForm';
import RouteMap from './components/RouteMap';
import RouteDetails from './components/RouteDetails';
import DownloadButton from './components/DownloadButton';
import Login from './components/Login';
import './styles.css';

const libraries = ['places', 'geometry'];
const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

function App() {
  const [routeData, setRouteData] = useState(null);
  const [originalRouteData, setOriginalRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cachedRoutes, setCachedRoutes] = useState({});
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isOptimized, setIsOptimized] = useState(false);

  // Kiểm tra token khi component mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // Hàm đăng nhập
  const handleLogin = (userToken) => {
    localStorage.setItem('token', userToken);
    setToken(userToken);
  };

  // Hàm đăng xuất
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  // Hàm tìm tuyến đường
  const handleFindRoute = async (waypoints, previousWaypoints = []) => {
    setLoading(true);
    setError(null);
    setIsOptimized(false);
    setOriginalRouteData(null);

    try {
      // Kiểm tra xem có waypoints trước đó không
      const hasPreviousWaypoints = previousWaypoints.length > 0;
      
      // Xác định điểm bắt đầu tính toán mới
      let startIndex = 0;
      let previousLegs = [];
      let previousTotalDistance = 0;
      let previousTotalDuration = 0;
      
      if (hasPreviousWaypoints) {
        // Tìm điểm chung cuối cùng giữa tuyến đường cũ và mới
        for (let i = 0; i < Math.min(previousWaypoints.length, waypoints.length); i++) {
          if (previousWaypoints[i] !== waypoints[i]) {
            break;
          }
          startIndex = i;
        }
        
        // Nếu có ít nhất một chặng có thể tái sử dụng
        if (startIndex > 0 && routeData && routeData.legs) {
          previousLegs = routeData.legs.slice(0, startIndex);
          previousTotalDistance = previousLegs.reduce((sum, leg) => sum + leg.distanceValue, 0);
          previousTotalDuration = previousLegs.reduce((sum, leg) => sum + leg.durationValue, 0);
        }
      }
      
      // Nếu tất cả các điểm đều giống nhau, không cần tính toán lại
      if (hasPreviousWaypoints && startIndex === previousWaypoints.length - 1 && waypoints.length === previousWaypoints.length) {
        setLoading(false);
        return;
      }
      
      // Chỉ tính toán các chặng mới
      const newWaypoints = waypoints.slice(startIndex);
      
      // Đảm bảo waypoints được mã hóa đúng
      const safeWaypoints = newWaypoints.map(wp => encodeURIComponent(wp));
      
      console.log('Sending request with waypoints:', safeWaypoints);
      console.log('Starting calculation from index:', startIndex);

      const API_URL = process.env.NODE_ENV === 'production' 
        ? 'https://route-finder-app-d6de2cbb07a2.herokuapp.com/api/multi-directions'
        : 'http://localhost:5000/api/multi-directions';
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          waypoints: safeWaypoints,
          startIndex: startIndex > 0 ? startIndex - 1 : 0
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Không thể tìm tuyến đường');
      }

      const data = await response.json();
      console.log('API Response Data:', data);
      
      // Kết hợp kết quả cũ và mới
      if (previousLegs.length > 0) {
        const combinedData = {
          legs: [...previousLegs, ...data.legs],
          totalDistance: formatDistance(previousTotalDistance + data.totalDistanceValue),
          totalDistanceValue: previousTotalDistance + data.totalDistanceValue,
          totalDuration: formatDuration(previousTotalDuration + data.totalDurationValue),
          totalDurationValue: previousTotalDuration + data.totalDurationValue,
          waypoints: [...routeData.waypoints.slice(0, startIndex + 1), ...data.waypoints.slice(1)]
        };
        setRouteData(combinedData);
      } else {
        setRouteData(data);
      }
      
      // Lưu waypoints hiện tại để so sánh trong lần tìm kiếm tiếp theo
      setRouteData(prevData => ({
        ...prevData || data,
        currentWaypoints: waypoints
      }));
      
    } catch (err) {
      console.error('Error in handleFindRoute:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Hàm định dạng khoảng cách
  const formatDistance = (meters) => {
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  };
  
  // Hàm định dạng thời gian
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours} giờ ${minutes} phút`;
    } else {
      return `${minutes} phút`;
    }
  };

  const handleOptimizeRoute = async (waypoints) => {
    setLoading(true);
    setError(null);
    
    // Lưu lại dữ liệu tuyến đường ban đầu trước khi tối ưu
    setOriginalRouteData(routeData);
    setIsOptimized(true);

    try {
      const API_URL = process.env.NODE_ENV === 'production' 
        ? 'https://route-finder-app-d6de2cbb07a2.herokuapp.com/api/optimize-route'
        : 'http://localhost:5000/api/optimize-route';
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ waypoints }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể tối ưu hóa tuyến đường');
      }

      const data = await response.json();
      setRouteData(data);
    } catch (err) {
      console.error('Error in handleOptimizeRoute:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return <Login onLogin={(token) => {
      localStorage.setItem('token', token);
      setToken(token);
    }} />;
  }

  return (
    <div className="app">
      <LoadScript 
        googleMapsApiKey={API_KEY}
        libraries={libraries}
      >
        <Header onLogout={handleLogout} />
        <main>
          <RouteForm 
            onFindRoute={handleFindRoute}
            onOptimizeRoute={handleOptimizeRoute} 
            previousWaypoints={routeData?.currentWaypoints || []}
          />
          {loading && <div className="loading">Đang tìm tuyến đường...</div>}
          {error && <div className="error">{error}</div>}
          {routeData && (
            <>
              <div className={`route-comparison ${isOptimized ? 'optimized' : ''}`}>
                <div className="route-column original">
                  <h3>Tuyến đường ban đầu</h3>
                  <RouteMap routeData={isOptimized ? originalRouteData : routeData} />
                  <div className="route-summary">
                    <div className="summary-item">
                      <i className="fas fa-road"></i>
                      <span>Tổng khoảng cách: {isOptimized ? originalRouteData.totalDistance : routeData.totalDistance}</span>
                    </div>
                    <div className="summary-item">
                      <i className="fas fa-clock"></i>
                      <span>Tổng thời gian: {isOptimized ? originalRouteData.totalDuration : routeData.totalDuration}</span>
                    </div>
                  </div>
                </div>
                
                {isOptimized && (
                  <div className="route-column optimized">
                    <h3>Tuyến đường tối ưu</h3>
                    <RouteMap routeData={routeData} />
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
                    
                    <div className="optimization-summary">
                      <h4>Kết quả tối ưu hóa:</h4>
                      <p>
                        <i className="fas fa-chart-line"></i>
                        Tiết kiệm: {((originalRouteData.totalDistanceValue - routeData.totalDistanceValue) / originalRouteData.totalDistanceValue * 100).toFixed(1)}% khoảng cách
                      </p>
                      <p>
                        <i className="fas fa-road"></i>
                        Khoảng cách giảm: {((originalRouteData.totalDistanceValue - routeData.totalDistanceValue) / 1000).toFixed(1)} km
                      </p>
                      <p>
                        <i className="fas fa-clock"></i>
                        Thời gian giảm: {Math.floor((originalRouteData.totalDurationValue - routeData.totalDurationValue) / 60)} phút
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <DownloadButton 
                routeData={routeData}
                originalRouteData={isOptimized ? originalRouteData : null}
                isOptimized={isOptimized}
              />
            </>
          )}
        </main>
      </LoadScript>
    </div>
  );
}

export default App;
