import React from "react";
import AvatarImage from "../components/AvatarImage";
import "./MainLayout.css";

interface MainLayoutProps {
  children: React.ReactNode;

  userName: string;
  roleName: string;
  avatarUrl?: string | null;
  permissions: string[];

  onLogout: () => void;

  // =========================================================
  // ĐIỀU HƯỚNG
  // =========================================================

  onHome: () => void;
  onGradeManagement: () => void;
  onStudentInformation: () => void;
  onClassHistory: () => void;
  onClassManagement: () => void;
  onTrainingCatalog: () => void;
  onTrainingPrograms?: () => void;
  onAdmissionsLeads: () => void;
  onScheduleManagement?: () => void;
  onAttendanceManagement?: () => void;
  onAssignments?: () => void;
  onProfile: () => void;
  onChangePassword: () => void;

}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  userName,
  roleName,
  avatarUrl,
  permissions,
  onLogout,

  onHome,
  onGradeManagement,
  onStudentInformation,
  onClassHistory,
  onClassManagement,
  onTrainingCatalog,
  onTrainingPrograms = () => {},
  onAdmissionsLeads,
  onScheduleManagement = () => window.location.assign("/quan-ly-lich-hoc"),
  onAttendanceManagement = () => window.location.assign("/quan-ly-diem-danh"),
  onAssignments = () => window.location.assign("/quan-ly-bai-tap"),
  onProfile,
  onChangePassword,
}) => {
  // =========================================================
  // PATH HIỆN TẠI
  // =========================================================

  const currentPath = window.location.pathname;

  // =========================================================
  // KIỂM TRA ACTIVE MENU
  // =========================================================

  const isActive = (path: string) => {
    return currentPath === path;
  };
  const canViewGrades = permissions.includes("GRADE_VIEW");
  const canViewClasses = permissions.includes("CLASS_VIEW");
  const canManageClasses =
    canViewClasses && permissions.includes("QUAN_LY_LOP");
  const canManageTrainingPrograms =
    canViewClasses &&
    ["CLASS_CREATE", "CLASS_UPDATE", "CLASS_DELETE"].some((permission) =>
      permissions.includes(permission),
    );
  const canViewCatalog = permissions.includes("CURRICULUM_VIEW");
  const canViewLeads = permissions.includes("LEAD_VIEW");
  const canViewSchedule = permissions.includes("SCHEDULE_VIEW");
  const canViewAttendance = permissions.includes("CLASS_VIEW");
  const canViewAssignments = [
    "ASSIGNMENT_VIEW",
    "ASSIGNMENT_CREATE",
    "ASSIGNMENT_SUBMIT",
    "ASSIGNMENT_GRADE",
  ].some((permission) => permissions.includes(permission));
  const canManageGrades =
    permissions.includes("GRADE_CREATE") ||
    permissions.includes("GRADE_UPDATE");

  // =========================================================
  // ĐIỀU HƯỚNG TRANG CHỦ
  // =========================================================

  const handleHome = () => {
    onHome();
  };

  // =========================================================
  // ĐIỀU HƯỚNG HỒ SƠ CÁ NHÂN
  // =========================================================

  const handleProfile = () => {
    onProfile();
  };

  // =========================================================
  // ĐIỀU HƯỚNG ĐỔI MẬT KHẨU
  // =========================================================

  const handleChangePassword = () => {
    onChangePassword();
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = () => {
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

          <div className="sidebar-section-title">CÁ NHÂN</div>

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

          {(canViewGrades || canViewClasses || canViewCatalog || canManageTrainingPrograms || canViewSchedule || canViewAttendance || canViewAssignments) && (
            <>
              <div className="sidebar-section-title">ĐÀO TẠO</div>

              {canViewGrades && (
                <button
                  type="button"
                  className={`sidebar-item ${
                    isActive("/quan-ly-diem") ? "active" : ""
                  }`}
                  onClick={onGradeManagement}
                >
                  <span className="sidebar-item-icon">▥</span>
                  <span>{canManageGrades ? "Quản lý điểm" : "Xem điểm"}</span>
                </button>
              )}

              {canViewGrades && permissions.includes("USER_VIEW") && (
                <>
                  <button
                    type="button"
                    className={`sidebar-item ${
                      isActive("/thong-tin-hoc-vien") ? "active" : ""
                    }`}
                    onClick={onStudentInformation}
                  >
                    <span className="sidebar-item-icon">♙</span>
                    <span>Thông tin học viên</span>
                  </button>
                  <button
                    type="button"
                    className={`sidebar-item ${
                      isActive("/lich-su-lop-hoc") ? "active" : ""
                    }`}
                    onClick={onClassHistory}
                  >
                    <span className="sidebar-item-icon">▤</span>
                    <span>Lịch sử lớp học</span>
                  </button>
                </>
              )}

              {canManageClasses && (
                <button
                  type="button"
                  className={`sidebar-item ${
                    isActive("/quan-ly-lop") ? "active" : ""
                  }`}
                  onClick={onClassManagement}
                >
                  <span className="sidebar-item-icon">▤</span>
                  <span>Quản lý lớp</span>
                </button>
              )}
              {canViewSchedule && (
                <button
                  type="button"
                  className={`sidebar-item ${
                    isActive("/quan-ly-lich-hoc") ? "active" : ""
                  }`}
                  onClick={onScheduleManagement}
                >
                  <span className="sidebar-item-icon">▦</span>
                  <span>Quản lý lịch học</span>
                </button>
              )}
              {canViewAttendance && (
                <button
                  type="button"
                  className={`sidebar-item ${
                    isActive("/quan-ly-diem-danh") ? "active" : ""
                  }`}
                  onClick={onAttendanceManagement}
                >
                  <span className="sidebar-item-icon">✓</span>
                  <span>Điểm danh</span>
                </button>
              )}
              {canViewAssignments && (
                <button
                  type="button"
                  className={`sidebar-item ${
                    isActive("/quan-ly-bai-tap") ? "active" : ""
                  }`}
                  onClick={onAssignments}
                >
                  <span className="sidebar-item-icon">▤</span>
                  <span>Bài tập</span>
                </button>
              )}
              {canManageTrainingPrograms && (
                <button
                  type="button"
                  className={`sidebar-item ${
                    isActive("/quan-ly-chuong-trinh") ? "active" : ""
                  }`}
                  onClick={onTrainingPrograms}
                >
                  <span className="sidebar-item-icon">▤</span>
                  <span>Chương trình đào tạo</span>
                </button>
              )}
              {canViewCatalog && (
                <button
                  type="button"
                  className={`sidebar-item ${
                    isActive("/danh-muc-dao-tao") ? "active" : ""
                  }`}
                  onClick={onTrainingCatalog}
                >
                  <span className="sidebar-item-icon">▧</span>
                  <span>Danh mục đào tạo</span>
                </button>
              )}
            </>
          )}
          {canViewLeads && (
            <>
              <div className="sidebar-section-title">TUYỂN SINH</div>
              <button
                type="button"
                className={`sidebar-item ${
                  isActive("/quan-ly-lead") ? "active" : ""
                }`}
                onClick={onAdmissionsLeads}
              >
                <span className="sidebar-item-icon">♧</span>
                <span>Lead tư vấn</span>
              </button>
            </>
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

      <main className="main-content">
        {/* ===================================================
            PAGE CONTENT
        =================================================== */}

        <section className="page-content">{children}</section>
      </main>
    </div>
  );
};

export default MainLayout;
