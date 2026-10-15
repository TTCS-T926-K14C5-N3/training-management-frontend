import type { ReactNode } from "react";
import AppStatusPage from "../components/AppStatusPage";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredAnyPermission?: string[];
}

function ProtectedRoute({
  children,
  requiredPermission,
  requiredAnyPermission,
}: ProtectedRouteProps) {
  const savedUser = localStorage.getItem("user");

  // =========================================================
  // KHÔNG CÓ SESSION
  // =========================================================

  if (!savedUser) {
    window.location.replace("/");
    return null;
  }

  // =========================================================
  // ĐỌC SESSION
  // =========================================================

  let session: any;

  try {
    session = JSON.parse(savedUser);
  } catch {
    localStorage.removeItem("user");
    window.location.replace("/");
    return null;
  }

  // =========================================================
  // LẤY DANH SÁCH QUYỀN
  // =========================================================

  const permissions = Array.isArray(session.quyen) ? session.quyen : [];
  const isSystemAdmin = Array.isArray(session.vaiTro) && session.vaiTro.some(
    (role: any) => {
      const roleName =
        typeof role?.tenVaiTro === "string"
          ? role.tenVaiTro.trim().toLowerCase()
          : "";

      return (
        role?.vaiTroId === 8 ||
        roleName === "admin" ||
        roleName === "quản trị hệ thống" ||
        roleName === "quản trị viên hệ thống"
      );
    },
  );
  const hasPermission = (permissionCode: string) =>
    isSystemAdmin ||
    permissions.some(
      (permission: any) => permission?.maQuyen === permissionCode,
    );

  // =========================================================
  // KIỂM TRA QUYỀN
  // =========================================================

  const hasRequiredPermission =
    !requiredPermission || hasPermission(requiredPermission);
  const hasAnyRequiredPermission =
    !requiredAnyPermission ||
    requiredAnyPermission.some(hasPermission);

  if (requiredPermission && !hasRequiredPermission) {
    return <AppStatusPage status="forbidden" />;
  }

  if (requiredAnyPermission && !hasAnyRequiredPermission) {
    return <AppStatusPage status="forbidden" />;
  }

  // =========================================================
  // CHO PHÉP TRUY CẬP
  // =========================================================

  return <>{children}</>;
}

export default ProtectedRoute;
