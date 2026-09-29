import { useState } from "react";
import "./App.css";

function App() {
  const [showPassword, setShowPassword] = useState(false);

 // Validation đăng nhập
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({
    username: "",
    password: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = {
      username: "",
      password: "",
    };

    if (!username.trim()) {
      newErrors.username = "Vui lòng nhập tên đăng nhập";
    }

    if (!password.trim()) {
      newErrors.password = "Vui lòng nhập mật khẩu";
    }

    setErrors(newErrors);

    if (!newErrors.username && !newErrors.password) {
      console.log("Dữ liệu đăng nhập hợp lệ");
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* LEFT */}
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

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Tên đăng nhập</label>

              <div className="input-wrapper">
                <span className="input-icon">👤</span>

                <input
                  type="text"
                  placeholder="Nhập tên đăng nhập"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setErrors({ ...errors, username: "" });
                  }}
                />
              </div>

              {errors.username && (
                <p className="error-message">{errors.username}</p>
              )}
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
                    setErrors({ ...errors, password: "" });
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

              {errors.password && (
                <p className="error-message">{errors.password}</p>
              )}
            </div>

            <div className="login-options">
              <label className="remember">
                <input type="checkbox" />
                <span>Ghi nhớ đăng nhập</span>
              </label>

              <a href="#">Quên mật khẩu?</a>
            </div>

            <button type="submit" className="login-button">
              <span>→</span>
              Đăng nhập
            </button>

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
        </section>

        {/* RIGHT */}
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
