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
  // =======================================================
  // DANH SÁCH USER
  // =======================================================

  const [users, setUsers] = useState<User[]>([]);

  // =======================================================
  // DANH SÁCH ROLE
  // =======================================================

  const [roles, setRoles] = useState<Role[]>([]);

  // =======================================================
  // ROLE CỦA USER ĐANG CHỌN
  // =======================================================

  const [userRoles, setUserRoles] = useState<UserRole[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // =======================================================
  // LOADING
  // =======================================================

  const [loadingUsers, setLoadingUsers] = useState(false);

  const [loadingRoles, setLoadingRoles] = useState(false);

  const [loadingUserRoles, setLoadingUserRoles] = useState(false);

  // =======================================================
  // ACTION LOADING
  // =======================================================

  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // =======================================================
  // THÔNG BÁO
  // =======================================================

  const [message, setMessage] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  // =======================================================
  // TÌM KIẾM
  // =======================================================

  const [search, setSearch] = useState("");

  const [searchInput, setSearchInput] = useState("");

  // =======================================================
  // BỘ LỌC VAI TRÒ
  // =======================================================

  const [roleFilter, setRoleFilter] = useState("");

  // =======================================================
  // BỘ LỌC TRẠNG THÁI
  // =======================================================

  const [statusFilter, setStatusFilter] = useState("");

  // =======================================================
  // PHÂN TRANG
  // =======================================================

  const [currentPage, setCurrentPage] = useState(1);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const LIMIT = 20;

  // =========================================================
  // TOAST THÀNH CÔNG
  // =========================================================

  const showSuccess = (text: string) => {
    setMessage(text);
    setErrorMessage("");

    window.setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  // =========================================================
  // TOAST LỖI
  // =========================================================

  const showError = (text: string) => {
    setErrorMessage(text);
    setMessage("");

    window.setTimeout(() => {
      setErrorMessage("");
    }, 4000);
  };

  // =========================================================
  // LẤY DANH SÁCH NGƯỜI DÙNG
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

      // -----------------------------------------------------
      // SEARCH
      // -----------------------------------------------------

      if (currentSearch.trim()) {
        params.search = currentSearch.trim();
      }

      // -----------------------------------------------------
      // ROLE FILTER
      // -----------------------------------------------------

      if (currentRole) {
        params.role_id = Number(currentRole);
      }

      // -----------------------------------------------------
      // STATUS FILTER
      // -----------------------------------------------------

      if (currentStatus) {
        params.status = currentStatus;
      }

      const response = await api.get("/users/", {
        params,
      });

      // =====================================================
      // BACKEND RESPONSE
      //
      // {
      //   data: [...],
      //   pagination: {...}
      // }
      // =====================================================

      const responseData = response.data;

      const userData = Array.isArray(responseData?.data)
        ? responseData.data
        : [];

      setUsers(userData);

      // -----------------------------------------------------
      // PAGINATION
      // -----------------------------------------------------

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

      // -----------------------------------------------------
      // Nếu user đang chọn không còn trong danh sách
      // thì bỏ chọn
      // -----------------------------------------------------

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
  // LẤY DANH SÁCH VAI TRÒ
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
  // LẤY VAI TRÒ CỦA USER
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
  // LOAD BAN ĐẦU
  // =========================================================

  useEffect(() => {
    loadUsers(1, "", "", "");

    loadRoles();
  }, []);

  // =========================================================
  // KHI CHỌN USER
  // =========================================================

  useEffect(() => {
    if (selectedUserId === null) {
      setUserRoles([]);
      return;
    }

    loadUserRoles(selectedUserId);
  }, [selectedUserId]);

  // =========================================================
  // USER ĐANG CHỌN
  // =========================================================

  const selectedUser = users.find(
    (user) => user.nguoiDungId === selectedUserId,
  );

  // =========================================================
  // VAI TRÒ CHƯA ĐƯỢC GÁN
  // =========================================================

  const availableRoles = useMemo(() => {
    const currentRoleIds = new Set(userRoles.map((role) => role.vaiTroId));

    return roles.filter((role) => !currentRoleIds.has(role.vaiTroId));
  }, [roles, userRoles]);

  // =========================================================
  // TÌM KIẾM
  // =========================================================

  const handleSearch = () => {
    const value = searchInput.trim();

    setSearch(value);
    setCurrentPage(1);

    loadUsers(1, value, roleFilter, statusFilter);
  };

  // =========================================================
  // ENTER ĐỂ TÌM KIẾM
  // =========================================================

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  // =========================================================
  // THAY ĐỔI ROLE FILTER
  // =========================================================

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value);
    setCurrentPage(1);

    loadUsers(1, search, value, statusFilter);
  };

  // =========================================================
  // THAY ĐỔI STATUS FILTER
  // =========================================================

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);

    loadUsers(1, search, roleFilter, value);
  };

  // =========================================================
  // XÓA BỘ LỌC
  // =========================================================

  const handleClearFilters = () => {
    setSearch("");
    setSearchInput("");
    setRoleFilter("");
    setStatusFilter("");
    setCurrentPage(1);

    loadUsers(1, "", "", "");
  };

  // =========================================================
  // CHUYỂN TRANG
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
  // GÁN VAI TRÒ
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
  // THU HỒI VAI TRÒ
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
  // HIỂN THỊ SỐ DÒNG
  // =========================================================

  const firstItem = pagination.total === 0 ? 0 : (currentPage - 1) * LIMIT + 1;

  const lastItem = Math.min(currentPage * LIMIT, pagination.total);

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "30px",
        boxSizing: "border-box",
      }}
    >
      {/* ===================================================
          HEADER
      =================================================== */}

      <div
        style={{
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            color: "#8a94a6",
            fontSize: "14px",
            marginBottom: "6px",
          }}
        >
          Quản lý / Vai trò & quyền
        </div>

        <h1
          style={{
            margin: 0,
            color: "#172033",
            fontSize: "28px",
          }}
        >
          Quản lý vai trò người dùng
        </h1>

        <p
          style={{
            marginTop: "8px",
            marginBottom: 0,
            color: "#8a94a6",
          }}
        >
          Quản lý người dùng, tìm kiếm và phân quyền theo vai trò.
        </p>
      </div>

      {/* ===================================================
          BỘ LỌC
      =================================================== */}

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e9f0",
          borderRadius: "14px",
          padding: "20px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(250px, 1fr) 220px 180px auto",
            gap: "12px",
            alignItems: "end",
          }}
        >
          {/* SEARCH */}

          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "7px",
              }}
            >
              Tìm kiếm
            </label>

            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Tên, email hoặc số điện thoại..."
              style={{
                width: "100%",
                height: "42px",
                padding: "0 13px",
                boxSizing: "border-box",
                border: "1px solid #d9dee7",
                borderRadius: "8px",
                outline: "none",
                fontSize: "14px",
                color: "#172033",
              }}
            />
          </div>

          {/* ROLE */}

          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "7px",
              }}
            >
              Vai trò
            </label>

            <select
              value={roleFilter}
              onChange={(event) => handleRoleFilterChange(event.target.value)}
              style={{
                width: "100%",
                height: "42px",
                padding: "0 12px",
                border: "1px solid #d9dee7",
                borderRadius: "8px",
                background: "#ffffff",
                fontSize: "14px",
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
                fontSize: "13px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "7px",
              }}
            >
              Trạng thái
            </label>

            <select
              value={statusFilter}
              onChange={(event) => handleStatusFilterChange(event.target.value)}
              style={{
                width: "100%",
                height: "42px",
                padding: "0 12px",
                border: "1px solid #d9dee7",
                borderRadius: "8px",
                background: "#ffffff",
                fontSize: "14px",
                color: "#172033",
                outline: "none",
              }}
            >
              <option value="">Tất cả trạng thái</option>

              <option value="HoatDong">Hoạt động</option>

              <option value="BiKhoa">Bị khóa</option>
            </select>
          </div>

          {/* BUTTON */}

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
                height: "42px",
                padding: "0 18px",
                border: "none",
                borderRadius: "8px",
                background: "#2563eb",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              🔍 Tìm kiếm
            </button>

            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                height: "42px",
                padding: "0 15px",
                border: "1px solid #d9dee7",
                borderRadius: "8px",
                background: "#ffffff",
                color: "#475569",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Xóa lọc
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================
          TOAST
      =================================================== */}

      {message && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "24px",
            zIndex: 999999,
            padding: "13px 18px",
            borderRadius: "10px",
            background: "#16a34a",
            color: "#ffffff",
            fontWeight: 600,
            boxShadow: "0 8px 25px rgba(0,0,0,0.18)",
          }}
        >
          ✓ {message}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "24px",
            zIndex: 999999,
            padding: "13px 18px",
            borderRadius: "10px",
            background: "#dc2626",
            color: "#ffffff",
            fontWeight: 600,
            boxShadow: "0 8px 25px rgba(0,0,0,0.18)",
          }}
        >
          ⚠ {errorMessage}
        </div>
      )}

      {/* ===================================================
          DANH SÁCH + CHI TIẾT
      =================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(500px, 1.4fr) minmax(350px, 1fr)",
          gap: "20px",
        }}
      >
        {/* =================================================
            DANH SÁCH NGƯỜI DÙNG
        ================================================= */}

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e9f0",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid #edf0f4",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                  color: "#172033",
                }}
              >
                Danh sách người dùng
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "#8a94a6",
                  fontSize: "13px",
                }}
              >
                {pagination.total} người dùng
              </p>
            </div>

            {loadingUsers && (
              <span
                style={{
                  fontSize: "13px",
                  color: "#2563eb",
                }}
              >
                Đang tải...
              </span>
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
                      padding: "12px 15px",
                      textAlign: "left",
                      fontSize: "12px",
                      color: "#64748b",
                    }}
                  >
                    Người dùng
                  </th>

                  <th
                    style={{
                      padding: "12px 15px",
                      textAlign: "left",
                      fontSize: "12px",
                      color: "#64748b",
                    }}
                  >
                    Số điện thoại
                  </th>

                  <th
                    style={{
                      padding: "12px 15px",
                      textAlign: "center",
                      fontSize: "12px",
                      color: "#64748b",
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
                        padding: "50px",
                        textAlign: "center",
                        color: "#8a94a6",
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
                        padding: "50px",
                        textAlign: "center",
                        color: "#8a94a6",
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
                          background: selected ? "#eff6ff" : "#ffffff",
                          borderBottom: "1px solid #edf0f4",
                        }}
                      >
                        <td
                          style={{
                            padding: "13px 15px",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: "#172033",
                            }}
                          >
                            {user.hoTen}
                          </div>

                          <div
                            style={{
                              marginTop: "4px",
                              fontSize: "12px",
                              color: "#8a94a6",
                            }}
                          >
                            {user.email}
                          </div>
                        </td>

                        <td
                          style={{
                            padding: "13px 15px",
                            fontSize: "13px",
                            color: "#475569",
                          }}
                        >
                          {user.soDienThoai || "—"}
                        </td>

                        <td
                          style={{
                            padding: "13px 15px",
                            textAlign: "center",
                          }}
                        >
                          {user.trangThai === "BiKhoa" ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "5px 9px",
                                borderRadius: "999px",
                                background: "#fee2e2",
                                color: "#dc2626",
                                fontSize: "11px",
                                fontWeight: 700,
                              }}
                            >
                              Bị khóa
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "5px 9px",
                                borderRadius: "999px",
                                background: "#dcfce7",
                                color: "#16a34a",
                                fontSize: "11px",
                                fontWeight: 700,
                              }}
                            >
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

          {/* =================================================
              PAGINATION
          ================================================= */}

          <div
            style={{
              padding: "15px 18px",
              borderTop: "1px solid #edf0f4",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Hiển thị <strong>{firstItem}</strong> -{" "}
              <strong>{lastItem}</strong> / <strong>{pagination.total}</strong>
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
                  width: "34px",
                  height: "34px",
                  border: "1px solid #d9dee7",
                  borderRadius: "7px",
                  background: currentPage <= 1 ? "#f1f5f9" : "#ffffff",
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
                          width: "34px",
                          height: "34px",
                          border:
                            page === currentPage
                              ? "1px solid #2563eb"
                              : "1px solid #d9dee7",
                          borderRadius: "7px",
                          background:
                            page === currentPage ? "#2563eb" : "#ffffff",
                          color: page === currentPage ? "#ffffff" : "#475569",
                          cursor: "pointer",
                          fontWeight: 600,
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
                  width: "34px",
                  height: "34px",
                  border: "1px solid #d9dee7",
                  borderRadius: "7px",
                  background:
                    pagination.totalPages === 0 ||
                    currentPage >= pagination.totalPages
                      ? "#f1f5f9"
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

        {/* =================================================
            CHI TIẾT USER + ROLE
        ================================================= */}

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e9f0",
            borderRadius: "14px",
            padding: "24px",
          }}
        >
          {!selectedUser ? (
            <div
              style={{
                minHeight: "500px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                color: "#8a94a6",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "48px",
                  marginBottom: "12px",
                }}
              >
                👤
              </div>

              <h3
                style={{
                  margin: 0,
                  color: "#374151",
                }}
              >
                Chưa chọn người dùng
              </h3>

              <p>Chọn một người dùng trong danh sách để quản lý vai trò.</p>
            </div>
          ) : (
            <>
              {/* ==========================================
                  THÔNG TIN USER
              ========================================== */}

              <div
                style={{
                  paddingBottom: "20px",
                  borderBottom: "1px solid #edf0f4",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        color: "#172033",
                        fontSize: "21px",
                      }}
                    >
                      {selectedUser.hoTen}
                    </h2>

                    <p
                      style={{
                        margin: "6px 0 0",
                        color: "#8a94a6",
                        fontSize: "13px",
                      }}
                    >
                      {selectedUser.email}
                    </p>

                    <p
                      style={{
                        margin: "4px 0 0",
                        color: "#8a94a6",
                        fontSize: "13px",
                      }}
                    >
                      ☎ {selectedUser.soDienThoai || "Chưa cập nhật"}
                    </p>
                  </div>

                  {selectedUser.trangThai === "BiKhoa" ? (
                    <span
                      style={{
                        alignSelf: "flex-start",
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: "#fee2e2",
                        color: "#dc2626",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      Bị khóa
                    </span>
                  ) : (
                    <span
                      style={{
                        alignSelf: "flex-start",
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: "#dcfce7",
                        color: "#16a34a",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      Hoạt động
                    </span>
                  )}
                </div>
              </div>

              {/* ==========================================
                  ROLE HIỆN TẠI
              ========================================== */}

              <div
                style={{
                  marginTop: "25px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: "17px",
                    color: "#172033",
                  }}
                >
                  Vai trò hiện tại
                </h3>

                {loadingUserRoles ? (
                  <p
                    style={{
                      color: "#8a94a6",
                    }}
                  >
                    Đang tải vai trò...
                  </p>
                ) : userRoles.length === 0 ? (
                  <div
                    style={{
                      padding: "15px",
                      background: "#f8fafc",
                      borderRadius: "10px",
                      color: "#8a94a6",
                    }}
                  >
                    Người dùng chưa được gán vai trò.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {userRoles.map((role) => (
                      <div
                        key={role.vaiTroId}
                        style={{
                          padding: "13px",
                          borderRadius: "10px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
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
                              color: "#2563eb",
                            }}
                          >
                            {role.tenVaiTro}
                          </div>

                          {role.moTa && (
                            <div
                              style={{
                                marginTop: "3px",
                                fontSize: "12px",
                                color: "#64748b",
                              }}
                            >
                              {role.moTa}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveRole(role.vaiTroId)}
                          disabled={actionLoading === role.vaiTroId}
                          style={{
                            padding: "8px 11px",
                            border: "none",
                            borderRadius: "7px",
                            background:
                              actionLoading === role.vaiTroId
                                ? "#d1d5db"
                                : "#fee2e2",
                            color: "#dc2626",
                            cursor:
                              actionLoading === role.vaiTroId
                                ? "not-allowed"
                                : "pointer",
                            fontWeight: 600,
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
              </div>

              {/* ==========================================
                  ROLE CÓ THỂ GÁN
              ========================================== */}

              <div
                style={{
                  marginTop: "28px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: "17px",
                    color: "#172033",
                  }}
                >
                  Vai trò có thể gán
                </h3>

                {loadingRoles ? (
                  <p
                    style={{
                      color: "#8a94a6",
                    }}
                  >
                    Đang tải vai trò...
                  </p>
                ) : availableRoles.length === 0 ? (
                  <div
                    style={{
                      padding: "15px",
                      background: "#f8fafc",
                      borderRadius: "10px",
                      color: "#8a94a6",
                    }}
                  >
                    Người dùng đã có tất cả vai trò.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "9px",
                    }}
                  >
                    {availableRoles.map((role) => (
                      <div
                        key={role.vaiTroId}
                        style={{
                          padding: "12px",
                          border: "1px solid #e5e9f0",
                          borderRadius: "9px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "#172033",
                            }}
                          >
                            {role.tenVaiTro}
                          </div>

                          {role.moTa && (
                            <div
                              style={{
                                marginTop: "3px",
                                fontSize: "11px",
                                color: "#8a94a6",
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
                            padding: "8px 12px",
                            border: "none",
                            borderRadius: "7px",
                            background:
                              actionLoading === role.vaiTroId
                                ? "#d1d5db"
                                : "#2563eb",
                            color: "#ffffff",
                            cursor:
                              actionLoading === role.vaiTroId
                                ? "not-allowed"
                                : "pointer",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {actionLoading === role.vaiTroId
                            ? "Đang xử lý..."
                            : "+ Gán"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleManagement;
