import React, { useEffect, useState } from "react";
import ToastNotification from "../components/ToastNotification";
import { API_URL } from "../config/api";

export const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [checkingToken, setCheckingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ============================================================
  // LẤY TOKEN TỪ LINK EMAIL
  // Ví dụ:
  // http://localhost:5173/reset-password?token=abc123
  // ============================================================

  const queryParams = new URLSearchParams(window.location.search);

  const token = queryParams.get("token");

  // ============================================================
  // KIỂM TRA TOKEN NGAY KHI MỞ TRANG
  // ============================================================

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setMessage({
          type: "error",
          text: "Token không hợp lệ",
        });

        setTokenValid(false);
        setCheckingToken(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/reset-password/validate-token?token=${encodeURIComponent(
            token,
          )}`,
        );

        const res = await response.json();

        if (!response.ok) {
          setMessage({
            type: "error",
            text: res?.detail || "Token không hợp lệ",
          });

          setTokenValid(false);
          setCheckingToken(false);
          return;
        }

        setTokenValid(true);
        setMessage(null);
      } catch (error) {
        console.error("VALIDATE RESET TOKEN ERROR:", error);

        setTokenValid(false);

        setMessage({
          type: "error",
          text: "Không thể kiểm tra token. Vui lòng thử lại.",
        });
      } finally {
        setCheckingToken(false);
      }
    };

    validateToken();
  }, [token]);

  // ============================================================
  // XỬ LÝ ĐẶT LẠI MẬT KHẨU
  // ============================================================

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setMessage(null);

    // ----------------------------------------------------------
    // Kiểm tra token
    // ----------------------------------------------------------

    if (!token || !tokenValid) {
      setMessage({
        type: "error",
        text: "Token không hợp lệ hoặc đã hết hạn.",
      });

      return;
    }

    // ----------------------------------------------------------
    // Kiểm tra độ dài mật khẩu
    // ----------------------------------------------------------

    if (newPassword.length < 8) {
      setMessage({
        type: "error",
        text: "Mật khẩu phải có ít nhất 8 ký tự.",
      });

      return;
    }

    // ----------------------------------------------------------
    // Kiểm tra có chữ cái
    // ----------------------------------------------------------

    if (!/[A-Za-zÀ-ỹ]/.test(newPassword)) {
      setMessage({
        type: "error",
        text: "Mật khẩu phải có ít nhất một chữ cái.",
      });

      return;
    }

    // ----------------------------------------------------------
    // Kiểm tra có chữ số
    // ----------------------------------------------------------

    if (!/[0-9]/.test(newPassword)) {
      setMessage({
        type: "error",
        text: "Mật khẩu phải có ít nhất một chữ số.",
      });

      return;
    }

    // ----------------------------------------------------------
    // Kiểm tra xác nhận mật khẩu
    // ----------------------------------------------------------

    if (newPassword !== confirmPassword) {
      setMessage({
        type: "error",
        text: "Mật khẩu xác nhận không khớp.",
      });

      return;
    }

    // ----------------------------------------------------------
    // Bắt đầu gọi API
    // ----------------------------------------------------------

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/reset-password`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          token: token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const res = await response.json();

      // --------------------------------------------------------
      // API thành công
      // --------------------------------------------------------

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.",
        });

        setNewPassword("");
        setConfirmPassword("");

        // Token đã được sử dụng
        setTokenValid(false);

        setTimeout(() => {
          window.location.replace("/");
        }, 1500);

        return;
      }

      // --------------------------------------------------------
      // API lỗi
      // --------------------------------------------------------

      let errorMessage = "Không thể đặt lại mật khẩu.";

      if (res?.detail) {
        if (Array.isArray(res.detail)) {
          errorMessage = res.detail
            .map((item: { msg?: string }) => {
              return item.msg || "Dữ liệu không hợp lệ.";
            })
            .join(", ");
        } else {
          errorMessage = res.detail;
        }
      } else if (res?.message) {
        errorMessage = res.message;
      }

      setMessage({
        type: "error",
        text: errorMessage,
      });

      // Nếu backend trả token không hợp lệ/hết hạn
      // thì ẩn form luôn.
      if (
        typeof errorMessage === "string" &&
        (errorMessage.toLowerCase().includes("token không hợp lệ") ||
          errorMessage.toLowerCase().includes("token đã hết hạn"))
      ) {
        setTokenValid(false);
      }
    } catch (error) {
      console.error("RESET PASSWORD ERROR:", error);

      setMessage({
        type: "error",
        text: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // GIAO DIỆN
  // ============================================================

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* ================================================== */}
        {/* TIÊU ĐỀ */}
        {/* ================================================== */}

        <h2 style={styles.title}>Đặt lại mật khẩu</h2>

        <p style={styles.subtitle}>Nhập mật khẩu mới cho tài khoản của bạn.</p>

        {/* ================================================== */}
        {/* THÔNG BÁO */}
        {/* ================================================== */}

        {message?.type === "success" && (
          <ToastNotification
            type="success"
            text={message.text}
            onClose={() => setMessage(null)}
          />
        )}

        {message?.type === "error" && (
          <div
            style={{
              ...styles.alert,
              backgroundColor: "#fce8e6",
              color: "#c5221f",
              borderColor: "#fad2cf",
            }}
          >
            {message.text}
          </div>
        )}

        {/* ================================================== */}
        {/* KIỂM TRA TOKEN */}
        {/* ================================================== */}

        {checkingToken ? (
          <p style={styles.passwordHint}>
            Đang kiểm tra liên kết đặt lại mật khẩu...
          </p>
        ) : tokenValid ? (
          /* ================================================== */
          /* FORM ĐẶT LẠI MẬT KHẨU */
          /* ================================================== */

          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Mật khẩu mới */}

            <div style={styles.formGroup}>
              <label style={styles.label}>Mật khẩu mới</label>

              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới"
                required
                disabled={loading}
                style={styles.input}
              />
            </div>

            {/* Xác nhận mật khẩu */}

            <div style={styles.formGroup}>
              <label style={styles.label}>Xác nhận mật khẩu mới</label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                required
                disabled={loading}
                style={styles.input}
              />
            </div>

            {/* Yêu cầu mật khẩu */}

            <p style={styles.passwordHint}>
              Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ cái và chữ số.
            </p>

            {/* Nút */}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                backgroundColor: loading ? "#9ca3af" : "#0066cc",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
            </button>
          </form>
        ) : null}

        {/* ================================================== */}
        {/* QUAY LẠI */}
        {/* ================================================== */}

        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          style={styles.backButton}
        >
          Quay lại trang đăng nhập
        </button>
      </div>
    </div>
  );
};

// ============================================================
// CSS
// ============================================================

const styles: {
  [key: string]: React.CSSProperties;
} = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    padding: "20px",
    backgroundColor: "#f5f7fb",
    boxSizing: "border-box",
  },

  card: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: "#ffffff",
    padding: "32px",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
    border: "1px solid #eaeaea",
    boxSizing: "border-box",
  },

  title: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: "8px",
    textAlign: "center",
  },

  subtitle: {
    fontSize: "14px",
    color: "#666666",
    marginBottom: "24px",
    textAlign: "center",
    lineHeight: "1.5",
  },

  alert: {
    padding: "12px 16px",
    borderRadius: "8px",
    marginBottom: "20px",
    fontSize: "14px",
    border: "1px solid",
    lineHeight: "1.5",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },

  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  label: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#333333",
  },

  input: {
    padding: "12px",
    fontSize: "14px",
    borderRadius: "8px",
    border: "1px solid #cccccc",
    outline: "none",
    boxSizing: "border-box",
    width: "100%",
  },

  passwordHint: {
    fontSize: "13px",
    color: "#666666",
    margin: "-4px 0 0 0",
    lineHeight: "1.5",
  },

  button: {
    padding: "12px",
    fontSize: "15px",
    fontWeight: "600",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    marginTop: "8px",
  },

  backButton: {
    width: "100%",
    marginTop: "16px",
    padding: "11px",
    fontSize: "14px",
    fontWeight: "600",
    color: "#0066cc",
    backgroundColor: "#ffffff",
    border: "1px solid #0066cc",
    borderRadius: "8px",
    cursor: "pointer",
  },
};
