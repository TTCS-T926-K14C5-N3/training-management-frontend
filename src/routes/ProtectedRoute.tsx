import { useEffect, type ReactNode } from "react";

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
  // KHÔNG CÓ PHIÊN ĐĂNG NHẬP
  // =========================================================
  if (!user) {
    window.location.href = "/";
    return null;
  }

  // =========================================================
  // KIỂM TRA PHIÊN
  // =========================================================
  let session: SessionUser;

  try {
    session = JSON.parse(user);

    if (
      session.expiresAt &&
      Date.now() >= session.expiresAt
    ) {
      localStorage.removeItem("user");
      window.location.href = "/";
      return null;
    }
  } catch {
    localStorage.removeItem("user");
    window.location.href = "/";
    return null;
  }

  // =========================================================
  // KIỂM TRA QUYỀN TRUY CẬP URL
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
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f5f7fb",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "35px",
              background: "white",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Không có quyền truy cập
            </h2>

            <p>
              Bạn không có quyền thực hiện chức năng này.
            </p>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              style={{
                marginTop: "15px",
                padding: "10px 20px",
                border: "none",
                borderRadius: "8px",
                background: "#2563eb",
                color: "white",
                cursor: "pointer",
              }}
            >
              Quay lại
            </button>
          </div>
        </div>
      );
    }
  }

  // =========================================================
  // CHO PHÉP TRUY CẬP
  // =========================================================
  return <>{children}</>;
}

export default ProtectedRoute;