import { useEffect, useRef } from "react";
import "./ToastNotification.css";

interface ToastNotificationProps {
  type: "success" | "error";
  text: string;
  onClose: () => void;
  durationMs?: number;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({
  type,
  text,
  onClose,
  durationMs = 3000,
}) => {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const timer = window.setTimeout(() => onCloseRef.current(), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, text]);

  return (
    <div
      className={`app-toast app-toast-${type}`}
      role={type === "success" ? "status" : "alert"}
      aria-live={type === "success" ? "polite" : "assertive"}
    >
      <div className="app-toast-icon">{type === "success" ? "✓" : "!"}</div>

      <div className="app-toast-content">
        <strong>{type === "success" ? "Thành công" : "Lỗi"}</strong>
        <span>{text}</span>
      </div>

      <button
        type="button"
        className="app-toast-close"
        onClick={onClose}
        aria-label="Đóng thông báo"
      >
        ×
      </button>
    </div>
  );
};

export default ToastNotification;
