import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import api from "../services/api";
import "./AbsenceRequestList.css";

interface AbsenceRequest {
  requestId: number;
  scheduleId: number;
  classCode: string | null;
  className: string | null;
  date: string;
  startTime: string;
  endTime: string;
  subjectName: string | null;
  teacherName: string | null;
  reason: string;
  evidence: string | null;
  evidenceName?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface AbsenceRequestListProps {
  navigate: (path: string) => void;
}

const formatDate = (value: string): string => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
};

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const errorMessage = (error: unknown): string => {
  if (axios.isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (error.response?.status === 401) return "Phiên đăng nhập đã hết hạn.";
    if (error.response?.status === 403) return "Bạn không có quyền xem đơn xin phép.";
    if (!error.response) return "Không thể kết nối Backend. Vui lòng thử lại.";
    return `Không thể tải dữ liệu đơn xin phép (HTTP ${error.response.status}).`;
  }
  return error instanceof Error
    ? error.message
    : "Không thể tải dữ liệu đơn xin phép.";
};

const statusLabel: Record<AbsenceRequest["status"], string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
};

function AbsenceRequestList({ navigate }: AbsenceRequestListProps) {
  const [requests, setRequests] = useState<AbsenceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    try {
      const requestResponse = await api.get<AbsenceRequest[]>(
        "/attendance/sessions/absence-requests",
        {
          signal,
        },
      );
      setRequests(requestResponse.data);
      setError("");
    } catch (loadError) {
      if (axios.isCancel(loadError) || signal?.aborted) return;
      console.error("Không thể tải danh sách đơn xin phép:", loadError);
      setError(errorMessage(loadError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadData(controller.signal);
    });
    return () => controller.abort();
  }, [loadData]);

  const downloadEvidence = async (request: AbsenceRequest) => {
    if (!request.evidence) return;
    setDownloadingId(request.requestId);
    setError("");
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
      console.error("Không thể tải tệp minh chứng đơn xin phép:", downloadError);
      setError(errorMessage(downloadError));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <main className="absence-list-page">
      <header className="absence-list-hero">
        <div>
          <span className="absence-list-eyebrow">HỌC TẬP CÁ NHÂN</span>
          <h1>Theo dõi đơn xin phép</h1>
          <p>
            Xem trạng thái xử lý, lý do duyệt và thông báo cho các đơn xin phép
            vắng học của bạn.
          </p>
        </div>
        <span className="absence-list-hero-icon" aria-hidden="true">▤</span>
      </header>

      <section className="absence-list-panel" aria-labelledby="absence-requests-title">
        <div className="absence-list-section-heading">
          <div>
            <h2 id="absence-requests-title">Đơn xin phép của tôi</h2>
            <p>{requests.length} đơn đã gửi</p>
          </div>
          <div className="absence-list-actions">
            <button
              className="absence-list-secondary-button"
              type="button"
              onClick={() => {
                setLoading(true);
                void loadData();
              }}
              disabled={loading}
            >
              {loading ? "Đang tải..." : "Tải lại"}
            </button>
            <button
              className="absence-list-create-button"
              type="button"
              onClick={() => navigate("/don-xin-phep")}
            >
              Gửi đơn mới
            </button>
          </div>
        </div>

        {error && (
          <div className="absence-list-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadData();
              }}
            >
              Thử lại
            </button>
          </div>
        )}

        {loading ? (
          <p className="absence-list-state" role="status">
            Đang tải đơn xin phép...
          </p>
        ) : !error && requests.length === 0 ? (
          <div className="absence-list-state">
            <strong>Bạn chưa gửi đơn xin phép nào.</strong>
            <span>Đơn đã gửi sẽ xuất hiện tại đây cùng kết quả xử lý.</span>
          </div>
        ) : (
          <div className="absence-request-list">
            {requests.map((request) => (
              <article className="absence-request-list-item" key={request.requestId}>
                <div className="absence-request-list-topline">
                  <div>
                    <strong>
                      {request.classCode ?? "Lớp học"}
                      {request.className ? ` · ${request.className}` : ""}
                    </strong>
                    <span>
                      {formatDate(request.date)} · {request.startTime}–
                      {request.endTime}
                    </span>
                  </div>
                  <span className={`absence-request-status ${request.status}`}>
                    {statusLabel[request.status] ?? request.status}
                  </span>
                </div>
                <p className="absence-request-list-session">
                  {request.subjectName ?? "Buổi học"}
                  {request.teacherName ? ` · ${request.teacherName}` : ""}
                </p>
                <div className="absence-request-list-reason">
                  <strong>Lý do xin phép</strong>
                  <p>{request.reason}</p>
                </div>
                {request.evidence && (
                  <button
                    className="absence-request-evidence"
                    type="button"
                    disabled={downloadingId === request.requestId}
                    onClick={() => void downloadEvidence(request)}
                  >
                    {downloadingId === request.requestId
                      ? "Đang tải minh chứng..."
                      : `Tải minh chứng${request.evidenceName ? ` (${request.evidenceName})` : ""}`}
                  </button>
                )}
                {request.reviewReason && (
                  <div className="absence-request-review-reason">
                    <strong>
                      {request.status === "approved"
                        ? "Lý do duyệt"
                        : "Lý do từ chối"}
                    </strong>
                    <p>{request.reviewReason}</p>
                    {request.reviewedAt && (
                      <small>Đã xử lý lúc {formatDateTime(request.reviewedAt)}</small>
                    )}
                  </div>
                )}
                <small className="absence-request-created">
                  Gửi lúc {formatDateTime(request.createdAt)}
                </small>
              </article>
            ))}
          </div>
        )}
      </section>

    </main>
  );
}

export default AbsenceRequestList;
