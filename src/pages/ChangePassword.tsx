import React, { useState } from "react";
import api from "../services/api";

const ChangePassword: React.FC = () => {
  // =========================================================
  // STATE
  // =========================================================

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // =========================================================
  // XỬ LÝ ĐỔI MẬT KHẨU
  // =========================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Xóa thông báo cũ
    setError("");
    setSuccessMsg("");

    // =======================================================
    // KIỂM TRA DỮ LIỆU
    // =======================================================

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Vui lòng điền đầy đủ tất cả các trường.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu mới và xác nhận mật khẩu không khớp.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("Mật khẩu mới phải khác mật khẩu hiện tại.");
      return;
    }

    try {
      setIsLoading(true);

      // =====================================================
      // GỌI API ĐỔI MẬT KHẨU
      // =====================================================

      const response = await api.post("/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      console.log("Đổi mật khẩu thành công:", response.data);

      // =====================================================
      // CẬP NHẬT USER TRONG LOCAL STORAGE
      // =====================================================

      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);

          // -------------------------------------------------
          // Backend có thể trả token với một trong hai tên
          // -------------------------------------------------

          const newToken =
            response.data?.access_token || response.data?.token || null;

          if (newToken) {
            user.token = newToken;
          }

          // -------------------------------------------------
          // ĐÃ ĐỔI MẬT KHẨU THÀNH CÔNG
          // KHÔNG CÒN BẮT BUỘC ĐỔI MẬT KHẨU
          // -------------------------------------------------

          user.yeuCauDoiMatKhau = false;
          user.batBuocDoiMatKhau = false;
          user.canDoiMatKhau = false;

          // Lưu lại user
          localStorage.setItem("user", JSON.stringify(user));

          console.log(
            "User sau khi cập nhật:",
            JSON.parse(localStorage.getItem("user") || "null"),
          );
        } catch (parseError) {
          console.error(
            "Lỗi đọc/cập nhật user trong localStorage:",
            parseError,
          );
        }
      }

      // =====================================================
      // XÓA DỮ LIỆU FORM
      // =====================================================

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // =====================================================
      // HIỂN THỊ THÔNG BÁO THÀNH CÔNG
      // =====================================================

      setSuccessMsg("Đổi mật khẩu thành công!");

      // =====================================================
      // CHUYỂN VỀ TRANG CHỦ
      //
      // QUAN TRỌNG:
      // Dùng location.assign("/") để reload lại App.
      //
      // Không dùng:
      // window.history.replaceState(...)
      //
      // vì App.tsx đang quản lý currentPath bằng state.
      // =====================================================

      window.setTimeout(() => {
        window.location.assign("/");
      }, 1000);
    } catch (err: any) {
      console.error("Lỗi đổi mật khẩu:", err);

      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Đã xảy ra lỗi khi đổi mật khẩu. Vui lòng thử lại.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="change-password-page">
      <style>
        {`
          * {
            box-sizing: border-box;
          }

          .change-password-page {
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 48px 24px;
            background:
              radial-gradient(
                circle at top right,
                rgba(37, 99, 235, 0.08),
                transparent 35%
              ),
              #f3f6fb;
          }

          .change-password-wrapper {
            width: 100%;
            max-width: 820px;
            display: grid;
            grid-template-columns: 0.9fr 1.1fr;
            background: #ffffff;
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid #e5e7eb;
            box-shadow:
              0 20px 50px rgba(15, 23, 42, 0.10),
              0 4px 12px rgba(15, 23, 42, 0.04);
          }

          /* ================================================
             LEFT PANEL
             ================================================ */

          .change-password-info {
            position: relative;
            overflow: hidden;
            padding: 42px 34px;
            background:
              linear-gradient(
                145deg,
                #0f172a 0%,
                #16213e 55%,
                #1d4ed8 150%
              );
            color: #ffffff;
          }

          .change-password-info::before {
            content: "";
            position: absolute;
            width: 220px;
            height: 220px;
            border-radius: 50%;
            background: rgba(59, 130, 246, 0.16);
            top: -90px;
            right: -80px;
          }

          .change-password-info::after {
            content: "";
            position: absolute;
            width: 180px;
            height: 180px;
            border-radius: 50%;
            background: rgba(96, 165, 250, 0.10);
            bottom: -80px;
            left: -70px;
          }

          .brand {
            position: relative;
            z-index: 1;
            margin-bottom: 42px;
          }

          .brand-title {
            margin: 0;
            font-size: 25px;
            font-weight: 800;
            letter-spacing: -0.5px;
          }

          .brand-subtitle {
            display: block;
            margin-top: 5px;
            font-size: 10px;
            letter-spacing: 2px;
            color: #93c5fd;
            text-transform: uppercase;
          }

          .security-icon {
            position: relative;
            z-index: 1;
            width: 68px;
            height: 68px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 22px;
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.12);
            border: 1px solid rgba(255, 255, 255, 0.15);
            font-size: 32px;
          }

          .info-title {
            position: relative;
            z-index: 1;
            margin: 0 0 12px;
            font-size: 25px;
            line-height: 1.25;
            font-weight: 700;
          }

          .info-description {
            position: relative;
            z-index: 1;
            margin: 0;
            color: #cbd5e1;
            font-size: 14px;
            line-height: 1.7;
          }

          .security-note {
            position: relative;
            z-index: 1;
            margin-top: 35px;
            padding: 16px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.10);
          }

          .security-note-title {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            font-size: 13px;
            font-weight: 700;
          }

          .security-note-text {
            margin: 0;
            color: #cbd5e1;
            font-size: 12px;
            line-height: 1.6;
          }

          /* ================================================
             RIGHT FORM
             ================================================ */

          .change-password-form-panel {
            padding: 42px 42px;
          }

          .form-header {
            margin-bottom: 28px;
          }

          .form-header h2 {
            margin: 0;
            color: #0f172a;
            font-size: 25px;
            font-weight: 750;
          }

          .form-header p {
            margin: 8px 0 0;
            color: #64748b;
            font-size: 14px;
          }

          /* ================================================
             ALERT
             ================================================ */

          .alert {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px 14px;
            margin-bottom: 20px;
            border-radius: 10px;
            font-size: 13px;
            line-height: 1.5;
          }

          .alert-error {
            color: #991b1b;
            background: #fef2f2;
            border: 1px solid #fecaca;
          }

          .alert-success {
            color: #166534;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
          }

          .alert-icon {
            flex-shrink: 0;
            font-size: 16px;
            font-weight: bold;
          }

          /* ================================================
             FORM GROUP
             ================================================ */

          .form-group {
            margin-bottom: 20px;
          }

          .form-label {
            display: block;
            margin-bottom: 8px;
            color: #334155;
            font-size: 13px;
            font-weight: 650;
          }

          .input-wrapper {
            position: relative;
          }

          .form-input {
            width: 100%;
            height: 46px;
            padding: 0 14px;
            border: 1px solid #dbe2ea;
            border-radius: 9px;
            outline: none;
            background: #ffffff;
            color: #0f172a;
            font-size: 14px;
            transition:
              border-color 0.2s ease,
              box-shadow 0.2s ease,
              background-color 0.2s ease;
          }

          .form-input::placeholder {
            color: #a1aab8;
          }

          .form-input:hover {
            border-color: #b9c5d3;
          }

          .form-input:focus {
            border-color: #2563eb;
            background: #ffffff;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.10);
          }

          .form-input:disabled {
            background: #f8fafc;
            cursor: not-allowed;
          }

          /* ================================================
             PASSWORD RULES
             ================================================ */

          .password-hint {
            margin-top: 8px;
            color: #64748b;
            font-size: 11px;
            line-height: 1.5;
          }

          /* ================================================
             BUTTON
             ================================================ */

          .submit-button {
            width: 100%;
            height: 47px;
            margin-top: 4px;
            border: none;
            border-radius: 9px;
            background: linear-gradient(
              135deg,
              #2563eb,
              #1d4ed8
            );
            color: #ffffff;
            font-size: 14px;
            font-weight: 650;
            cursor: pointer;
            box-shadow:
              0 6px 14px rgba(37, 99, 235, 0.22);
            transition:
              transform 0.15s ease,
              box-shadow 0.15s ease,
              opacity 0.15s ease;
          }

          .submit-button:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow:
              0 9px 18px rgba(37, 99, 235, 0.28);
          }

          .submit-button:active:not(:disabled) {
            transform: translateY(0);
          }

          .submit-button:disabled {
            opacity: 0.65;
            cursor: not-allowed;
            box-shadow: none;
          }

          /* ================================================
             FOOTER
             ================================================ */

          .form-footer {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            margin-top: 22px;
            color: #94a3b8;
            font-size: 11px;
          }

          /* ================================================
             RESPONSIVE
             ================================================ */

          @media (max-width: 720px) {
            .change-password-page {
              padding: 20px 14px;
            }

            .change-password-wrapper {
              grid-template-columns: 1fr;
              max-width: 500px;
            }

            .change-password-info {
              padding: 30px;
            }

            .brand {
              margin-bottom: 28px;
            }

            .security-note {
              margin-top: 25px;
            }

            .change-password-form-panel {
              padding: 30px 25px;
            }
          }

          @media (max-width: 420px) {
            .change-password-info {
              padding: 25px 22px;
            }

            .change-password-form-panel {
              padding: 25px 20px;
            }

            .info-title {
              font-size: 22px;
            }

            .form-header h2 {
              font-size: 22px;
            }
          }
        `}
      </style>

      <div className="change-password-wrapper">
        {/* =====================================================
            LEFT - THÔNG TIN BẢO MẬT
            ===================================================== */}

        <div className="change-password-info">
          <div className="brand">
            <h1 className="brand-title">EduManage</h1>

            <span className="brand-subtitle">Training Management</span>
          </div>

          <div className="security-icon">🔐</div>

          <h2 className="info-title">Bảo vệ tài khoản của bạn</h2>

          <p className="info-description">
            Thay đổi mật khẩu định kỳ giúp bảo vệ tài khoản và thông tin cá nhân
            của bạn trong hệ thống quản lý đào tạo.
          </p>

          <div className="security-note">
            <div className="security-note-title">
              <span>🛡️</span>
              <span>Lưu ý bảo mật</span>
            </div>

            <p className="security-note-text">
              Không chia sẻ mật khẩu cho người khác. Hãy sử dụng mật khẩu riêng
              và khó đoán.
            </p>
          </div>
        </div>

        {/* =====================================================
            RIGHT - FORM ĐỔI MẬT KHẨU
            ===================================================== */}

        <div className="change-password-form-panel">
          <div className="form-header">
            <h2>Đổi mật khẩu</h2>

            <p>Cập nhật mật khẩu đăng nhập của bạn</p>
          </div>

          {/* =================================================
              ERROR
              ================================================= */}

          {error && (
            <div className="alert alert-error">
              <span className="alert-icon">!</span>

              <span>{error}</span>
            </div>
          )}

          {/* =================================================
              SUCCESS
              ================================================= */}

          {successMsg && (
            <div className="alert alert-success">
              <span className="alert-icon">✓</span>

              <span>
                {successMsg}

                <br />

                <span
                  style={{
                    fontWeight: 400,
                    fontSize: "12px",
                  }}
                >
                  Đang chuyển về trang chủ...
                </span>
              </span>
            </div>
          )}

          {/* =================================================
              FORM
              ================================================= */}

          <form onSubmit={handleSubmit}>
            {/* =================================================
                MẬT KHẨU HIỆN TẠI
                ================================================= */}

            <div className="form-group">
              <label className="form-label">Mật khẩu hiện tại</label>

              <div className="input-wrapper">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu hiện tại"
                  className="form-input"
                />
              </div>
            </div>

            {/* =================================================
                MẬT KHẨU MỚI
                ================================================= */}

            <div className="form-group">
              <label className="form-label">Mật khẩu mới</label>

              <div className="input-wrapper">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="new-password"
                  placeholder="Nhập mật khẩu mới"
                  className="form-input"
                />
              </div>

              <div className="password-hint">
                <span style={{ color: "#dc2626" }}>
                  Mật khẩu mới nên khác mật khẩu hiện tại và đủ khó để bảo vệ
                  tài khoản.
                </span>
              </div>
            </div>

            {/* =================================================
                XÁC NHẬN MẬT KHẨU
                ================================================= */}

            <div className="form-group">
              <label className="form-label">Xác nhận mật khẩu mới</label>

              <div className="input-wrapper">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu mới"
                  className="form-input"
                />
              </div>
            </div>

            {/* =================================================
                BUTTON
                ================================================= */}

            <button
              type="submit"
              disabled={isLoading}
              className="submit-button"
            >
              {isLoading ? "Đang xử lý..." : "Đổi mật khẩu"}
            </button>
          </form>

          {/* =================================================
              FOOTER
              ================================================= */}

          <div className="form-footer">
            <span>🔒</span>

            <span>Thông tin của bạn được bảo mật</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
