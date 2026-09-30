import { useState } from "react";
import "./App.css";
import ProtectedRoute from "./routes/ProtectedRoute";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
    const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
      return null;
    }

    try {
      return JSON.parse(savedUser);
    } catch {
      localStorage.removeItem("user");
      return null;
    }
  });
  // =========================================================
  // CHUYỂN LOGIN / REGISTER
  // =========================================================
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  // =========================================================
  // HIỆN / ẨN MẬT KHẨU
  // =========================================================
  const [showPassword, setShowPassword] = useState(false);

  // =========================================================
  // LOGIN
  // =========================================================
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginErrors, setLoginErrors] = useState({
    email: "",
    password: "",
  });

  // =========================================================
  // REGISTER
  // =========================================================
  const [hoTen, setHoTen] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [soDienThoai, setSoDienThoai] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [registerErrors, setRegisterErrors] = useState({
    hoTen: "",
    email: "",
    soDienThoai: "",
    password: "",
    confirmPassword: "",
  });

  // =========================================================
  // MESSAGE + LOADING
  // =========================================================
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const [loading, setLoading] = useState(false);

  // =========================================================
  // ĐĂNG NHẬP
  // =========================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("");
    setMessageType("");

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

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Đăng nhập không thành công");

        setMessageType("error");
        return;
      }

      setMessage(data.message || "Đăng nhập thành công");
      setMessageType("success");

      // Lưu thông tin người dùng tạm thời
      localStorage.setItem(
        "user",
        JSON.stringify({
          nguoiDungId: data.nguoiDungId,
          hoTen: data.hoTen,
          email: data.email,
          vaiTro: data.vaiTro,
       // phiên hết hạn sau 30 phút
          expiresAt: Date.now() + 30 * 60 * 1000,
        }),
      );
       setUser({
          nguoiDungId: data.nguoiDungId,
          hoTen: data.hoTen,
          email: data.email,
            vaiTro: data.vaiTro,
       });
      console.log("Đăng nhập thành công:", data);

      /*
        Sau này khi có trang Dashboard:
        window.location.href = "/dashboard";
      */
    } catch (error) {
      console.error(error);

      setMessage("Không thể kết nối tới máy chủ");

      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // ĐĂNG KÝ
  // =========================================================
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("");
    setMessageType("");

    const newErrors = {
      hoTen: "",
      email: "",
      soDienThoai: "",
      password: "",
      confirmPassword: "",
    };

    // Họ tên
    if (!hoTen.trim()) {
      newErrors.hoTen = "Vui lòng nhập họ và tên";
    }

    // Email
    if (!registerEmail.trim()) {
      newErrors.email = "Vui lòng nhập email";
    }

    // Số điện thoại
    if (!soDienThoai.trim()) {
      newErrors.soDienThoai = "Vui lòng nhập số điện thoại";
    } else if (!/^[0-9]{10,11}$/.test(soDienThoai)) {
      newErrors.soDienThoai = "Số điện thoại không hợp lệ";
    }

    // Mật khẩu
    if (!registerPassword.trim()) {
      newErrors.password = "Vui lòng nhập mật khẩu";
    } else if (registerPassword.length < 6) {
      newErrors.password = "Mật khẩu phải có ít nhất 6 ký tự";
    }

    // Xác nhận mật khẩu
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = "Vui lòng xác nhận mật khẩu";
    } else if (registerPassword !== confirmPassword) {
      newErrors.confirmPassword = "Mật khẩu xác nhận không khớp";
    }

    setRegisterErrors(newErrors);

    if (
      newErrors.hoTen ||
      newErrors.email ||
      newErrors.soDienThoai ||
      newErrors.password ||
      newErrors.confirmPassword
    ) {
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/register`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          ho_ten: hoTen.trim(),
          email: registerEmail.trim(),
          so_dien_thoai: soDienThoai.trim(),
          password: registerPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Đăng ký không thành công");

        setMessageType("error");
        return;
      }

      // =====================================================
      // ĐĂNG KÝ THÀNH CÔNG
      // =====================================================

      setMessage("Đăng ký thành công. Vui lòng đăng nhập.");

      setMessageType("success");

      // Đưa email vừa đăng ký sang form Login
      setEmail(registerEmail);

      // Reset form đăng ký
      setHoTen("");
      setRegisterEmail("");
      setSoDienThoai("");
      setRegisterPassword("");
      setConfirmPassword("");

      // Chuyển về Login
      setIsRegister(false);

      setShowPassword(false);
    } catch (error) {
      console.error(error);

      setMessage("Không thể kết nối tới máy chủ");

      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // CHUYỂN FORM
  // =========================================================
  const openRegister = () => {
    setIsRegister(true);

    setMessage("");
    setMessageType("");
    setShowPassword(false);
  };

  const openLogin = () => {
    setIsRegister(false);

    setMessage("");
    setMessageType("");
    setShowPassword(false);
  };

  // ========================================================= 
// GIAO DIỆN 
 
// ========================================================= 

if (user) {
    if (window.location.pathname === "/change-password") {
      return (
        <ProtectedRoute>
          <ChangePassword />
        </ProtectedRoute>
      );
    }

    return (
      <ProtectedRoute>
        <div style={{ padding: "40px" }}>
          <h1>Hệ thống quản lý đào tạo</h1>
          <p>Xin chào, {user.hoTen}</p>
          <p>Email: {user.email}</p>
          <p>Vai trò: {user.vaiTro}</p>
          
          <button
            onClick={() => {
              localStorage.removeItem("user");
              setUser(null);
            }}
          >
            Đăng xuất
          </button>

          <button
            style={{ marginLeft: '10px' }}
            onClick={() => window.location.href = "/change-password"}
          >
            Đổi mật khẩu
          </button>
        </div>
      </ProtectedRoute>
    );
  }
  
if (isForgotPassword) {
  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsForgotPassword(false)}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          padding: '8px 16px',
          cursor: 'pointer',
          backgroundColor: '#f0f0f0',
          border: '1px solid #ccc',
          borderRadius: '6px',
          fontSize: '14px',
          zIndex: 10
        }}
      >
        ← Quay lại đăng nhập
      </button>
      <ForgotPassword />
    </div>
  );
}

return (
  <div className="login-page"> 
    <div className="login-container"> 
      {/* =================================================== 
          LEFT 
      =================================================== */} 
      <section className="login-form-section"> 
        <div className="brand"> 
          <div className="brand-icon">🎓</div> 

          <h1> 
            Hệ thống quản lý <span>đào tạo</span> 
          </h1> 
        </div> 

        <p className={`subtitle ${isRegister ? "register-subtitle" : ""}`}> 
          {isRegister 
            ? "Tạo tài khoản để sử dụng hệ thống quản lý đào tạo" 
            : "Đăng nhập để truy cập và quản lý các chức năng của hệ thống"} 
        </p> 

        {/* ================================================= 
            MESSAGE 
        ================================================= */} 

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

          {/* =================================================
              FORM ĐĂNG NHẬP
          ================================================= */}

          {!isRegister && (
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
                      setEmail(e.target.value);

                      setLoginErrors({
                        ...loginErrors,
                        email: "",
                      });
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
              <button type="submit" className="login-button" disabled={loading}>
                <span>→</span>

                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>

              {/* REGISTER */}
              <div className="register-link">
                <span>Chưa có tài khoản?</span>

                <button type="button" onClick={openRegister}>
                  Đăng ký ngay
                </button>
              </div>

              <div className="divider">
                <span></span>

                <p>hoặc</p>

                <span></span>
              </div>

              <button type="button" className="school-login">
                👥
                <span>Đăng nhập bằng tài khoản trường</span>
              </button>
            </form>
          )}

          {/* =================================================
              FORM ĐĂNG KÝ
          ================================================= */}

          {isRegister && (
            <form
              className="login-form register-form"
              onSubmit={handleRegister}
            >
              {/* HỌ TÊN */}
              <div className="form-group">
                <label>Họ và tên</label>

                <div className="input-wrapper">
                  <span className="input-icon">👤</span>

                  <input
                    type="text"
                    placeholder="Nhập họ và tên"
                    value={hoTen}
                    onChange={(e) => {
                      setHoTen(e.target.value);

                      setRegisterErrors({
                        ...registerErrors,
                        hoTen: "",
                      });
                    }}
                  />
                </div>

                {registerErrors.hoTen && (
                  <p className="error-message">{registerErrors.hoTen}</p>
                )}
              </div>

              {/* EMAIL */}
              <div className="form-group">
                <label>Email</label>

                <div className="input-wrapper">
                  <span className="input-icon">✉️</span>

                  <input
                    type="email"
                    placeholder="Nhập email"
                    value={registerEmail}
                    onChange={(e) => {
                      setRegisterEmail(e.target.value);

                      setRegisterErrors({
                        ...registerErrors,
                        email: "",
                      });
                    }}
                  />
                </div>

                {registerErrors.email && (
                  <p className="error-message">{registerErrors.email}</p>
                )}
              </div>

              {/* SỐ ĐIỆN THOẠI */}
              <div className="form-group">
                <label>Số điện thoại</label>

                <div className="input-wrapper">
                  <span className="input-icon">📱</span>

                  <input
                    type="tel"
                    placeholder="Nhập số điện thoại"
                    value={soDienThoai}
                    onChange={(e) => {
                      setSoDienThoai(e.target.value);

                      setRegisterErrors({
                        ...registerErrors,
                        soDienThoai: "",
                      });
                    }}
                  />
                </div>

                {registerErrors.soDienThoai && (
                  <p className="error-message">{registerErrors.soDienThoai}</p>
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
                    value={registerPassword}
                    onChange={(e) => {
                      setRegisterPassword(e.target.value);

                      setRegisterErrors({
                        ...registerErrors,
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

                {registerErrors.password && (
                  <p className="error-message">{registerErrors.password}</p>
                )}
              </div>

              {/* CONFIRM PASSWORD */}
              <div className="form-group">
                <label>Xác nhận mật khẩu</label>

                <div className="input-wrapper">
                  <span className="input-icon">🔐</span>

                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);

                      setRegisterErrors({
                        ...registerErrors,
                        confirmPassword: "",
                      });
                    }}
                  />
                </div>

                {registerErrors.confirmPassword && (
                  <p className="error-message">
                    {registerErrors.confirmPassword}
                  </p>
                )}
              </div>

              {/* REGISTER BUTTON */}
              <button type="submit" className="login-button" disabled={loading}>
                <span>+</span>

                {loading ? "Đang đăng ký..." : "Đăng ký"}
              </button>

              {/* BACK LOGIN */}
              <div className="register-link">
                <span>Đã có tài khoản?</span>

                <button type="button" onClick={openLogin}>
                  Đăng nhập
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ===================================================
            RIGHT
        =================================================== */}

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
