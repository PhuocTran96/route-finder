import React from 'react';

const Header = ({ onLogout }) => {
  return (
    <header className="header">
      <div className="header-content">
        <h1>Route Finder</h1>
        <p>Made from React by Hoàng Phước with love</p>
      </div>
      <button className="logout-button" onClick={onLogout}>
        <i className="fas fa-sign-out-alt"></i> Đăng xuất
      </button>
    </header>
  );
};

export default Header;
