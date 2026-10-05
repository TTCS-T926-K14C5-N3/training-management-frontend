import React, { useEffect, useRef, useState } from "react";
import "./MainLayout.css";

interface MainLayoutProps {
  children: React.ReactNode;
  userName: string;
  email: string;
  roleName: string;
  permissions: string[];
  onLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  userName,
  email,
  roleName,
  permissions,
  onLogout,
}) => {
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const accountMenuRef = useRef<HTMLDivElement>(null);

  const hasPermission = (maQuyen: string) => permissions.includes(maQuyen);

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

  return (
    <div className="main-layout">
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="sidebar">
        {/* LOGO */}

        <div className="sidebar-logo">
          <h2>EduManage</h2>
          <span>Training Management</span>
        </div>

        {/* MENU */}

        <nav className="sidebar-menu">
          {/* DASHBOARD */}

          <button className="sidebar-item active">
            <span>⌂</span>
            <span>Trang chủ</span>
          </button>

          {/* QUẢN LÝ ĐIỂM */}

          {hasPermission("QUAN_LY_DIEM") && (
            <button className="sidebar-item">
              <span>📊</span>
              <span>Quản lý điểm</span>
            </button>
          )}

          {/* QUẢN LÝ LỚP */}

          {hasPermission("QUAN_LY_LOP") && (
            <button className="sidebar-item">
              <span>🏫</span>
              <span>Quản lý lớp</span>
            </button>
          )}
        </nav>

        {/* ===================================================
            USER + LOGOUT
        =================================================== */}

        <div className="sidebar-bottom">
          {/* USER */}

          <div className="sidebar-user">
            <div className="user-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>

            <div className="user-info">
              <strong>{userName}</strong>
              <span>{roleName}</span>
            </div>
          </div>

          {/* LOGOUT */}

          <button className="logout-button" onClick={onLogout}>
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
            {/* NÚT TÊN TÀI KHOẢN */}

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
                {userName.charAt(0).toUpperCase()}
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
                {/* HEADER */}

                <div className="account-dropdown-header">
                  <div className="account-dropdown-avatar">
                    {userName.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <strong>{userName}</strong>
                    <span>{roleName}</span>
                  </div>
                </div>

                {/* DIVIDER */}

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

                      {/* ĐÃ SỬA: DÙNG EMAIL */}
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
                    TRẠNG THÁI TÀI KHOẢN
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
