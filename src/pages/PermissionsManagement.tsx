import { useEffect, useState } from "react";
import api from "../services/api";
import RolePermissionsPanel from "./RolePermissionsPanel";

interface Role {
  vaiTroId: number;
  tenVaiTro: string;
}

const PermissionsManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    api
      .get<Role[]>("/roles/")
      .then((response) => {
        if (active) {
          setRoles(Array.isArray(response.data) ? response.data : []);
        }
      })
      .catch((requestError: unknown) => {
        console.error("Không thể tải danh sách vai trò:", requestError);
        if (active) {
          setError("Không thể tải cấu hình quyền. Vui lòng thử tải lại trang.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ padding: "28px 32px 40px" }}>
      <header
        style={{
          marginBottom: "20px",
          padding: "22px 24px",
          borderRadius: "18px",
          background: "linear-gradient(135deg, #172554 0%, #2563eb 100%)",
          boxShadow: "0 12px 30px rgba(37, 99, 235, 0.16)",
          color: "#fff",
        }}
      >
        <div
          style={{
            marginBottom: "8px",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: 0.75,
          }}
        >
          Phân quyền hệ thống
        </div>
        <h1 style={{ margin: 0, fontSize: "24px" }}>Quyền</h1>
        <p style={{ margin: "7px 0 0", fontSize: "13px", opacity: 0.8 }}>
          Cấu hình quyền truy cập theo vai trò hệ thống.
        </p>
      </header>
      {error ? (
        <p role="alert" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      ) : loading ? (
        <p role="status">Đang tải cấu hình quyền...</p>
      ) : (
        <RolePermissionsPanel roles={roles} />
      )}
    </div>
  );
};

export default PermissionsManagement;
