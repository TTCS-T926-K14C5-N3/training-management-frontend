import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import RolePermissionsPanel from "./RolePermissionsPanel";
import AvatarImage from "../components/AvatarImage";
import "./RoleManagement.css";
import "./UsersPage.css";

// =========================================================
// INTERFACE
// =========================================================

interface User {
  nguoiDungId: number;
  hoTen: string;
  email: string;
  avatarUrl?: string | null;
  soDienThoai?: string | null;
  vaiTro?: string;
  trangThai?: string;
  ngayTao?: string;
  ngayCapNhat?: string;
}

interface Role {
  vaiTroId: number;
  tenVaiTro: string;
  moTa?: string;
}

interface UserRole {
  vaiTroId: number;
  tenVaiTro: string;
  moTa?: string;
  ngayGan?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// =========================================================
// COMPONENT
// =========================================================

const RoleManagement: React.FC = () => {
  const [activeSection, setActiveSection] = useState<"users" | "permissions">(
    "users",
  );
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingUserRoles, setLoadingUserRoles] = useState(false);

  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // =========================================================
  // TOAST
  // =========================================================

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const showSuccess = (text: string) => {
    setErrorMessage("");
    setMessage(text);
  };

  const showError = (text: string) => {
    setMessage("");
    setErrorMessage(text);
  };

  // Tự động ẩn thông báo sau 3 giây
  useEffect(() => {
    if (!message && !errorMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMessage("");
      setErrorMessage("");
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [message, errorMessage]);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const LIMIT = 20;

  // =========================================================
  // LOAD USERS
  // =========================================================

  const loadUsers = async (
    page: number = currentPage,
    currentSearch: string = search,
    currentRole: string = roleFilter,
    currentStatus: string = statusFilter,
  ) => {
    try {
      setLoadingUsers(true);

      const params: Record<string, string | number> = {
        page,
        limit: LIMIT,
      };

      if (currentSearch.trim()) {
        params.search = currentSearch.trim();
      }

      if (currentRole) {
        params.role_id = Number(currentRole);
      }

      if (currentStatus) {
        params.status = currentStatus;
      }

      const response = await api.get("/users/", {
        params,
      });

      const responseData = response.data;

      const userData = Array.isArray(responseData?.data)
        ? responseData.data
        : [];

      setUsers(userData);

      if (responseData?.pagination) {
        setPagination({
          page: responseData.pagination.page ?? page,
          limit: responseData.pagination.limit ?? LIMIT,
          total: responseData.pagination.total ?? 0,
          totalPages: responseData.pagination.totalPages ?? 0,
        });
      } else {
        setPagination({
          page,
          limit: LIMIT,
          total: userData.length,
          totalPages: userData.length > 0 ? 1 : 0,
        });
      }

      if (
        selectedUserId !== null &&
        !userData.some((user: User) => user.nguoiDungId === selectedUserId)
      ) {
        setSelectedUserId(null);
        setUserRoles([]);
      }
    } catch (error) {
      console.error("Không thể tải danh sách người dùng:", error);
      showError("Không thể tải danh sách người dùng.");
    } finally {
      setLoadingUsers(false);
    }
  };

  // =========================================================
  // LOAD ROLES
  // =========================================================

  const loadRoles = async () => {
    try {
      setLoadingRoles(true);

      const response = await api.get("/roles/");

      setRoles(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Không thể tải danh sách vai trò:", error);
      showError("Không thể tải danh sách vai trò.");
    } finally {
      setLoadingRoles(false);
    }
  };

  // =========================================================
  // LOAD USER ROLES
  // =========================================================

  const loadUserRoles = async (userId: number) => {
    try {
      setLoadingUserRoles(true);

      const response = await api.get(`/roles/users/${userId}`);

      setUserRoles(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Không thể tải vai trò của người dùng:", error);

      setUserRoles([]);

      showError("Không thể tải vai trò của người dùng.");
    } finally {
      setLoadingUserRoles(false);
    }
  };

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadUsers(1, "", "", "");
    loadRoles();
  }, []);

  // =========================================================
  // SELECT USER
  // =========================================================

  useEffect(() => {
    if (selectedUserId === null) {
      setUserRoles([]);
      return;
    }

    loadUserRoles(selectedUserId);
  }, [selectedUserId]);

  // =========================================================
  // SELECTED USER
  // =========================================================

  const selectedUser = users.find(
    (user) => user.nguoiDungId === selectedUserId,
  );

  // =========================================================
  // AVAILABLE ROLES
  // =========================================================

  const availableRoles = useMemo(() => {
    const currentRoleIds = new Set(userRoles.map((role) => role.vaiTroId));

    return roles.filter((role) => !currentRoleIds.has(role.vaiTroId));
  }, [roles, userRoles]);

  // =========================================================
  // SEARCH
  // =========================================================

  const handleSearch = () => {
    const value = searchInput.trim();

    setSearch(value);
    setCurrentPage(1);

    loadUsers(1, value, roleFilter, statusFilter);
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  // =========================================================
  // FILTER
  // =========================================================

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  // =========================================================
  // PAGINATION
  // =========================================================

  const handlePageChange = (page: number) => {
    if (
      page < 1 ||
      (pagination.totalPages > 0 && page > pagination.totalPages)
    ) {
      return;
    }

    setCurrentPage(page);

    loadUsers(page, search, roleFilter, statusFilter);
  };

  // =========================================================
  // ASSIGN ROLE
  // =========================================================

  const handleAssignRole = async (roleId: number) => {
    if (selectedUserId === null) {
      showError("Vui lòng chọn người dùng.");
      return;
    }

    try {
      setActionLoading(roleId);

      setMessage("");
      setErrorMessage("");

      await api.post(`/roles/users/${selectedUserId}/${roleId}`);

      await loadUserRoles(selectedUserId);

      showSuccess("Gán vai trò thành công.");
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (responseStatus === 400) {
        showError(detail || "Dữ liệu không hợp lệ.");
      } else if (responseStatus === 403) {
        showError(detail || "Bạn không có quyền thực hiện chức năng này.");
      } else if (responseStatus === 404) {
        showError(detail || "Không tìm thấy người dùng hoặc vai trò.");
      } else if (responseStatus === 409) {
        showError(detail || "Người dùng đã có vai trò này.");
      } else {
        showError(detail || "Có lỗi xảy ra khi gán vai trò.");
      }
    } finally {
      setActionLoading(null);
    }
  };

  // =========================================================
  // REMOVE ROLE
  // =========================================================

  const handleRemoveRole = async (roleId: number) => {
    if (selectedUserId === null) {
      showError("Vui lòng chọn người dùng.");
      return;
    }

    try {
      setActionLoading(roleId);

      setMessage("");
      setErrorMessage("");

      await api.delete(`/roles/users/${selectedUserId}/${roleId}`);

      await loadUserRoles(selectedUserId);

      showSuccess("Thu hồi vai trò thành công.");
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (responseStatus === 403) {
        showError(detail || "Bạn không có quyền thực hiện chức năng này.");
      } else if (responseStatus === 404) {
        showError(detail || "Người dùng không có vai trò này.");
      } else {
        showError(detail || "Có lỗi xảy ra khi thu hồi vai trò.");
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (activeSection === "permissions") {
    return (
      <div style={{ padding: "28px 32px 40px" }}>
        <button
          type="button"
          onClick={() => setActiveSection("users")}
          style={{
            marginBottom: "16px",
            padding: "9px 13px",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            background: "#fff",
            color: "#334155",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ← Quay lại gán vai trò
        </button>
        <RolePermissionsPanel roles={roles} />
      </div>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <>
      {(message || errorMessage) && (
        <ToastNotification
          type={message ? "success" : "error"}
          text={message || errorMessage}
          durationMs={3000}
          onClose={() => {
            setMessage("");
            setErrorMessage("");
          }}
        />
      )}
      {/* =====================================================
          PAGE
      ===================================================== */}

      <div
        style={{
          minHeight: "100%",
          background: "linear-gradient(180deg, #f8faff 0%, #f4f7fb 100%)",
          padding: "28px 32px 40px",
          boxSizing: "border-box",
        }}
      >
        {/* =====================================================
            PAGE INTRO
        ===================================================== */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
            marginBottom: "24px",
            padding: "22px 24px",
            borderRadius: "18px",
            background: "linear-gradient(135deg, #172554 0%, #2563eb 100%)",
            boxShadow: "0 12px 30px rgba(37, 99, 235, 0.16)",
            color: "#ffffff",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: 0.75,
                marginBottom: "8px",
              }}
            >
              <span>⚙</span>
              Phân quyền hệ thống
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 750,
                letterSpacing: "-0.02em",
              }}
            >
              Vai trò & quyền
            </h2>

            <p
              style={{
                margin: "7px 0 0",
                fontSize: "13px",
                color: "rgba(255,255,255,0.76)",
              }}
            >
              Quản lý vai trò và phân quyền cho từng người dùng.
            </p>
          </div>

          <div
            style={{
              minWidth: "125px",
              padding: "13px 16px",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.16)",
              backdropFilter: "blur(8px)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "23px",
                fontWeight: 750,
              }}
            >
              {pagination.total}
            </div>

            <div
              style={{
                marginTop: "2px",
                fontSize: "11px",
                opacity: 0.72,
              }}
            >
              Người dùng
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "16px",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveSection("permissions")}
            style={{
              minHeight: "40px",
              padding: "0 15px",
              border: "1px solid #bfdbfe",
              borderRadius: "9px",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cấu hình quyền theo vai trò
          </button>
        </div>

        {/* =====================================================
            FILTER
        ===================================================== */}

        <div className="users-filter-card">
          <div className="users-search-wrapper">
            <span className="users-search-icon">⌕</span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Tìm theo họ tên, email, số điện thoại..."
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) => handleRoleFilterChange(event.target.value)}
            className="users-filter-select"
          >
            <option value="">Tất cả vai trò</option>
            {roles.map((role) => (
              <option key={role.vaiTroId} value={role.vaiTroId}>
                {role.tenVaiTro}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => handleStatusFilterChange(event.target.value)}
            className="users-filter-select"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="HoatDong">Hoạt động</option>
            <option value="BiKhoa">Bị khóa</option>
          </select>

          <button
            type="button"
            className="users-search-button"
            onClick={handleSearch}
          >
            Tìm kiếm
          </button>
        </div>

        {/* =====================================================
            MAIN CONTENT
        ===================================================== */}

        <div className="role-content-grid">
          {/* ===================================================
              USER LIST
          =================================================== */}

          <div className="users-table-card role-users-list">
            {/* HEADER */}

            <div className="users-table-header">
              <div>
                <h2>Danh sách người dùng</h2>
                <span>{pagination.total} người dùng</span>
              </div>
            </div>

            {/* TABLE */}

            <div className="users-table-wrapper">
              <table className="users-table role-users-select-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>Số điện thoại</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>

                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={6} className="role-users-table-message">
                        Đang tải danh sách...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="role-users-table-message">
                        Không tìm thấy người dùng.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const selected = selectedUserId === user.nguoiDungId;

                      return (
                        <tr
                          key={user.nguoiDungId}
                          onClick={() => setSelectedUserId(user.nguoiDungId)}
                          className={
                            selected ? "role-users-row-selected" : undefined
                          }
                          aria-selected={selected}
                        >
                          <td className="users-id">{user.nguoiDungId}</td>

                          <td>
                            <div className="users-name">
                              <div className="users-avatar">
                                <AvatarImage
                                  source={user.avatarUrl}
                                  userId={user.nguoiDungId}
                                  fallback={
                                    user.hoTen?.charAt(0)?.toUpperCase() || "U"
                                  }
                                  alt={`Ảnh đại diện của ${user.hoTen}`}
                                />
                              </div>
                              <div>
                                <strong>{user.hoTen}</strong>
                                <small>ID: {user.nguoiDungId}</small>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="users-email">{user.email}</span>
                          </td>

                          <td>
                            {user.soDienThoai || (
                              <span className="users-empty-value">—</span>
                            )}
                          </td>

                          <td>
                            {user.vaiTro ? (
                              <span className="users-role">{user.vaiTro}</span>
                            ) : (
                              <span className="users-empty-value">—</span>
                            )}
                          </td>

                          <td>
                            <span
                              className={`users-status ${
                                user.trangThai === "HoatDong"
                                  ? "users-status-active"
                                  : "users-status-locked"
                              }`}
                            >
                              <span className="status-dot" />
                              {user.trangThai === "HoatDong"
                                ? "Hoạt động"
                                : "Bị khóa"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}

            <div className="users-pagination">
              <div className="users-pagination-info">
                Hiển thị <strong>{users.length}</strong> / {pagination.total}{" "}
                người dùng
              </div>

              <div className="users-pagination-controls">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  ←
                </button>

                <span className="users-current-page">{currentPage}</span>

                <button
                  type="button"
                  disabled={
                    pagination.totalPages === 0 ||
                    currentPage >= pagination.totalPages
                  }
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  →
                </button>

                <span className="users-page-total">
                  {currentPage} / {Math.max(1, pagination.totalPages)}
                </span>
              </div>
            </div>
          </div>

          {/* ===================================================
              USER DETAIL
          =================================================== */}

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e8edf5",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 4px 18px rgba(15,23,42,0.04)",
            }}
          >
            {!selectedUser ? (
              <div
                style={{
                  minHeight: "520px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  textAlign: "center",
                  padding: "30px",
                }}
              >
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#eef4ff",
                    color: "#2563eb",
                    fontSize: "32px",
                    marginBottom: "16px",
                  }}
                >
                  👤
                </div>

                <h3
                  style={{
                    margin: 0,
                    color: "#172033",
                    fontSize: "17px",
                  }}
                >
                  Chưa chọn người dùng
                </h3>

                <p
                  style={{
                    margin: "8px 0 0",
                    maxWidth: "260px",
                    color: "#94a3b8",
                    fontSize: "12px",
                    lineHeight: 1.6,
                  }}
                >
                  Chọn một người dùng trong danh sách để quản lý vai trò và
                  quyền truy cập.
                </p>
              </div>
            ) : (
              <>
                {/* USER HEADER */}

                <div
                  style={{
                    padding: "22px",
                    background:
                      "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
                    borderBottom: "1px solid #edf1f6",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "15px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                        color: "#ffffff",
                        fontSize: "19px",
                        fontWeight: 800,
                        boxShadow: "0 7px 18px rgba(37,99,235,0.2)",
                      }}
                    >
                      {selectedUser.hoTen?.charAt(0)?.toUpperCase() || "U"}
                    </div>

                    <div
                      style={{
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <h2
                          style={{
                            margin: 0,
                            color: "#172033",
                            fontSize: "18px",
                            fontWeight: 750,
                          }}
                        >
                          {selectedUser.hoTen}
                        </h2>

                        {selectedUser.trangThai === "BiKhoa" ? (
                          <span
                            style={{
                              padding: "4px 7px",
                              borderRadius: "999px",
                              background: "#fef2f2",
                              color: "#dc2626",
                              fontSize: "9px",
                              fontWeight: 800,
                            }}
                          >
                            BỊ KHÓA
                          </span>
                        ) : (
                          <span
                            style={{
                              padding: "4px 7px",
                              borderRadius: "999px",
                              background: "#ecfdf5",
                              color: "#16a34a",
                              fontSize: "9px",
                              fontWeight: 800,
                            }}
                          >
                            HOẠT ĐỘNG
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "#64748b",
                          fontSize: "12px",
                        }}
                      >
                        {selectedUser.email}
                      </div>

                      <div
                        style={{
                          marginTop: "3px",
                          color: "#94a3b8",
                          fontSize: "11px",
                        }}
                      >
                        ☎{" "}
                        {selectedUser.soDienThoai ||
                          "Chưa cập nhật số điện thoại"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ROLE CURRENT */}

                <div
                  style={{
                    padding: "21px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: 750,
                          color: "#172033",
                        }}
                      >
                        Vai trò hiện tại
                      </div>

                      <div
                        style={{
                          marginTop: "3px",
                          fontSize: "11px",
                          color: "#94a3b8",
                        }}
                      >
                        Các vai trò đang được gán
                      </div>
                    </div>

                    <span
                      style={{
                        minWidth: "25px",
                        height: "25px",
                        padding: "0 7px",
                        borderRadius: "8px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#eef4ff",
                        color: "#2563eb",
                        fontSize: "11px",
                        fontWeight: 800,
                      }}
                    >
                      {userRoles.length}
                    </span>
                  </div>

                  {loadingUserRoles ? (
                    <div
                      style={{
                        padding: "18px",
                        borderRadius: "11px",
                        background: "#f8fafc",
                        color: "#94a3b8",
                        textAlign: "center",
                        fontSize: "12px",
                      }}
                    >
                      Đang tải vai trò...
                    </div>
                  ) : userRoles.length === 0 ? (
                    <div
                      style={{
                        padding: "17px",
                        borderRadius: "11px",
                        border: "1px dashed #cbd5e1",
                        background: "#f8fafc",
                        color: "#94a3b8",
                        textAlign: "center",
                        fontSize: "12px",
                      }}
                    >
                      Người dùng chưa được gán vai trò.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {userRoles.map((role) => (
                        <div
                          key={role.vaiTroId}
                          style={{
                            padding: "12px",
                            borderRadius: "11px",
                            border: "1px solid #dbeafe",
                            background: "#f5f9ff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "9px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#dbeafe",
                                color: "#2563eb",
                                fontSize: "14px",
                              }}
                            >
                              ◆
                            </div>

                            <div>
                              <div
                                style={{
                                  fontWeight: 700,
                                  color: "#1e40af",
                                  fontSize: "12px",
                                }}
                              >
                                {role.tenVaiTro}
                              </div>

                              {role.moTa && (
                                <div
                                  style={{
                                    marginTop: "3px",
                                    fontSize: "10px",
                                    color: "#64748b",
                                  }}
                                >
                                  {role.moTa}
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveRole(role.vaiTroId)}
                            disabled={actionLoading === role.vaiTroId}
                            style={{
                              padding: "7px 10px",
                              border: "1px solid #fecaca",
                              borderRadius: "8px",
                              background:
                                actionLoading === role.vaiTroId
                                  ? "#f1f5f9"
                                  : "#fff7f7",
                              color: "#dc2626",
                              cursor:
                                actionLoading === role.vaiTroId
                                  ? "not-allowed"
                                  : "pointer",
                              fontWeight: 700,
                              fontSize: "10px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {actionLoading === role.vaiTroId
                              ? "Đang xử lý..."
                              : "Thu hồi"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* =================================================
                      AVAILABLE ROLES
                  ================================================= */}

                  <div
                    style={{
                      marginTop: "26px",
                      paddingTop: "22px",
                      borderTop: "1px solid #edf1f6",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "12px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "15px",
                            fontWeight: 750,
                            color: "#172033",
                          }}
                        >
                          Vai trò có thể gán
                        </div>

                        <div
                          style={{
                            marginTop: "3px",
                            fontSize: "11px",
                            color: "#94a3b8",
                          }}
                        >
                          Thêm quyền cho người dùng
                        </div>
                      </div>
                    </div>

                    {loadingRoles ? (
                      <div
                        style={{
                          padding: "18px",
                          borderRadius: "11px",
                          background: "#f8fafc",
                          color: "#94a3b8",
                          textAlign: "center",
                          fontSize: "12px",
                        }}
                      >
                        Đang tải vai trò...
                      </div>
                    ) : availableRoles.length === 0 ? (
                      <div
                        style={{
                          padding: "17px",
                          borderRadius: "11px",
                          border: "1px dashed #cbd5e1",
                          background: "#f8fafc",
                          color: "#94a3b8",
                          textAlign: "center",
                          fontSize: "12px",
                        }}
                      >
                        Người dùng đã có tất cả vai trò.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          maxHeight: "300px",
                          overflowY: "auto",
                          paddingRight: "2px",
                        }}
                      >
                        {availableRoles.map((role) => (
                          <div
                            key={role.vaiTroId}
                            style={{
                              padding: "11px 12px",
                              border: "1px solid #e8edf5",
                              borderRadius: "10px",
                              background: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontWeight: 700,
                                  color: "#334155",
                                  fontSize: "12px",
                                }}
                              >
                                {role.tenVaiTro}
                              </div>

                              {role.moTa && (
                                <div
                                  style={{
                                    marginTop: "3px",
                                    fontSize: "10px",
                                    color: "#94a3b8",
                                  }}
                                >
                                  {role.moTa}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAssignRole(role.vaiTroId)}
                              disabled={actionLoading === role.vaiTroId}
                              style={{
                                minWidth: "65px",
                                padding: "7px 10px",
                                border: "none",
                                borderRadius: "8px",
                                background:
                                  actionLoading === role.vaiTroId
                                    ? "#cbd5e1"
                                    : "#2563eb",
                                color: "#ffffff",
                                cursor:
                                  actionLoading === role.vaiTroId
                                    ? "not-allowed"
                                    : "pointer",
                                fontWeight: 700,
                                fontSize: "10px",
                              }}
                            >
                              {actionLoading === role.vaiTroId
                                ? "..."
                                : "+ Gán"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default RoleManagement;
