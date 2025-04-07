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
    ? process.env.CLIENT_URL || 'https://route-finder-app-d6de2cbb07a2.herokuapp.com' 
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

    return {
      location: response.data.results[0].geometry.location,
      address: response.data.results[0].formatted_address,
      shortName: response.data.results[0].address_components[0].short_name
    };
  } catch (error) {
    console.error('Geocoding error:', error.message);
    throw error;
  }
};

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

    // Tạo các chặng (legs) giữa các điểm liên tiếp
    const legs = [];
    let totalDistanceValue = 0;
    let totalDurationValue = 0;

    for (let i = 0; i < processedWaypoints.length - 1; i++) {
      const origin = processedWaypoints[i];
      const destination = processedWaypoints[i + 1];

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
        return res.status(400).json({
          error: `Không thể tìm tuyến đường từ ${origin.shortName} đến ${destination.shortName}`,
          details: response.data
        });
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

    // Tính tổng khoảng cách và thời gian
    // Chuyển đổi từ mét sang km và giây sang phút/giờ
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

    const result = {
      legs,
      totalDistance: formatTotalDistance(totalDistanceValue),
      totalDistanceValue,
      totalDuration: formatTotalDuration(totalDurationValue),
      totalDurationValue,
      waypoints: processedWaypoints
    };

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
    const routeData = req.body;
    
    // Tạo workbook mới
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tuyến đường');
    
    // Định dạng cột
    worksheet.columns = [
      { header: 'Tên điểm đi', key: 'origin', width: 30 },
      { header: 'Tên điểm đến', key: 'destination', width: 30 },
      { header: 'Khoảng cách', key: 'distance', width: 15 },
      { header: 'Thời gian ước tính', key: 'duration', width: 20 },
      { header: 'Phương tiện', key: 'transport', width: 15 },
      { header: 'Chỉ dẫn tuyến đi', key: 'instructions', width: 50 },
      { header: 'Chi tiết', key: 'details', width: 20 }
    ];
    
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
      worksheet.addRow({
        origin: leg.origin.fullAddress,
        destination: leg.destination.fullAddress,
        distance: leg.distance,
        duration: leg.duration,
        transport: 'Ô tô',
        instructions: instructionsText,
        details: 'Xem trên Google Maps'
      });
      
      // Thêm hyperlink cho cột "Chi tiết"
      worksheet.getCell(`G${worksheet.rowCount}`).value = {
        text: 'Xem trên Google Maps',
        hyperlink: mapLink
      };
      worksheet.getCell(`G${worksheet.rowCount}`).font = {
        color: { argb: '0000FF' },
        underline: true
      };
    });
    
    // Thêm dòng tổng cộng
    worksheet.addRow({
      stt: '',
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