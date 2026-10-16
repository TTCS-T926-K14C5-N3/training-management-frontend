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

  // =========================================================
  // KIỂM TRA ADMIN
  // =========================================================

  const roles = Array.isArray(session.vaiTro) ? session.vaiTro : [];
  const isAdmin = roles.some((role: any) => {
    const name = (role?.tenVaiTro ?? "").trim().toLowerCase();
    return (
      name === "admin" ||
      name === "quản trị hệ thống" ||
      name === "quản trị viên hệ thống" ||
      role?.vaiTroId === 8
    );
  });

  // =========================================================
  // KIỂM TRA QUYỀN
  // =========================================================

  const hasRequiredPermission =
    !requiredPermission ||
    isAdmin ||
    permissions.some(
      (permission: any) => permission?.maQuyen === requiredPermission,
    );
  const hasAnyRequiredPermission =
    !requiredAnyPermission ||
    isAdmin ||
    requiredAnyPermission.some((requiredCode) =>
      permissions.some(
        (permission: any) => permission?.maQuyen === requiredCode,
      ),
    );

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
