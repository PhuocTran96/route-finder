import React from 'react';

const ExcelTable = ({ routeData }) => {
  if (!routeData || !routeData.legs) return null;

  return (
    <div className="excel-table-container">
      <table className="excel-table">
        <thead>
          <tr>
            <th>STT</th>
            <th>Điểm đi</th>
            <th>Điểm đến</th>
            <th>Khoảng cách</th>
            <th>Thời gian</th>
            <th>Phương tiện</th>
          </tr>
        </thead>
        <tbody>
          {routeData.legs.map((leg, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{leg.origin.fullAddress}</td>
              <td>{leg.destination.fullAddress}</td>
              <td>{leg.distance}</td>
              <td>{leg.duration}</td>
              <td>Ô tô</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="3">Tổng cộng</td>
            <td>{routeData.totalDistance}</td>
            <td>{routeData.totalDuration}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default ExcelTable;
