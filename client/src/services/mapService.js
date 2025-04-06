// services/mapService.js
const getRouteData = async (origin, destination) => {
    try {
      // Gọi API để lấy dữ liệu tuyến đường
      const response = await fetch('/api/directions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ origin, destination }),
      });
      
      if (!response.ok) {
        throw new Error('Không thể tìm tuyến đường');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching route data:', error);
      throw error;
    }
  };
  
  export { getRouteData };
  