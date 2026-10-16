import React, { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import AvatarImage from "../components/AvatarImage";
import StudentProfileModal from "../components/StudentProfileModal";
import UserImportModal from "../components/UserImportModal";
import "./UsersPage.css";

interface User {
  nguoiDungId: number;
  hoTen: string;
  email: string;
  anhDaiDien?: string | null;
  soDienThoai?: string | null;
  trangThai: string;
  vaiTro?: string;
  vaiTroId?: number;
  vaiTroIds?: number[];
  maHocVien?: string | null;
}

interface Role {
  vaiTroId: number;
  tenVaiTro: string;
  moTa?: string | null;
}

interface UserRole {
  vaiTroId: number;
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

const isValidEmailFormat = (email: string): boolean => {
  if (email.length > 254) {
    return false;
  }
  const parts = email.split("@");
  if (parts.length !== 2) {
    return false;
  }
  const [localPart, domain] = parts;
  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    return false;
  }
  const domainLabels = domain.split(".");
  return (
    /^[^\s@]+$/.test(localPart) &&
    domainLabels.length >= 2 &&
    domainLabels.every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label)
    ) &&
    (domainLabels[domainLabels.length - 1].length >= 2 ||
      domainLabels[domainLabels.length - 1].startsWith("xn--"))
  );
};

const ROLE_OPTIONS = [
  { value: "1", label: "Guest" },
  { value: "2", label: "Student" },
  { value: "3", label: "Instructor" },
  { value: "4", label: "TA" },
  { value: "5", label: "Admissions" },
  { value: "6", label: "Accountant" },
  { value: "7", label: "Training Manager" },
  { value: "8", label: "Admin" },
];

export type StudentProfileSection = "information" | "history";

interface UsersPageProps {
  profileSection?: StudentProfileSection;
}

const UsersPage: React.FC<UsersPageProps> = ({ profileSection }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState(profileSection ? "2" : "");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  // Toast
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Current user & permissions
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const currentUserId = currentUser?.nguoiDungId;

  const permissions: string[] = Array.isArray(currentUser?.quyen)
    ? currentUser.quyen.map((p: any) => p.maQuyen)
    : [];

  const isAdmin = Array.isArray(currentUser?.vaiTro)
    ? currentUser.vaiTro.some((role: any) => {
        const roleName = typeof role?.tenVaiTro === "string" ? role.tenVaiTro.trim().toLowerCase() : "";
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
  const canEditStudentProfile =
    isAdmin || permissions.includes("STUDENT_PROFILE_UPDATE");
  const canViewAcademicProfile =
    isAdmin || permissions.includes("GRADE_VIEW");
  const canLockUser = isAdmin || permissions.includes("USER_LOCK");
  const canUnlockUser = isAdmin || permissions.includes("USER_UNLOCK");
  const canDeleteUser = isAdmin || permissions.includes("USER_DELETE");
  const canManageUserRoles =
    isAdmin ||
    (permissions.includes("ROLE_VIEW") && permissions.includes("ROLE_UPDATE"));

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createForm, setCreateForm] = useState({
    hoTen: "",
    email: "",
    vaiTroId: "",
  });

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [studentProfileUser, setStudentProfileUser] = useState<User | null>(
    null,
  );
  const [editForm, setEditForm] = useState({
    hoTen: "",
    email: "",
    soDienThoai: "",
  });
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [currentRoleIds, setCurrentRoleIds] = useState<number[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editRolesLoaded, setEditRolesLoaded] = useState(false);
  const [editRoleLoadError, setEditRoleLoadError] = useState("");
  const [editError, setEditError] = useState("");
  const [editFieldErrors, setEditFieldErrors] = useState<{
    email?: string;
    soDienThoai?: string;
  }>({});

  const resetCreateForm = () => {
    setCreateForm({
      hoTen: "",
      email: "",
      vaiTroId: "",
    });
    setCreateError("");
    setCreateSuccess("");
  };

  const openCreateModal = () => {
    resetCreateForm();
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (createLoading) return;
    setShowCreateModal(false);
    resetCreateForm();
  };

  const openEditModal = async (user: User) => {
    setEditingUser(user);
    setEditForm({
      hoTen: user.hoTen || "",
      email: user.email || "",
      soDienThoai: user.soDienThoai || "",
    });
    setEditError("");
    setEditFieldErrors({});
    setEditRoleLoadError("");
    setEditRolesLoaded(false);
    setAvailableRoles([]);
    setCurrentRoleIds([]);
    setSelectedRoleIds([]);

    if (!canManageUserRoles) {
      return;
    }

    setEditLoading(true);
    try {
      const [rolesResponse, userRolesResponse] = await Promise.all([
        api.get<Role[]>("/roles/"),
        api.get<UserRole[]>(`/roles/users/${user.nguoiDungId}`),
      ]);
      const roles = Array.isArray(rolesResponse.data) ? rolesResponse.data : [];
      const roleIds = Array.isArray(userRolesResponse.data)
        ? userRolesResponse.data.map((role) => role.vaiTroId)
        : [];

      setAvailableRoles(roles);
      setCurrentRoleIds(roleIds);
      setSelectedRoleIds(roleIds);
      setEditRolesLoaded(true);
    } catch (error: unknown) {
      console.error("Lỗi tải vai trò người dùng:", error);
      setEditRoleLoadError(
        "Không thể tải vai trò. Bạn vẫn có thể sửa thông tin người dùng.",
      );
    } finally {
      setEditLoading(false);
    }
  };

  const closeEditModal = () => {
    if (editSaving) return;
    setEditingUser(null);
    setEditError("");
    setEditFieldErrors({});
    setEditRoleLoadError("");
  };

  // Load Users
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/users/", {
        params: {
          search: search || undefined,
          role_id: profileSection ? "2" : roleId || undefined,
          status: status || undefined,
          page,
          limit,
        },
      });
      const data = response.data as UserResponse | User[];
      if (Array.isArray(data)) {
        setUsers(data);
        setTotal(data.length);
      } else {
        const userList = data.items || data.users || data.data || [];
        setUsers(userList);
        if (typeof data.pagination?.total === "number") {
          setTotal(data.pagination.total);
        } else if (typeof data.total === "number") {
          setTotal(data.total);
        } else {
          setTotal(userList.length);
        }
      }
    } catch (error: any) {
      console.error("Lỗi tải danh sách người dùng:", error);
      setToast({
        type: "error",
        text: error?.response?.data?.detail || "Không thể tải danh sách người dùng.",
      });
    } finally {
      setLoading(false);
    }
  }, [page, profileSection, search, roleId, status, limit]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Create Account
  const handleCreateAccount = async () => {
    const hoTen = createForm.hoTen.trim();
    const email = createForm.email.trim().toLowerCase();
    const vaiTroId = Number(createForm.vaiTroId);
    setCreateError("");
    setCreateSuccess("");

    if (!hoTen) {
      setCreateError("Vui lòng nhập họ tên.");
      return;
    }
    if (!email) {
      setCreateError("Vui lòng nhập email.");
      return;
    }
    if (!isValidEmailFormat(email)) {
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

      setShowCreateModal(false);

      if (search || roleId || status || page !== 1) {
        setSearch("");
        setRoleId("");
        setStatus("");
        setPage(1);
      } else {
        await loadUsers();
      }
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail = error?.response?.data?.detail || "Không thể tạo tài khoản. Vui lòng thử lại.";
      if (responseStatus === 400 && typeof detail === "string" && detail.toLowerCase().includes("email")) {
        setCreateError("Email đã tồn tại");
      } else {
        setCreateError(detail);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  // Save Edit User
  const handleSaveEdit = async () => {
    if (!editingUser) return;
    const hoTen = editForm.hoTen.trim();
    const email = editForm.email.trim().toLowerCase();
    const soDienThoai = editForm.soDienThoai.trim();
    const fieldErrors: { email?: string; soDienThoai?: string } = {};

    if (!hoTen) {
      setEditError("Vui lòng nhập họ tên.");
      return;
    }
    if (!isValidEmailFormat(email)) {
      fieldErrors.email = "Email không đúng định dạng.";
    }
    if (soDienThoai && !/^(?:0|\+84)(?:3|5|7|8|9)\d{8}$/.test(soDienThoai)) {
      fieldErrors.soDienThoai = "Nhập số di động Việt Nam hợp lệ, ví dụ 0912345678 hoặc +84912345678.";
    }
    setEditFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setEditError("");
      return;
    }

    setEditError("");
    setEditSaving(true);
    let profileSaved = false;

    try {
      await api.put(`/users/${editingUser.nguoiDungId}`, {
        ho_ten: hoTen,
        email,
        so_dien_thoai: soDienThoai || null,
      });
      profileSaved = true;

      if (canManageUserRoles && editRolesLoaded) {
        const rolesToAssign = selectedRoleIds.filter(
          (id) => !currentRoleIds.includes(id),
        );
        const rolesToRemove = currentRoleIds.filter(
          (id) => !selectedRoleIds.includes(id),
        );

        try {
          for (const roleId of rolesToAssign) {
            await api.post(`/roles/users/${editingUser.nguoiDungId}/${roleId}`);
          }
          for (const roleId of rolesToRemove) {
            await api.delete(`/roles/users/${editingUser.nguoiDungId}/${roleId}`);
          }
        } catch (roleError) {
          try {
            const response = await api.get<UserRole[]>(
              `/roles/users/${editingUser.nguoiDungId}`,
            );
            const roleIds = Array.isArray(response.data)
              ? response.data.map((role) => role.vaiTroId)
              : [];
            setCurrentRoleIds(roleIds);
            setSelectedRoleIds(roleIds);
          } catch (reloadError) {
            console.error("Lỗi tải lại vai trò người dùng:", reloadError);
          }
          throw roleError;
        }
      }

      setToast({ type: "success", text: "Cập nhật thông tin người dùng thành công." });
      setEditingUser(null);
      await loadUsers();
    } catch (error: any) {
      console.error("Lỗi cập nhật người dùng:", error);
      const detail = error?.response?.data?.detail || "Không thể cập nhật người dùng.";
      setEditError(
        profileSaved
          ? `Thông tin cơ bản đã được lưu nhưng cập nhật vai trò chưa hoàn tất: ${detail}`
          : detail
      );
    } finally {
      setEditSaving(false);
    }
  };

  // Search
  const handleSearch = () => {
    if (page !== 1) {
      setPage(1);
    } else {
      loadUsers();
    }
  };

  // Lock User
  const handleLock = async (user: User) => {
    if (user.nguoiDungId === currentUserId) {
      setToast({ type: "error", text: "Bạn không thể tự khóa tài khoản đang đăng nhập." });
      return;
    }
    const reason = window.prompt(`Nhập lý do khóa tài khoản "${user.hoTen}":`);
    if (reason === null) return;
    if (!reason.trim()) {
      setToast({ type: "error", text: "Vui lòng nhập lý do khóa tài khoản." });
      return;
    }
    try {
      await api.put(`/users/${user.nguoiDungId}/lock`, { lyDoKhoa: reason.trim() });
      setToast({ type: "success", text: "Khóa tài khoản thành công." });
      await loadUsers();
    } catch (error: any) {
      setToast({ type: "error", text: error?.response?.data?.detail || "Không thể khóa tài khoản." });
    }
  };

  // Unlock User
  const handleUnlock = async (user: User) => {
    if (!window.confirm(`Bạn có chắc muốn mở khóa tài khoản "${user.hoTen}"?`)) return;
    try {
      await api.put(`/users/${user.nguoiDungId}/unlock`);
      setToast({ type: "success", text: "Mở khóa tài khoản thành công." });
      await loadUsers();
    } catch (error: any) {
      setToast({ type: "error", text: error?.response?.data?.detail || "Không thể mở khóa tài khoản." });
    }
  };

  // Delete User
  const handleDelete = async (user: User) => {
    if (user.nguoiDungId === currentUserId) {
      setToast({ type: "error", text: "Bạn không thể tự xóa tài khoản đang đăng nhập." });
      return;
    }
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa tài khoản "${user.hoTen}"?\n\nEmail: ${user.email}\n\nSau khi xóa, tài khoản này sẽ không còn trong hệ thống.`
      )
    )
      return;
    try {
      setLoading(true);
      const response = await api.delete(`/users/${user.nguoiDungId}`);
      setToast({ type: "success", text: response?.data?.message || "Xóa tài khoản thành công." });
      if (users.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        await loadUsers();
      }
    } catch (error: any) {
      setToast({ type: "error", text: error?.response?.data?.detail || "Không thể xóa tài khoản." });
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="users-page">
      {toast && (
        <ToastNotification
          type={toast.type}
          text={toast.text}
          onClose={() => setToast(null)}
        />
      )}

      <section className="dashboard-hero users-page-hero">
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-label">
            {profileSection ? "HỒ SƠ HỌC VIÊN" : "QUẢN LÝ HỆ THỐNG"}
          </div>
          <h2>
            {profileSection === "information"
              ? "Thông tin học viên"
              : profileSection === "history"
                ? "Lịch sử lớp học"
                : "Quản lý người dùng"}
          </h2>
          <p>
            {profileSection === "information"
              ? "Tra cứu thông tin cá nhân, liên hệ và trình độ đầu vào của học viên."
              : profileSection === "history"
                ? "Theo dõi lớp đang học, lịch sử lớp và bảng điểm của học viên."
                : "Tra cứu học viên theo mã, ID, họ tên hoặc số điện thoại; mở hồ sơ để xem quá trình học và bảng điểm."}
          </p>
        </div>

        <div className="users-header-actions">
          {!profileSection && canCreateUser && (
            <>
              <button
                type="button"
                className="users-import-button"
                onClick={() => setShowImportModal(true)}
              >
                ↑ Import Excel
              </button>

              <button
                type="button"
                className="users-create-button"
                onClick={openCreateModal}
              >
                <span className="button-plus">+</span>Tạo tài khoản
              </button>
            </>
          )}
        </div>
      </section>

      <div
        className={`users-filter-card ${
          profileSection ? "users-filter-student-profile" : ""
        }`}
      >
        <div className="users-search-wrapper">
          <span className="users-search-icon">⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Tìm mã học viên, ID, họ tên, email hoặc số điện thoại..."
          />
        </div>
        {!profileSection && (
          <select
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value);
              setPage(1);
            }}
            className="users-filter-select"
          >
            <option value="">Tất cả vai trò</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        )}
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

      <div className="users-table-card">
        <div className="users-table-header">
          <div>
            <h2>{profileSection || roleId === "2" ? "Danh sách học viên" : "Danh sách người dùng"}</h2>
            <span>
              {total} {profileSection || roleId === "2" ? "học viên" : "người dùng"}
            </span>
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
                    <th>Mã / ID</th>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>Số điện thoại</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>{profileSection ? "Xem chi tiết" : "Thao tác"}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.nguoiDungId}>
                      <td className="users-id">
                        {user.maHocVien || user.nguoiDungId}
                      </td>
                      <td>
                        <div className="users-name">
                          <div className="users-avatar">
                            <AvatarImage
                              source={user.anhDaiDien}
                              userId={user.nguoiDungId}
                              fallback={user.hoTen?.charAt(0)?.toUpperCase() || "U"}
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
                          {canViewAcademicProfile &&
                            (user.vaiTroIds?.includes(2) ||
                              user.vaiTroId === 2) && (
                              <button
                                className="action-profile"
                                onClick={() => setStudentProfileUser(user)}
                                title={
                                  profileSection === "information"
                                    ? "Xem thông tin học viên"
                                    : profileSection === "history"
                                      ? "Xem lịch sử lớp học"
                                      : "Mở hồ sơ học tập của học viên"
                                }
                              >
                                {profileSection === "information"
                                  ? "Thông tin"
                                  : profileSection === "history"
                                    ? "Lịch sử lớp"
                                    : "Hồ sơ học tập"}
                              </button>
                            )}
                          {!profileSection && canUpdateUser && (
                            <button
                              className="action-edit"
                              onClick={() => void openEditModal(user)}
                              title="Chỉnh sửa thông tin người dùng"
                            >
                              Sửa
                            </button>
                          )}
                          {!profileSection && (user.trangThai === "HoatDong"
                            ? canLockUser && (
                                <button
                                  className="action-lock"
                                  onClick={() => handleLock(user)}
                                  disabled={user.nguoiDungId === currentUserId}
                                  title={
                                    user.nguoiDungId === currentUserId
                                      ? "Không thể tự khóa tài khoản đang đăng nhập"
                                      : "Khóa tài khoản"
                                  }
                                >
                                  Khóa
                                </button>
                              )
                            : canUnlockUser && (
                                <button
                                  className="action-unlock"
                                  onClick={() => handleUnlock(user)}
                                  title="Mở khóa tài khoản"
                                >
                                  Mở khóa
                                </button>
                              ))}
                          {!profileSection && canDeleteUser && (
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

      {studentProfileUser && (
        <StudentProfileModal
          student={studentProfileUser}
          canEdit={
            profileSection !== "history" && canEditStudentProfile
          }
          section={profileSection}
          onClose={() => setStudentProfileUser(null)}
          onSaved={() => void loadUsers()}
        />
      )}

      {/* MODAL EDIT USER */}
      {editingUser && (
        <div
          className="users-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditModal();
            }
          }}
        >
          <div
            className="users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-title"
          >
            <div className="users-modal-header">
              <div>
                <h2 id="edit-user-title">Sửa thông tin người dùng</h2>
                <p>Cập nhật thông tin và vai trò của {editingUser.hoTen}.</p>
              </div>
              <button
                type="button"
                className="users-modal-close"
                onClick={closeEditModal}
                disabled={editSaving}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            {editError && (
              <div className="users-form-error" role="alert">
                {editError}
              </div>
            )}

            <div className="users-form-group">
              <label htmlFor="edit-user-name">
                Họ tên <span>*</span>
              </label>
              <input
                id="edit-user-name"
                type="text"
                value={editForm.hoTen}
                onChange={(event) =>
                  setEditForm((previous) => ({
                    ...previous,
                    hoTen: event.target.value,
                  }))
                }
                disabled={editSaving}
                autoFocus
              />
            </div>

            <div className="users-form-group">
              <label htmlFor="edit-user-email">
                Email <span>*</span>
              </label>
              <input
                id="edit-user-email"
                type="email"
                value={editForm.email}
                onChange={(event) => {
                  setEditForm((previous) => ({
                    ...previous,
                    email: event.target.value,
                  }));
                  setEditFieldErrors((previous) => ({
                    ...previous,
                    email: undefined,
                  }));
                }}
                disabled={editSaving}
                maxLength={254}
                aria-invalid={Boolean(editFieldErrors.email)}
                aria-describedby={
                  editFieldErrors.email ? "edit-user-email-error" : undefined
                }
                className={editFieldErrors.email ? "input-error" : undefined}
              />
              {editFieldErrors.email && (
                <div
                  id="edit-user-email-error"
                  className="users-inline-error"
                  role="alert"
                >
                  {editFieldErrors.email}
                </div>
              )}
            </div>

            <div className="users-form-group">
              <label htmlFor="edit-user-phone">Số điện thoại</label>
              <input
                id="edit-user-phone"
                type="tel"
                inputMode="tel"
                value={editForm.soDienThoai}
                onChange={(event) => {
                  setEditForm((previous) => ({
                    ...previous,
                    soDienThoai: event.target.value,
                  }));
                  setEditFieldErrors((previous) => ({
                    ...previous,
                    soDienThoai: undefined,
                  }));
                }}
                disabled={editSaving}
                maxLength={13}
                placeholder="0912345678 hoặc +84912345678"
                aria-invalid={Boolean(editFieldErrors.soDienThoai)}
                aria-describedby={
                  editFieldErrors.soDienThoai
                    ? "edit-user-phone-error"
                    : undefined
                }
                className={
                  editFieldErrors.soDienThoai ? "input-error" : undefined
                }
              />
              {editFieldErrors.soDienThoai && (
                <div
                  id="edit-user-phone-error"
                  className="users-inline-error"
                  role="alert"
                >
                  {editFieldErrors.soDienThoai}
                </div>
              )}
            </div>

            <div className="users-edit-roles">
              <div className="users-edit-roles-heading">
                <strong>Vai trò</strong>
                {editLoading && <span>Đang tải vai trò...</span>}
              </div>
              {canManageUserRoles ? (
                editRoleLoadError ? (
                  <div className="users-edit-roles-error" role="alert">
                    {editRoleLoadError}
                  </div>
                ) : (
                  <div className="users-edit-roles-list">
                    {availableRoles.map((role) => (
                      <label
                        className="users-edit-role-option"
                        key={role.vaiTroId}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRoleIds.includes(role.vaiTroId)}
                          onChange={(event) => {
                            setSelectedRoleIds((previous) =>
                              event.target.checked
                                ? [...previous, role.vaiTroId]
                                : previous.filter((id) => id !== role.vaiTroId),
                            );
                          }}
                          disabled={
                            editSaving || editLoading || !editRolesLoaded
                          }
                        />
                        <span>
                          <strong>{role.tenVaiTro}</strong>
                          {role.moTa && <small>{role.moTa}</small>}
                        </span>
                      </label>
                    ))}
                  </div>
                )
              ) : (
                <div className="users-edit-roles-error">
                  Bạn chưa có quyền xem và gán vai trò. Có thể lưu thông tin cá
                  nhân mà không thay đổi vai trò.
                </div>
              )}
            </div>

            <div className="users-modal-actions">
              <button
                type="button"
                className="users-cancel-button"
                onClick={closeEditModal}
                disabled={editSaving || editLoading}
              >
                Hủy
              </button>
              <button
                type="button"
                className="users-submit-button"
                onClick={handleSaveEdit}
                disabled={editSaving || editLoading}
              >
                {editSaving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREATE USER */}
      {showCreateModal && (
        <div
          className="users-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCreateModal();
          }}
        >
          <div className="users-modal">
            <div className="users-modal-header">
              <div>
                <h2>Tạo tài khoản</h2>
                <p>
                  Nhập thông tin người dùng. Mật khẩu tạm thời sẽ được hệ
                  thống tự động tạo và gửi qua email.
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

            {createError && <div className="users-form-error">{createError}</div>}
            {createSuccess && (
              <div className="users-form-success">✓ {createSuccess}</div>
            )}

            <div className="users-form-group">
              <label>
                Họ tên <span>*</span>
              </label>
              <input
                type="text"
                value={createForm.hoTen}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, hoTen: e.target.value }))
                }
                placeholder="Nhập họ và tên"
                disabled={createLoading}
                autoFocus
              />
            </div>
            <div className="users-form-group">
              <label>
                Email <span>*</span>
              </label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => {
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }));
                  setCreateError("");
                }}
                placeholder="Nhập email đăng nhập"
                disabled={createLoading}
                className={createError === "Email đã tồn tại" ? "input-error" : ""}
              />
              {createError === "Email đã tồn tại" && (
                <div className="users-inline-error">Email đã tồn tại</div>
              )}
            </div>
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
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="users-info-box">
              <strong>Lưu ý:</strong> Không cần nhập mật khẩu. Hệ thống sẽ tự
              động tạo mật khẩu tạm thời và gửi thông tin đăng nhập tới email
              của người dùng.
            </div>
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

      {/* MODAL IMPORT EXCEL */}
      {showImportModal && (
        <UserImportModal
          onClose={() => setShowImportModal(false)}
          onViewInvalidData={(rows, title) => {
            setShowImportModal(false);
            window.history.pushState(
              { userImportInvalidData: { rows, title } },
              "",
              "/du-lieu-import-khong-hop-le",
            );
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          onImported={async (createdRows, failedRows) => {
            setShowImportModal(false);
            setToast({
              type: "success",
              text:
                failedRows > 0
                  ? `Đã import ${createdRows} tài khoản; ${failedRows} dòng bị lỗi.`
                  : `Đã import thành công ${createdRows} tài khoản.`,
            });
            if (search || roleId || status || page !== 1) {
              setSearch("");
              setRoleId("");
              setStatus("");
              setPage(1);
            } else {
              await loadUsers();
            }
          }}
        />
      )}
    </div>
  );
};

export default UsersPage;
