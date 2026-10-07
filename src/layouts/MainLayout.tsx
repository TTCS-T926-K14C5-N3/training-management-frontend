import React, { useEffect, useRef, useState } from "react";
import AvatarImage from "../components/AvatarImage";
import "./MainLayout.css";

interface MainLayoutProps {
  children: React.ReactNode;

  userName: string;
  email: string;
  roleName: string;
  avatarUrl?: string | null;
  permissions: string[];

  onLogout: () => void;

  // =========================================================
  // ĐIỀU HƯỚNG
  // =========================================================

  onHome: () => void;
  onProfile: () => void;
  onChangePassword: () => void;

  onGradeManagement?: () => void;
  onClassManagement?: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  userName,
  email,
  roleName,
  avatarUrl,
  permissions,
  onLogout,

  onHome,
  onProfile,
  onChangePassword,

  onGradeManagement,
  onClassManagement,
}) => {
  // =========================================================
  // STATE
  // =========================================================

  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // =========================================================
  // REF
  // =========================================================

  const accountMenuRef = useRef<HTMLDivElement>(null);

  // =========================================================
  // PATH HIỆN TẠI
  // =========================================================

  const currentPath = window.location.pathname;

  // =========================================================
  // KIỂM TRA QUYỀN
  // =========================================================

  const hasPermission = (maQuyen: string) => {
    return permissions.includes(maQuyen);
  };

  // =========================================================
  // KIỂM TRA ACTIVE MENU
  // =========================================================

  const isActive = (path: string) => {
    return currentPath === path;
  };

  // =========================================================
  // ĐÓNG POPUP KHI BẤM RA NGOÀI
  // =========================================================

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setShowAccountMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // =========================================================
  // ĐÓNG POPUP KHI NHẤN ESC
  // =========================================================

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAccountMenu(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // =========================================================
  // ĐIỀU HƯỚNG TRANG CHỦ
  // =========================================================

  const handleHome = () => {
    setShowAccountMenu(false);
    onHome();
  };

  // =========================================================
  // ĐIỀU HƯỚNG HỒ SƠ CÁ NHÂN
  // =========================================================

  const handleProfile = () => {
    setShowAccountMenu(false);
    onProfile();
  };

  // =========================================================
  // ĐIỀU HƯỚNG ĐỔI MẬT KHẨU
  // =========================================================

  const handleChangePassword = () => {
    setShowAccountMenu(false);
    onChangePassword();
  };

  // =========================================================
  // ĐIỀU HƯỚNG QUẢN LÝ ĐIỂM
  // =========================================================

  const handleGradeManagement = () => {
    setShowAccountMenu(false);

    if (!onGradeManagement) {
      return;
    }

    onGradeManagement();
  };

  // =========================================================
  // ĐIỀU HƯỚNG QUẢN LÝ LỚP
  // =========================================================

  const handleClassManagement = () => {
    setShowAccountMenu(false);

    if (!onClassManagement) {
      return;
    }

    onClassManagement();
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = () => {
    setShowAccountMenu(false);
    onLogout();
  };

  return (
    <div className="main-layout">
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="sidebar">
        {/* ===================================================
            LOGO
        =================================================== */}

        <div className="sidebar-logo">
          <h2>EduManage</h2>

          <span>Training Management</span>
        </div>

        {/* ===================================================
            MENU
        =================================================== */}

        <nav className="sidebar-menu">
          {/* =================================================
              TRANG CHỦ
          ================================================= */}

          <button
            type="button"
            className={`sidebar-item ${isActive("/") ? "active" : ""}`}
            onClick={handleHome}
          >
            <span className="sidebar-item-icon">⌂</span>

            <span>Trang chủ</span>
          </button>

          {/* =================================================
              HỒ SƠ CÁ NHÂN
          ================================================= */}

          <button
            type="button"
            className={`sidebar-item ${
              isActive("/ho-so-ca-nhan") ? "active" : ""
            }`}
            onClick={handleProfile}
          >
            <span className="sidebar-item-icon">👤</span>

            <span>Hồ sơ cá nhân</span>
          </button>

          {/* =================================================
              ĐỔI MẬT KHẨU
          ================================================= */}

          <button
            type="button"
            className={`sidebar-item ${
              isActive("/change-password") ? "active" : ""
            }`}
            onClick={handleChangePassword}
          >
            <span className="sidebar-item-icon">🔐</span>

            <span>Đổi mật khẩu</span>
          </button>

          {/* =================================================
              QUẢN LÝ ĐIỂM
          ================================================= */}

          {hasPermission("QUAN_LY_DIEM") && (
            <button
              type="button"
              className={`sidebar-item ${
                isActive("/quan-ly-diem") ? "active" : ""
              }`}
              onClick={handleGradeManagement}
            >
              <span className="sidebar-item-icon">📊</span>

              <span>Quản lý điểm</span>
            </button>
          )}

          {/* =================================================
              QUẢN LÝ LỚP
          ================================================= */}

          {hasPermission("QUAN_LY_LOP") && (
            <button
              type="button"
              className={`sidebar-item ${
                isActive("/quan-ly-lop") ? "active" : ""
              }`}
              onClick={handleClassManagement}
            >
              <span className="sidebar-item-icon">🏫</span>

              <span>Quản lý lớp</span>
            </button>
          )}
        </nav>

        {/* ===================================================
            USER + LOGOUT
        =================================================== */}

        <div className="sidebar-bottom">
          {/* =================================================
              USER
          ================================================= */}

          <button
            type="button"
            className="sidebar-user"
            onClick={handleProfile}
          >
            <div className="user-avatar">
              <AvatarImage
                source={avatarUrl}
                fallback={userName.charAt(0).toUpperCase()}
                alt={`Ảnh đại diện của ${userName}`}
              />
            </div>

            <div className="user-info">
              <strong>{userName}</strong>

              <span>{roleName}</span>
            </div>
          </button>

          {/* =================================================
              LOGOUT
          ================================================= */}

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main className="main-content">
        {/* ===================================================
            TOP HEADER
        =================================================== */}

        <header className="top-header">
          <div>
            <p>Hệ thống quản lý đào tạo</p>
          </div>

          {/* =================================================
              ACCOUNT BUTTON + POPUP
          ================================================= */}

          <div className="header-account-wrapper" ref={accountMenuRef}>
            {/* =================================================
                ACCOUNT BUTTON
            ================================================= */}

            <button
              type="button"
              className={`header-user ${
                showAccountMenu ? "header-user-active" : ""
              }`}
              onClick={() => setShowAccountMenu((prev) => !prev)}
              aria-expanded={showAccountMenu}
              aria-haspopup="true"
            >
              <div className="header-user-avatar">
                <AvatarImage
                  source={avatarUrl}
                  fallback={userName.charAt(0).toUpperCase()}
                  alt={`Ảnh đại diện của ${userName}`}
                />
              </div>

              <span>{userName}</span>

              <span
                className={`header-user-arrow ${
                  showAccountMenu ? "rotate" : ""
                }`}
              >
                ▾
              </span>
            </button>

            {/* =================================================
                ACCOUNT DROPDOWN
            ================================================= */}

            {showAccountMenu && (
              <div className="account-dropdown">
                {/* =================================================
                    DROPDOWN HEADER
                ================================================= */}

                <div className="account-dropdown-header">
                  <div className="account-dropdown-avatar">
                    <AvatarImage
                      source={avatarUrl}
                      fallback={userName.charAt(0).toUpperCase()}
                      alt={`Ảnh đại diện của ${userName}`}
                    />
                  </div>

                  <div>
                    <strong>{userName}</strong>

                    <span>{roleName}</span>
                  </div>
                </div>

                {/* =================================================
                    DIVIDER
                ================================================= */}

                <div className="account-dropdown-divider"></div>

                {/* =================================================
                    THÔNG TIN TÀI KHOẢN
                ================================================= */}

                <div className="account-dropdown-section">
                  {/* HỌ VÀ TÊN */}

                  <div className="account-dropdown-item">
                    <div className="account-dropdown-icon">👤</div>

                    <div>
                      <span>Họ và tên</span>

                      <strong>{userName}</strong>
                    </div>
                  </div>

                  {/* EMAIL */}

                  <div className="account-dropdown-item">
                    <div className="account-dropdown-icon">✉️</div>

                    <div>
                      <span>Email</span>

                      <strong>{email}</strong>
                    </div>
                  </div>

                  {/* VAI TRÒ */}

                  <div className="account-dropdown-item">
                    <div className="account-dropdown-icon">🛡️</div>

                    <div>
                      <span>Vai trò</span>

                      <strong>{roleName}</strong>
                    </div>
                  </div>

                  {/* SỐ QUYỀN */}

                  <div className="account-dropdown-item">
                    <div className="account-dropdown-icon">🔐</div>

                    <div>
                      <span>Số quyền</span>

                      <strong>{permissions.length} quyền</strong>
                    </div>
                  </div>
                </div>

                {/* =================================================
                    ACTIONS
                ================================================= */}

                <div className="account-dropdown-actions">
                  {/* HỒ SƠ */}

                  <button type="button" onClick={handleProfile}>
                    <span>👤</span>

                    <span>Hồ sơ cá nhân</span>
                  </button>

                  {/* ĐỔI MẬT KHẨU */}

                  <button type="button" onClick={handleChangePassword}>
                    <span>🔐</span>

                    <span>Đổi mật khẩu</span>
                  </button>
                </div>

                {/* =================================================
                    TRẠNG THÁI
                ================================================= */}

                <div className="account-dropdown-status">
                  <span className="account-status-dot">●</span>

                  <div>
                    <strong>Tài khoản đang hoạt động</strong>

                    <span>Phiên đăng nhập hiện tại bình thường.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ===================================================
            PAGE CONTENT
        =================================================== */}

        <section className="page-content">{children}</section>
      </main>
    </div>
  );
};

export default MainLayout;
