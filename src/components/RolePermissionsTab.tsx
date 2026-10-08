import React, { useEffect, useState } from "react";
import api from "../services/api";

interface Role {
  vaiTroId: number;
  tenVaiTro: string;
  moTa?: string;
}

interface Permission {
  quyenId: number;
  maQuyen: string;
  tenQuyen: string;
  moTa?: string;
}

interface RolePermissionsTabProps {
  roles: Role[];
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

const RolePermissionsTab: React.FC<RolePermissionsTabProps> = ({
  roles,
  showSuccess,
  showError,
}) => {
  const [permissionsCatalog, setPermissionsCatalog] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await api.get("/roles/permissions/catalog");
        setPermissionsCatalog(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        showError("Không thể tải danh mục quyền.");
      }
    };
    fetchCatalog();
  }, [showError]);

  useEffect(() => {
    if (selectedRoleId === null) {
      setSelectedCodes(new Set());
      return;
    }

    const fetchRolePermissions = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/roles/${selectedRoleId}/permissions`);
        const perms = Array.isArray(res.data) ? res.data : [];
        setSelectedCodes(new Set(perms.map((p: any) => p.maQuyen)));
      } catch (err) {
        showError("Không thể tải quyền của vai trò.");
      } finally {
        setLoading(false);
      }
    };

    fetchRolePermissions();
  }, [selectedRoleId, showError]);

  const handleToggle = (code: string) => {
    const newSet = new Set(selectedCodes);
    if (newSet.has(code)) {
      newSet.delete(code);
    } else {
      newSet.add(code);
    }
    setSelectedCodes(newSet);
  };

  const handleSave = async () => {
    if (selectedRoleId === null) return;
    try {
      setSaving(true);
      await api.put(`/roles/${selectedRoleId}/permissions`, {
        permissionCodes: Array.from(selectedCodes)
      });
      showSuccess("Cập nhật quyền thành công.");
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Không thể cập nhật quyền.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px" }}>
      {/* Sidebar Roles */}
      <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", border: "1px solid #e8edf5", boxShadow: "0 4px 18px rgba(15,23,42,0.04)" }}>
        <h3 style={{ margin: "0 0 20px 0", color: "#172033", fontSize: "16px", fontWeight: 750 }}>Danh sách vai trò</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {roles.map(role => (
            <button
              key={role.vaiTroId}
              type="button"
              onClick={() => setSelectedRoleId(role.vaiTroId)}
              style={{
                padding: "14px 16px",
                textAlign: "left",
                borderRadius: "10px",
                border: selectedRoleId === role.vaiTroId ? "1px solid #2563eb" : "1px solid #e8edf5",
                background: selectedRoleId === role.vaiTroId ? "#eff6ff" : "#fff",
                color: selectedRoleId === role.vaiTroId ? "#1d4ed8" : "#475569",
                cursor: "pointer",
                fontWeight: 650,
                fontSize: "14px",
                transition: "all 0.15s ease",
                boxShadow: selectedRoleId === role.vaiTroId ? "0 2px 8px rgba(37,99,235,0.1)" : "none"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "18px", opacity: selectedRoleId === role.vaiTroId ? 1 : 0.6 }}>🛡️</span>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: "2px" }}>{role.tenVaiTro}</div>
                  {role.moTa && (
                    <div style={{ fontSize: "11px", fontWeight: 500, color: selectedRoleId === role.vaiTroId ? "#3b82f6" : "#94a3b8" }}>
                      {role.moTa}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Permissions Panel */}
      <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", border: "1px solid #e8edf5", boxShadow: "0 4px 18px rgba(15,23,42,0.04)" }}>
        {selectedRoleId === null ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }}>⚙️</div>
            <h3 style={{ margin: "0 0 8px 0", color: "#475569", fontSize: "16px" }}>Chưa chọn vai trò</h3>
            <p style={{ margin: 0, fontSize: "13px" }}>Vui lòng chọn một vai trò ở danh sách bên trái để cấu hình quyền truy cập.</p>
          </div>
        ) : loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: "24px", marginBottom: "12px" }}>⏳</div>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>Đang tải danh sách quyền...</div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid #e8edf5" }}>
              <div>
                <h3 style={{ margin: "0 0 6px 0", color: "#172033", fontSize: "18px", fontWeight: 750 }}>
                  Cấu hình quyền cho: <span style={{ color: "#2563eb" }}>{roles.find(r => r.vaiTroId === selectedRoleId)?.tenVaiTro}</span>
                </h3>
                <div style={{ fontSize: "13px", color: "#64748b" }}>
                  Đã chọn {selectedCodes.size} / {permissionsCatalog.length} quyền
                </div>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "12px 24px",
                  background: "#16a34a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(22,163,74,0.2)"
                }}
              >
                {saving ? "⏳ Đang lưu..." : "💾 Lưu thay đổi"}
              </button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {permissionsCatalog.map(perm => (
                <label
                  key={perm.maQuyen}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "14px",
                    padding: "18px",
                    border: selectedCodes.has(perm.maQuyen) ? "1px solid #3b82f6" : "1px solid #e2e8f0",
                    borderRadius: "12px",
                    cursor: "pointer",
                    background: selectedCodes.has(perm.maQuyen) ? "#f8fafc" : "#fff",
                    transition: "all 0.15s ease",
                    boxShadow: selectedCodes.has(perm.maQuyen) ? "0 2px 8px rgba(59,130,246,0.08)" : "none"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCodes.has(perm.maQuyen)}
                    onChange={() => handleToggle(perm.maQuyen)}
                    style={{ marginTop: "3px", width: "18px", height: "18px", accentColor: "#2563eb", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "14px", marginBottom: "4px" }}>
                      {perm.tenQuyen}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
                      {perm.moTa}
                    </div>
                    <div style={{ 
                      fontSize: "10.5px", 
                      color: selectedCodes.has(perm.maQuyen) ? "#2563eb" : "#94a3b8", 
                      marginTop: "8px", 
                      fontFamily: "monospace",
                      background: selectedCodes.has(perm.maQuyen) ? "#dbeafe" : "#f1f5f9",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      display: "inline-block",
                      fontWeight: 600
                    }}>
                      {perm.maQuyen}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RolePermissionsTab;
