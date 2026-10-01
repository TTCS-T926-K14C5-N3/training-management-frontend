import React from "react";
import "./AdminLayout.css";

interface AdminLayoutProps {
  children: React.ReactNode;
  userName: string;
  roleName: string;
  onLogout: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  userName,
  roleName,
  onLogout,
}) => {
  const avatarLetter = userName?.charAt(0)?.toUpperCase() || "A";

  return (
    <div className="admin-layout">
      {/* ================= SIDEBAR ================= */}
      <aside className="admin-sidebar">
        {/* Logo */}
        <div className="admin-logo">
          <div className="admin-logo-mark">E</div>

          <div className="admin-logo-text">
            <div>EduManage</div>
            <small>TRAINING MANAGEMENT</small>
          </div>
        </div>

        {/* Menu */}
        <div className="admin-navigation">
          <div className="admin-section-title">TỔNG QUAN</div>

          <button className="admin-menu-item admin-menu-active">
            <span className="admin-menu-symbol">▦</span>
            <span>Dashboard</span>
          </button>

          <div className="admin-section-title">QUẢN LÝ</div>

          <button className="admin-menu-item">
            <span className="admin-menu-symbol">♙</span>
            <span>Người dùng</span>
          </button>

          <button className="admin-menu-item">
            <span className="admin-menu-symbol">◇</span>
            <span>Vai trò & quyền</span>
          </button>

          <button className="admin-menu-item">
            <span className="admin-menu-symbol">▣</span>
            <span>Đào tạo</span>
          </button>

          <button className="admin-menu-item">
            <span className="admin-menu-symbol">▤</span>
            <span>Lớp học</span>
          </button>

          <button className="admin-menu-item">
            <span className="admin-menu-symbol">◫</span>
            <span>Báo cáo</span>
          </button>

          <div className="admin-section-title">HỆ THỐNG</div>

          <button className="admin-menu-item">
            <span className="admin-menu-symbol">⚙</span>
            <span>Cài đặt</span>
          </button>
        </div>

        {/* User bottom */}
        <div className="admin-sidebar-footer">
          <div className="admin-account">
            <div className="admin-avatar">
              {avatarLetter}
              <span className="admin-online"></span>
            </div>

            <div className="admin-account-info">
              <strong>{userName}</strong>
              <span>{roleName}</span>
            </div>
          </div>

          <button type="button" className="admin-logout" onClick={onLogout}>
            <span>↪</span>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <main className="admin-main">
        {/* Header */}
        <header className="admin-header">
          <div>
            <div className="admin-breadcrumb">
              Admin <span>/</span> Dashboard
            </div>

            <h1>Dashboard</h1>

            <p>Tổng quan hệ thống quản lý đào tạo</p>
          </div>

          <div className="admin-header-right">
            <button
              type="button"
              className="admin-notification"
              title="Thông báo"
            >
              ♢<span></span>
            </button>

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

        {/* Content */}
        <section className="admin-content">
          {/* Welcome */}
          <div className="admin-welcome">
            <div>
              <div className="admin-welcome-label">ADMINISTRATOR</div>

              <h2>Xin chào, {userName} 👋</h2>

              <p>Chào mừng bạn trở lại hệ thống quản lý đào tạo.</p>
            </div>

            <div className="admin-welcome-icon">✦</div>
          </div>

          {/* Statistics */}
          <div className="admin-stat-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-icon blue">♙</div>

              <div>
                <span>Tổng người dùng</span>
                <strong>1,248</strong>
                <small>
                  <b>+12%</b> so với tháng trước
                </small>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon purple">▣</div>

              <div>
                <span>Lớp học</span>
                <strong>86</strong>
                <small>
                  <b>+8%</b> so với tháng trước
                </small>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon green">◇</div>

              <div>
                <span>Khóa học</span>
                <strong>42</strong>
                <small>
                  <b>+5%</b> so với tháng trước
                </small>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon orange">◫</div>

              <div>
                <span>Đang hoạt động</span>
                <strong>1,106</strong>
                <small>
                  <b>88.6%</b> người dùng
                </small>
              </div>
            </div>
          </div>

          {/* Bottom panels */}
          <div className="admin-dashboard-grid">
            {/* Activity */}
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h3>Hoạt động gần đây</h3>
                  <p>Các hoạt động mới nhất trong hệ thống</p>
                </div>

                <button type="button">Xem tất cả</button>
              </div>

              <div className="admin-activity">
                <div className="admin-activity-item">
                  <div className="activity-icon blue">♙</div>

                  <div>
                    <strong>Người dùng mới được tạo</strong>

                    <span>Tài khoản học viên mới đã được thêm</span>

                    <small>5 phút trước</small>
                  </div>
                </div>

                <div className="admin-activity-item">
                  <div className="activity-icon green">✓</div>

                  <div>
                    <strong>Cập nhật thông tin lớp học</strong>

                    <span>Lớp CNTT K14 đã được cập nhật</span>

                    <small>24 phút trước</small>
                  </div>
                </div>

                <div className="admin-activity-item">
                  <div className="activity-icon purple">◇</div>

                  <div>
                    <strong>Thay đổi quyền người dùng</strong>

                    <span>Quyền Admin đã được cập nhật</span>

                    <small>1 giờ trước</small>
                  </div>
                </div>

                <div className="admin-activity-item">
                  <div className="activity-icon orange">▤</div>

                  <div>
                    <strong>Báo cáo mới được tạo</strong>

                    <span>Báo cáo thống kê tháng 09/2026</span>

                    <small>2 giờ trước</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h3>Thao tác nhanh</h3>
                  <p>Truy cập các chức năng thường dùng</p>
                </div>
              </div>

              <div className="admin-quick-actions">
                <button>
                  <span className="quick-blue">♙</span>
                  <div>
                    <strong>Quản lý người dùng</strong>
                    <small>Thêm, sửa, khóa tài khoản</small>
                  </div>
                  <b>›</b>
                </button>

                <button>
                  <span className="quick-purple">◇</span>
                  <div>
                    <strong>Vai trò & quyền</strong>
                    <small>Thiết lập quyền hệ thống</small>
                  </div>
                  <b>›</b>
                </button>

                <button>
                  <span className="quick-green">▣</span>
                  <div>
                    <strong>Quản lý đào tạo</strong>
                    <small>Chương trình và lớp học</small>
                  </div>
                  <b>›</b>
                </button>

                <button>
                  <span className="quick-orange">▤</span>
                  <div>
                    <strong>Báo cáo</strong>
                    <small>Xem báo cáo hệ thống</small>
                  </div>
                  <b>›</b>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminLayout;
