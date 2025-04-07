import React from 'react';

const Header = () => {
  return (
    <header className="header">
      <h1>Route Finder</h1>
      <p>Made from React by Hoàng Phước with love</p>
      <button onClick={onLogout}>Đăng xuất</button>
    </header>
  );
};

export default Header;
