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

interface PermissionGroup {
  name: string;
  icon: string;
  permissions: Permission[];
  visiblePermissions?: Permission[];
}

interface RolePermissionsPanelProps {
  roles: Role[];
}

const permissionGroupFor = (code: string): { name: string; icon: string } => {
  if (code.startsWith("USER_") || code.startsWith("STUDENT_")) {
    return { name: "Người dùng", icon: "👥" };
  }
  if (code.startsWith("ROLE_")) {
    return { name: "Vai trò và phân quyền", icon: "🛡️" };
  }
  if (code.startsWith("GRADE_") || code === "QUAN_LY_DIEM") {
    return { name: "Điểm", icon: "📊" };
  }
  if (code.startsWith("TUITION_") || code === "QUAN_LY_HOC_PHI") {
    return { name: "Học phí", icon: "💳" };
  }
  if (code.startsWith("CLASS_") || code === "QUAN_LY_LOP") {
    return { name: "Lớp học", icon: "🏫" };
  }
  if (code.startsWith("SCHEDULE_")) {
    return { name: "Lịch học", icon: "🗓️" };
  }
  if (code.startsWith("CURRICULUM_")) {
    return { name: "Danh mục đào tạo", icon: "📚" };
  }
  if (code.startsWith("LEAD_")) {
    return { name: "Khách hàng tiềm năng", icon: "📩" };
  }
  return { name: "Khác", icon: "🔐" };
};

const samePermissions = (left: Set<string>, right: Set<string>) =>
  left.size === right.size && [...left].every((permission) => right.has(permission));

const RolePermissionsPanel: React.FC<RolePermissionsPanelProps> = ({
  roles,
}) => {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const activeRoleId = selectedRoleId ?? roles[0]?.vaiTroId ?? null;
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(),
  );
  const [savedPermissions, setSavedPermissions] = useState<Set<string>>(
    new Set(),
  );
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [permissionsLoadError, setPermissionsLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const hasUnsavedChanges = !samePermissions(
    selectedPermissions,
    savedPermissions,
  );

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
          const loadedPermissions = new Set(
            permissions.map((permission) => permission.maQuyen),
          );
          setSelectedPermissions(loadedPermissions);
          setSavedPermissions(loadedPermissions);
        }
      })
      .catch((error: unknown) => {
        console.error("Không thể tải quyền của vai trò:", error);
        if (active) {
          setPermissionsLoadError(true);
          setErrorMessage("Không thể tải quyền của vai trò. Vui lòng thử lại.");
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
    const groups = new Map<string, PermissionGroup>();
    catalog.forEach((permission) => {
      const group = permissionGroupFor(permission.maQuyen);
      const current = groups.get(group.name) ?? {
        ...group,
        permissions: [],
      };
      current.permissions.push(permission);
      groups.set(group.name, current);
    });
    return [...groups.values()];
  }, [catalog]);

  const visibleGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    if (!query) {
      return groupedPermissions.map((group) => ({
        ...group,
        visiblePermissions: group.permissions,
      }));
    }

    return groupedPermissions.flatMap((group) => {
      const groupMatches = group.name.toLocaleLowerCase("vi").includes(query);
      const permissions = groupMatches
        ? group.permissions
        : group.permissions.filter((permission) =>
            [permission.tenQuyen, permission.maQuyen, permission.moTa]
              .filter(Boolean)
              .some((value) => value.toLocaleLowerCase("vi").includes(query)),
          );
      return permissions.length
        ? [{ ...group, visiblePermissions: permissions }]
        : [];
    });
  }, [groupedPermissions, search]);

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

  const isLockedPermission = (permissionCode: string) =>
    activeRoleId === 8 &&
    ["ROLE_VIEW", "ROLE_UPDATE"].includes(permissionCode);

  const setGroupPermissions = (permissions: Permission[]) => {
    const selectablePermissions = permissions.filter(
      (permission) => !isLockedPermission(permission.maQuyen),
    );
    const allSelected = permissions.every((permission) =>
      selectedPermissions.has(permission.maQuyen),
    );
    setSelectedPermissions((current) => {
      const updated = new Set(current);
      selectablePermissions.forEach(({ maQuyen }) => {
        if (allSelected) updated.delete(maQuyen);
        else updated.add(maQuyen);
      });
      return updated;
    });
  };

  const setAllPermissions = (select: boolean) => {
    setSelectedPermissions((current) => {
      const updated = new Set(current);
      catalog.forEach(({ maQuyen }) => {
        if (isLockedPermission(maQuyen)) return;
        if (select) updated.add(maQuyen);
        else updated.delete(maQuyen);
      });
      return updated;
    });
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((current) => {
      const updated = new Set(current);
      if (updated.has(groupName)) updated.delete(groupName);
      else updated.add(groupName);
      return updated;
    });
  };

  const changeRole = (nextRoleId: number) => {
    if (nextRoleId === activeRoleId) return;
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "Vai trò hiện tại có thay đổi chưa lưu. Bạn có muốn bỏ các thay đổi này và chuyển vai trò không?",
      )
    ) {
      return;
    }
    setMessage("");
    setErrorMessage("");
    setPermissionsLoadError(false);
    setLoadingPermissions(true);
    setSelectedRoleId(nextRoleId);
  };

  const cancelChanges = () => {
    setSelectedPermissions(new Set(savedPermissions));
    setMessage("");
    setErrorMessage("");
  };

  const savePermissions = async () => {
    if (activeRoleId === null || permissionsLoadError || !hasUnsavedChanges) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");
      const response = await api.put(
        `/roles/${activeRoleId}/permissions`,
        {
          permissionCodes: Array.from(selectedPermissions),
        },
      );
      setSavedPermissions(new Set(selectedPermissions));

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
      setErrorMessage(
        typeof detail === "string"
          ? detail
          : "Không thể cập nhật quyền. Vui lòng kiểm tra quyền quản trị và thử lại.",
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedRole = roles.find((role) => role.vaiTroId === activeRoleId);
  const controlsDisabled =
    loadingPermissions || permissionsLoadError || saving || activeRoleId === null;

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

      <header className="role-permissions-heading">
        <div>
          <h2>Cấu hình quyền theo vai trò</h2>
          <p>Quyền không được chọn sẽ bị từ chối tại backend.</p>
        </div>
        <label className="role-permissions-role-select">
          <span>Vai trò</span>
          <select
            value={activeRoleId ?? ""}
            onChange={(event) => changeRole(Number(event.target.value))}
            disabled={roles.length === 0 || loadingPermissions || saving}
          >
            {roles.map((role) => (
              <option key={role.vaiTroId} value={role.vaiTroId}>
                {role.tenVaiTro}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loadingCatalog || (activeRoleId !== null && loadingPermissions) ? (
        <p className="role-permissions-status" role="status">
          Đang tải cấu hình quyền...
        </p>
      ) : roles.length === 0 ? (
        <p className="role-permissions-error" role="alert">
          Không tải được danh sách vai trò hệ thống.
        </p>
      ) : permissionsLoadError ? (
        <p className="role-permissions-error" role="alert">
          Không thể tải quyền của vai trò. Hãy thử tải lại trang trước khi tiếp tục.
        </p>
      ) : catalog.length === 0 ? (
        <p className="role-permissions-error" role="alert">
          Chưa có danh mục quyền để cấu hình.
        </p>
      ) : (
        <>
          <div className="role-permissions-toolbar">
            <label className="role-permissions-search">
              <span className="sr-only">Tìm quyền</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên quyền hoặc mã quyền..."
                disabled={controlsDisabled}
              />
            </label>
            <div className="role-permissions-stats" aria-live="polite">
              <span>
                Tổng quyền <strong>{catalog.length}</strong>
              </span>
              <span>
                Đang chọn <strong>{selectedPermissions.size}</strong>
              </span>
            </div>
            <div className="role-permissions-bulk-actions">
              <button
                type="button"
                onClick={() => setAllPermissions(true)}
                disabled={controlsDisabled}
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                onClick={() => setAllPermissions(false)}
                disabled={controlsDisabled}
              >
                Bỏ chọn tất cả
              </button>
            </div>
          </div>

          {visibleGroups.length === 0 ? (
            <div className="role-permissions-empty" role="status">
              Không tìm thấy quyền phù hợp
            </div>
          ) : (
            <div className="role-permissions-groups">
              {visibleGroups.map((group) => {
                const selectedCount = group.permissions.filter((permission) =>
                  selectedPermissions.has(permission.maQuyen),
                ).length;
                const allSelected =
                  selectedCount === group.permissions.length;
                const expanded =
                  search.trim().length > 0 || expandedGroups.has(group.name);

                return (
                  <section
                    key={group.name}
                    className={`role-permissions-group${expanded ? " is-open" : ""}`}
                  >
                    <div className="role-permissions-group-heading">
                      <button
                        type="button"
                        className="role-permissions-group-toggle"
                        aria-expanded={expanded}
                        onClick={() => toggleGroup(group.name)}
                      >
                        <span className="role-permissions-group-icon" aria-hidden="true">
                          {group.icon}
                        </span>
                        <span className="role-permissions-group-name">
                          {group.name}
                        </span>
                        <span className="role-permissions-group-count">
                          {selectedCount}/{group.permissions.length} quyền
                        </span>
                        <span
                          className="role-permissions-chevron"
                          aria-hidden="true"
                        >
                          {expanded ? "⌃" : "⌄"}
                        </span>
                      </button>
                      <label className="role-permissions-group-select">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(element) => {
                            if (element) {
                              element.indeterminate =
                                selectedCount > 0 && !allSelected;
                            }
                          }}
                          disabled={controlsDisabled}
                          onChange={() => setGroupPermissions(group.permissions)}
                          aria-label={`Chọn tất cả quyền nhóm ${group.name}`}
                        />
                        <span>Chọn nhóm</span>
                      </label>
                    </div>
                    {expanded && (
                      <div className="role-permissions-grid">
                        {(group.visiblePermissions ?? group.permissions).map((permission) => {
                          const locked = isLockedPermission(permission.maQuyen);
                          return (
                            <label
                              key={permission.maQuyen}
                              className={`role-permission-item${selectedPermissions.has(permission.maQuyen) ? " is-selected" : ""}`}
                              title={permission.moTa}
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissions.has(permission.maQuyen)}
                                disabled={controlsDisabled || locked}
                                onChange={() =>
                                  togglePermission(permission.maQuyen)
                                }
                              />
                              <span className="role-permission-copy">
                                <strong>{permission.tenQuyen}</strong>
                                <small>{permission.maQuyen}</small>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      <footer className="role-permissions-actions">
        <div className="role-permissions-save-status" aria-live="polite">
          <strong>{selectedRole?.tenVaiTro ?? "Chưa chọn vai trò"}</strong>
          <span>
            {saving
              ? "Đang lưu cấu hình..."
              : hasUnsavedChanges
                ? "Có thay đổi chưa lưu"
                : "Chưa có thay đổi"}
          </span>
        </div>
        <div className="role-permissions-save-buttons">
          <button
            type="button"
            className="role-permissions-cancel"
            onClick={cancelChanges}
            disabled={controlsDisabled || !hasUnsavedChanges}
          >
            Hủy thay đổi
          </button>
          <button
            type="button"
            onClick={savePermissions}
            disabled={controlsDisabled || !hasUnsavedChanges}
            className="role-permissions-save"
          >
            {saving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </div>
      </footer>
    </section>
  );
};

export default RolePermissionsPanel;
