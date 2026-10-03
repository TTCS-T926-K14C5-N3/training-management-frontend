import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";

interface User {
  nguoiDungId: number;
  hoTen: string;
  email: string;
  soDienThoai?: string;
  trangThai?: string;
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

const RoleManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingUserRoles, setLoadingUserRoles] = useState(false);

  // =========================================================
  // LẤY DANH SÁCH NGƯỜI DÙNG
  // =========================================================

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);

      const response = await api.get("/users/");

      setUsers(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error("Không thể tải danh sách người dùng:", error);
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

      setRoles(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error("Không thể tải danh sách vai trò:", error);
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

      const response = await api.get(
        `/roles/users/${userId}`
      );

      setUserRoles(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Không thể tải vai trò của người dùng:",
        error
      );

      setUserRoles([]);
    } finally {
      setLoadingUserRoles(false);
    }
  };

  // =========================================================
  // LOAD BAN ĐẦU
  // =========================================================

  useEffect(() => {
    loadUsers();
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
    (user) => user.nguoiDungId === selectedUserId
  );

  // =========================================================
  // VAI TRÒ CHƯA ĐƯỢC GÁN
  // =========================================================

  const availableRoles = useMemo(() => {
    const currentRoleIds = new Set(
      userRoles.map((role) => role.vaiTroId)
    );

    return roles.filter(
      (role) => !currentRoleIds.has(role.vaiTroId)
    );
  }, [roles, userRoles]);

  // =========================================================
  // GÁN VAI TRÒ - SCRUM-121
  // =========================================================
  const handleAssignRole = async (roleId: number) => {
    if (selectedUserId === null) {
      setErrorMessage("Vui lòng chọn người dùng.");
      return;
    }

    try {
      setActionLoading(roleId);
      setMessage("");
      setErrorMessage("");

      await api.post(
        `/roles/users/${selectedUserId}/${roleId}`
      );

      setMessage("Gán vai trò thành công.");
      await loadUserRoles(selectedUserId);
    } catch (error: any) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 400) {
        setErrorMessage(detail || "Dữ liệu không hợp lệ.");
      } else if (status === 403) {
        setErrorMessage(
          detail || "Bạn không có quyền thực hiện chức năng này."
        );
      } else if (status === 404) {
        setErrorMessage(
          detail || "Không tìm thấy người dùng hoặc vai trò."
        );
      } else if (status === 409) {
        setErrorMessage(
          detail || "Người dùng đã có vai trò này."
        );
      } else {
        setErrorMessage(
          detail || "Có lỗi xảy ra khi gán vai trò."
        );
      }
    } finally {
      setActionLoading(null);
    }
  };

  // =========================================================
  // THU HỒI VAI TRÒ - SCRUM-121
  // =========================================================
  const handleRemoveRole = async (roleId: number) => {
    if (selectedUserId === null) {
      setErrorMessage("Vui lòng chọn người dùng.");
      return;
    }

    try {
      setActionLoading(roleId);
      setMessage("");
      setErrorMessage("");

      await api.delete(
        `/roles/users/${selectedUserId}/${roleId}`
      );

      setMessage("Thu hồi vai trò thành công.");
      await loadUserRoles(selectedUserId);
    } catch (error: any) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 400) {
        setErrorMessage(detail || "Dữ liệu không hợp lệ.");
      } else if (status === 403) {
        setErrorMessage(
          detail || "Bạn không có quyền thực hiện chức năng này."
        );
      } else if (status === 404) {
        setErrorMessage(
          detail || "Không tìm thấy người dùng hoặc vai trò."
        );
      } else if (status === 409) {
        setErrorMessage(
          detail || "Không thể thực hiện thao tác này."
        );
      } else {
        setErrorMessage(
          detail || "Có lỗi xảy ra khi thu hồi vai trò."
        );
      }
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "30px",
      }}
    >
      {/* HEADER */}

      <div style={{ marginBottom: "25px" }}>
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
            color: "#8a94a6",
          }}
        >
          Quản lý các vai trò được gán cho từng người dùng.
        </p>
      </div>

      {message && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 15px",
            borderRadius: "8px",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#047857",
            fontWeight: 600,
          }}
        >
          ✓ {message}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 15px",
            borderRadius: "8px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            fontWeight: 600,
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* NỘI DUNG */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: "20px",
        }}
      >
        {/* =================================================
            DANH SÁCH NGƯỜI DÙNG
        ================================================= */}

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e9f0",
            borderRadius: "14px",
            padding: "20px",
          }}
        >
          <h2
            style={{
              margin: "0 0 5px",
              fontSize: "18px",
              color: "#172033",
            }}
          >
            Người dùng
          </h2>

          <p
            style={{
              margin: "0 0 18px",
              color: "#9aa4b2",
              fontSize: "13px",
            }}
          >
            Chọn người dùng để xem vai trò
          </p>

          {loadingUsers ? (
            <div style={{ color: "#8a94a6" }}>
              Đang tải người dùng...
            </div>
          ) : users.length === 0 ? (
            <div style={{ color: "#8a94a6" }}>
              Chưa có người dùng.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {users.map((user) => {
                const isSelected =
                  selectedUserId === user.nguoiDungId;

                return (
                  <button
                    key={user.nguoiDungId}
                    type="button"
                    onClick={() =>
                      setSelectedUserId(user.nguoiDungId)
                    }
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "13px",
                      borderRadius: "10px",
                      border: isSelected
                        ? "1px solid #3b82f6"
                        : "1px solid #e5e9f0",
                      background: isSelected
                        ? "#eff6ff"
                        : "#fff",
                      cursor: "pointer",
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
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* =================================================
            CHI TIẾT VAI TRÒ
        ================================================= */}

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e9f0",
            borderRadius: "14px",
            padding: "25px",
          }}
        >
          {!selectedUser ? (
            <div
              style={{
                minHeight: "450px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                color: "#8a94a6",
              }}
            >
              <div
                style={{
                  fontSize: "45px",
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

              <p>
                Chọn một người dùng ở danh sách bên trái.
              </p>
            </div>
          ) : (
            <>
              {/* THÔNG TIN USER */}

              <div
                style={{
                  paddingBottom: "20px",
                  borderBottom: "1px solid #edf0f4",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    color: "#172033",
                    fontSize: "22px",
                  }}
                >
                  {selectedUser.hoTen}
                </h2>

                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#8a94a6",
                  }}
                >
                  {selectedUser.email}
                </p>
              </div>

              {/* =================================================
                  VAI TRÒ HIỆN TẠI
              ================================================= */}

              <div style={{ marginTop: "25px" }}>
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
                  <p style={{ color: "#8a94a6" }}>
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
                    Người dùng chưa có vai trò.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    {userRoles.map((role) => (
                      <div
                        key={role.vaiTroId}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "15px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
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
                          onClick={() =>
                            handleRemoveRole(role.vaiTroId)
                          }
                          disabled={actionLoading === role.vaiTroId}
                          style={{
                            padding: "8px 12px",
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

              {/* =================================================
                  VAI TRÒ CÓ THỂ GÁN
              ================================================= */}

              <div style={{ marginTop: "30px" }}>
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
                  <p style={{ color: "#8a94a6" }}>
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
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(220px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {availableRoles.map((role) => (
                      <div
                        key={role.vaiTroId}
                        style={{
                          border: "1px solid #e5e9f0",
                          borderRadius: "10px",
                          padding: "15px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#172033",
                          }}
                        >
                          {role.tenVaiTro}
                        </div>

                        <div
                          style={{
                            marginTop: "5px",
                            minHeight: "32px",
                            fontSize: "12px",
                            color: "#8a94a6",
                          }}
                        >
                          {role.moTa || "Chưa có mô tả"}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleAssignRole(role.vaiTroId)
                          }
                          disabled={actionLoading === role.vaiTroId}
                          style={{
                            width: "100%",
                            marginTop: "12px",
                            padding: "9px",
                            border: "none",
                            borderRadius: "8px",
                            background:
                              actionLoading === role.vaiTroId
                                ? "#d1d5db"
                                : "#2563eb",
                            color: "#fff",
                            cursor:
                              actionLoading === role.vaiTroId
                                ? "not-allowed"
                                : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {actionLoading === role.vaiTroId
                            ? "Đang xử lý..."
                            : "+ Gán vai trò"}
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