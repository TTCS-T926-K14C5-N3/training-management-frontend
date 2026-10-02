import { forgotPassword } from "../services/authService";
import React, { useState } from "react";

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setMessage(null);

  try {
    const res = await forgotPassword(email);

    setMessage({
      type: "success",
      text: res?.message || "Yêu cầu đã được gửi! Vui lòng kiểm tra Gmail để lấy liên kết đặt lại mật khẩu.",
    });

    setEmail("");
  } catch (err: any) {
    console.error("FORGOT PASSWORD ERROR:", err);

    setMessage({
      type: "error",
      text: err.message || "Không thể gửi yêu cầu đặt lại mật khẩu.",
    });
  } finally {
    setLoading(false);
  }
};

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Quên mật khẩu?</h2>
        <p style={styles.subtitle}>
          Nhập địa chỉ Gmail đăng ký tài khoản. Hệ thống sẽ tự động gửi liên kết
          khôi phục.
        </p>

        {message && (
          <div
            style={{
              ...styles.alert,
              backgroundColor:
                message.type === "success" ? "#e6f4ea" : "#fce8e6",
              color: message.type === "success" ? "#137333" : "#c5221f",
              borderColor: message.type === "success" ? "#ceead6" : "#fad2cf",
            }}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label htmlFor="email" style={styles.label}>
              Địa chỉ Gmail
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nhap.email@gmail.com"
              required
              style={styles.input}
            />
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Đang gửi..." : "Gửi liên kết khôi phục"}
          </button>
        </form>

        <div style={styles.footer}>
          <a href="/login" style={styles.link}>
            ← Quay lại trang Đăng nhập
          </a>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "80vh",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: "#ffffff",
    padding: "32px",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
    border: "1px solid #eaeaea",
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
  },
  button: {
    padding: "12px",
    fontSize: "15px",
    fontWeight: "600",
    color: "#ffffff",
    backgroundColor: "#0066cc",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    marginTop: "8px",
  },
  footer: {
    marginTop: "24px",
    textAlign: "center",
  },
  link: {
    fontSize: "14px",
    color: "#0066cc",
    textDecoration: "none",
  },
};
