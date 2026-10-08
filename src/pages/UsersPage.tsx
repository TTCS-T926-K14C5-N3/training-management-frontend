


import React, { useCallback, useEffect, useState } from "react";


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
  soDienThoai?: string | null;
  trangThai: string;
  vaiTro?: string;
  vaiTroId?: number;
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
        /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label),
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


const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
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

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);


  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const currentUserId = currentUser?.nguoiDungId;

  const permissions: string[] = Array.isArray(currentUser?.quyen)
    ? currentUser.quyen.map((p: any) => p.maQuyen)
    : [];

  const isAdmin = Array.isArray(currentUser?.vaiTro)
    ? currentUser.vaiTro.some((role: any) => {
        const roleName = typeof role?.tenVaiTro === "string" ? role.tenVaiTro.trim().toLowerCase() : "";
        return roleName === "admin" || roleName === "quản trị hệ thống" || roleName === "quản trị viên hệ thống" || role?.vaiTroId === 8;
      })
    : false;

  const canCreateUser = isAdmin || permissions.includes("USER_CREATE");
  const canUpdateUser = isAdmin || permissions.includes("USER_UPDATE");
  const canLockUser = isAdmin || permissions.includes("USER_LOCK");
  const canUnlockUser = isAdmin || permissions.includes("USER_UNLOCK");
  const canDeleteUser = isAdmin || permissions.includes("USER_DELETE");
  const canManageUserRoles =
    isAdmin ||
    (permissions.includes("ROLE_VIEW") &&
      permissions.includes("ROLE_UPDATE"));

  // === CREATE MODAL ===
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");


  const [createForm, setCreateForm] = useState({
    hoTen: "",
    email: "",
    vaiTroId: "",
  });

  const [createSuccess, setCreateSuccess] = useState("");
  const [createForm, setCreateForm] = useState({ hoTen: "", email: "", vaiTroId: "" });


  const [editingUser, setEditingUser] = useState<User | null>(null);
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

    setCreateForm({ hoTen: "", email: "", vaiTroId: "" });

    setCreateError("");
    setCreateError("");
  };

  const openCreateModal = () => { resetCreateForm(); setShowCreateModal(true); };
  const closeCreateModal = () => { if (createLoading) return; setShowCreateModal(false); resetCreateForm(); };

  // === EDIT MODAL ===
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ hoTen: "", email: "", soDienThoai: "" });

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditForm({ hoTen: user.hoTen || "", email: user.email || "", soDienThoai: user.soDienThoai || "" });
    setEditError("");
    setEditSuccess("");
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (editLoading) return;
    setShowEditModal(false);
    setEditingUser(null);
    setEditError("");
    setEditSuccess("");
  };

  // === LOAD USERS ===
  const loadUsers = useCallback(async () => {
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
      console.error("Loi tai danh sach nguoi dung:", error);
      setToast({ type: "error", text: error?.response?.data?.detail || "Khong the tai danh sach nguoi dung." });
    } finally {
      setLoading(false);
    }
  }, [page, search, roleId, status, limit]);


  const openEditModal = async (user: User) => {
    setEditingUser(user);
    setEditForm({
      hoTen: user.hoTen,
      email: user.email,
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
      const roles = Array.isArray(rolesResponse.data)
        ? rolesResponse.data
        : [];
      const roleIds = Array.isArray(userRolesResponse.data)
        ? userRolesResponse.data.map((role) => role.vaiTroId)
        : [];

      setAvailableRoles(roles);
      setCurrentRoleIds(roleIds);
      setSelectedRoleIds(roleIds);
      setEditRolesLoaded(true);
    } catch (error: any) {
      console.error("Lỗi tải vai trò người dùng:", error);
      setEditRoleLoadError(
        error?.response?.data?.detail ||
          "Không thể tải vai trò. Bạn vẫn có thể sửa thông tin người dùng.",
      );
    } finally {
      setEditLoading(false);
    }
  };

  const closeEditModal = () => {
    if (editSaving) {
      return;
    }

    setEditingUser(null);
    setEditError("");
    setEditFieldErrors({});
    setEditRoleLoadError("");
  };

  const handleSaveEdit = async () => {
    if (!editingUser) {
      return;
    }

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
    if (
      soDienThoai &&
      !/^(?:0|\+84)(?:3|5|7|8|9)\d{8}$/.test(soDienThoai)
    ) {
      fieldErrors.soDienThoai =
        "Nhập số di động Việt Nam hợp lệ, ví dụ 0912345678 hoặc +84912345678.";
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
            await api.post(
              `/roles/users/${editingUser.nguoiDungId}/${roleId}`,
            );
          }
          for (const roleId of rolesToRemove) {
            await api.delete(
              `/roles/users/${editingUser.nguoiDungId}/${roleId}`,
            );
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

      setToast({
        type: "success",
        text: "Cập nhật thông tin người dùng thành công.",
      });
      setEditingUser(null);
      await loadUsers();
    } catch (error: any) {
      console.error("Lỗi cập nhật người dùng:", error);
      const detail =
        error?.response?.data?.detail || "Không thể cập nhật người dùng.";
      setEditError(
        profileSaved
          ? `Thông tin cơ bản đã được lưu nhưng cập nhật vai trò chưa hoàn tất: ${detail}`
          : detail,
      );
    } finally {
      setEditSaving(false);
    }
  };

  // =====================================================
  // TẠO TÀI KHOẢN
  // =====================================================

  useEffect(() => { loadUsers(); }, [loadUsers]);


  // === CREATE ACCOUNT ===
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

      await loadUsers();

      window.setTimeout(() => {
        setShowCreateModal(false);
      }, 1800);

    setCreateSuccess("");
    if (!hoTen) { setCreateError("Vui long nhap ho ten."); return; }
    if (!email) { setCreateError("Vui long nhap email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setCreateError("Email khong hop le."); return; }
    if (!vaiTroId) { setCreateError("Vui long chon vai tro."); return; }
    try {
      setCreateLoading(true);
      await api.post("/users/create-account", { ho_ten: hoTen, email, vai_tro_id: vaiTroId });
      setCreateSuccess("Tao tai khoan thanh cong. Thong tin dang nhap tam thoi da duoc gui toi email.");
      setToast({ type: "success", text: "Tao tai khoan thanh cong." });
      setCreateForm({ hoTen: "", email: "", vaiTroId: "" });
      if (search || roleId || status || page !== 1) {
        setSearch("");
        setRoleId("");
        setStatus("");
        setPage(1);
      } else {
        await loadUsers();
      }
      window.setTimeout(() => { setShowCreateModal(false); setCreateSuccess(""); }, 1800);

    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail = error?.response?.data?.detail || "Khong the tao tai khoan. Vui long thu lai.";
      if (responseStatus === 400 && typeof detail === "string" && detail.toLowerCase().includes("email")) {
        setCreateError("Email da ton tai");
      } else {
        setCreateError(detail);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  // === EDIT USER ===
  const handleEditUser = async () => {
    if (!editingUser) return;
    const hoTen = editForm.hoTen.trim();
    const email = editForm.email.trim().toLowerCase();
    const soDienThoai = editForm.soDienThoai.trim();
    setEditError("");
    setEditSuccess("");
    if (!hoTen) { setEditError("Vui long nhap ho ten."); return; }
    if (!email) { setEditError("Vui long nhap email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEditError("Email khong hop le."); return; }
    try {
      setEditLoading(true);
      await api.put(`/users/${editingUser.nguoiDungId}`, { ho_ten: hoTen, email, so_dien_thoai: soDienThoai || null });
      setEditSuccess("Cap nhat thong tin thanh cong.");
      setToast({ type: "success", text: "Cap nhat thong tin nguoi dung thanh cong." });
      await loadUsers();
      window.setTimeout(() => { closeEditModal(); }, 1500);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || "Khong the cap nhat. Vui long thu lai.";
      setEditError(detail);
    } finally {
      setEditLoading(false);
    }
  };

  // === SEARCH ===
  const handleSearch = () => {
    if (page !== 1) { setPage(1); } else { loadUsers(); }
  };

  // === LOCK ===
  const handleLock = async (user: User) => {
    if (user.nguoiDungId === currentUserId) {
      setToast({ type: "error", text: "Ban khong the tu khoa tai khoan dang dang nhap." });
      return;
    }
    const reason = window.prompt(`Nhap ly do khoa tai khoan "${user.hoTen}":`);
    if (reason === null) return;
    if (!reason.trim()) { setToast({ type: "error", text: "Vui long nhap ly do khoa tai khoan." }); return; }
    try {
      await api.put(`/users/${user.nguoiDungId}/lock`, { lyDoKhoa: reason.trim() });
      setToast({ type: "success", text: "Khoa tai khoan thanh cong." });
      await loadUsers();
    } catch (error: any) {
      setToast({ type: "error", text: error?.response?.data?.detail || "Khong the khoa tai khoan." });
    }
  };

  // === UNLOCK ===
  const handleUnlock = async (user: User) => {
    if (!window.confirm(`Ban co chac muon mo khoa tai khoan "${user.hoTen}"?`)) return;
    try {
      await api.put(`/users/${user.nguoiDungId}/unlock`);
      setToast({ type: "success", text: "Mo khoa tai khoan thanh cong." });
      await loadUsers();
    } catch (error: any) {
      setToast({ type: "error", text: error?.response?.data?.detail || "Khong the mo khoa tai khoan." });
    }
  };

  // === DELETE ===
  const handleDelete = async (user: User) => {
    if (user.nguoiDungId === currentUserId) {
      setToast({ type: "error", text: "Ban khong the tu xoa tai khoan dang dang nhap." });
      return;
    }
    if (!window.confirm(`Ban co chac chan muon xoa tai khoan "${user.hoTen}"?\n\nEmail: ${user.email}\n\nSau khi xoa, tai khoan nay se khong con trong he thong.`)) return;
    try {
      setLoading(true);
      const response = await api.delete(`/users/${user.nguoiDungId}`);
      setToast({ type: "success", text: response?.data?.message || "Xoa tai khoan thanh cong." });
      if (users.length === 1 && page > 1) { setPage((prev) => prev - 1); } else { await loadUsers(); }
    } catch (error: any) {
      setToast({ type: "error", text: error?.response?.data?.detail || "Khong the xoa tai khoan." });
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


        <div className={`users-toast ${toast.type === "success" ? "users-toast-success" : "users-toast-error"}`}>
          <div className="users-toast-icon">{toast.type === "success" ? "✓" : "!"}</div>
          <div className="users-toast-content">
            <strong>{toast.type === "success" ? "Thanh cong" : "Loi"}</strong>
            <span>{toast.text}</span>
          </div>
          <button type="button" className="users-toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="users-header">
        <div>
          <div className="users-breadcrumb">Quan ly <span>/</span> Nguoi dung</div>
          <h1>Nguoi dung</h1>
          <p>Quan ly tai khoan nguoi dung trong he thong</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {canCreateUser && (
            <>
              <button className="users-import-button" onClick={() => setShowImportModal(true)}>
                ↑ Import Excel
              </button>

              <button className="users-create-button" onClick={openCreateModal}>
                <span className="button-plus">+</span>Tao tai khoan
              </button>
            </>
          )}
        </div>
      </section>

      <div className="users-filter-card">
        <div className="users-search-wrapper">
          <span className="users-search-icon">⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            placeholder="Tim theo ho ten, email, so dien thoai..."
          />
        </div>
        <select value={roleId} onChange={(e) => { setRoleId(e.target.value); setPage(1); }} className="users-filter-select">
          <option value="">Tat ca vai tro</option>
          {ROLE_OPTIONS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="users-filter-select">
          <option value="">Tat ca trang thai</option>
          <option value="HoatDong">Hoat dong</option>
          <option value="BiKhoa">Bi khoa</option>
        </select>
        <button className="users-search-button" onClick={handleSearch}>Tim kiem</button>
      </div>

      <div className="users-table-card">
        <div className="users-table-header">
          <div>
            <h2>Danh sach nguoi dung</h2>
            <span>{total} nguoi dung</span>
          </div>
        </div>

        {loading ? (
          <div className="users-loading">
            <div className="users-spinner" />
            <p>Dang tai danh sach nguoi dung...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="users-empty">
            <div className="users-empty-icon">👤</div>
            <h3>Khong tim thay nguoi dung</h3>
            <p>Khong co tai khoan nao phu hop voi dieu kien tim kiem.</p>
          </div>
        ) : (
          <>
            <div className="users-table-wrapper">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>ID</th><th>Ho ten</th><th>Email</th><th>So dien thoai</th><th>Vai tro</th><th>Trang thai</th><th>Thao tac</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.nguoiDungId}>
                      <td className="users-id">{user.nguoiDungId}</td>
                      <td>
                        <div className="users-name">
                          <div className="users-avatar">
                            <AvatarImage source={user.anhDaiDien} userId={user.nguoiDungId} fallback={user.hoTen?.charAt(0)?.toUpperCase() || "U"} alt={`Anh dai dien cua ${user.hoTen}`} />
                          </div>
                          <div>
                            <strong>{user.hoTen}</strong>
                            <small>ID: {user.nguoiDungId}</small>
                          </div>
                        </div>
                      </td>
                      <td><span className="users-email">{user.email}</span></td>
                      <td>{user.soDienThoai || <span className="users-empty-value">—</span>}</td>
                      <td>{user.vaiTro ? <span className="users-role">{user.vaiTro}</span> : <span className="users-empty-value">—</span>}</td>
                      <td>
                        <span className={`users-status ${user.trangThai === "HoatDong" ? "users-status-active" : "users-status-locked"}`}>
                          <span className="status-dot" />
                          {user.trangThai === "HoatDong" ? "Hoat dong" : "Bi khoa"}
                        </span>
                      </td>
                      <td>
                        <div className="users-actions">
                          {canUpdateUser && (

                            <button
                              className="action-edit"
                              onClick={() => void openEditModal(user)}
                            >
                              Sửa

                            <button className="action-edit" onClick={() => openEditModal(user)} title="Chinh sua thong tin nguoi dung">
                              Sua

                            </button>
                          )}
                          {user.trangThai === "HoatDong"
                            ? canLockUser && (
                                <button className="action-lock" onClick={() => handleLock(user)} disabled={user.nguoiDungId === currentUserId} title={user.nguoiDungId === currentUserId ? "Khong the tu khoa tai khoan dang dang nhap" : "Khoa tai khoan"}>
                                  Khoa
                                </button>
                              )
                            : canUnlockUser && (
                                <button className="action-unlock" onClick={() => handleUnlock(user)} title="Mo khoa tai khoan">
                                  Mo khoa
                                </button>
                              )}
                          {canDeleteUser && (
                            <button className="action-delete" onClick={() => handleDelete(user)} disabled={user.nguoiDungId === currentUserId} title={user.nguoiDungId === currentUserId ? "Khong the tu xoa tai khoan dang dang nhap" : "Xoa tai khoan"}>
                              Xoa
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
                Hien thi <strong>{users.length}</strong> / {total} nguoi dung
              </div>
              <div className="users-pagination-controls">
                <button disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>←</button>
                <span className="users-current-page">{page}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>→</button>
                <span className="users-page-total">{page} / {totalPages}</span>
              </div>
            </div>
          </>
        )}
      </div>


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
                <p>
                  Cập nhật thông tin và vai trò của {editingUser.hoTen}.
                </p>
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
                                : previous.filter(
                                    (id) => id !== role.vaiTroId,
                                  ),
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
                  Bạn chưa có quyền xem và gán vai trò. Có thể lưu thông tin
                  cá nhân mà không thay đổi vai trò.
                </div>
              )}
            </div>

            <div className="users-modal-actions">
              <button
                type="button"
                className="users-cancel-button"
                onClick={closeEditModal}
                disabled={editSaving}
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

      {/* =====================================================
          MODAL TẠO TÀI KHOẢN
          ===================================================== */}


      {/* MODAL TAO TAI KHOAN */}

      {showCreateModal && (
        <div className="users-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeCreateModal(); }}>
          <div className="users-modal">
            <div className="users-modal-header">
              <div>
                <h2>Tạo tài khoản</h2>
                <p>Nhập thông tin người dùng. Mật khẩu tạm thời sẽ được hệ thống tự động tạo và gửi qua email.</p>
              </div>
              <button type="button" className="users-modal-close" onClick={closeCreateModal} disabled={createLoading}>×</button>
            </div>


            {/* ERROR */}

            {createError && (
              <div className="users-form-error">{createError}</div>
            )}

            {/* HỌ TÊN */}


            {createError && <div className="users-form-error">{createError}</div>}
            {createSuccess && <div className="users-form-success">✓ {createSuccess}</div>}

            <div className="users-form-group">
              <label>Họ tên <span>*</span></label>
              <input type="text" value={createForm.hoTen} onChange={(e) => setCreateForm((prev) => ({ ...prev, hoTen: e.target.value }))} placeholder="Nhập họ và tên" disabled={createLoading} autoFocus />
            </div>
            <div className="users-form-group">
              <label>Email <span>*</span></label>
              <input type="email" value={createForm.email} onChange={(e) => { setCreateForm((prev) => ({ ...prev, email: e.target.value })); setCreateError(""); }} placeholder="Nhập email đăng nhập" disabled={createLoading} className={createError === "Email đã tồn tại" ? "input-error" : ""} />
              {createError === "Email đã tồn tại" && <div className="users-inline-error">Email đã tồn tại</div>}
            </div>
            <div className="users-form-group">
              <label>Vai trò <span>*</span></label>
              <select value={createForm.vaiTroId} onChange={(e) => setCreateForm((prev) => ({ ...prev, vaiTroId: e.target.value }))} disabled={createLoading}>
                <option value="">-- Chọn vai trò --</option>
                {ROLE_OPTIONS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
              </select>
            </div>
            <div className="users-info-box">
              <strong>Lưu ý:</strong> Không cần nhập mật khẩu. Hệ thống sẽ tự động tạo mật khẩu tạm thời và gửi thông tin đăng nhập tới email của người dùng.
            </div>
            <div className="users-modal-actions">
              <button type="button" className="users-cancel-button" onClick={closeCreateModal} disabled={createLoading}>Hủy</button>
              <button type="button" className="users-submit-button" onClick={handleCreateAccount} disabled={createLoading}>
                {createLoading ? "Đang tạo..." : "Tạo tài khoản"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUA NGUOI DUNG */}
      {showEditModal && editingUser && (
        <div className="users-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}>
          <div className="users-modal">
            <div className="users-modal-header">
              <div>
                <h2>Chỉnh sửa người dùng</h2>
                <p>Cập nhật thông tin cho tài khoản <strong>{editingUser.hoTen}</strong></p>
              </div>
              <button type="button" className="users-modal-close" onClick={closeEditModal} disabled={editLoading}>×</button>
            </div>
            {editError && <div className="users-form-error">{editError}</div>}
            {editSuccess && <div className="users-form-success">✓ {editSuccess}</div>}
            <div className="users-form-group">
              <label>Họ tên <span>*</span></label>
              <input type="text" value={editForm.hoTen} onChange={(e) => setEditForm((prev) => ({ ...prev, hoTen: e.target.value }))} placeholder="Nhập họ và tên" disabled={editLoading} autoFocus />
            </div>
            <div className="users-form-group">
              <label>Email <span>*</span></label>
              <input type="email" value={editForm.email} onChange={(e) => { setEditForm((prev) => ({ ...prev, email: e.target.value })); setEditError(""); }} placeholder="Nhập email" disabled={editLoading} />
            </div>
            <div className="users-form-group">
              <label>Số điện thoại</label>
              <input type="text" value={editForm.soDienThoai} onChange={(e) => setEditForm((prev) => ({ ...prev, soDienThoai: e.target.value }))} placeholder="Nhập số điện thoại (tùy chọn)" disabled={editLoading} />
            </div>
            <div className="users-info-box">
              <strong>Lưu ý:</strong> Để thay đổi vai trò, vui lòng sử dụng trang Quản lý vai trò.
            </div>
            <div className="users-modal-actions">
              <button type="button" className="users-cancel-button" onClick={closeEditModal} disabled={editLoading}>Hủy</button>
              <button type="button" className="users-submit-button" onClick={handleEditUser} disabled={editLoading}>
                {editLoading ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IMPORT EXCEL */}
      {showImportModal && (
        <UserImportModal
          onClose={() => setShowImportModal(false)}
          onImported={async (createdRows, failedRows) => {
            setShowImportModal(false);
            setToast({
              type: "success",
              text: failedRows > 0
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
