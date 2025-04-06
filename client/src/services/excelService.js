const ExcelJS = require('exceljs');

const generateExcel = async (routeData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tuyến đường');
  
  worksheet.columns = [
    { header: 'Tên điểm đi', key: 'origin', width: 30 },
    { header: 'Tên điểm đến', key: 'destination', width: 30 },
    { header: 'Khoảng cách', key: 'distance', width: 15 },
    { header: 'Thời gian ước tính', key: 'duration', width: 20 },
    { header: 'Phương tiện', key: 'transport', width: 15 },
    { header: 'Chỉ dẫn tuyến đi', key: 'instructions', width: 50 },
    { header: 'Chi tiết', key: 'details', width: 30 }
  ];
  
  const instructionsText = routeData.steps
    .map(step => {
      const plainText = step.instructions
        .replace(/<div[^>]*>/g, '\n')
        .replace(/<\/div>/g, '')
        .replace(/<[^>]*>/g, '');
      return `${plainText} (${step.distance.text})`;
    })
    .join('\n');
  
  worksheet.addRow({
    origin: routeData.origin.shortName,
    destination: routeData.destination.shortName,
    distance: routeData.distance,
    duration: routeData.duration,
    transport: 'Ô tô',
    instructions: instructionsText,
    details: routeData.googleMapsUrl
  });
  
  worksheet.getCell('G2').value = {
    text: 'Xem trên Google Maps',
    hyperlink: routeData.googleMapsUrl
  };
  
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = {
  generateExcel
};
