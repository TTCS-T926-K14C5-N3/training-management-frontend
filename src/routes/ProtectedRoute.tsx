import type { ReactNode } from "react";
import AppStatusPage from "../components/AppStatusPage";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
}

function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
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

  if (requiredPermission) {
    const hasPermission = permissions.some(
      (permission: any) => permission?.maQuyen === requiredPermission,
    );

    if (!hasPermission) {
      return <AppStatusPage status="forbidden" />;
    }
  }

  // =========================================================
  // CHO PHÉP TRUY CẬP
  // =========================================================

  return <>{children}</>;
}

export default ProtectedRoute;
