import React, { useEffect, useState } from "react";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import AvatarImage from "../components/AvatarImage";

import "./UsersPage.css";

import UserImportModal from "../components/UserImportModal";

interface User {
  nguoiDungId: number;
  hoTen: string;
  email: string;
  anhDaiDien?: string | null;
  soDienThoai?: string;
  trangThai: string;
  vaiTro?: string;
  vaiTroId?: number;
}

interface UserResponse {
  items?: User[];
  users?: User[];
  data?: User[];
  total?: number;
  page?: number;
  limit?: number;
  total_pages?: number;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // =====================================================
  // MODAL IMPORT EXCEL
  // =====================================================

  const [showImportModal, setShowImportModal] = useState(false);

  // =====================================================
  // TÌM KIẾM / LỌC / PHÂN TRANG
  // =====================================================

  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  // =====================================================
  // TOAST THÔNG BÁO GÓC TRÁI
  // =====================================================

  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // =====================================================
  // THÔNG TIN NGƯỜI DÙNG ĐANG ĐĂNG NHẬP
  // =====================================================

  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const currentUserId = currentUser?.nguoiDungId;

  const permissions: string[] = Array.isArray(currentUser?.quyen)
    ? currentUser.quyen.map((permission: any) => permission.maQuyen)
    : [];

  const isAdmin = Array.isArray(currentUser?.vaiTro)
    ? currentUser.vaiTro.some((role: any) => {
        const roleName =
          typeof role?.tenVaiTro === "string"
            ? role.tenVaiTro.trim().toLowerCase()
            : "";

        return (
          roleName === "admin" ||
          roleName === "quản trị hệ thống" ||
          roleName === "quản trị viên hệ thống" ||
          role?.vaiTroId === 8
        );
      })
    : false;

  const canCreateUser = isAdmin || permissions.includes("USER_CREATE");
  const canUpdateUser = isAdmin || permissions.includes("USER_UPDATE");
  const canLockUser = isAdmin || permissions.includes("USER_LOCK");
  const canUnlockUser = isAdmin || permissions.includes("USER_UNLOCK");
  const canDeleteUser = isAdmin || permissions.includes("USER_DELETE");

  // =====================================================
  // FORM TẠO TÀI KHOẢN
  // =====================================================

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const [createForm, setCreateForm] = useState({
    hoTen: "",
    email: "",
    vaiTroId: "",
  });

  const resetCreateForm = () => {
    setCreateForm({
      hoTen: "",
      email: "",
      vaiTroId: "",
    });
    setCreateError("");
    setCreateError("");
  };

  const openCreateModal = () => {
    resetCreateForm();
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (createLoading) {
      return;
    }

    setShowCreateModal(false);
    resetCreateForm();
  };

  // =====================================================
  // TẢI DANH SÁCH NGƯỜI DÙNG
  // =====================================================

  const loadUsers = async () => {
    try {
      setLoading(true);

      const response = await api.get("/users/", {
        params: {
          search: search || undefined,
          role_id: roleId || undefined,
          status: status || undefined,
          page,
          limit,
        },
      });

      const data: UserResponse = response.data;

      const userList = data.items || data.users || data.data || [];

      setUsers(userList);

      // Backend hiện tại trả:
      //
      // {
      //   data: [...],
      //   pagination: {
      //     total: ...
      //   }
      // }
      //
      // Ưu tiên pagination.total.

      if (typeof data.pagination?.total === "number") {
        setTotal(data.pagination.total);
      } else if (typeof data.total === "number") {
        setTotal(data.total);
      } else {
        setTotal(userList.length);
      }
    } catch (error: any) {
      console.error("Lỗi tải danh sách người dùng:", error);

      setToast({
        type: "error",
        text:
          error?.response?.data?.detail ||
          "Không thể tải danh sách người dùng.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, roleId, status]);

  // =====================================================
  // TẠO TÀI KHOẢN
  // =====================================================

  const handleCreateAccount = async () => {
    const hoTen = createForm.hoTen.trim();
    const email = createForm.email.trim().toLowerCase();
    const vaiTroId = Number(createForm.vaiTroId);

    setCreateError("");
    if (!hoTen) {
      setCreateError("Vui lòng nhập họ tên.");
      return;
    }

    if (!email) {
      setCreateError("Vui lòng nhập email.");
      return;
    }

    // Kiểm tra email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateError("Email không hợp lệ.");
      return;
    }

    if (!vaiTroId) {
      setCreateError("Vui lòng chọn vai trò.");
      return;
    }

    try {
      setCreateLoading(true);

      await api.post("/users/create-account", {
        ho_ten: hoTen,
        email,
        vai_tro_id: vaiTroId,
      });

      setToast({
        type: "success",
        text: "Tạo tài khoản thành công. Thông tin đăng nhập tạm thời đã được gửi tới email.",
      });

      setCreateForm({
        hoTen: "",
        email: "",
        vaiTroId: "",
      });

      await loadUsers();

      window.setTimeout(() => {
        setShowCreateModal(false);
      }, 1800);
    } catch (error: any) {
      console.error("Lỗi tạo tài khoản:", error);

      const responseStatus = error?.response?.status;

      const detail =
        error?.response?.data?.detail ||
        "Không thể tạo tài khoản. Vui lòng thử lại.";

      if (responseStatus === 400 && detail === "Email đã tồn tại") {
        setCreateError("Email đã tồn tại");
      } else if (
        typeof detail === "string" &&
        detail.toLowerCase().includes("email") &&
        detail.toLowerCase().includes("tồn tại")
      ) {
        setCreateError("Email đã tồn tại");
      } else {
        setCreateError(detail);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  // =====================================================
  // TÌM KIẾM
  // =====================================================

  const handleSearch = () => {
    if (page !== 1) {
      setPage(1);
      return;
    }

    loadUsers();
  };

  // =====================================================
  // KHÓA TÀI KHOẢN
  // =====================================================

  const handleLock = async (user: User) => {
    if (user.nguoiDungId === currentUserId) {
      setToast({
        type: "error",
        text: "Bạn không thể tự khóa tài khoản đang đăng nhập.",
      });

      return;
    }

    const reason = window.prompt(`Nhập lý do khóa tài khoản "${user.hoTen}":`);

    if (reason === null) {
      return;
    }

    if (!reason.trim()) {
      setToast({
        type: "error",
        text: "Vui lòng nhập lý do khóa tài khoản.",
      });

      return;
    }

    try {
      await api.put(`/users/${user.nguoiDungId}/lock`, {
        lyDoKhoa: reason.trim(),
      });

      setToast({
        type: "success",
        text: "Khóa tài khoản thành công.",
      });

      await loadUsers();
    } catch (error: any) {
      console.error("Lỗi khóa tài khoản:", error);

      setToast({
        type: "error",
        text: error?.response?.data?.detail || "Không thể khóa tài khoản.",
      });
    }
  };

  // =====================================================
  // MỞ KHÓA TÀI KHOẢN
  // =====================================================

  const handleUnlock = async (user: User) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn mở khóa tài khoản "${user.hoTen}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.put(`/users/${user.nguoiDungId}/unlock`);

      setToast({
        type: "success",
        text: "Mở khóa tài khoản thành công.",
      });

      await loadUsers();
    } catch (error: any) {
      console.error("Lỗi mở khóa tài khoản:", error);

      setToast({
        type: "error",
        text: error?.response?.data?.detail || "Không thể mở khóa tài khoản.",
      });
    }
  };

  // =====================================================
  // XÓA TÀI KHOẢN
  // =====================================================

  const handleDelete = async (user: User) => {
    if (user.nguoiDungId === currentUserId) {
      setToast({
        type: "error",
        text: "Bạn không thể tự xóa tài khoản đang đăng nhập.",
      });

      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa tài khoản "${user.hoTen}"?\n\nEmail: ${user.email}\n\nSau khi xóa, tài khoản này sẽ không còn trong hệ thống.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);

      const response = await api.delete(`/users/${user.nguoiDungId}`);

      // Toast góc trái
      setToast({
        type: "success",
        text: response?.data?.message || "Xóa tài khoản thành công.",
      });

      if (users.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        await loadUsers();
      }
    } catch (error: any) {
      console.error("Lỗi xóa tài khoản:", error);

      setToast({
        type: "error",
        text: error?.response?.data?.detail || "Không thể xóa tài khoản.",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // =====================================================
  // GIAO DIỆN
  // =====================================================

  return (
    <div className="users-page">
      {/* =====================================================
          TOAST THÔNG BÁO GÓC TRÁI
          ===================================================== */}

      {toast && (
        <ToastNotification
          type={toast.type}
          text={toast.text}
          onClose={() => setToast(null)}
        />
      )}

      <section className="dashboard-hero users-page-hero">
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-label">QUẢN LÝ HỆ THỐNG</div>

          <h2>Quản lý người dùng</h2>

          <p>Quản lý tài khoản người dùng trong hệ thống.</p>
        </div>

        <div className="users-header-actions">
          {canCreateUser && (
            <>
              <button
                className="users-import-button"
                onClick={() => setShowImportModal(true)}
              >
                ↑ Import Excel
              </button>

              <button className="users-create-button" onClick={openCreateModal}>
                <span className="button-plus">+</span>
                Tạo tài khoản
              </button>
            </>
          )}
        </div>
      </section>

      {/* =====================================================
          FILTER
          ===================================================== */}

      <div className="users-filter-card">
        <div className="users-search-wrapper">
          <span className="users-search-icon">⌕</span>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            placeholder="Tìm theo họ tên, email, số điện thoại..."
          />
        </div>

        <select
          value={roleId}
          onChange={(e) => {
            setRoleId(e.target.value);
            setPage(1);
          }}
          className="users-filter-select"
        >
          <option value="">Tất cả vai trò</option>

          <option value="1">Guest</option>
          <option value="2">Student</option>
          <option value="3">Instructor</option>
          <option value="4">TA</option>
          <option value="5">Admissions</option>
          <option value="6">Accountant</option>
          <option value="7">Training Manager</option>
          <option value="8">Admin</option>
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="users-filter-select"
        >
          <option value="">Tất cả trạng thái</option>

          <option value="HoatDong">Hoạt động</option>

          <option value="BiKhoa">Bị khóa</option>
        </select>

        <button className="users-search-button" onClick={handleSearch}>
          Tìm kiếm
        </button>
      </div>

      {/* =====================================================
          TABLE CARD
          ===================================================== */}

      <div className="users-table-card">
        <div className="users-table-header">
          <div>
            <h2>Danh sách người dùng</h2>

            <span>{total} người dùng</span>
          </div>
        </div>

        {loading ? (
          <div className="users-loading">
            <div className="users-spinner" />

            <p>Đang tải danh sách người dùng...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="users-empty">
            <div className="users-empty-icon">👤</div>

            <h3>Không tìm thấy người dùng</h3>

            <p>Không có tài khoản nào phù hợp với điều kiện tìm kiếm.</p>
          </div>
        ) : (
          <>
            <div className="users-table-wrapper">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>Số điện thoại</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr key={user.nguoiDungId}>
                      <td className="users-id">{user.nguoiDungId}</td>

                      <td>
                        <div className="users-name">
                          <div className="users-avatar">
                            <AvatarImage
                              source={user.anhDaiDien}
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

                      <td>
                        <div className="users-actions">
                          {/* SỬA */}

                          {canUpdateUser && (
                            <button
                              className="action-edit"
                              onClick={() =>
                                setToast({
                                  type: "success",
                                  text: "Chức năng sửa người dùng sẽ được triển khai tiếp theo.",
                                })
                              }
                            >
                              Sửa
                            </button>
                          )}

                          {/* KHÓA / MỞ KHÓA */}

                          {user.trangThai === "HoatDong"
                            ? canLockUser && (
                                <button
                                  className="action-lock"
                                  onClick={() => handleLock(user)}
                                  disabled={user.nguoiDungId === currentUserId}
                                >
                                  Khóa
                                </button>
                              )
                            : canUnlockUser && (
                                <button
                                  className="action-unlock"
                                  onClick={() => handleUnlock(user)}
                                >
                                  Mở khóa
                                </button>
                              )}

                          {/* XÓA */}

                          {canDeleteUser && (
                            <button
                              className="action-delete"
                              onClick={() => handleDelete(user)}
                              disabled={user.nguoiDungId === currentUserId}
                              title={
                                user.nguoiDungId === currentUserId
                                  ? "Không thể tự xóa tài khoản đang đăng nhập"
                                  : "Xóa tài khoản"
                              }
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* =====================================================
                PAGINATION
                ===================================================== */}

            <div className="users-pagination">
              <div className="users-pagination-info">
                Hiển thị <strong>{users.length}</strong> / {total} người dùng
              </div>

              <div className="users-pagination-controls">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => prev - 1)}
                >
                  ←
                </button>

                <span className="users-current-page">{page}</span>

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  →
                </button>

                <span className="users-page-total">
                  {page} / {totalPages}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* =====================================================
          MODAL TẠO TÀI KHOẢN
          ===================================================== */}

      {showCreateModal && (
        <div
          className="users-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeCreateModal();
            }
          }}
        >
          <div className="users-modal">
            {/* HEADER */}

            <div className="users-modal-header">
              <div>
                <h2>Tạo tài khoản</h2>

                <p>
                  Nhập thông tin người dùng. Mật khẩu tạm thời sẽ được hệ thống
                  tự động tạo và gửi qua email.
                </p>
              </div>

              <button
                type="button"
                className="users-modal-close"
                onClick={closeCreateModal}
                disabled={createLoading}
              >
                ×
              </button>
            </div>

            {/* ERROR */}

            {createError && (
              <div className="users-form-error">{createError}</div>
            )}

            {/* HỌ TÊN */}

            <div className="users-form-group">
              <label>
                Họ tên <span>*</span>
              </label>

              <input
                type="text"
                value={createForm.hoTen}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    hoTen: e.target.value,
                  }))
                }
                placeholder="Nhập họ và tên"
                disabled={createLoading}
                autoFocus
              />
            </div>

            {/* EMAIL */}

            <div className="users-form-group">
              <label>
                Email <span>*</span>
              </label>

              <input
                type="email"
                value={createForm.email}
                onChange={(e) => {
                  setCreateForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }));

                  setCreateError("");
                }}
                placeholder="Nhập email đăng nhập"
                disabled={createLoading}
                className={
                  createError === "Email đã tồn tại" ? "input-error" : ""
                }
              />

              {createError === "Email đã tồn tại" && (
                <div className="users-inline-error">Email đã tồn tại</div>
              )}
            </div>

            {/* VAI TRÒ */}

            <div className="users-form-group">
              <label>
                Vai trò <span>*</span>
              </label>

              <select
                value={createForm.vaiTroId}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    vaiTroId: e.target.value,
                  }))
                }
                disabled={createLoading}
              >
                <option value="">-- Chọn vai trò --</option>

                <option value="1">Guest</option>

                <option value="2">Student</option>

                <option value="3">Instructor</option>

                <option value="4">TA</option>

                <option value="5">Admissions</option>

                <option value="6">Accountant</option>

                <option value="7">Training Manager</option>

                <option value="8">Admin</option>
              </select>
            </div>

            {/* INFO */}

            <div className="users-info-box">
              <strong>Lưu ý:</strong> Không cần nhập mật khẩu. Hệ thống sẽ tự
              động tạo mật khẩu tạm thời và gửi thông tin đăng nhập tới email
              của người dùng.
            </div>

            {/* BUTTON */}

            <div className="users-modal-actions">
              <button
                type="button"
                className="users-cancel-button"
                onClick={closeCreateModal}
                disabled={createLoading}
              >
                Hủy
              </button>

              <button
                type="button"
                className="users-submit-button"
                onClick={handleCreateAccount}
                disabled={createLoading}
              >
                {createLoading ? "Đang tạo..." : "Tạo tài khoản"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          MODAL IMPORT EXCEL
          ===================================================== */}

      {showImportModal && (
        <UserImportModal
          onClose={() => setShowImportModal(false)}
          onImported={async () => {
            // Đóng modal
            setShowImportModal(false);

            // Tải lại danh sách
            await loadUsers();

            // Toast góc trái
            setToast({
              type: "success",
              text: "Import người dùng thành công.",
            });
          }}
        />
      )}
    </div>
  );
};

export default UsersPage;
