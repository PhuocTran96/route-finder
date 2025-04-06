import React from 'react';

const DownloadButton = ({ routeData }) => {
  const handleDownload = async () => {
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(routeData),
      });
      
      if (!response.ok) {
        throw new Error('Không thể tạo file Excel');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tuyen-duong.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Lỗi khi tải xuống:', error);
      alert('Không thể tải xuống file Excel. Vui lòng thử lại sau.');
    }
  };

  return (
    <button 
      className="download-button" 
      onClick={handleDownload}
      disabled={!routeData}
    >
      Tải về Excel
    </button>
  );
};

export default DownloadButton;
