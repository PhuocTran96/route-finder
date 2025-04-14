const express = require('express');
const cors = require('cors');
const axios = require('axios');
const ExcelJS = require('exceljs');
const path = require('path');
const mongoose = require('mongoose');
const auth = require('./auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Kết nối MongoDB thành công'))
.catch(err => console.error('Lỗi kết nối MongoDB:', err));

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL 
    : 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
// Sử dụng routes xác thực
app.use('/api/auth', auth.routes);

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Hàm kiểm tra và chuyển đổi tọa độ
const processCoordinate = (input) => {
  const decoded = decodeURIComponent(input);
  
  // Kiểm tra định dạng tọa độ
  if (/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(decoded)) {
    const [lat, lng] = decoded.split(',').map(Number);
    return { lat, lng, type: 'coordinate' };
  }
  return { address: decoded, type: 'address' };
};

// Xử lý Geocoding
const geocode = async (input) => {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        [input.type === 'coordinate' ? 'latlng' : 'address']: input.type === 'coordinate' 
          ? `${input.lat},${input.lng}` 
          : input.address,
        key: API_KEY
      }
    });

    if (response.data.status !== 'OK') {
      throw new Error(response.data.status);
    }

    // Tạo tên ngắn gọn hơn nhưng vẫn đầy đủ thông tin cần thiết
    const result = response.data.results[0];
    const addressComponents = result.address_components;
    
    // Tìm các thành phần địa chỉ
    const streetNumber = addressComponents.find(comp => comp.types.includes('street_number'))?.long_name || '';
    const route = addressComponents.find(comp => comp.types.includes('route'))?.long_name || '';
    
    // Tạo shortName kết hợp số nhà và tên đường
    const shortName = streetNumber && route 
      ? `${streetNumber} ${route}` 
      : result.formatted_address.split(',')[0];

    return {
      location: result.geometry.location,
      address: result.formatted_address,
      shortName: shortName
    };
  } catch (error) {
    console.error('Geocoding error:', error.message);
    throw error;
  }
};

// Hàm tính toán lộ trình (tái sử dụng logic từ /api/multi-directions)
async function calculateRoute(waypoints) {
  // Tạo các chặng (legs) giữa các điểm liên tiếp
  const legs = [];
  let totalDistanceValue = 0;
  let totalDurationValue = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const origin = waypoints[i];
    const destination = waypoints[i + 1];

    // Gọi Directions API cho mỗi cặp điểm
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: 'driving',
        language: 'vi',
        key: API_KEY
      }
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Không thể tìm tuyến đường từ ${origin.shortName} đến ${destination.shortName}`);
    }

    const route = response.data.routes[0];
    const leg = route.legs[0];
    
    totalDistanceValue += leg.distance.value;
    totalDurationValue += leg.duration.value;

    legs.push({
      origin: {
        fullAddress: origin.fullAddress,
        shortName: origin.shortName,
        lat: origin.lat,
        lng: origin.lng
      },
      destination: {
        fullAddress: destination.fullAddress,
        shortName: destination.shortName,
        lat: destination.lat,
        lng: destination.lng
      },
      distance: leg.distance.text,
      distanceValue: leg.distance.value,
      duration: leg.duration.text,
      durationValue: leg.duration.value,
      steps: leg.steps.map(step => ({
        instructions: step.html_instructions,
        distance: step.distance.text,
        duration: step.duration.text,
        maneuver: step.maneuver || 'straight'
      })),
      polyline: route.overview_polyline.points
    });
  }

  // Định dạng tổng khoảng cách và thời gian
  const formatTotalDistance = (meters) => {
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  };

  const formatTotalDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours} giờ ${minutes} phút`;
    } else {
      return `${minutes} phút`;
    }
  };

  return {
    legs,
    totalDistance: formatTotalDistance(totalDistanceValue),
    totalDistanceValue,
    totalDuration: formatTotalDuration(totalDurationValue),
    totalDurationValue,
    waypoints
  };
}

app.post('/api/optimize-route', async (req, res) => {
  try {
    const { waypoints } = req.body;
    
    if (!waypoints || waypoints.length < 2) {
      return res.status(400).json({ error: 'Cần ít nhất 2 điểm để tối ưu hóa tuyến đường' });
    }
    
    // Xử lý tất cả các điểm
    const processedWaypoints = await Promise.all(
      waypoints.map(async (wp) => {
        const input = processCoordinate(wp);
        if (input.type === 'coordinate') {
          const geocodeResult = await geocode(input);
          return {
            lat: input.lat,
            lng: input.lng,
            fullAddress: geocodeResult.address,
            shortName: geocodeResult.shortName
          };
        } else {
          const geocodeResult = await geocode(input);
          return {
            lat: geocodeResult.location.lat,
            lng: geocodeResult.location.lng,
            fullAddress: geocodeResult.address,
            shortName: geocodeResult.shortName
          };
        }
      })
    );
    
    // Gọi Directions API với tham số optimize:true
    const origin = processedWaypoints[0];
    const destination = processedWaypoints[processedWaypoints.length - 1];
    const intermediates = processedWaypoints.slice(1, -1);
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        waypoints: `optimize:true|${intermediates.map(wp => `${wp.lat},${wp.lng}`).join('|')}`,
        mode: 'driving',
        language: 'vi',
        key: API_KEY
      }
    });
    
    if (response.data.status !== 'OK') {
      return res.status(400).json({
        error: 'Không thể tối ưu hóa tuyến đường',
        details: response.data
      });
    }
    
    // Lấy thứ tự tối ưu từ kết quả
    const optimizedOrder = response.data.routes[0].waypoint_order;
    
    // Sắp xếp lại waypoints theo thứ tự tối ưu
    const optimizedWaypoints = [origin];
    optimizedOrder.forEach(index => {
      optimizedWaypoints.push(intermediates[index]);
    });
    optimizedWaypoints.push(destination);
    
    // Tính toán lại lộ trình với thứ tự mới
    const result = await calculateRoute(optimizedWaypoints);
    
    res.json(result);
  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({ error: 'Không thể tối ưu hóa tuyến đường' });
  }
});

// API cho nhiều điểm đến
app.post('/api/multi-directions', async (req, res) => {
  try {
    const { waypoints, startIndex = 0 } = req.body;
    
    if (!waypoints || waypoints.length < 2) {
      return res.status(400).json({ error: 'Cần ít nhất 2 điểm để tạo tuyến đường' });
    }
    
    console.log('Request received with waypoints:', waypoints);
    console.log('Starting calculation from index:', startIndex);

    // Xử lý tất cả các điểm
    const processedWaypoints = await Promise.all(
      waypoints.map(async (wp) => {
        const input = processCoordinate(wp);
        if (input.type === 'coordinate') {
          const geocodeResult = await geocode(input);
          return {
            lat: input.lat,
            lng: input.lng,
            fullAddress: geocodeResult.address,
            shortName: geocodeResult.shortName
          };
        } else {
          const geocodeResult = await geocode(input);
          return {
            lat: geocodeResult.location.lat,
            lng: geocodeResult.location.lng,
            fullAddress: geocodeResult.address,
            shortName: geocodeResult.shortName
          };
        }
      })
    );

    console.log('Processed waypoints:', processedWaypoints);

    const result = await calculateRoute(processedWaypoints);

    res.json(result);

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Lỗi server',
      details: error.message 
    });
  }
});

// API endpoint để tạo và tải xuống file Excel
app.post('/api/download', async (req, res) => {
  try {
    const { routeData, originalRouteData, isOptimized } = req.body;
    
    // Tạo workbook mới
    const workbook = new ExcelJS.Workbook();
    
    // ===== SHEET 1: TỔNG QUAN =====
    const overviewSheet = workbook.addWorksheet('Tổng quan');
    
    // Định dạng cột cho sheet tổng quan
    overviewSheet.columns = [
      { header: 'Thông tin', key: 'info', width: 30 },
      { header: 'Tuyến đường ban đầu', key: 'original', width: 30 },
      { header: 'Tuyến đường tối ưu', key: 'optimized', width: 30 },
      { header: 'Chênh lệch', key: 'difference', width: 20 }
    ];
    
    // Thêm tiêu đề và định dạng
    overviewSheet.getRow(1).font = { bold: true, size: 12 };
    overviewSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Thêm dữ liệu tổng quan
    if (isOptimized && originalRouteData) {
      // Tính toán chênh lệch
      const distanceDiff = originalRouteData.totalDistanceValue - routeData.totalDistanceValue;
      const durationDiff = originalRouteData.totalDurationValue - routeData.totalDurationValue;
      const percentageSaved = ((distanceDiff / originalRouteData.totalDistanceValue) * 100).toFixed(1);
      
      // Thêm thông tin tổng quát
      overviewSheet.addRow({
        info: 'Tổng khoảng cách',
        original: originalRouteData.totalDistance,
        optimized: routeData.totalDistance,
        difference: `${(distanceDiff / 1000).toFixed(1)} km (${percentageSaved}%)`
      });
      
      overviewSheet.addRow({
        info: 'Tổng thời gian',
        original: originalRouteData.totalDuration,
        optimized: routeData.totalDuration,
        difference: `${Math.floor(durationDiff / 60)} phút`
      });
      
      // Thêm thông tin về thứ tự các điểm
      overviewSheet.addRow({ info: 'Thứ tự các điểm', original: '', optimized: '', difference: '' });
      
      // Thêm thứ tự các điểm trong tuyến đường ban đầu
      originalRouteData.waypoints.forEach((wp, index) => {
        overviewSheet.addRow({
          info: `Điểm ${index + 1}`,
          original: wp.shortName,
          optimized: index < routeData.waypoints.length ? routeData.waypoints[index].shortName : '',
          difference: ''
        });
      });
    } else {
      // Nếu không có tối ưu hóa, chỉ hiển thị thông tin tuyến đường hiện tại
      overviewSheet.addRow({
        info: 'Tổng khoảng cách',
        original: routeData.totalDistance,
        optimized: 'Chưa tối ưu hóa',
        difference: 'N/A'
      });
      
      overviewSheet.addRow({
        info: 'Tổng thời gian',
        original: routeData.totalDuration,
        optimized: 'Chưa tối ưu hóa',
        difference: 'N/A'
      });
    }
    
    // Thêm bản đồ tổng thể
    overviewSheet.addRow({});
    overviewSheet.addRow({ info: 'Xem trên Google Maps:', original: '', optimized: '', difference: '' });
    
    // URL cho bản đồ tổng thể
    const allWaypoints = routeData.waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
    const mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${routeData.waypoints[0].lat},${routeData.waypoints[0].lng}&destination=${routeData.waypoints[routeData.waypoints.length-1].lat},${routeData.waypoints[routeData.waypoints.length-1].lng}&waypoints=${allWaypoints}&travelmode=driving`;
    
    overviewSheet.addRow({ info: mapUrl });
    overviewSheet.getCell(`A${overviewSheet.rowCount}`).value = {
      text: 'Xem tuyến đường trên Google Maps',
      hyperlink: mapUrl
    };
    overviewSheet.getCell(`A${overviewSheet.rowCount}`).font = {
      color: { argb: '0000FF' },
      underline: true
    };
    
    // ===== SHEET 2: TUYẾN ĐƯỜNG BAN ĐẦU (nếu có) =====
    if (isOptimized && originalRouteData) {
      const originalSheet = workbook.addWorksheet('Tuyến đường ban đầu');
      
      // Định dạng cột
      originalSheet.columns = [
        { header: 'Tên điểm đi', key: 'origin', width: 30 },
        { header: 'Tên điểm đến', key: 'destination', width: 30 },
        { header: 'Khoảng cách', key: 'distance', width: 15 },
        { header: 'Thời gian ước tính', key: 'duration', width: 20 },
        { header: 'Phương tiện', key: 'transport', width: 15 },
        { header: 'Chỉ dẫn tuyến đi', key: 'instructions', width: 50 },
        { header: 'Chi tiết', key: 'details', width: 20 }
      ];
      
      // Định dạng header
      originalSheet.getRow(1).font = { bold: true, size: 12 };
      originalSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      
      // Thêm dữ liệu cho từng chặng
      originalRouteData.legs.forEach((leg, index) => {
        const instructionsText = leg.steps
          .map(step => {
            const plainText = step.instructions
              .replace(/<div[^>]*>/g, '\n')
              .replace(/<\/div>/g, '')
              .replace(/<[^>]*>/g, '');
            return `${plainText} (${step.distance.text})`;
          })
          .join('\n');
        
        // Tạo URL cho Google Maps
        const mapLink = `https://www.google.com/maps/dir/?api=1&origin=${leg.origin.lat},${leg.origin.lng}&destination=${leg.destination.lat},${leg.destination.lng}&travelmode=driving`;
        
        // Thêm dòng với địa chỉ đầy đủ và hyperlink
        originalSheet.addRow({
          origin: leg.origin.fullAddress,
          destination: leg.destination.fullAddress,
          distance: leg.distance,
          duration: leg.duration,
          transport: 'Ô tô',
          instructions: instructionsText,
          details: 'Xem trên Google Maps'
        });
        
        // Thêm hyperlink cho cột "Chi tiết"
        originalSheet.getCell(`G${originalSheet.rowCount}`).value = {
          text: 'Xem trên Google Maps',
          hyperlink: mapLink
        };
        originalSheet.getCell(`G${originalSheet.rowCount}`).font = {
          color: { argb: '0000FF' },
          underline: true
        };
      });
      
      // Thêm dòng tổng cộng
      originalSheet.addRow({
        origin: 'Tổng cộng',
        destination: '',
        distance: originalRouteData.totalDistance,
        duration: originalRouteData.totalDuration,
        transport: '',
        instructions: ''
      });
    }
    
    // ===== SHEET 3: TUYẾN ĐƯỜNG TỐI ƯU =====
    const optimizedSheet = workbook.addWorksheet(isOptimized ? 'Tuyến đường tối ưu' : 'Tuyến đường');
    
    // Định dạng cột
    optimizedSheet.columns = [
      { header: 'Tên điểm đi', key: 'origin', width: 30 },
      { header: 'Tên điểm đến', key: 'destination', width: 30 },
      { header: 'Khoảng cách', key: 'distance', width: 15 },
      { header: 'Thời gian ước tính', key: 'duration', width: 20 },
      { header: 'Phương tiện', key: 'transport', width: 15 },
      { header: 'Chỉ dẫn tuyến đi', key: 'instructions', width: 50 },
      { header: 'Chi tiết', key: 'details', width: 20 }
    ];
    
    // Định dạng header
    optimizedSheet.getRow(1).font = { bold: true, size: 12 };
    optimizedSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Thêm dữ liệu cho từng chặng
    routeData.legs.forEach((leg, index) => {
      const instructionsText = leg.steps
        .map(step => {
          const plainText = step.instructions
            .replace(/<div[^>]*>/g, '\n')
            .replace(/<\/div>/g, '')
            .replace(/<[^>]*>/g, '');
          return `${plainText} (${step.distance.text})`;
        })
        .join('\n');
      
      // Tạo URL cho Google Maps
      const mapLink = `https://www.google.com/maps/dir/?api=1&origin=${leg.origin.lat},${leg.origin.lng}&destination=${leg.destination.lat},${leg.destination.lng}&travelmode=driving`;
      
      // Thêm dòng với địa chỉ đầy đủ và hyperlink
      optimizedSheet.addRow({
        origin: leg.origin.fullAddress,
        destination: leg.destination.fullAddress,
        distance: leg.distance,
        duration: leg.duration,
        transport: 'Ô tô',
        instructions: instructionsText,
        details: 'Xem trên Google Maps'
      });
      
      // Thêm hyperlink cho cột "Chi tiết"
      optimizedSheet.getCell(`G${optimizedSheet.rowCount}`).value = {
        text: 'Xem trên Google Maps',
        hyperlink: mapLink
      };
      optimizedSheet.getCell(`G${optimizedSheet.rowCount}`).font = {
        color: { argb: '0000FF' },
        underline: true
      };
    });
    
    // Thêm dòng tổng cộng
    optimizedSheet.addRow({
      origin: 'Tổng cộng',
      destination: '',
      distance: routeData.totalDistance,
      duration: routeData.totalDuration,
      transport: '',
      instructions: ''
    });
    
    // Thiết lập header cho response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=tuyen-duong.xlsx');
    
    // Gửi file Excel
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ error: 'Không thể tạo file Excel' });
  }
});

// Serve static files trong môi trường production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

// Khởi động server
app.listen(PORT, () => {
  console.log(`🟢 Server đang chạy trên cổng ${PORT}`);
});
