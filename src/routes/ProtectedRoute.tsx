import { useEffect, type ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const user = localStorage.getItem("user");

  // =========================================================
  //  GIA HẠN PHIÊN KHI NGƯỜI DÙNG CÒN HOẠT ĐỘNG
  // =========================================================
  useEffect(() => {
    // Không có phiên đăng nhập thì không cần gia hạn
    if (!user) return;

    let isActive = false;

    // Ghi nhận người dùng đang hoạt động
    const handleActivity = () => {
      isActive = true;
    };

    // Các thao tác được xem là người dùng đang hoạt động
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

    // Kiểm tra hoạt động mỗi 1 phút
    const interval = setInterval(() => {
      if (!isActive) return;

      const currentUser = localStorage.getItem("user");

      if (!currentUser) return;

      try {
        const session = JSON.parse(currentUser);

        // Gia hạn thêm 30 phút
        session.expiresAt = Date.now() + 30 * 60 * 1000;

        // Lưu lại phiên mới
        localStorage.setItem("user", JSON.stringify(session));

        // Đặt lại trạng thái hoạt động
        isActive = false;
      } catch {
        // Phiên không hợp lệ thì xóa phiên
        localStorage.removeItem("user");
      }
    }, 60 * 1000);

    // Dọn dẹp khi component bị hủy
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      clearInterval(interval);
    };
  }, [user]);

  // =========================================================
  //  KIỂM TRA CÓ PHIÊN ĐĂNG NHẬP
  // =========================================================
  if (!user) {
    window.location.href = "/";
    return null;
  }

  // =========================================================
  //  KIỂM TRA PHIÊN CÓ HẾT HẠN KHÔNG
  // =========================================================
  try {
    const session = JSON.parse(user);

    if (session.expiresAt && Date.now() >= session.expiresAt) {
      // Xóa thông tin phiên đã hết hạn
      localStorage.removeItem("user");

      // Quay về trang đăng nhập
      window.location.href = "/";
      return null;
    }
  } catch {
    // Dữ liệu phiên không hợp lệ
    localStorage.removeItem("user");
    window.location.href = "/";
    return null;
  }

  // =========================================================
  // Cho phép truy cập nội dung được bảo vệ
  // =========================================================
  return <>{children}</>;
}

export default ProtectedRoute;