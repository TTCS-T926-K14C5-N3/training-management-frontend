import { useEffect, type ReactNode } from "react";
import ErrorPage from "../components/ErrorPage";

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
  // 401 - KHÔNG CÓ PHIÊN ĐĂNG NHẬP
  // =========================================================
  if (!user) {
    return (
      <ErrorPage
        code={401}
        title="Phiên đăng nhập hết hạn"
        message="Bạn cần đăng nhập để tiếp tục sử dụng chức năng này."
        actionText="Đăng nhập lại"
        onAction={() => {
          window.location.href = "/";
        }}
      />
    );
  }

  // =========================================================
  // KIỂM TRA PHIÊN
  // =========================================================
  let session: SessionUser;

  try {
    session = JSON.parse(user);

    // =======================================================
    // 401 - PHIÊN ĐÃ HẾT HẠN
    // =======================================================
    if (
      session.expiresAt &&
      Date.now() >= session.expiresAt
    ) {
      localStorage.removeItem("user");

      return (
        <ErrorPage
          code={401}
          title="Phiên đăng nhập hết hạn"
          message="Phiên làm việc của bạn đã hết hạn. Vui lòng đăng nhập lại."
          actionText="Đăng nhập lại"
          onAction={() => {
            window.location.href = "/";
          }}
        />
      );
    }
  } catch {
    // =======================================================
    // 401 - SESSION KHÔNG HỢP LỆ
    // =======================================================
    localStorage.removeItem("user");

    return (
      <ErrorPage
        code={401}
        title="Phiên đăng nhập không hợp lệ"
        message="Thông tin phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại."
        actionText="Đăng nhập lại"
        onAction={() => {
          window.location.href = "/";
        }}
      />
    );
  }

  // =========================================================
  // 403 - KIỂM TRA QUYỀN TRUY CẬP
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
        <ErrorPage
          code={403}
          title="Không có quyền truy cập"
          message="Bạn không có quyền thực hiện chức năng này."
          actionText="Quay về trang chính"
          onAction={() => {
            window.location.href = "/";
          }}
        />
      );
    }
  }

  // =========================================================
  // CHO PHÉP TRUY CẬP
  // =========================================================
  return <>{children}</>;
}

export default ProtectedRoute;