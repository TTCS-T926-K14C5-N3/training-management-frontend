import React, { useEffect, useState } from "react";
import api from "../services/api";

interface User {
  nguoiDungId: number;
  hoTen: string;
  email: string;
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
}

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [total, setTotal] = useState(0);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const currentUserId = Number(currentUser?.nguoiDungId);

  // =========================================================
  // TẢI DANH SÁCH NGƯỜI DÙNG
  // =========================================================

  const loadUsers = async () => {
    try {
      setLoading(true);
      setMessage(null);

      const response = await api.get("/users/", {
        params: {
          search: search.trim() || undefined,
          role_id: roleId || undefined,
          status: status || undefined,
          page,
          limit,
        },
      });

      const data: UserResponse = response.data;

      const userList = data.items || data.users || data.data || [];

      setUsers(userList);

      setTotal(
        typeof data.total === "number" ? data.total : userList.length,
      );
    } catch (error: any) {
      console.error("Lỗi tải danh sách người dùng:", error);

      setMessage({
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

  // =========================================================
  // TÌM KIẾM
  // =========================================================

  const handleSearch = () => {
    if (page !== 1) {
      setPage(1);
      return;
    }

    loadUsers();
  };

  // =========================================================
  // KHÓA NGƯỜI DÙNG
  // PUT /users/{nguoi_dung_id}/lock
  // Body: { ly_do_khoa }
  // =========================================================

  const handleLock = async (user: User) => {
    if (user.nguoiDungId === currentUserId) {
      setMessage({
        type: "error",
        text: "Bạn không thể tự khóa tài khoản đang đăng nhập.",
      });
      return;
    }

    const reason = window.prompt(
      `Nhập lý do khóa tài khoản "${user.hoTen}":`,
    );

    // Người dùng nhấn Cancel
    if (reason === null) {
      return;
    }

    // Không cho phép lý do rỗng
    if (!reason.trim()) {
      setMessage({
        type: "error",
        text: "Vui lòng nhập lý do khóa tài khoản.",
      });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      await api.put(`/users/${user.nguoiDungId}/lock`, {
        ly_do_khoa: reason.trim(),
      });

      setMessage({
        type: "success",
        text: `Đã khóa tài khoản "${user.hoTen}" thành công.`,
      });

      // Cập nhật lại danh sách sau khi khóa thành công
      await loadUsers();
    } catch (error: any) {
      console.error("Lỗi khóa tài khoản:", error);

      setMessage({
        type: "error",
        text:
          error?.response?.data?.detail ||
          "Không thể khóa tài khoản.",
      });
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // MỞ KHÓA NGƯỜI DÙNG
  // PUT /users/{nguoi_dung_id}/unlock
  // =========================================================

  const handleUnlock = async (user: User) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn mở khóa tài khoản "${user.hoTen}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      await api.put(`/users/${user.nguoiDungId}/unlock`);

      setMessage({
        type: "success",
        text: `Đã mở khóa tài khoản "${user.hoTen}" thành công.`,
      });

      // Cập nhật lại danh sách sau khi mở khóa thành công
      await loadUsers();
    } catch (error: any) {
      console.error("Lỗi mở khóa tài khoản:", error);

      setMessage({
        type: "error",
        text:
          error?.response?.data?.detail ||
          "Không thể mở khóa tài khoản.",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // =========================================================
  // GIAO DIỆN
  // =========================================================

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Người dùng</h1>

          <p style={styles.subtitle}>
            Quản lý tài khoản người dùng trong hệ thống
          </p>
        </div>

        <button
          style={styles.primaryButton}
          onClick={() =>
            setMessage({
              type: "success",
              text: "Chức năng thêm người dùng sẽ được triển khai tiếp theo.",
            })
          }
        >
          + Thêm người dùng
        </button>
      </div>

      {/* MESSAGE */}
      {message && (
        <div
          style={{
            ...styles.message,
            ...(message.type === "success"
              ? styles.success
              : styles.error),
          }}
        >
          {message.text}
        </div>
      )}

      {/* BỘ LỌC */}
      <div style={styles.filterBox}>
        <div style={styles.searchGroup}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            placeholder="Tìm theo họ tên, email, số điện thoại..."
            style={styles.input}
          />

          <button
            style={styles.searchButton}
            onClick={handleSearch}
          >
            Tìm kiếm
          </button>
        </div>

        <select
          value={roleId}
          onChange={(e) => {
            setRoleId(e.target.value);
            setPage(1);
          }}
          style={styles.select}
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
          style={styles.select}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="HoatDong">Hoạt động</option>
          <option value="BiKhoa">Bị khóa</option>
        </select>
      </div>

      {/* BẢNG NGƯỜI DÙNG */}
      <div style={styles.tableContainer}>
        {loading ? (
          <div style={styles.loading}>
            Đang tải danh sách người dùng...
          </div>
        ) : users.length === 0 ? (
          <div style={styles.empty}>
            Không tìm thấy người dùng.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Họ tên</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Số điện thoại</th>
                <th style={styles.th}>Vai trò</th>
                <th style={styles.th}>Trạng thái</th>
                <th style={styles.th}>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.nguoiDungId}>
                  <td style={styles.td}>
                    {user.nguoiDungId}
                  </td>

                  <td style={styles.td}>
                    <strong>{user.hoTen}</strong>
                  </td>

                  <td style={styles.td}>
                    {user.email}
                  </td>

                  <td style={styles.td}>
                    {user.soDienThoai || "—"}
                  </td>

                  <td style={styles.td}>
                    {user.vaiTro || "—"}
                  </td>

                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.status,
                        ...(user.trangThai === "HoatDong"
                          ? styles.active
                          : styles.locked),
                      }}
                    >
                      {user.trangThai === "HoatDong"
                        ? "Hoạt động"
                        : "Bị khóa"}
                    </span>
                  </td>

                  <td style={styles.td}>
                    <div style={styles.actions}>
                      {/* SỬA */}
                      <button
                        style={styles.editButton}
                        onClick={() =>
                          setMessage({
                            type: "success",
                            text: "Chức năng sửa người dùng sẽ được triển khai tiếp theo.",
                          })
                        }
                      >
                        Sửa
                      </button>

                      {/* KHÓA / MỞ KHÓA */}
                      {user.trangThai === "HoatDong" ? (
                        <button
                          style={{
                            ...styles.lockButton,
                            ...(user.nguoiDungId === currentUserId
                              ? styles.disabledButton
                              : {}),
                          }}
                          onClick={() => handleLock(user)}
                          disabled={
                            user.nguoiDungId === currentUserId ||
                            loading
                          }
                          title={
                            user.nguoiDungId === currentUserId
                              ? "Không thể tự khóa tài khoản"
                              : "Khóa tài khoản"
                          }
                        >
                          Khóa
                        </button>
                      ) : (
                        <button
                          style={styles.unlockButton}
                          onClick={() => handleUnlock(user)}
                          disabled={loading}
                        >
                          Mở khóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PHÂN TRANG */}
      <div style={styles.pagination}>
        <button
          style={styles.pageButton}
          disabled={page <= 1 || loading}
          onClick={() =>
            setPage((prev) => prev - 1)
          }
        >
          ← Trước
        </button>

        <span style={styles.pageText}>
          Trang {page} / {totalPages}
        </span>

        <button
          style={styles.pageButton}
          disabled={page >= totalPages || loading}
          onClick={() =>
            setPage((prev) => prev + 1)
          }
        >
          Sau →
        </button>
      </div>
    </div>
  );
};

// =========================================================
// STYLES
// =========================================================

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "30px",
    minHeight: "100%",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },

  title: {
    margin: 0,
    fontSize: "30px",
    fontWeight: 700,
  },

  subtitle: {
    marginTop: "8px",
    color: "#64748b",
  },

  primaryButton: {
    border: "none",
    borderRadius: "10px",
    padding: "12px 18px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },

  message: {
    padding: "13px 16px",
    borderRadius: "10px",
    marginBottom: "20px",
  },

  success: {
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
  },

  error: {
    background: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fecaca",
  },

  filterBox: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    background: "#fff",
    padding: "18px",
    borderRadius: "14px",
    marginBottom: "20px",
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.06)",
  },

  searchGroup: {
    display: "flex",
    gap: "8px",
    flex: 1,
    minWidth: "320px",
  },

  input: {
    flex: 1,
    padding: "11px 13px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    outline: "none",
    fontSize: "14px",
  },

  searchButton: {
    border: "none",
    borderRadius: "8px",
    padding: "0 18px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },

  select: {
    padding: "11px 13px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#fff",
    minWidth: "170px",
  },

  tableContainer: {
    background: "#fff",
    borderRadius: "14px",
    overflowX: "auto",
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.06)",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1000px",
  },

  th: {
    textAlign: "left",
    padding: "15px",
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    color: "#475569",
    fontSize: "14px",
  },

  td: {
    padding: "15px",
    borderBottom: "1px solid #eef2f7",
    color: "#334155",
    fontSize: "14px",
  },

  status: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
  },

  active: {
    background: "#dcfce7",
    color: "#15803d",
  },

  locked: {
    background: "#fee2e2",
    color: "#dc2626",
  },

  actions: {
    display: "flex",
    gap: "8px",
  },

  editButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    borderRadius: "7px",
    padding: "7px 12px",
    cursor: "pointer",
  },

  lockButton: {
    border: "none",
    background: "#fee2e2",
    color: "#dc2626",
    borderRadius: "7px",
    padding: "7px 12px",
    cursor: "pointer",
  },

  unlockButton: {
    border: "none",
    background: "#dcfce7",
    color: "#15803d",
    borderRadius: "7px",
    padding: "7px 12px",
    cursor: "pointer",
  },

  disabledButton: {
    opacity: 0.5,
    cursor: "not-allowed",
  },

  loading: {
    padding: "50px",
    textAlign: "center",
    color: "#64748b",
  },

  empty: {
    padding: "50px",
    textAlign: "center",
    color: "#64748b",
  },

  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "18px",
    marginTop: "20px",
  },

  pageButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: "8px",
    padding: "9px 14px",
    cursor: "pointer",
  },

  pageText: {
    color: "#475569",
    fontWeight: 600,
  },
};

export default UsersPage;