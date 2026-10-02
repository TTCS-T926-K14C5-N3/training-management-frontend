import { useEffect, type ReactNode } from "react";
import ErrorPage from "../pages/ErrorPage";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
}

interface SessionPermission {
  maQuyen: string;
  tenQuyen?: string;
}

interface SessionUser {
  expiresAt?: number;
  quyen?: SessionPermission[];
}

function ProtectedRoute({
  children,
  requiredPermission,
}: ProtectedRouteProps) {
  const user = localStorage.getItem("user");

  // =========================================================
  // GIA HẠN PHIÊN KHI NGƯỜI DÙNG CÒN HOẠT ĐỘNG
  // =========================================================
  useEffect(() => {
    if (!user) return;

    let isActive = false;

    const handleActivity = () => {
      isActive = true;
    };

    const events = [
      "click",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
    ];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    const interval = setInterval(() => {
      if (!isActive) return;

      const currentUser = localStorage.getItem("user");

      if (!currentUser) return;

      try {
        const session: SessionUser = JSON.parse(currentUser);

        session.expiresAt =
          Date.now() + 30 * 60 * 1000;

        localStorage.setItem(
          "user",
          JSON.stringify(session)
        );

        isActive = false;
      } catch {
        localStorage.removeItem("user");
      }
    }, 60 * 1000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      clearInterval(interval);
    };
  }, [user]);

  // =========================================================
  // KHÔNG CÓ PHIÊN ĐĂNG NHẬP (LỖI 401)
  // =========================================================
  if (!user) {
    return <ErrorPage code={401} />;
  }

  // =========================================================
  // KIỂM TRA PHIÊN (LỖI 401)
  // =========================================================
  let session: SessionUser;

  try {
    session = JSON.parse(user);

    if (
      session.expiresAt &&
      Date.now() >= session.expiresAt
    ) {
      localStorage.removeItem("user");
      return <ErrorPage code={401} />;
    }
  } catch {
    localStorage.removeItem("user");
    return <ErrorPage code={401} />;
  }

  // =========================================================
  // KIỂM TRA QUYỀN TRUY CẬP URL (LỖI 403)
  // =========================================================
  if (requiredPermission) {
    const permissions = Array.isArray(session.quyen)
      ? session.quyen
      : [];

    const hasPermission = permissions.some(
      (permission) =>
        permission.maQuyen === requiredPermission
    );

    if (!hasPermission) {
      return <ErrorPage code={403} />;
    }
  }

  // =========================================================
  // CHO PHÉP TRUY CẬP
  // =========================================================
  return <>{children}</>;
}

export default ProtectedRoute;