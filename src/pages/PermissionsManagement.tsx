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
    <div className="permission-management-page">
      <header className="permission-management-hero">
        <div className="permission-management-eyebrow">
          Phân quyền hệ thống
        </div>
        <h1>Quyền</h1>
        <p>
          Cấu hình quyền truy cập theo vai trò hệ thống.
        </p>
      </header>
      {error ? (
        <p className="permission-management-error" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p className="permission-management-loading" role="status">
          Đang tải cấu hình quyền...
        </p>
      ) : (
        <RolePermissionsPanel roles={roles} />
      )}
    </div>
  );
};

export default PermissionsManagement;
