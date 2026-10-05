import React, { useEffect, useState } from "react";
import "./App.css";

import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleManagement from "./pages/RoleManagement";

import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import Profile from "./pages/Profile";
import api from "./services/api";

// ===========================================================
// TYPES
// ===========================================================

interface VaiTro {
  vaiTroId: number;
  tenVaiTro: string;
}

interface Quyen {
  quyenId: number;
  maQuyen: string;
  tenQuyen: string;
}

interface User {
  nguoiDungId: number;
  hoTen: string;
  email: string;
  vaiTro: VaiTro[];
  quyen: Quyen[];
  token: string;
  expiresAt: number;
}

// ===========================================================
// KIỂM TRA QUYỀN
// ===========================================================

function hasPermission(user: User | null, maQuyen: string): boolean {
  if (!user) return false;

  return user.quyen.some((quyen) => quyen.maQuyen === maQuyen);
}

// ===========================================================
// KIỂM TRA ADMIN
// ===========================================================

function isAdminUser(user: User | null): boolean {
  if (!user) return false;

  return user.vaiTro.some((role) => {
    const roleName = role.tenVaiTro.trim().toLowerCase();

    return (
      roleName === "admin" ||
      roleName === "quản trị hệ thống" ||
      roleName === "quản trị viên hệ thống" ||
      role.vaiTroId === 8
    );
  });
}

// ===========================================================
// REDIRECT VỀ TRANG CHỦ
// ===========================================================

function RedirectToHome() {
  useEffect(() => {
    if (window.location.pathname !== "/") {
      window.location.replace("/");
    }
  }, []);

  return null;
}

// ===========================================================
// KÍCH HOẠT TÀI KHOẢN
// ===========================================================

function ActivateAccountPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );

  const [message, setMessage] = useState("Đang kích hoạt tài khoản...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Liên kết kích hoạt không hợp lệ hoặc đã bị thiếu token.");
      return;
    }

    const activateAccount = async () => {
      try {
        const response = await api.post("/activate-account", {
          token,
        });

        setStatus("success");
        setMessage(response.data?.message || "Kích hoạt tài khoản thành công.");
      } catch (error: any) {
        console.error("Lỗi kích hoạt tài khoản:", error);

        const detail =
          error.response?.data?.detail ||
          "Không thể kích hoạt tài khoản. Liên kết có thể đã hết hạn hoặc đã được sử dụng.";

        setStatus("error");
        setMessage(detail);
      }
    };

    activateAccount();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f6fb",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "500px",
          background: "#ffffff",
          borderRadius: "20px",
          padding: "40px 32px",
          textAlign: "center",
          boxShadow: "0 15px 40px rgba(0, 0, 0, 0.12)",
        }}
      >
        <div
          style={{
            fontSize: "56px",
            marginBottom: "20px",
          }}
        >
          {status === "loading" ? "⏳" : status === "success" ? "✅" : "❌"}
        </div>

        <h1
          style={{
            marginBottom: "12px",
            color:
              status === "success"
                ? "#16a34a"
                : status === "error"
                  ? "#dc2626"
                  : "#1d4ed8",
          }}
        >
          {status === "loading"
            ? "Đang kích hoạt tài khoản"
            : status === "success"
              ? "Kích hoạt thành công"
              : "Kích hoạt thất bại"}
        </h1>

        <p
          style={{
            color: "#555",
            lineHeight: 1.6,
            marginBottom: "28px",
          }}
        >
          {message}
        </p>

        {status === "loading" && (
          <p
            style={{
              color: "#777",
              fontSize: "14px",
            }}
          >
            Vui lòng chờ trong giây lát...
          </p>
        )}

        {status === "success" && (
          <button
            type="button"
            onClick={() => {
              window.location.replace("/");
            }}
            style={{
              width: "100%",
              padding: "13px 20px",
              border: "none",
              borderRadius: "10px",
              background: "#2563eb",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đi đến trang đăng nhập
          </button>
        )}

        {status === "error" && (
          <button
            type="button"
            onClick={() => {
              window.location.replace("/");
            }}
            style={{
              width: "100%",
              padding: "13px 20px",
              border: "none",
              borderRadius: "10px",
              background: "#2563eb",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Quay lại trang đăng nhập
          </button>
        )}
      </div>
    </div>
  );
}

// ===========================================================
// APP
// ===========================================================

function App() {
  // =========================================================
  // PATH HIỆN TẠI
  // =========================================================

  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // =========================================================
  // THEO DÕI THAY ĐỔI URL
  // =========================================================

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // =========================================================
  // HÀM ĐIỀU HƯỚNG
  // =========================================================

  const navigate = (path: string) => {
    if (window.location.pathname === path) {
      setCurrentPath(path);
      return;
    }

    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  // =========================================================
  // USER HIỆN TẠI
  // =========================================================

  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
      return null;
    }

    try {
      const parsedUser = JSON.parse(savedUser);

      // -----------------------------------------------------
      // KIỂM TRA SESSION FRONTEND
      // -----------------------------------------------------

      if (parsedUser.expiresAt && Date.now() >= parsedUser.expiresAt) {
        localStorage.removeItem("user");
        return null;
      }

      return {
        nguoiDungId: parsedUser.nguoiDungId,
        hoTen: parsedUser.hoTen,
        email: parsedUser.email,
        vaiTro: Array.isArray(parsedUser.vaiTro) ? parsedUser.vaiTro : [],
        quyen: Array.isArray(parsedUser.quyen) ? parsedUser.quyen : [],
        token: parsedUser.token || "",
        expiresAt: parsedUser.expiresAt || 0,
      };
    } catch (error) {
      console.error("Không thể đọc thông tin đăng nhập:", error);

      localStorage.removeItem("user");

      return null;
    }
  });

  // =========================================================
  // LOGIN STATE
  // =========================================================

  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [loginErrors, setLoginErrors] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const [loading, setLoading] = useState(false);

  // =========================================================
  // KHÓA NÚT LOGIN 15 PHÚT
  // =========================================================

  const [loginLockedUntil, setLoginLockedUntil] = useState<number | null>(null);

  const [lockRemaining, setLockRemaining] = useState(0);

  // =========================================================
  // KIỂM TRA EMAIL ĐANG BỊ KHÓA
  // =========================================================

  const checkLoginLock = (emailValue: string) => {
    const normalizedEmail = emailValue.trim().toLowerCase();

    if (!normalizedEmail) {
      setLoginLockedUntil(null);
      setLockRemaining(0);
      return;
    }

    const storageKey = `loginLockedUntil:${normalizedEmail}`;

    const savedLock = localStorage.getItem(storageKey);

    if (!savedLock) {
      setLoginLockedUntil(null);
      setLockRemaining(0);
      return;
    }

    const lockUntil = Number(savedLock);

    if (!Number.isFinite(lockUntil)) {
      localStorage.removeItem(storageKey);

      setLoginLockedUntil(null);
      setLockRemaining(0);

      return;
    }

    if (Date.now() >= lockUntil) {
      localStorage.removeItem(storageKey);

      setLoginLockedUntil(null);
      setLockRemaining(0);

      return;
    }

    setLoginLockedUntil(lockUntil);

    setLockRemaining(Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000)));
  };

  // =========================================================
  // KIỂM TRA KHÓA KHI EMAIL THAY ĐỔI
  // =========================================================

  useEffect(() => {
    checkLoginLock(email);
  }, [email]);

  // =========================================================
  // ĐẾM NGƯỢC
  // =========================================================

  useEffect(() => {
    if (!loginLockedUntil) {
      setLockRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(
        0,
        Math.ceil((loginLockedUntil - Date.now()) / 1000),
      );

      setLockRemaining(remaining);

      if (remaining <= 0) {
        const normalizedEmail = email.trim().toLowerCase();

        if (normalizedEmail) {
          localStorage.removeItem(`loginLockedUntil:${normalizedEmail}`);
        }

        setLoginLockedUntil(null);
        setLockRemaining(0);
      }
    };

    updateRemaining();

    const timer = window.setInterval(updateRemaining, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loginLockedUntil, email]);

  // =========================================================
  // FORMAT THỜI GIAN
  // =========================================================

  const formatLockRemaining = () => {
    const minutes = Math.floor(lockRemaining / 60);

    const seconds = lockRemaining % 60;

    return `${String(minutes).padStart(
      2,
      "0",
    )}:${String(seconds).padStart(2, "0")}`;
  };

  // =========================================================
  // ĐĂNG NHẬP
  // =========================================================

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading || loginLockedUntil !== null) {
      return;
    }

    setMessage("");
    setMessageType("");

    // -------------------------------------------------------
    // VALIDATE
    // -------------------------------------------------------

    const newErrors = {
      email: "",
      password: "",
    };

    if (!email.trim()) {
      newErrors.email = "Vui lòng nhập email";
    }

    if (!password.trim()) {
      newErrors.password = "Vui lòng nhập mật khẩu";
    }

    setLoginErrors(newErrors);

    if (newErrors.email || newErrors.password) {
      return;
    }

    try {
      setLoading(true);

      // -----------------------------------------------------
      // LOGIN API
      // -----------------------------------------------------

      const response = await api.post("/login", {
        email: email.trim(),
        password,
      });

      const data = response.data;

      // -----------------------------------------------------
      // KIỂM TRA TOKEN
      // -----------------------------------------------------

      if (!data.access_token) {
        setMessage("Đăng nhập thành công nhưng không nhận được access token");

        setMessageType("error");

        return;
      }

      // -----------------------------------------------------
      // LOGIN THÀNH CÔNG
      // -----------------------------------------------------

      const normalizedEmail = email.trim().toLowerCase();

      localStorage.removeItem(`loginLockedUntil:${normalizedEmail}`);

      setLoginLockedUntil(null);
      setLockRemaining(0);

      const vaiTro: VaiTro[] = Array.isArray(data.vaiTro) ? data.vaiTro : [];

      const quyen: Quyen[] = Array.isArray(data.quyen) ? data.quyen : [];

      // -----------------------------------------------------
      // TẠO USER
      // -----------------------------------------------------

      const loggedInUser: User = {
        nguoiDungId: data.nguoiDungId,
        hoTen: data.hoTen,
        email: data.email,
        vaiTro,
        quyen,
        token: data.access_token,

        // JWT hiện tại: 30 phút
        expiresAt: Date.now() + 30 * 60 * 1000,
      };

      // -----------------------------------------------------
      // LƯU SESSION
      // -----------------------------------------------------

      localStorage.setItem("user", JSON.stringify(loggedInUser));

      setMessage(data.message || "Đăng nhập thành công");

      setMessageType("success");

      setUser(loggedInUser);

      // -----------------------------------------------------
      // LUÔN VỀ TRANG CHỦ
      // -----------------------------------------------------

      window.history.replaceState({}, "", "/");

      setCurrentPath("/");
    } catch (error: any) {
      console.error("Lỗi đăng nhập:", error);

      const status = error.response?.status;

      const detail =
        error.response?.data?.detail || "Email hoặc mật khẩu không đúng";

      // -----------------------------------------------------
      // KHÓA 15 PHÚT
      // -----------------------------------------------------

      if (status === 423) {
        const normalizedEmail = email.trim().toLowerCase();

        const lockUntil = Date.now() + 15 * 60 * 1000;

        localStorage.setItem(
          `loginLockedUntil:${normalizedEmail}`,
          String(lockUntil),
        );

        setLoginLockedUntil(lockUntil);

        setLockRemaining(15 * 60);

        setMessage(
          "Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau khoảng 15 phút.",
        );

        setMessageType("error");

        return;
      }

      // -----------------------------------------------------
      // SAI LOGIN
      // -----------------------------------------------------

      setMessage(detail);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // ĐIỀU HƯỚNG QUẢN LÝ VAI TRÒ
  // =========================================================

  const handleRoleManagement = () => {
    if (!hasPermission(user, "ROLE_VIEW")) {
      navigate("/");
      return;
    }

    navigate("/quan-ly-vai-tro");
  };

  // =========================================================
  // ĐĂNG XUẤT
  // =========================================================

  const handleLogout = async () => {
    try {
      if (user?.token) {
        await api.post("/logout");
      }
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    } finally {
      localStorage.removeItem("user");

      setUser(null);

      setEmail("");

      setPassword("");

      setMessage("");

      setMessageType("");

      setLoginErrors({
        email: "",
        password: "",
      });

      setShowPassword(false);

      setLoginLockedUntil(null);

      setLockRemaining(0);

      window.location.replace("/");
    }
  };

  // =========================================================
  // KÍCH HOẠT TÀI KHOẢN
  // =========================================================

  if (currentPath === "/activate-account") {
    return <ActivateAccountPage />;
  }

  // =========================================================
  // RESET PASSWORD
  // =========================================================

  if (currentPath === "/reset-password") {
    return <ResetPassword />;
  }

  // =========================================================
  // QUÊN MẬT KHẨU
  // =========================================================

  if (!user && isForgotPassword) {
    return <ForgotPassword />;
  }

  // =========================================================
  // CHƯA ĐĂNG NHẬP
  // =========================================================

  if (!user) {
    const isLoginDisabled = loading || loginLockedUntil !== null;

    return (
      <div className="login-page">
        <div className="login-container">
          {/* =================================================
              FORM LOGIN
          ================================================= */}

          <section className="login-form-section">
            <div className="brand">
              <div className="brand-icon">🎓</div>

              <h1>
                Hệ thống quản lý <span>đào tạo</span>
              </h1>
            </div>

            <p className="subtitle">
              Đăng nhập để truy cập và quản lý các chức năng của hệ thống
            </p>

            {/* MESSAGE */}

            {message && (
              <div
                className={
                  messageType === "success"
                    ? "message success-message"
                    : "message api-error-message"
                }
              >
                {message}
              </div>
            )}

            {/* FORM */}

            <form className="login-form" onSubmit={handleLogin}>
              {/* EMAIL */}

              <div className="form-group">
                <label>Email</label>

                <div className="input-wrapper">
                  <span className="input-icon">✉️</span>

                  <input
                    type="email"
                    placeholder="Nhập email"
                    value={email}
                    onChange={(e) => {
                      const newEmail = e.target.value;

                      setEmail(newEmail);

                      setLoginErrors({
                        ...loginErrors,
                        email: "",
                      });

                      checkLoginLock(newEmail);
                    }}
                  />
                </div>

                {loginErrors.email && (
                  <p className="error-message">{loginErrors.email}</p>
                )}
              </div>

              {/* PASSWORD */}

              <div className="form-group">
                <label>Mật khẩu</label>

                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>

                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);

                      setLoginErrors({
                        ...loginErrors,
                        password: "",
                      });
                    }}
                  />

                  <button
                    type="button"
                    className="show-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>

                {loginErrors.password && (
                  <p className="error-message">{loginErrors.password}</p>
                )}
              </div>

              {/* OPTIONS */}

              <div className="login-options">
                <label className="remember">
                  <input type="checkbox" />

                  <span>Ghi nhớ đăng nhập</span>
                </label>

                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();

                    setIsForgotPassword(true);
                  }}
                >
                  Quên mật khẩu?
                </a>
              </div>

              {/* LOGIN BUTTON */}

              <button
                type="submit"
                className="login-button"
                disabled={isLoginDisabled}
                style={{
                  opacity: isLoginDisabled ? 0.55 : 1,

                  cursor: isLoginDisabled ? "not-allowed" : "pointer",
                }}
              >
                <span>→</span>

                {loading
                  ? "Đang đăng nhập..."
                  : loginLockedUntil !== null
                    ? `Đăng nhập lại sau ${formatLockRemaining()}`
                    : "Đăng nhập"}
              </button>

              {/* DIVIDER */}

              <div className="divider">
                <span></span>

                <p>hoặc</p>

                <span></span>
              </div>

              {/* SCHOOL LOGIN */}

              <button type="button" className="school-login">
                👥
                <span>Đăng nhập bằng tài khoản trường</span>
              </button>
            </form>
          </section>

          {/* =================================================
              GIỚI THIỆU
          ================================================= */}

          <section className="information-section">
            <div className="overlay"></div>

            <div className="information-content">
              <h2>
                Quản lý đào tạo
                <br />
                hiệu quả hơn
              </h2>

              <p className="description">
                Hỗ trợ quản lý sinh viên, giảng viên, khóa học và các hoạt động
                đào tạo một cách dễ dàng, nhanh chóng và chính xác.
              </p>

              <div className="features">
                <Feature
                  icon="🎓"
                  title="Quản lý khóa học"
                  description="Tổ chức và quản lý các chương trình đào tạo"
                />

                <Feature
                  icon="👥"
                  title="Quản lý sinh viên"
                  description="Theo dõi thông tin và quá trình học tập"
                />

                <Feature
                  icon="📅"
                  title="Quản lý lịch học"
                  description="Sắp xếp thời khóa biểu linh hoạt"
                />

                <Feature
                  icon="📊"
                  title="Thống kê - Báo cáo"
                  description="Cung cấp báo cáo chi tiết, trực quan"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // =========================================================
  // TỪ ĐÂY TRỞ XUỐNG: USER ĐÃ ĐĂNG NHẬP
  // =========================================================

  const roleName =
    user.vaiTro && user.vaiTro.length > 0
      ? user.vaiTro.map((role) => role.tenVaiTro).join(", ")
      : "Chưa có vai trò";

  // =========================================================
  // HỒ SƠ CÁ NHÂN
  // =========================================================

  if (currentPath === "/ho-so-ca-nhan") {
    return (
      <ProtectedRoute>
        <MainLayout
          userName={user.hoTen}
          email={user.email}
          roleName={roleName}
          permissions={user.quyen.map((q) => q.maQuyen)}
          onLogout={handleLogout}
        >
          <Profile user={user} onBack={() => navigate("/")} />
        </MainLayout>
      </ProtectedRoute>
    );
  }

  // =========================================================
  // ĐỔI MẬT KHẨU
  // =========================================================

  if (currentPath === "/change-password") {
    return (
      <ProtectedRoute>
        <ChangePassword />
      </ProtectedRoute>
    );
  }

  // =========================================================
  // ADMIN
  // =========================================================

  const isAdmin = isAdminUser(user);

  // =========================================================
  // QUẢN LÝ VAI TRÒ
  // =========================================================

  if (currentPath === "/quan-ly-vai-tro") {
    if (!hasPermission(user, "ROLE_VIEW")) {
      return <RedirectToHome />;
    }

    return (
      <ProtectedRoute requiredPermission="ROLE_VIEW">
        <AdminLayout
          userName={user.hoTen}
          roleName={roleName}
          permissions={user.quyen.map((q) => q.maQuyen)}
          onLogout={handleLogout}
          onRoleManagement={handleRoleManagement}
        >
          <RoleManagement />
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  // =========================================================
  // QUYỀN THEO PATH
  // =========================================================

  let requiredPermission: string | undefined;

  if (currentPath === "/quan-ly-diem") {
    requiredPermission = "QUAN_LY_DIEM";
  }

  if (currentPath === "/quan-ly-lop") {
    requiredPermission = "QUAN_LY_LOP";
  }

  if (currentPath === "/quan-ly-hoc-phi") {
    requiredPermission = "QUAN_LY_HOC_PHI";
  }

  // =========================================================
  // ADMIN DASHBOARD
  // =========================================================

  if (isAdmin) {
    return (
      <ProtectedRoute>
        <AdminLayout
          userName={user.hoTen}
          roleName={roleName}
          permissions={user.quyen.map((q) => q.maQuyen)}
          onLogout={handleLogout}
          onRoleManagement={handleRoleManagement}
        >
          {/* WELCOME */}

          <div className="admin-welcome">
            <div>
              <div className="admin-welcome-label">TỔNG QUAN HỆ THỐNG</div>

              <h2>Xin chào, Admin {user.hoTen}!</h2>

              <p>
                Chào mừng bạn đến với trang quản trị hệ thống quản lý đào tạo.
              </p>
            </div>

            <div className="admin-welcome-icon">🎓</div>
          </div>

          {/* STAT */}

          <div className="admin-stat-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-icon blue">👥</div>

              <div>
                <span>Người dùng</span>

                <strong>--</strong>

                <small>Dữ liệu hệ thống</small>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon purple">🛡️</div>

              <div>
                <span>Vai trò</span>

                <strong>{user.vaiTro.length}</strong>

                <small>Vai trò hiện tại</small>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon green">🔐</div>

              <div>
                <span>Quyền</span>

                <strong>{user.quyen.length}</strong>

                <small>Quyền được cấp</small>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon orange">⚙️</div>

              <div>
                <span>Trạng thái</span>

                <strong>Hoạt động</strong>

                <small>Tài khoản hiện tại</small>
              </div>
            </div>
          </div>

          {/* DASHBOARD */}

          <div className="admin-dashboard-grid">
            {/* HOẠT ĐỘNG */}

            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h3>Hoạt động gần đây</h3>

                  <p>Thông tin hoạt động của hệ thống</p>
                </div>
              </div>

              <div className="admin-activity">
                <div className="admin-activity-item">
                  <div className="activity-icon blue">🔑</div>

                  <div>
                    <strong>Đăng nhập hệ thống</strong>

                    <span>{user.hoTen} đã đăng nhập</span>

                    <small>Vừa mới đây</small>
                  </div>
                </div>

                <div className="admin-activity-item">
                  <div className="activity-icon green">👤</div>

                  <div>
                    <strong>Tài khoản đang hoạt động</strong>

                    <span>Tài khoản đang ở trạng thái hoạt động</span>

                    <small>Hiện tại</small>
                  </div>
                </div>

                <div className="admin-activity-item">
                  <div className="activity-icon purple">🛡️</div>

                  <div>
                    <strong>Phân quyền</strong>

                    <span>{user.quyen.length} quyền được cấp</span>

                    <small>Hiện tại</small>
                  </div>
                </div>
              </div>
            </div>

            {/* THAO TÁC NHANH */}

            <div className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h3>Thao tác nhanh</h3>

                  <p>Các chức năng thường dùng</p>
                </div>
              </div>

              <div className="admin-quick-actions">
                {/* ĐỔI MẬT KHẨU */}

                <button
                  type="button"
                  onClick={() => navigate("/change-password")}
                >
                  <span className="quick-blue">🔐</span>

                  <div>
                    <strong>Đổi mật khẩu</strong>

                    <small>Cập nhật mật khẩu tài khoản</small>
                  </div>

                  <b>→</b>
                </button>

                {/* QUẢN LÝ NGƯỜI DÙNG */}

                <button
                  type="button"
                  onClick={() => {
                    if (hasPermission(user, "USER_VIEW")) {
                      navigate("/quan-ly-nguoi-dung");
                    }
                  }}
                  disabled={!hasPermission(user, "USER_VIEW")}
                  style={{
                    opacity: hasPermission(user, "USER_VIEW") ? 1 : 0.5,
                  }}
                >
                  <span className="quick-purple">👥</span>

                  <div>
                    <strong>Quản lý người dùng</strong>

                    <small>Quản lý tài khoản hệ thống</small>
                  </div>

                  <b>→</b>
                </button>

                {/* VAI TRÒ & QUYỀN */}

                {hasPermission(user, "ROLE_VIEW") && (
                  <button type="button" onClick={handleRoleManagement}>
                    <span className="quick-green">🛡️</span>

                    <div>
                      <strong>Vai trò & quyền</strong>

                      <small>Quản lý phân quyền</small>
                    </div>

                    <b>→</b>
                  </button>
                )}

                {/* BÁO CÁO */}

                <button type="button">
                  <span className="quick-orange">📊</span>

                  <div>
                    <strong>Báo cáo</strong>

                    <small>Xem báo cáo hệ thống</small>
                  </div>

                  <b>→</b>
                </button>
              </div>
            </div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  // =========================================================
  // USER THƯỜNG
  // =========================================================

  return (
    <ProtectedRoute requiredPermission={requiredPermission}>
      <MainLayout
        userName={user.hoTen}
        email={user.email}
        roleName={roleName}
        permissions={user.quyen.map((q) => q.maQuyen)}
        onLogout={handleLogout}
      >
        <div className="user-dashboard">
          {/* =================================================
              WELCOME BANNER
          ================================================= */}

          <section className="dashboard-hero">
            <div className="dashboard-hero-content">
              <div className="dashboard-hero-label">
                HỆ THỐNG QUẢN LÝ ĐÀO TẠO
              </div>

              <h2>
                Xin chào, <span>{user.hoTen}</span> 👋
              </h2>

              <p>
                Chào mừng bạn quay trở lại. Chúc bạn có một ngày làm việc hiệu
                quả!
              </p>

              <div className="dashboard-hero-info">
                <div>
                  <span className="hero-info-label">Tài khoản</span>

                  <strong>{user.email}</strong>
                </div>

                <div>
                  <span className="hero-info-label">Vai trò</span>

                  <strong>{roleName}</strong>
                </div>
              </div>
            </div>

            <div className="dashboard-hero-decoration">
              <div className="hero-circle hero-circle-1"></div>

              <div className="hero-circle hero-circle-2"></div>

              <div className="hero-graduation">🎓</div>
            </div>
          </section>

          {/* =================================================
              STAT CARDS
          ================================================= */}

          <section className="dashboard-stat-grid">
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon blue">👤</div>

              <div className="dashboard-stat-content">
                <span>Tài khoản</span>

                <strong>Hoạt động</strong>

                <small>Trạng thái hiện tại</small>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon purple">🛡️</div>

              <div className="dashboard-stat-content">
                <span>Vai trò</span>

                <strong>{user.vaiTro.length}</strong>

                <small>Vai trò được cấp</small>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon green">🔐</div>

              <div className="dashboard-stat-content">
                <span>Quyền truy cập</span>

                <strong>{user.quyen.length}</strong>

                <small>Quyền được cấp</small>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon orange">🟢</div>

              <div className="dashboard-stat-content">
                <span>Phiên đăng nhập</span>

                <strong>Đang hoạt động</strong>

                <small>Bảo mật JWT</small>
              </div>
            </div>
          </section>

          {/* =================================================
              MAIN DASHBOARD GRID
          ================================================= */}

          <section className="dashboard-main-grid">
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <div>
                  <span className="panel-eyebrow">TRUY CẬP NHANH</span>

                  <h3>Chức năng của bạn</h3>

                  <p>Các chức năng được cấp theo vai trò và quyền truy cập.</p>
                </div>
              </div>

              <div className="dashboard-action-list">
                {/* =================================================
                    HỒ SƠ CÁ NHÂN
                ================================================= */}

                <button
                  type="button"
                  className="dashboard-action"
                  onClick={() => navigate("/ho-so-ca-nhan")}
                >
                  <div className="dashboard-action-icon blue">👤</div>

                  <div className="dashboard-action-content">
                    <strong>Hồ sơ cá nhân</strong>

                    <span>Xem và cập nhật thông tin cá nhân</span>
                  </div>

                  <div className="dashboard-action-arrow">→</div>
                </button>

                {/* =================================================
                    ĐỔI MẬT KHẨU
                ================================================= */}

                <button
                  type="button"
                  className="dashboard-action"
                  onClick={() => navigate("/change-password")}
                >
                  <div className="dashboard-action-icon purple">🔐</div>

                  <div className="dashboard-action-content">
                    <strong>Đổi mật khẩu</strong>

                    <span>Cập nhật mật khẩu để bảo vệ tài khoản</span>
                  </div>

                  <div className="dashboard-action-arrow">→</div>
                </button>

                {/* =================================================
                    QUẢN LÝ ĐIỂM
                ================================================= */}

                {hasPermission(user, "QUAN_LY_DIEM") && (
                  <button
                    type="button"
                    className="dashboard-action"
                    onClick={() => navigate("/quan-ly-diem")}
                  >
                    <div className="dashboard-action-icon green">📊</div>

                    <div className="dashboard-action-content">
                      <strong>Quản lý điểm</strong>

                      <span>Xem và quản lý thông tin điểm</span>
                    </div>

                    <div className="dashboard-action-arrow">→</div>
                  </button>
                )}

                {/* =================================================
                    QUẢN LÝ LỚP
                ================================================= */}

                {hasPermission(user, "QUAN_LY_LOP") && (
                  <button
                    type="button"
                    className="dashboard-action"
                    onClick={() => navigate("/quan-ly-lop")}
                  >
                    <div className="dashboard-action-icon orange">🏫</div>

                    <div className="dashboard-action-content">
                      <strong>Quản lý lớp</strong>

                      <span>Xem và quản lý thông tin lớp học</span>
                    </div>

                    <div className="dashboard-action-arrow">→</div>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* =================================================
              BOTTOM INFORMATION
          ================================================= */}

          <section className="dashboard-bottom-grid">
            <div className="dashboard-info-card">
              <div className="info-card-icon">🎓</div>

              <div>
                <span>EDUMANAGE</span>

                <h3>Hệ thống quản lý đào tạo</h3>

                <p>
                  Quản lý thông tin đào tạo, người dùng, lớp học và các hoạt
                  động học tập một cách hiệu quả và chính xác.
                </p>
              </div>
            </div>

            <div className="dashboard-info-card system-card">
              <div className="system-status-dot"></div>

              <div>
                <span>TRẠNG THÁI HỆ THỐNG</span>

                <h3>Hệ thống đang hoạt động</h3>

                <p>Các dịch vụ chính đang hoạt động bình thường.</p>
              </div>

              <div className="system-online">● Online</div>
            </div>
          </section>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}

// ===========================================================
// FEATURE COMPONENT
// ===========================================================

interface FeatureProps {
  icon: string;
  title: string;
  description: string;
}

function Feature({ icon, title, description }: FeatureProps) {
  return (
    <div className="feature">
      <div className="feature-icon">{icon}</div>

      <div>
        <h3>{title}</h3>

        <p>{description}</p>
      </div>
    </div>
  );
}

export default App;
