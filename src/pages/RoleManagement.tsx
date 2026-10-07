import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";

// =========================================================
// INTERFACE
// =========================================================

interface User {
  nguoiDungId: number;
  hoTen: string;
  email: string;
  soDienThoai?: string | null;
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

    loadUsers(1, search, value, statusFilter);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);

    loadUsers(1, search, roleFilter, value);
  };

  const handleClearFilters = () => {
    setSearch("");
    setSearchInput("");
    setRoleFilter("");
    setStatusFilter("");
    setCurrentPage(1);

    loadUsers(1, "", "", "");
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

  // =========================================================
  // PAGINATION DISPLAY
  // =========================================================

  const firstItem = pagination.total === 0 ? 0 : (currentPage - 1) * LIMIT + 1;

  const lastItem = Math.min(currentPage * LIMIT, pagination.total);

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <>
      {/* =====================================================
          TOAST - GÓC DƯỚI BÊN TRÁI
      ===================================================== */}

      <style>
        {`
          @keyframes toastSlideIn {
            from {
              opacity: 0;
              transform: translateX(-25px);
            }

            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
      </style>

      {(message || errorMessage) && (
        <div
          style={{
            position: "fixed",
            left: "18px",
            bottom: "18px",
            zIndex: 999999,
            pointerEvents: "none",
            animation: "toastSlideIn 0.25s ease-out",
          }}
        >
          {message && (
            <div
              style={{
                minWidth: "300px",
                maxWidth: "420px",
                padding: "14px 18px",
                borderRadius: "12px",
                background: "#16a34a",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                lineHeight: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.20)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <span
                style={{
                  width: "25px",
                  height: "25px",
                  minWidth: "25px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "15px",
                  fontWeight: 800,
                }}
              >
                ✓
              </span>

              <span>{message}</span>
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                minWidth: "300px",
                maxWidth: "420px",
                padding: "14px 18px",
                borderRadius: "12px",
                background: "#dc2626",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                lineHeight: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.20)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <span
                style={{
                  width: "25px",
                  height: "25px",
                  minWidth: "25px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "15px",
                  fontWeight: 800,
                }}
              >
                !
              </span>

              <span>{errorMessage}</span>
            </div>
          )}
        </div>
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

        {/* =====================================================
            FILTER
        ===================================================== */}

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e8edf5",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "20px",
            boxShadow: "0 4px 18px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "15px",
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
                Bộ lọc người dùng
              </div>

              <div
                style={{
                  marginTop: "3px",
                  fontSize: "12px",
                  color: "#94a3b8",
                }}
              >
                Tìm kiếm và lọc danh sách theo nhu cầu
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "999px",
                background: "#eff6ff",
                color: "#2563eb",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              ● {pagination.total} tài khoản
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(280px, 1fr) 210px 190px auto",
              gap: "12px",
              alignItems: "end",
            }}
          >
            {/* SEARCH */}

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "7px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#475569",
                }}
              >
                Tìm kiếm
              </label>

              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "13px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    fontSize: "15px",
                  }}
                >
                  ⌕
                </span>

                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Tên, email hoặc số điện thoại..."
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 13px 0 38px",
                    boxSizing: "border-box",
                    border: "1px solid #dce3ed",
                    borderRadius: "10px",
                    outline: "none",
                    fontSize: "13px",
                    color: "#172033",
                    background: "#fbfcfe",
                  }}
                />
              </div>
            </div>

            {/* ROLE */}

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "7px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#475569",
                }}
              >
                Vai trò
              </label>

              <select
                value={roleFilter}
                onChange={(event) => handleRoleFilterChange(event.target.value)}
                style={{
                  width: "100%",
                  height: "44px",
                  padding: "0 12px",
                  border: "1px solid #dce3ed",
                  borderRadius: "10px",
                  background: "#fbfcfe",
                  fontSize: "13px",
                  color: "#172033",
                  outline: "none",
                }}
              >
                <option value="">Tất cả vai trò</option>

                {roles.map((role) => (
                  <option key={role.vaiTroId} value={role.vaiTroId}>
                    {role.tenVaiTro}
                  </option>
                ))}
              </select>
            </div>

            {/* STATUS */}

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "7px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#475569",
                }}
              >
                Trạng thái
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  handleStatusFilterChange(event.target.value)
                }
                style={{
                  width: "100%",
                  height: "44px",
                  padding: "0 12px",
                  border: "1px solid #dce3ed",
                  borderRadius: "10px",
                  background: "#fbfcfe",
                  fontSize: "13px",
                  color: "#172033",
                  outline: "none",
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="HoatDong">Hoạt động</option>
                <option value="BiKhoa">Bị khóa</option>
              </select>
            </div>

            {/* BUTTONS */}

            <div
              style={{
                display: "flex",
                gap: "8px",
              }}
            >
              <button
                type="button"
                onClick={handleSearch}
                style={{
                  height: "44px",
                  padding: "0 17px",
                  border: "none",
                  borderRadius: "10px",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  boxShadow: "0 5px 12px rgba(37,99,235,0.2)",
                  whiteSpace: "nowrap",
                }}
              >
                Tìm kiếm
              </button>

              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  height: "44px",
                  padding: "0 14px",
                  border: "1px solid #dce3ed",
                  borderRadius: "10px",
                  background: "#ffffff",
                  color: "#475569",
                  fontWeight: 650,
                  fontSize: "13px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Xóa lọc
              </button>
            </div>
          </div>
        </div>

        {/* =====================================================
            MAIN CONTENT
        ===================================================== */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(560px, 1.35fr) minmax(390px, 0.9fr)",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {/* ===================================================
              USER LIST
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
            {/* HEADER */}

            <div
              style={{
                padding: "19px 20px",
                borderBottom: "1px solid #edf1f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 750,
                    color: "#172033",
                  }}
                >
                  Danh sách người dùng
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "12px",
                    color: "#94a3b8",
                  }}
                >
                  Chọn người dùng để xem và quản lý vai trò
                </div>
              </div>

              {loadingUsers && (
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: "999px",
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  Đang tải...
                </div>
              )}
            </div>

            {/* TABLE */}

            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                    }}
                  >
                    <th
                      style={{
                        padding: "12px 18px",
                        textAlign: "left",
                        fontSize: "11px",
                        color: "#64748b",
                        fontWeight: 750,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Người dùng
                    </th>

                    <th
                      style={{
                        padding: "12px 12px",
                        textAlign: "left",
                        fontSize: "11px",
                        color: "#64748b",
                        fontWeight: 750,
                        textTransform: "uppercase",
                      }}
                    >
                      Số điện thoại
                    </th>

                    <th
                      style={{
                        padding: "12px 18px",
                        textAlign: "center",
                        fontSize: "11px",
                        color: "#64748b",
                        fontWeight: 750,
                        textTransform: "uppercase",
                      }}
                    >
                      Trạng thái
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          padding: "65px 20px",
                          textAlign: "center",
                          color: "#94a3b8",
                        }}
                      >
                        Đang tải danh sách...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          padding: "65px 20px",
                          textAlign: "center",
                          color: "#94a3b8",
                        }}
                      >
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
                          style={{
                            cursor: "pointer",
                            background: selected ? "#f0f6ff" : "#ffffff",
                            borderBottom: "1px solid #edf1f6",
                            transition: "background 0.15s ease",
                          }}
                        >
                          <td
                            style={{
                              padding: "14px 18px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "11px",
                              }}
                            >
                              <div
                                style={{
                                  width: "38px",
                                  height: "38px",
                                  borderRadius: "11px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: selected ? "#2563eb" : "#eef2ff",
                                  color: selected ? "#ffffff" : "#4f46e5",
                                  fontSize: "14px",
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {user.hoTen?.charAt(0)?.toUpperCase() || "U"}
                              </div>

                              <div>
                                <div
                                  style={{
                                    fontWeight: 700,
                                    color: "#172033",
                                    fontSize: "13px",
                                  }}
                                >
                                  {user.hoTen}
                                </div>

                                <div
                                  style={{
                                    marginTop: "4px",
                                    fontSize: "11px",
                                    color: "#94a3b8",
                                  }}
                                >
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td
                            style={{
                              padding: "14px 12px",
                              fontSize: "12px",
                              color: "#64748b",
                            }}
                          >
                            {user.soDienThoai || "—"}
                          </td>

                          <td
                            style={{
                              padding: "14px 18px",
                              textAlign: "center",
                            }}
                          >
                            {user.trangThai === "BiKhoa" ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "5px 9px",
                                  borderRadius: "999px",
                                  background: "#fef2f2",
                                  color: "#dc2626",
                                  fontSize: "10px",
                                  fontWeight: 800,
                                }}
                              >
                                <span>●</span>
                                Bị khóa
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "5px 9px",
                                  borderRadius: "999px",
                                  background: "#ecfdf5",
                                  color: "#16a34a",
                                  fontSize: "10px",
                                  fontWeight: 800,
                                }}
                              >
                                <span>●</span>
                                Hoạt động
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}

            <div
              style={{
                padding: "14px 18px",
                borderTop: "1px solid #edf1f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                }}
              >
                Hiển thị <strong>{firstItem}</strong> -{" "}
                <strong>{lastItem}</strong> /{" "}
                <strong>{pagination.total}</strong>
              </span>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  style={{
                    width: "32px",
                    height: "32px",
                    border: "1px solid #dce3ed",
                    borderRadius: "8px",
                    background: currentPage <= 1 ? "#f8fafc" : "#ffffff",
                    color: "#475569",
                    cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  ‹
                </button>

                {Array.from(
                  {
                    length: pagination.totalPages,
                  },
                  (_, index) => index + 1,
                )
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === pagination.totalPages ||
                      Math.abs(page - currentPage) <= 1,
                  )
                  .map((page, index, pages) => {
                    const previous = pages[index - 1];

                    const needDots = previous && page - previous > 1;

                    return (
                      <React.Fragment key={page}>
                        {needDots && (
                          <span
                            style={{
                              padding: "0 3px",
                              color: "#94a3b8",
                            }}
                          >
                            ...
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handlePageChange(page)}
                          style={{
                            width: "32px",
                            height: "32px",
                            border:
                              page === currentPage
                                ? "1px solid #2563eb"
                                : "1px solid #dce3ed",
                            borderRadius: "8px",
                            background:
                              page === currentPage ? "#2563eb" : "#ffffff",
                            color: page === currentPage ? "#ffffff" : "#475569",
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: "12px",
                          }}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  type="button"
                  disabled={
                    pagination.totalPages === 0 ||
                    currentPage >= pagination.totalPages
                  }
                  onClick={() => handlePageChange(currentPage + 1)}
                  style={{
                    width: "32px",
                    height: "32px",
                    border: "1px solid #dce3ed",
                    borderRadius: "8px",
                    background:
                      pagination.totalPages === 0 ||
                      currentPage >= pagination.totalPages
                        ? "#f8fafc"
                        : "#ffffff",
                    color: "#475569",
                    cursor:
                      pagination.totalPages === 0 ||
                      currentPage >= pagination.totalPages
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  ›
                </button>
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
