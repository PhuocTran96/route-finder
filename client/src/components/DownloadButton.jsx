import React from 'react';

const DownloadButton = ({ routeData, originalRouteData, isOptimized }) => {
  const handleDownload = async () => {
    try {
      const API_URL = process.env.NODE_ENV === 'production' 
        ? 'https://route-finder-app-d6de2cbb07a2.herokuapp.com/api/download'
        : 'http://localhost:5000/api/download';
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          routeData, 
          originalRouteData, 
          isOptimized 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Không thể tải xuống file Excel');
      }
      
      // Tạo blob từ response
      const blob = await response.blob();
      
      // Tạo URL cho blob
      const url = window.URL.createObjectURL(blob);
      
      // Tạo link tải xuống và kích hoạt
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tuyen-duong.xlsx';
      document.body.appendChild(a);
      a.click();
      
      // Dọn dẹp
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('Không thể tải xuống file Excel. Vui lòng thử lại sau.');
    }
  };

  return (
    <button className="download-button" onClick={handleDownload}>
      <i className="fas fa-file-excel"></i> Tải xuống Excel
    </button>
  );
};

export default DownloadButton;
