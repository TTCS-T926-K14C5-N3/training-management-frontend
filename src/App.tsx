import React, { useState } from "react";
import "./App.css";

import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleManagement from "./pages/RoleManagement";

import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import { testPermission } from "./services/permissionService";
import api from "./services/api"; // Đã thêm trạm kiểm soát Axios

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
// KIỂM TRA QUYỀN VÀ ADMIN
// ===========================================================

function hasPermission(user: User | null, maQuyen: string): boolean {
  if (!user) return false;
  return user.quyen.some((quyen) => quyen.maQuyen === maQuyen);
}

function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  return user.vaiTro.some((role) => {
    const roleName = role.tenVaiTro.trim().toLowerCase();
    return roleName === "admin" || roleName === "quản trị hệ thống";
  });
}

// ===========================================================
// APP COMPONENT
// ===========================================================

function App() {
  // =========================================================
  // USER HIỆN TẠI
  // =========================================================
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return null;

    try {
      const parsedUser = JSON.parse(savedUser);
      // KIỂM TRA PHIÊN ĐĂNG NHẬP
      if (parsedUser.expiresAt && Date.now() >= parsedUser.expiresAt) {
        localStorage.removeItem("user");
        return null;
      }
      // CHUẨN HÓA USER
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
  // CÁC STATE CỦA FORM
  // =========================================================
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [loading, setLoading] = useState(false);

  // =========================================================
  // KIỂM TRA QUYỀN TEST
  // =========================================================
  const handleTestPermission = async () => {
    if (!user) return;
    try {
      const data = await testPermission(user.token);
      setMessage(data.message || "Bạn có quyền USER_CREATE");
      setMessageType("success");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Đã xảy ra lỗi.";
      setMessage(errorMessage);
      setMessageType("error");
    }
  };

  // =========================================================
  // ĐĂNG NHẬP (ĐÃ CHUYỂN SANG DÙNG API.TS)
  // =========================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setMessageType("");

    // 1. VALIDATE RỖNG
    const newErrors = { email: "", password: "" };
    if (!email.trim()) newErrors.email = "Vui lòng nhập email";
    if (!password.trim()) newErrors.password = "Vui lòng nhập mật khẩu";

    setLoginErrors(newErrors);
    if (newErrors.email || newErrors.password) return;

    // 2. GỌI API LOGIN BẰNG AXIOS
    try {
      setLoading(true);

      // Trạm kiểm soát api.ts sẽ tự gọi đúng baseURL và tự bắt lỗi 401/403/422
      const response = await api.post('/login', {
        email: email.trim(),
        password: password,
      });

      const data = response.data;

      // 3. XỬ LÝ KHI LOGIN THÀNH CÔNG
      if (!data.access_token) {
        setMessage("Đăng nhập thành công nhưng không nhận được access token");
        setMessageType("error");
        return;
      }

      const vaiTro: VaiTro[] = Array.isArray(data.vaiTro) ? data.vaiTro : [];
      const quyen: Quyen[] = Array.isArray(data.quyen) ? data.quyen : [];

// Lấy dữ liệu và lưu vào Local Storage
      const loggedInUser: User = {
        nguoiDungId: data.nguoiDungId,
        hoTen: data.hoTen,
        email: data.email,
        vaiTro: vaiTro,
        quyen: quyen,
        token: data.access_token,
        expiresAt: Date.now() + 30 * 60 * 1000,
      };

      localStorage.setItem("user", JSON.stringify(loggedInUser));

      // Hiển thị thông báo lên Form Đăng nhập
      setMessage(data.message || "Đăng nhập thành công");
      setMessageType("success");

      // Dùng setTimeout tạo độ trễ 1 giây (1000ms) để người dùng kịp đọc thông báo
      // Sau 1 giây mới gọi setUser() để chuyển trang
      setTimeout(() => {
        setUser(loggedInUser);
      }, 1000);

    } catch (error: any) {
      // 4. LOGIN THẤT BẠI
      console.error("Lỗi đăng nhập:", error);
      // Lấy câu thông báo lỗi chính xác từ Backend (VD: Sai mật khẩu)
      setMessage(error.response?.data?.detail || "Email hoặc mật khẩu không đúng");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // ĐĂNG XUẤT (ĐÃ CHUYỂN SANG DÙNG API.TS)
  // =========================================================
  const handleLogout = async () => {
    try {
      if (user?.token) {
        // Gọi API xóa phiên làm việc (api.ts tự động đính kèm Token)
        await api.post('/logout');
      }
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    } finally {
      // Dọn dẹp dữ liệu ở Frontend bất kể Backend báo gì
      localStorage.removeItem("user");
      setUser(null);
      setEmail("");
      setPassword("");
      setMessage("");
      setMessageType("");
      setLoginErrors({ email: "", password: "" });
      setShowPassword(false);
    }
  };

  // =========================================================
  // LUỒNG ĐIỀU HƯỚNG GIAO DIỆN
  // =========================================================
  if (window.location.pathname === "/reset-password") {
    return <ResetPassword />;
  }

  // NẾU ĐÃ ĐĂNG NHẬP: HIỂN THỊ GIAO DIỆN CHÍNH
  if (user) {
    if (window.location.pathname === "/change-password") {
      return (
        <ProtectedRoute>
          <ChangePassword />
        </ProtectedRoute>
      );
    }

    const roleName = user.vaiTro && user.vaiTro.length > 0
      ? user.vaiTro.map((role) => role.tenVaiTro).join(", ")
      : "Chưa có vai trò";
if (window.location.pathname === "/quan-ly-vai-tro") {
  return (
    <ProtectedRoute>
      <AdminLayout
        userName={user.hoTen}
        roleName={roleName}
        permissions={user.quyen.map((q) => q.maQuyen)}
        onLogout={handleLogout}
      >
        <RoleManagement />
      </AdminLayout>
    </ProtectedRoute>
  );
}
    const currentPath = window.location.pathname;
    let requiredPermission: string | undefined;

    if (currentPath === "/quan-ly-diem") requiredPermission = "QUAN_LY_DIEM";
    if (currentPath === "/quan-ly-lop") requiredPermission = "QUAN_LY_LOP";
    if (currentPath === "/quan-ly-hoc-phi") requiredPermission = "QUAN_LY_HOC_PHI";

    const isAdmin = isAdminUser(user);

    // GIAO DIỆN ADMIN
    if (isAdmin) {
      return (
        <ProtectedRoute>
          <AdminLayout
            userName={user.hoTen}
            roleName={roleName}
            permissions={user.quyen.map((q) => q.maQuyen)}
            onLogout={handleLogout}
          >
            <div className="admin-welcome">
              <div>
                <div className="admin-welcome-label">TỔNG QUAN HỆ THỐNG</div>
                <h2>Xin chào, Admin {user.hoTen}!</h2>
                <p>Chào mừng bạn đến với trang quản trị hệ thống quản lý đào tạo.</p>
              </div>
              <div className="admin-welcome-icon">🎓</div>
            </div>

            <div className="admin-stat-grid">
              <div className="admin-stat-card">
                <div className="admin-stat-icon blue">👥</div>
                <div><span>Người dùng</span><strong>--</strong><small>Dữ liệu hệ thống</small></div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon purple">🛡️</div>
                <div><span>Vai trò</span><strong>{user.vaiTro.length}</strong><small>Vai trò hiện tại</small></div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon green">🔐</div>
                <div><span>Quyền</span><strong>{user.quyen.length}</strong><small>Quyền được cấp</small></div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon orange">⚙️</div>
                <div><span>Trạng thái</span><strong>Hoạt động</strong><small>Tài khoản hiện tại</small></div>
              </div>
            </div>

            <div className="admin-dashboard-grid">
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div><h3>Hoạt động gần đây</h3><p>Thông tin hoạt động của hệ thống</p></div>
                </div>
                <div className="admin-activity">
                  <div className="admin-activity-item">
                    <div className="activity-icon blue">🔑</div>
                    <div><strong>Đăng nhập hệ thống</strong><span>{user.hoTen} đã đăng nhập</span><small>Vừa mới đây</small></div>
                  </div>
                  <div className="admin-activity-item">
                    <div className="activity-icon green">👤</div>
                    <div><strong>Tài khoản đang hoạt động</strong><span>Tài khoản đang ở trạng thái hoạt động</span><small>Hiện tại</small></div>
                  </div>
                  <div className="admin-activity-item">
                    <div className="activity-icon purple">🛡️</div>
                    <div><strong>Phân quyền</strong><span>{user.quyen.length} quyền được cấp</span><small>Hiện tại</small></div>
                  </div>
                </div>
              </div>

              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div><h3>Thao tác nhanh</h3><p>Các chức năng thường dùng</p></div>
                </div>
                <div className="admin-quick-actions">
                  <button type="button" onClick={() => { window.location.href = "/change-password"; }}>
                    <span className="quick-blue">🔐</span><div><strong>Đổi mật khẩu</strong><small>Cập nhật mật khẩu tài khoản</small></div><b>→</b>
                  </button>
                  <button type="button">
                    <span className="quick-purple">👥</span><div><strong>Quản lý người dùng</strong><small>Quản lý tài khoản hệ thống</small></div><b>→</b>
                  </button>
                  <button type="button">
                    <span className="quick-green">🛡️</span><div><strong>Vai trò & quyền</strong><small>Quản lý phân quyền</small></div><b>→</b>
                  </button>
                  <button type="button">
                    <span className="quick-orange">📊</span><div><strong>Báo cáo</strong><small>Xem báo cáo hệ thống</small></div><b>→</b>
                  </button>
                </div>
              </div>
            </div>
          </AdminLayout>
        </ProtectedRoute>
      );
    }

    // GIAO DIỆN USER THƯỜNG
    return (
      <ProtectedRoute requiredPermission={requiredPermission}>
        <MainLayout
          userName={user.hoTen}
          roleName={roleName}
          permissions={user.quyen.map((q) => q.maQuyen)}
          onLogout={handleLogout}
        >
          <div className="dashboard-welcome">
            <h2>Xin chào, {user.hoTen}!</h2>
            <p>Chào mừng bạn đến với hệ thống quản lý đào tạo.</p>

            <div style={{ marginTop: "25px", padding: "20px", background: "white", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
              <h3>Thông tin tài khoản</h3>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Vai trò:</strong> {roleName}</p>
              <p><strong>Số quyền:</strong> {user.quyen.length}</p>
            </div>
          </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  if (isForgotPassword) {
    return <ForgotPassword />;
  }

  // =========================================================
  // GIAO DIỆN LOGIN (NẾU CHƯA ĐĂNG NHẬP)
  // =========================================================
  return (
    <div className="login-page">
      <div className="login-container">
        {/* TRÁI: FORM ĐĂNG NHẬP */}
        <section className="login-form-section">
          <div className="brand">
            <div className="brand-icon">🎓</div>
            <h1>Hệ thống quản lý <span>đào tạo</span></h1>
          </div>

          <p className="subtitle">
            Đăng nhập để truy cập và quản lý các chức năng của hệ thống
          </p>

          {message && (
            <div className={messageType === "success" ? "message success-message" : "message api-error-message"}>
              {message}
            </div>
          )}

          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
              <div className="input-wrapper">
                <span className="input-icon">✉️</span>
                <input
                  type="email"
                  placeholder="Nhập email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setLoginErrors({ ...loginErrors, email: "" });
                  }}
                />
              </div>
              {loginErrors.email && <p className="error-message">{loginErrors.email}</p>}
            </div>

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
                    setLoginErrors({ ...loginErrors, password: "" });
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
              {loginErrors.password && <p className="error-message">{loginErrors.password}</p>}
            </div>

            <div className="login-options">
              <label className="remember">
                <input type="checkbox" />
                <span>Ghi nhớ đăng nhập</span>
              </label>
              <a href="#" onClick={(e) => { e.preventDefault(); setIsForgotPassword(true); }}>
                Quên mật khẩu?
              </a>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              <span>→</span>
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            <div className="divider">
              <span></span>
              <p>hoặc</p>
              <span></span>
            </div>

            <button type="button" className="school-login">
              👥<span>Đăng nhập bằng tài khoản trường</span>
            </button>
          </form>
        </section>

        {/* PHẢI: GIỚI THIỆU */}
        <section className="information-section">
          <div className="overlay"></div>
          <div className="information-content">
            <h2>Quản lý đào tạo<br />hiệu quả hơn</h2>
            <p className="description">
              Hỗ trợ quản lý sinh viên, giảng viên, khóa học và các hoạt động đào tạo một cách dễ dàng, nhanh chóng và chính xác.
            </p>
            <div className="features">
              <Feature icon="🎓" title="Quản lý khóa học" description="Tổ chức và quản lý các chương trình đào tạo" />
              <Feature icon="👥" title="Quản lý sinh viên" description="Theo dõi thông tin và quá trình học tập" />
              <Feature icon="📅" title="Quản lý lịch học" description="Sắp xếp thời khóa biểu linh hoạt" />
              <Feature icon="📊" title="Thống kê - Báo cáo" description="Cung cấp báo cáo chi tiết, trực quan" />
            </div>
          </div>
        </section>
      </div>
    </div>
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