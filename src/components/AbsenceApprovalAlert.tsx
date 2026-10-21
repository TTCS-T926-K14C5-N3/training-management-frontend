import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import "./AbsenceApprovalAlert.css";

export const ABSENCE_APPROVAL_ALERT_STORAGE_KEY =
  "pendingAbsenceApprovalAlert";

interface AbsenceApprovalAlertData {
  id: number;
  message: string;
}

interface AbsenceApprovalAlertProps {
  isStudent: boolean;
  onTrack: () => void;
}

function getStoredAlert(): AbsenceApprovalAlertData | null {
  const stored = sessionStorage.getItem(ABSENCE_APPROVAL_ALERT_STORAGE_KEY);
  if (!stored) return null;

  try {
    const value: unknown = JSON.parse(stored);
    if (
      value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "number" &&
      "message" in value &&
      typeof value.message === "string"
    ) {
      return { id: value.id, message: value.message };
    }
  } catch (error) {
    console.error("Không thể đọc thông báo duyệt đơn:", error);
  }

  sessionStorage.removeItem(ABSENCE_APPROVAL_ALERT_STORAGE_KEY);
  return null;
}

function AbsenceApprovalAlert({
  isStudent,
  onTrack,
}: AbsenceApprovalAlertProps) {
  const [alert, setAlert] = useState(getStoredAlert);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dismissedAlertId = useRef<number | null>(null);

  useEffect(() => {
    if (!isStudent) return;

    let active = true;
    const loadApprovedAlert = async () => {
      try {
        const response = await api.get<AbsenceApprovalAlertData | null>(
          "/attendance/sessions/notifications/approved-alert",
        );
        if (
          active &&
          response.data &&
          response.data.id !== dismissedAlertId.current
        ) {
          sessionStorage.setItem(
            ABSENCE_APPROVAL_ALERT_STORAGE_KEY,
            JSON.stringify(response.data),
          );
          setAlert(response.data);
        }
      } catch (loadError) {
        if (active) {
          console.error(
            "Không thể kiểm tra thông báo duyệt đơn:",
            loadError,
          );
        }
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadApprovedAlert();
      }
    };

    void loadApprovedAlert();
    const refreshInterval = window.setInterval(refreshWhenVisible, 30_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isStudent]);

  if (!isStudent || !alert) return null;

  const followRequest = async () => {
    setLoading(true);
    setError("");
    try {
      await api.post(`/attendance/sessions/notifications/${alert.id}/read`);
      sessionStorage.removeItem(ABSENCE_APPROVAL_ALERT_STORAGE_KEY);
      onTrack();
    } catch (requestError) {
      console.error("Không thể đánh dấu đã theo dõi đơn xin phép:", requestError);
      setError("Chưa thể mở theo dõi đơn. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const dismiss = () => {
    dismissedAlertId.current = alert.id;
    sessionStorage.removeItem(ABSENCE_APPROVAL_ALERT_STORAGE_KEY);
    setAlert(null);
  };

  return (
    <div className="absence-approval-alert-backdrop">
      <section
        className="absence-approval-alert"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="absence-approval-alert-title"
        aria-describedby="absence-approval-alert-message"
      >
        <span className="absence-approval-alert-icon" aria-hidden="true">
          ✓
        </span>
        <h2 id="absence-approval-alert-title">Đơn xin phép đã được duyệt</h2>
        <p id="absence-approval-alert-message">{alert.message}</p>
        {error && (
          <p className="absence-approval-alert-error" role="alert">
            {error}
          </p>
        )}
        <div className="absence-approval-alert-actions">
          <button
            type="button"
            className="absence-approval-alert-dismiss"
            onClick={dismiss}
            disabled={loading}
          >
            Để sau
          </button>
          <button
            type="button"
            className="absence-approval-alert-follow"
            onClick={() => void followRequest()}
            disabled={loading}
          >
            {loading ? "Đang mở..." : "Theo dõi đơn"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default AbsenceApprovalAlert;
