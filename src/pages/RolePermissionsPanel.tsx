import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import "./PermissionsManagement.css";

interface Role {
  vaiTroId: number;
  tenVaiTro: string;
}

interface Permission {
  quyenId?: number;
  maQuyen: string;
  tenQuyen: string;
  moTa: string;
}

interface RolePermissionsPanelProps {
  roles: Role[];
}

const RolePermissionsPanel: React.FC<RolePermissionsPanelProps> = ({
  roles,
}) => {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const activeRoleId = selectedRoleId ?? roles[0]?.vaiTroId ?? null;
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(),
  );
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    api
      .get<Permission[]>("/roles/permissions/catalog")
      .then((response) => {
        if (active) {
          setCatalog(Array.isArray(response.data) ? response.data : []);
        }
      })
      .catch((error: unknown) => {
        console.error("Không thể tải danh mục quyền:", error);
        if (active) {
          setErrorMessage(
            "Không thể tải danh mục quyền. Vui lòng kiểm tra quyền quản trị và thử lại.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadingCatalog(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (activeRoleId === null) {
      return;
    }

    let active = true;

    api
      .get<Permission[]>(`/roles/${activeRoleId}/permissions`)
      .then((response) => {
        if (active) {
          const permissions = Array.isArray(response.data)
            ? response.data
            : [];
          setSelectedPermissions(
            new Set(permissions.map((permission) => permission.maQuyen)),
          );
        }
      })
      .catch((error: unknown) => {
        console.error("Không thể tải quyền của vai trò:", error);
        if (active) {
          setSelectedPermissions(new Set());
          setErrorMessage(
            "Không thể tải quyền của vai trò. Vui lòng thử lại.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadingPermissions(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeRoleId]);

  const groupedPermissions = useMemo(() => {
    const groupFor = (code: string) => {
      if (code.startsWith("USER_")) return "Người dùng";
      if (code.startsWith("ROLE_")) return "Vai trò và phân quyền";
      if (code.startsWith("GRADE_") || code === "QUAN_LY_DIEM") {
        return "Điểm";
      }
      if (code.startsWith("TUITION_") || code === "QUAN_LY_HOC_PHI") {
        return "Học phí";
      }
      if (code.startsWith("ATTENDANCE_")) return "Điểm danh";
      if (code.startsWith("SCHEDULE_")) return "Lịch học";
      if (code.startsWith("CURRICULUM_")) return "Danh mục đào tạo";
      if (code.startsWith("LEAD_")) return "Tuyển sinh";
      return "Lớp học";
    };

    return catalog.reduce<Record<string, Permission[]>>((groups, permission) => {
      const group = groupFor(permission.maQuyen);
      groups[group] ??= [];
      groups[group].push(permission);
      return groups;
    }, {});
  }, [catalog]);

  const showError = (messageText: string) => {
    setMessage("");
    setErrorMessage(messageText);
  };

  const togglePermission = (permissionCode: string) => {
    setSelectedPermissions((current) => {
      const updated = new Set(current);
      if (updated.has(permissionCode)) {
        updated.delete(permissionCode);
      } else {
        updated.add(permissionCode);
      }
      return updated;
    });
  };

  const savePermissions = async () => {
    if (activeRoleId === null) {
      showError("Vui lòng chọn vai trò cần cấu hình.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");
      const availableCodes = new Set(
        catalog.map((permission) => permission.maQuyen),
      );
      const permissionCodes = Array.from(selectedPermissions).filter((code) =>
        availableCodes.has(code),
      );
      setSelectedPermissions(new Set(permissionCodes));
      const response = await api.put(
        `/roles/${activeRoleId}/permissions`,
        {
          permissionCodes,
        },
      );
      const currentUser = JSON.parse(localStorage.getItem("user") || "null");
      const isCurrentUsersRole = currentUser?.vaiTro?.some(
        (role: { vaiTroId?: number }) => role.vaiTroId === activeRoleId,
      );

      if (
        isCurrentUsersRole &&
        Array.isArray(response.data?.actorPermissions)
      ) {
        currentUser.quyen = response.data.actorPermissions;
        localStorage.setItem("user", JSON.stringify(currentUser));
        window.location.reload();
        return;
      }

      setMessage("Đã cập nhật quyền cho vai trò.");
    } catch (error: unknown) {
      console.error("Không thể cập nhật quyền cho vai trò:", error);
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.detail
        : undefined;
      showError(
        typeof detail === "string"
          ? detail
          : "Không thể cập nhật quyền. Vui lòng kiểm tra quyền quản trị và thử lại.",
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedRole = roles.find((role) => role.vaiTroId === activeRoleId);

  return (
    <section className="role-permissions-panel">
      {(message || errorMessage) && (
        <ToastNotification
          type={message ? "success" : "error"}
          text={message || errorMessage}
          onClose={() => {
            setMessage("");
            setErrorMessage("");
          }}
        />
      )}

      <div className="role-permissions-header">
        <div>
          <h3>Cấu hình quyền theo vai trò</h3>
          <p>
            Quyền không được chọn sẽ bị từ chối tại backend.
          </p>
        </div>
        <label className="role-permissions-role-select">
          Vai trò
          <select
            value={activeRoleId ?? ""}
            onChange={(event) => {
              setLoadingPermissions(true);
              setErrorMessage("");
              setSelectedRoleId(Number(event.target.value));
            }}
            disabled={roles.length === 0 || loadingPermissions || saving}
          >
            {roles.map((role) => (
              <option key={role.vaiTroId} value={role.vaiTroId}>
                {role.tenVaiTro}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadingCatalog || (activeRoleId !== null && loadingPermissions) ? (
        <p className="role-permissions-status" role="status">
          Đang tải cấu hình quyền...
        </p>
      ) : roles.length === 0 ? (
        <p className="role-permissions-error" role="alert">
          Không tải được danh sách tám vai trò hệ thống.
        </p>
      ) : catalog.length === 0 ? (
        <p className="role-permissions-error" role="alert">
          Chưa có danh mục quyền để cấu hình.
        </p>
      ) : (
        <div className="role-permissions-groups">
          {Object.entries(groupedPermissions).map(([group, permissions]) => (
            <details key={group} className="role-permissions-group">
              <summary>
                <span>{group}</span>
                <small>
                  {permissions.filter((permission) =>
                    selectedPermissions.has(permission.maQuyen),
                  ).length}
                  /{permissions.length} quyền được bật
                </small>
              </summary>
              <div className="role-permissions-group-items">
                {permissions.map((permission) => {
                  const lockedAdminPermission =
                    activeRoleId === 8 &&
                    ["ROLE_VIEW", "ROLE_UPDATE"].includes(permission.maQuyen);
                  return (
                    <label
                      key={permission.maQuyen}
                      className="role-permission-item"
                      title={permission.moTa}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.has(permission.maQuyen)}
                        disabled={
                          loadingPermissions || saving || lockedAdminPermission
                        }
                        onChange={() => togglePermission(permission.maQuyen)}
                      />
                      <span>
                        <strong>{permission.tenQuyen}</strong>
                        <small>{permission.maQuyen}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}

      <div className="role-permissions-actions">
        <span>
          {selectedRole ? `Đang cấu hình: ${selectedRole.tenVaiTro}` : ""}
        </span>
        <button
          type="button"
          onClick={savePermissions}
          disabled={
            saving ||
            loadingPermissions ||
            loadingCatalog ||
            activeRoleId === null
          }
          className="role-permissions-save"
        >
          {saving ? "Đang lưu..." : "Lưu cấu hình quyền"}
        </button>
      </div>
    </section>
  );
};

export default RolePermissionsPanel;
