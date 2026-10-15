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
  // KIỂM TRA QUYỀN
  // =========================================================

  const hasRequiredPermission =
    !requiredPermission ||
    permissions.some(
      (permission: any) => permission?.maQuyen === requiredPermission,
    );
  const hasAnyRequiredPermission =
    !requiredAnyPermission ||
    requiredAnyPermission.some((requiredCode) =>
      permissions.some(
        (permission: any) => permission?.maQuyen === requiredCode,
      ),
    );

  if (!hasRequiredPermission || !hasAnyRequiredPermission) {
    return <AppStatusPage status="forbidden" />;
  }

  // =========================================================
  // CHO PHÉP TRUY CẬP
  // =========================================================

  return <>{children}</>;
}

export default ProtectedRoute;
