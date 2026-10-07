import { useEffect, type ReactNode } from "react";

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
  // KIỂM TRA SESSION HẾT HẠN
  // =========================================================

  if (session.expiresAt && Date.now() >= session.expiresAt) {
    localStorage.removeItem("user");
    window.location.replace("/");
    return null;
  }

  // =========================================================
  // LẤY DANH SÁCH QUYỀN
  // =========================================================

  const permissions = Array.isArray(session.quyen) ? session.quyen : [];
  const isAdmin = Array.isArray(session.vaiTro)
    ? session.vaiTro.some((role: any) => {
        const roleName =
          typeof role?.tenVaiTro === "string"
            ? role.tenVaiTro.trim().toLowerCase()
            : "";

        return (
          roleName === "admin" ||
          roleName === "quản trị hệ thống" ||
          roleName === "quản trị viên hệ thống" ||
          role?.vaiTroId === 8
        );
      })
    : false;

  // =========================================================
  // KIỂM TRA QUYỀN
  // =========================================================

  if (requiredPermission) {
    const hasAdminAccess =
      isAdmin &&
      (requiredPermission === "USER_VIEW" ||
        requiredPermission === "ROLE_VIEW");
    const hasPermission =
      hasAdminAccess ||
      permissions.some(
        (permission: any) => permission?.maQuyen === requiredPermission,
      );

    // Không có quyền → về trang chủ chung
    if (!hasPermission) {
      console.warn(
        `Không có quyền ${requiredPermission}. Chuyển về trang chủ.`,
      );

      window.location.replace("/");
      return null;
    }
  }

  // =========================================================
  // GIA HẠN PHIÊN KHI USER CÒN HOẠT ĐỘNG
  // =========================================================

  useEffect(() => {
    let isActive = false;

    const handleActivity = () => {
      isActive = true;
    };

    const events = ["click", "mousemove", "keydown", "scroll", "touchstart"];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    const interval = window.setInterval(() => {
      if (!isActive) {
        return;
      }

      const currentUser = localStorage.getItem("user");

      if (!currentUser) {
        return;
      }

      try {
        const currentSession = JSON.parse(currentUser);

        // Gia hạn phiên frontend thêm 30 phút
        currentSession.expiresAt = Date.now() + 30 * 60 * 1000;

        localStorage.setItem("user", JSON.stringify(currentSession));

        isActive = false;
      } catch {
        localStorage.removeItem("user");
        window.location.replace("/");
      }
    }, 60 * 1000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      window.clearInterval(interval);
    };
  }, []);

  // =========================================================
  // CHO PHÉP TRUY CẬP
  // =========================================================

  return <>{children}</>;
}

export default ProtectedRoute;
