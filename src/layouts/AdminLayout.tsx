import React from "react";
import "./AdminLayout.css";

interface AdminLayoutProps {
  children: React.ReactNode;
  userName: string;
  roleName: string;
  permissions: string[];
  onLogout: () => void;

  // Điều hướng đến trang quản lý vai trò & quyền
  onRoleManagement: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  userName,
  roleName,
  permissions,
  onLogout,
  onRoleManagement,
}) => {
  const avatarLetter = userName?.charAt(0)?.toUpperCase() || "A";

  const hasPermission = (maQuyen: string) => permissions.includes(maQuyen);

  return (
    <div className="admin-layout">
      {/* =====================================================
          SIDEBAR
      ===================================================== */}
      <aside className="admin-sidebar">
        {/* Logo */}
        <div className="admin-logo">
          <div className="admin-logo-mark">E</div>

          <div className="admin-logo-text">
            <div>EduManage</div>

            <small>TRAINING MANAGEMENT</small>
          </div>
        </div>

        {/* =================================================
            MENU
        ================================================= */}
        <div className="admin-navigation">
          {/* Tổng quan */}
          <div className="admin-section-title">TỔNG QUAN</div>

          <button type="button" className="admin-menu-item admin-menu-active">
            <span className="admin-menu-symbol">▦</span>

            <span>Trang chủ</span>
          </button>

          {/* =================================================
              QUẢN LÝ
          ================================================= */}
          <div className="admin-section-title">QUẢN LÝ</div>

          {/* Người dùng */}
          {hasPermission("USER_VIEW") && (
            <button type="button" className="admin-menu-item">
              <span className="admin-menu-symbol">♙</span>

              <span>Người dùng</span>
            </button>
          )}

          {/* Vai trò & quyền */}
          {hasPermission("ROLE_VIEW") && (
            <button
              type="button"
              className="admin-menu-item"
              onClick={onRoleManagement}
            >
              <span className="admin-menu-symbol">◇</span>

              <span>Vai trò & quyền</span>
            </button>
          )}

          {/* Đào tạo */}
          <button type="button" className="admin-menu-item">
            <span className="admin-menu-symbol">▣</span>

            <span>Đào tạo</span>
          </button>

          {/* Lớp học */}
          {hasPermission("QUAN_LY_LOP") && (
            <button type="button" className="admin-menu-item">
              <span className="admin-menu-symbol">▤</span>

              <span>Lớp học</span>
            </button>
          )}

          {/* Báo cáo */}
          <button type="button" className="admin-menu-item">
            <span className="admin-menu-symbol">◫</span>

            <span>Báo cáo</span>
          </button>

          {/* =================================================
              HỆ THỐNG
          ================================================= */}
          <div className="admin-section-title">HỆ THỐNG</div>

          {/* Cài đặt */}
          <button type="button" className="admin-menu-item">
            <span className="admin-menu-symbol">⚙</span>

            <span>Cài đặt</span>
          </button>
        </div>

        {/* =================================================
            USER FOOTER
        ================================================= */}
        <div className="admin-sidebar-footer">
          <div className="admin-account">
            {/* Avatar */}
            <div className="admin-avatar">
              {avatarLetter}

              <span className="admin-online"></span>
            </div>

            {/* Thông tin tài khoản */}
            <div className="admin-account-info">
              <strong>{userName}</strong>

              <span>{roleName}</span>
            </div>
          </div>

          {/* Đăng xuất */}
          <button type="button" className="admin-logout" onClick={onLogout}>
            <span>↪</span>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN
      ===================================================== */}
      <main className="admin-main">
        {/* =================================================
            HEADER
        ================================================= */}
        <header className="admin-header">
          <div>
            <div className="admin-breadcrumb">
              Admin
              <span>/</span>
              Trang chủ
            </div>

            <h1>Trang chủ</h1>

            <p>Tổng quan hệ thống quản lý đào tạo</p>
          </div>

          <div className="admin-header-right">
            {/* Notification */}
            <button
              type="button"
              className="admin-notification"
              title="Thông báo"
            >
              ♢<span></span>
            </button>

            {/* Profile */}
            <div className="admin-header-profile">
              <div className="admin-header-avatar">{avatarLetter}</div>

              <div>
                <strong>{userName}</strong>

                <small>{roleName}</small>
              </div>

              <span className="admin-arrow">▾</span>
            </div>
          </div>
        </header>

        {/* =================================================
            CONTENT
        ================================================= */}
        <section className="admin-content">{children}</section>
      </main>
    </div>
  );
};

export default AdminLayout;
