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

  // Điều hướng đến trang chủ
  onHome: () => void;

  // Điều hướng đến trang quản lý người dùng
  onUserManagement: () => void;

  // Điều hướng đến trang đổi mật khẩu
  onChangePassword: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  userName,
  roleName,
  permissions,
  onLogout,
  onRoleManagement,
  onHome,
  onUserManagement,
  onChangePassword,
}) => {
  const avatarLetter = userName?.charAt(0)?.toUpperCase() || "A";

  const hasPermission = (maQuyen: string) => permissions.includes(maQuyen);

  // =========================================================
  // PATH HIỆN TẠI
  // =========================================================

  const currentPath = window.location.pathname;

  // =========================================================
  // KIỂM TRA MENU ĐANG ACTIVE
  // =========================================================

  const isHomeActive = currentPath === "/";

  const isUserManagementActive = currentPath === "/quan-ly-nguoi-dung";

  const isRoleManagementActive = currentPath === "/quan-ly-vai-tro";

  const isChangePasswordActive = currentPath === "/change-password";

  return (
    <div className="admin-layout">
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="admin-sidebar">
        {/* =================================================
            LOGO
        ================================================= */}

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
          {/* =================================================
              TỔNG QUAN
          ================================================= */}

          <div className="admin-section-title">TỔNG QUAN</div>

          {/* =================================================
              TRANG CHỦ
          ================================================= */}

          <button
            type="button"
            className={`admin-menu-item ${
              isHomeActive ? "admin-menu-active" : ""
            }`}
            onClick={onHome}
          >
            <span className="admin-menu-symbol">▦</span>

            <span>Trang chủ</span>
          </button>

          {/* =================================================
              QUẢN LÝ
          ================================================= */}

          <div className="admin-section-title">QUẢN LÝ</div>

          {/* =================================================
              NGƯỜI DÙNG
          ================================================= */}

          {hasPermission("USER_VIEW") && (
            <button
              type="button"
              className={`admin-menu-item ${
                isUserManagementActive ? "admin-menu-active" : ""
              }`}
              onClick={onUserManagement}
            >
              <span className="admin-menu-symbol">♙</span>

              <span>Người dùng</span>
            </button>
          )}

          {/* =================================================
              VAI TRÒ & QUYỀN
          ================================================= */}

          {hasPermission("ROLE_VIEW") && (
            <button
              type="button"
              className={`admin-menu-item ${
                isRoleManagementActive ? "admin-menu-active" : ""
              }`}
              onClick={onRoleManagement}
            >
              <span className="admin-menu-symbol">◇</span>

              <span>Vai trò & quyền</span>
            </button>
          )}

          {/* =================================================
              ĐÀO TẠO
          ================================================= */}

          <button type="button" className="admin-menu-item">
            <span className="admin-menu-symbol">▣</span>

            <span>Đào tạo</span>
          </button>

          {/* =================================================
              LỚP HỌC
          ================================================= */}

          {hasPermission("QUAN_LY_LOP") && (
            <button type="button" className="admin-menu-item">
              <span className="admin-menu-symbol">▤</span>

              <span>Lớp học</span>
            </button>
          )}

          {/* =================================================
              BÁO CÁO
          ================================================= */}

          <button type="button" className="admin-menu-item">
            <span className="admin-menu-symbol">◫</span>

            <span>Báo cáo</span>
          </button>

          {/* =================================================
              HỆ THỐNG
          ================================================= */}

          <div className="admin-section-title">HỆ THỐNG</div>

          {/* =================================================
              ĐỔI MẬT KHẨU
          ================================================= */}

          <button
            type="button"
            className={`admin-menu-item ${
              isChangePasswordActive ? "admin-menu-active" : ""
            }`}
            onClick={onChangePassword}
          >
            <span className="admin-menu-symbol">🔐</span>

            <span>Đổi mật khẩu</span>
          </button>

          {/* =================================================
              CÀI ĐẶT
          ================================================= */}

          <button type="button" className="admin-menu-item">
            <span className="admin-menu-symbol">⚙</span>

            <span>Cài đặt</span>
          </button>
        </div>

        {/* =====================================================
            USER FOOTER
        ===================================================== */}

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

          {/* =================================================
              ĐĂNG XUẤT
          ================================================= */}

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
              {isUserManagementActive
                ? "Người dùng"
                : isRoleManagementActive
                  ? "Vai trò & quyền"
                  : isChangePasswordActive
                    ? "Đổi mật khẩu"
                    : "Trang chủ"}
            </div>

            <h1>
              {isUserManagementActive
                ? "Quản lý người dùng"
                : isRoleManagementActive
                  ? "Quản lý vai trò người dùng"
                  : isChangePasswordActive
                    ? "Đổi mật khẩu"
                    : "Trang chủ"}
            </h1>

            <p>
              {isUserManagementActive
                ? "Quản lý tài khoản người dùng trong hệ thống."
                : isRoleManagementActive
                  ? "Quản lý người dùng, tìm kiếm và phân quyền theo vai trò."
                  : isChangePasswordActive
                    ? "Cập nhật mật khẩu để bảo vệ tài khoản."
                    : "Tổng quan hệ thống quản lý đào tạo"}
            </p>
          </div>

          {/* =================================================
              HEADER RIGHT
          ================================================= */}

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
