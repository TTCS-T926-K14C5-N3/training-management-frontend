import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import "./AttendanceManagement.css";

interface AbsenceReviewRequest {
  requestId: number;
  scheduleId: number;
  classCode: string | null;
  className: string | null;
  studentName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  subjectName: string | null;
  reason: string;
  evidence: string | null;
  evidenceName: string | null;
  status: "pending" | "approved" | "rejected";
  reviewReason: string | null;
}

const errorMessage = (error: unknown): string => {
  if (axios.isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (error.response?.status === 401) return "Phiên đăng nhập đã hết hạn.";
    if (error.response?.status === 403) return "Bạn không có quyền xử lý đơn xin phép.";
    if (error.response?.status === 404) return "Không tìm thấy đơn xin phép.";
  }
  return error instanceof Error
    ? error.message
    : "Không thể tải hoặc xử lý đơn xin phép.";
};

function AttendanceManagement() {
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [absenceRequests, setAbsenceRequests] = useState<AbsenceReviewRequest[]>([]);
  const [absenceRequestsLoading, setAbsenceRequestsLoading] = useState(true);
  const [absenceRequestsError, setAbsenceRequestsError] = useState("");
  const [requestActionId, setRequestActionId] = useState<number | null>(null);

  const loadAbsenceRequests = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<AbsenceReviewRequest[]>(
        "/attendance/sessions/absence-requests",
        { signal },
      );
      if (signal?.aborted) return;
      setAbsenceRequests(response.data);
      setAbsenceRequestsError("");
    } catch (loadError) {
      if (axios.isCancel(loadError) || signal?.aborted) return;
      console.error("Không thể tải đơn xin phép cần duyệt:", loadError);
      setAbsenceRequestsError(errorMessage(loadError));
    } finally {
      if (!signal?.aborted) setAbsenceRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void loadAbsenceRequests(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadAbsenceRequests]);

  const reviewAbsenceRequest = async (
    request: AbsenceReviewRequest,
    decision: "approved" | "rejected",
  ) => {
    const reason = window.prompt(
      decision === "approved"
        ? "Nhập lý do duyệt đơn xin phép:"
        : "Nhập lý do từ chối đơn xin phép:",
      "",
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setAbsenceRequestsError("Vui lòng nhập lý do duyệt hoặc từ chối.");
      return;
    }

    setRequestActionId(request.requestId);
    setAbsenceRequestsError("");
    setToast(null);
    try {
      await api.post(
        `/attendance/sessions/absence-requests/${request.requestId}/decision`,
        { decision, reason: reason.trim() },
      );
      setToast({
        type: "success",
        text:
          decision === "approved"
            ? "Đã duyệt đơn. Điểm danh được cập nhật thành Vắng có phép và học viên đã nhận thông báo."
            : "Đã từ chối đơn và gửi thông báo cho học viên.",
      });
      await loadAbsenceRequests();
    } catch (reviewError) {
      console.error("Không thể xử lý đơn xin phép:", reviewError);
      setAbsenceRequestsError(errorMessage(reviewError));
    } finally {
      setRequestActionId(null);
    }
  };

  const downloadEvidence = async (request: AbsenceReviewRequest) => {
    if (!request.evidence) return;
    setAbsenceRequestsError("");
    try {
      const response = await api.get<Blob>(request.evidence, {
        responseType: "blob",
      });
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = request.evidenceName || "minh-chung";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      console.error("Không thể tải minh chứng xin phép:", downloadError);
      setAbsenceRequestsError(errorMessage(downloadError));
    }
  };

  return (
    <main className="attendance-page">
      <header className="attendance-page-hero">
        <div>
          <span>QUẢN LÝ HỌC TẬP</span>
          <h1>Xử lý đơn xin phép vắng</h1>
          <p>Xem xét đơn xin phép vắng và gửi kết quả đến học viên.</p>
        </div>
        <div className="attendance-page-actions">
          <span className="attendance-page-icon" aria-hidden="true">✓</span>
        </div>
      </header>

      <section className="attendance-page-card attendance-request-review">
        <div className="attendance-request-heading">
          <div>
            <h2>Đơn xin phép vắng cần xử lý</h2>
            <p>
              Chỉ hiển thị các buổi học được phân công cho bạn. Khi duyệt đơn,
              điểm danh của học viên sẽ chuyển thành Vắng có phép.
            </p>
          </div>
          <button
            type="button"
            className="attendance-page-switch"
            onClick={() => {
              setAbsenceRequestsLoading(true);
              void loadAbsenceRequests();
            }}
            disabled={absenceRequestsLoading}
          >
            {absenceRequestsLoading ? "Đang tải..." : "Tải lại"}
          </button>
        </div>
        {absenceRequestsError && (
          <div className="attendance-page-message error" role="alert">
            {absenceRequestsError}
          </div>
        )}
        {absenceRequestsLoading ? (
          <p className="attendance-page-empty" role="status">
            Đang tải đơn xin phép...
          </p>
        ) : absenceRequests.length === 0 ? (
          <p className="attendance-page-empty">
            Hiện không có đơn xin phép nào cần theo dõi.
          </p>
        ) : (
          <div className="attendance-request-list">
            {absenceRequests.map((request) => (
              <article
                className="attendance-request-item"
                key={request.requestId}
              >
                <div className="attendance-request-item-heading">
                  <div>
                    <strong>
                      {request.studentName ?? "Học viên"}
                      {" · "}
                      {request.classCode ?? "Lớp học"}
                    </strong>
                    <span>
                      {request.subjectName ?? "Buổi học"} · {request.date} ·{" "}
                      {request.startTime}–{request.endTime}
                    </span>
                  </div>
                  <span className={`attendance-request-status ${request.status}`}>
                    {request.status === "pending"
                      ? "Chờ duyệt"
                      : request.status === "approved"
                        ? "Đã duyệt"
                        : "Đã từ chối"}
                  </span>
                </div>
                <p className="attendance-request-reason">{request.reason}</p>
                {request.evidence && (
                  <button
                    type="button"
                    className="attendance-request-evidence"
                    onClick={() => void downloadEvidence(request)}
                  >
                    Tải minh chứng
                    {request.evidenceName ? ` (${request.evidenceName})` : ""}
                  </button>
                )}
                {request.reviewReason && (
                  <p className="attendance-request-review-reason">
                    <strong>Lý do xử lý:</strong> {request.reviewReason}
                  </p>
                )}
                {request.status === "pending" && (
                  <div className="attendance-request-actions">
                    <button
                      type="button"
                      className="attendance-request-approve"
                      disabled={requestActionId === request.requestId}
                      onClick={() =>
                        void reviewAbsenceRequest(request, "approved")
                      }
                    >
                      Duyệt đơn
                    </button>
                    <button
                      type="button"
                      className="attendance-request-reject"
                      disabled={requestActionId === request.requestId}
                      onClick={() =>
                        void reviewAbsenceRequest(request, "rejected")
                      }
                    >
                      Từ chối
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      {toast && (
        <ToastNotification
          type={toast.type}
          text={toast.text}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  );
}

export default AttendanceManagement;
