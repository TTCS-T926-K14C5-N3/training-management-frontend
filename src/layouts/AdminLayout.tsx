import React, { useEffect, useMemo, useRef, useState } from "react";
import AvatarImage from "../components/AvatarImage";
import "./AdminLayout.css";

interface AdminLayoutProps {
  children: React.ReactNode;
  userName: string;
  roleName: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
  permissions: string[];
  onLogout: () => void;

  // Điều hướng đến trang cấu hình quyền
  onRoleManagement: () => void;

  // Điều hướng đến trang chủ
  onHome: () => void;

  // Điều hướng đến trang quản lý người dùng
  onUserManagement: () => void;


  onGradeManagement: () => void;
  onStudentInformation: () => void;
  onClassHistory: () => void;
  onClassManagement: () => void;
  onTrainingCatalog?: () => void;
  onTrainingPrograms?: () => void;
  onAdmissionsLeads?: () => void;
  onScheduleManagement?: () => void;

  // Điều hướng đến trang đổi mật khẩu
  onChangePassword: () => void;

  // Điều hướng đến trang hồ sơ cá nhân
  onProfile: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  userName,
  roleName,
  avatarUrl,
  isAdmin,
  permissions,
  onLogout,
  onRoleManagement,
  onHome,
  onUserManagement,
  onGradeManagement,
  onStudentInformation,
  onClassHistory,
  onClassManagement,
  onTrainingCatalog = () => {},
  onTrainingPrograms = () => {},
  onAdmissionsLeads = () => {},
  onScheduleManagement = () => window.location.assign("/quan-ly-lich-hoc"),
  onChangePassword,
  onProfile,
}) => {
  // =========================================================
  // AVATAR
  // =========================================================

  const avatarLetter = userName?.charAt(0)?.toUpperCase() || "A";

  // =========================================================
  // KIỂM TRA ADMIN
  // =========================================================

  const isAdminRole = () => {
    const normalizedRoleName = roleName.trim().toLowerCase();

    return (
      isAdmin ||
      normalizedRoleName === "admin" ||
      normalizedRoleName.includes("quản trị hệ thống") ||
      normalizedRoleName.includes("quản trị viên hệ thống")
    );
  };

  // =========================================================
  // KIỂM TRA QUYỀN
  // =========================================================

  const hasPermission = (maQuyen: string): boolean => {
    /*
     * Admin hệ thống luôn được phép truy cập tất cả các tính năng
     * chính của hệ thống, bao gồm:
     * - Quản lý người dùng     (USER_VIEW)
     * - Cấu hình quyền         (ROLE_VIEW)
     * - Danh mục đào tạo       (CURRICULUM_VIEW)
     * - Lead tư vấn            (LEAD_VIEW)
     * - Lịch học                (SCHEDULE_VIEW/CREATE/UPDATE)
     *
     * Việc này giúp tránh trường hợp tài khoản Admin
     * bị thiếu permission trong JWT nhưng vẫn phải có
     * quyền truy cập toàn bộ chức năng quản trị.
     */
    if (
      isAdminRole() &&
      (
        maQuyen === "USER_VIEW" ||
        maQuyen === "ROLE_VIEW" ||
        maQuyen === "CURRICULUM_VIEW" ||
        maQuyen === "LEAD_VIEW" ||
        maQuyen === "SCHEDULE_VIEW" ||
        maQuyen === "SCHEDULE_CREATE" ||
        maQuyen === "SCHEDULE_UPDATE"
      )
    ) {
      return true;
    }

    return permissions.includes(maQuyen);
  };

  // =========================================================
  // PATH HIỆN TẠI
  // =========================================================

  const currentPath = window.location.pathname;

  // =========================================================
  // KIỂM TRA MENU ĐANG ACTIVE
  // =========================================================

  const isHomeActive = currentPath === "/";

  const isUserManagementActive = currentPath === "/quan-ly-nguoi-dung";

  const isRoleManagementActive =
    currentPath === "/phan-quyen" || currentPath === "/quan-ly-vai-tro";

  const isGradeManagementActive = currentPath === "/quan-ly-diem";

  const isClassManagementActive = currentPath === "/quan-ly-lop";

  const isScheduleManagementActive = currentPath === "/quan-ly-lich-hoc";

  const isTrainingProgramsActive = currentPath === "/quan-ly-chuong-trinh";

  const isTrainingCatalogActive = currentPath === "/danh-muc-dao-tao";

  const isAdmissionsLeadsActive = currentPath === "/quan-ly-lead";

  const isChangePasswordActive = currentPath === "/change-password";

  const isProfileActive = currentPath === "/ho-so-ca-nhan";

  const [quickSearch, setQuickSearch] = useState("");
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const quickSearchRef = useRef<HTMLInputElement>(null);
  const quickLinks = useMemo(
    () =>
      [
        { label: "Trang chủ", action: onHome, available: true },
        { label: "Người dùng", action: onUserManagement, available: hasPermission("USER_VIEW") },
        {
          label: "Phân quyền",
          action: onRoleManagement,
          available: hasPermission("ROLE_VIEW") && hasPermission("ROLE_UPDATE"),
        },
        {
          label: hasPermission("GRADE_CREATE") || hasPermission("GRADE_UPDATE") ? "Quản lý điểm" : "Xem điểm",
          action: onGradeManagement,
          available: hasPermission("GRADE_VIEW") || hasPermission("QUAN_LY_DIEM"),
        },
        {
          label: "Quản lý lớp",
          action: onClassManagement,
          available: hasPermission("CLASS_VIEW") && hasPermission("QUAN_LY_LOP"),
        },
        {
          label: "Quản lý lịch học",
          action: onScheduleManagement,
          available: hasPermission("SCHEDULE_VIEW"),
        },
        {
          label: "Chương trình đào tạo",
          action: onTrainingPrograms,
          available: hasPermission("CLASS_VIEW"),
        },
        {
          label: "Danh mục đào tạo",
          action: onTrainingCatalog,
          available: hasPermission("CURRICULUM_VIEW"),
        },
        {
          label: "Lead tư vấn",
          action: onAdmissionsLeads,
          available: hasPermission("LEAD_VIEW"),
        },
        { label: "Hồ sơ cá nhân", action: onProfile, available: true },
        { label: "Đổi mật khẩu", action: onChangePassword, available: true },
      ].filter((link) => link.available),
    [
      hasPermission,
      onAdmissionsLeads,
      onChangePassword,
      onClassManagement,
      onGradeManagement,
      onHome,
      onProfile,
      onRoleManagement,
      onScheduleManagement,
      onTrainingCatalog,
      onTrainingPrograms,
      onUserManagement,
    ],
  );
  const filteredQuickLinks = quickLinks
    .filter((link) =>
      link.label.toLocaleLowerCase("vi").includes(quickSearch.trim().toLocaleLowerCase("vi")),
    )
    .slice(0, 6);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsQuickSearchOpen(true);
        quickSearchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setIsQuickSearchOpen(false);
        setQuickSearch("");
        quickSearchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

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
          <img
            className="admin-logo-mark"
            src="/images/edumanage-cap.png"
            alt="Logo EduManage"
          />

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
              QUYỀN
          ================================================= */}

          {hasPermission("ROLE_VIEW") && hasPermission("ROLE_UPDATE") && (
            <button
              type="button"
              className={`admin-menu-item ${
                isRoleManagementActive ? "admin-menu-active" : ""
              }`}
              onClick={onRoleManagement}
            >
              <span className="admin-menu-symbol">◇</span>

              <span>Quyền</span>
            </button>
          )}


          {(hasPermission("GRADE_VIEW") || hasPermission("QUAN_LY_DIEM")) && (
            <button
              type="button"
              className={`admin-menu-item ${
                isGradeManagementActive ? "admin-menu-active" : ""
              }`}
              onClick={onGradeManagement}
            >
              <span className="admin-menu-symbol">▥</span>

              <span>
                {hasPermission("QUAN_LY_DIEM") ||
                hasPermission("GRADE_CREATE") ||
                hasPermission("GRADE_UPDATE")
                  ? "Quản lý điểm"
                  : "Xem điểm"}
              </span>
            </button>
          )}

          {hasPermission("GRADE_VIEW") && hasPermission("USER_VIEW") && (
            <>
              <button
                type="button"
                className={`admin-menu-item ${
                  currentPath === "/thong-tin-hoc-vien" ? "admin-menu-active" : ""
                }`}
                onClick={onStudentInformation}
              >
                <span className="admin-menu-symbol">♙</span>
                <span>Thông tin học viên</span>
              </button>
              <button
                type="button"
                className={`admin-menu-item ${
                  currentPath === "/lich-su-lop-hoc" ? "admin-menu-active" : ""
                }`}
                onClick={onClassHistory}
              >
                <span className="admin-menu-symbol">▤</span>
                <span>Lịch sử lớp học</span>
              </button>
            </>
          )}

          {hasPermission("CLASS_VIEW") && hasPermission("QUAN_LY_LOP") && (
            <button
              type="button"
              className={`admin-menu-item ${
                isClassManagementActive ? "admin-menu-active" : ""
              }`}
              onClick={onClassManagement}
            >
              <span className="admin-menu-symbol">▤</span>

              <span>Quản lý lớp</span>
            </button>
          )}

          {hasPermission("SCHEDULE_VIEW") && (
            <button
              type="button"
              className={`admin-menu-item ${
                isScheduleManagementActive ? "admin-menu-active" : ""
              }`}
              onClick={onScheduleManagement}
            >
              <span className="admin-menu-symbol">▦</span>
              <span>Quản lý lịch học</span>
            </button>
          )}

          {hasPermission("CLASS_VIEW") && (
            <button
              type="button"
              className={`admin-menu-item ${
                isTrainingProgramsActive ? "admin-menu-active" : ""
              }`}
              onClick={onTrainingPrograms}
            >
              <span className="admin-menu-symbol">▤</span>
              <span>Chương trình đào tạo</span>
            </button>
          )}

          {hasPermission("CURRICULUM_VIEW") && (
            <button
              type="button"
              className={`admin-menu-item ${
                isTrainingCatalogActive ? "admin-menu-active" : ""
              }`}
              onClick={onTrainingCatalog}
            >
              <span className="admin-menu-symbol">▧</span>
              <span>Danh mục đào tạo</span>
            </button>
          )}

          {hasPermission("LEAD_VIEW") && (
            <button
              type="button"
              className={`admin-menu-item ${
                isAdmissionsLeadsActive ? "admin-menu-active" : ""
              }`}
              onClick={onAdmissionsLeads}
            >
              <span className="admin-menu-symbol">♧</span>
              <span>Lead tư vấn</span>
            </button>
          )}


          {/* =================================================
              HỆ THỐNG
          ================================================= */}

          <div className="admin-section-title">HỆ THỐNG</div>

          {/* =================================================
              HỒ SƠ CÁ NHÂN
          ================================================= */}

          <button
            type="button"
            className={`admin-menu-item ${
              isProfileActive ? "admin-menu-active" : ""
            }`}
            onClick={onProfile}
          >
            <span className="admin-menu-symbol">👤</span>

            <span>Hồ sơ cá nhân</span>
          </button>

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

          <button type="button" className="admin-menu-item" onClick={() => alert("Chức năng Cài đặt đang được phát triển!")}>
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
              <AvatarImage
                source={avatarUrl}
                fallback={avatarLetter}
                alt={`Ảnh đại diện của ${userName}`}
              />

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
        <header className="admin-topbar">
          <div className="admin-quick-search">
            <span className="admin-quick-search-icon" aria-hidden="true">⌕</span>
            <input
              ref={quickSearchRef}
              type="search"
              value={quickSearch}
              placeholder="Tìm kiếm nhanh lớp, môn học, người dùng..."
              aria-label="Tìm kiếm nhanh trong hệ thống"
              aria-expanded={isQuickSearchOpen && quickSearch.trim().length > 0}
              onFocus={() => setIsQuickSearchOpen(true)}
              onChange={(event) => {
                setQuickSearch(event.target.value);
                setIsQuickSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && filteredQuickLinks[0]) {
                  filteredQuickLinks[0].action();
                  setIsQuickSearchOpen(false);
                  setQuickSearch("");
                  quickSearchRef.current?.blur();
                }
              }}
            />
            <kbd>Ctrl + K</kbd>
            {isQuickSearchOpen && quickSearch.trim() && (
              <div className="admin-quick-search-results" role="listbox">
                {filteredQuickLinks.length ? (
                  filteredQuickLinks.map((link) => (
                    <button
                      key={link.label}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        link.action();
                        setIsQuickSearchOpen(false);
                        setQuickSearch("");
                        quickSearchRef.current?.blur();
                      }}
                    >
                      {link.label}
                    </button>
                  ))
                ) : (
                  <span>Không tìm thấy mục phù hợp.</span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="admin-topbar-user"
            onClick={onProfile}
            aria-label={`Mở hồ sơ của ${userName}`}
          >
            <span className="admin-topbar-avatar">
              <AvatarImage source={avatarUrl} fallback={avatarLetter} alt="" />
            </span>
            <span className="admin-topbar-user-copy">
              <strong>{userName}</strong>
              <small>{roleName}</small>
            </span>
            <span className="admin-topbar-chevron" aria-hidden="true">⌄</span>
          </button>
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
