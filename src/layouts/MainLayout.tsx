

import React from "react";
import "./MainLayout.css";

interface MainLayoutProps {
  children: React.ReactNode;
  userName: string;
  roleName: string;
  permissions: string[];
  onLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  userName,
  roleName,
  permissions,
  onLogout,
}) => {
  const hasPermission = (maQuyen: string) =>
  permissions.includes(maQuyen);
  return (
    <div className="main-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>EduManage</h2>
          <span>Training Management</span>
        </div>

        <nav className="sidebar-menu">
  {/* Dashboard */}
  <button className="sidebar-item active">
    <span>⌂</span>
    <span>Dashboard</span>
  </button>

  {/* Quản lý điểm */}
  {hasPermission("QUAN_LY_DIEM") && (
    <button className="sidebar-item">
      <span>📊</span>
      <span>Quản lý điểm</span>
    </button>
  )}

  {/* Quản lý lớp */}
  {hasPermission("QUAN_LY_LOP") && (
    <button className="sidebar-item">
      <span>🏫</span>
      <span>Quản lý lớp</span>
    </button>
  )}

  {/* Hồ sơ cá nhân */}
  <button className="sidebar-item">
    <span>👤</span>
    <span>Hồ sơ cá nhân</span>
  </button>
</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="user-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>

            <div className="user-info">
              <strong>{userName}</strong>
              <span>{roleName}</span>
            </div>
          </div>

          <button className="logout-button" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>Dashboard</h1>
            <p>Hệ thống quản lý đào tạo</p>
          </div>

          <div className="header-user">
            <span>{userName}</span>
          </div>
        </header>

        <section className="page-content">{children}</section>
      </main>
    </div>
  );
};

export default MainLayout;
