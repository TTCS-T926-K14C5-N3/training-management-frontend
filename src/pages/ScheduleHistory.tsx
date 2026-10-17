import { useEffect, useState } from "react";
import axios from "axios";
import api from "../services/api";
import "./ScheduleHistory.css";

interface ScheduleSnapshot {
  ngayHoc?: string;
  gioBatDau?: string;
  gioKetThuc?: string;
  phongHocId?: number | null;
  maPhong?: string | null;
  tenPhong?: string | null;
  giangVienId?: number | null;
  giangVienTen?: string | null;
  trangThai?: string;
  lyDoHuy?: string | null;
}

interface ScheduleEvent {
  lichHocLichSuId: number;
  lichHocId: number;
  maBuoiHoc: string;
  maLop: string | null;
  tenLop: string | null;
  hanhDong: string;
  duLieuCu: ScheduleSnapshot | null;
  duLieuMoi: ScheduleSnapshot | null;
  lyDo: string | null;
  thoiDiem: string;
  nguoiThucHien: string | null;
  noiDungThongBao: string | null;
  trangThaiThongBao: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
  } | null;
}

interface ScheduleEventResponse {
  items: ScheduleEvent[];
  total: number;
  page: number;
  pageSize: number;
}

type EventFilter = "all" | "date_time" | "room" | "instructor" | "cancelled";

interface ScheduleHistoryProps {
  navigate: (path: string) => void;
}

const PAGE_SIZE = 20;

const formatDate = (value: string): string => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

const formatTimestamp = (value: string): string => {
  const businessTimestamp = value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)
    ? value
    : `${value}+07:00`;
  const parsed = new Date(businessTimestamp);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(parsed);
};

const eventLabels = (event: ScheduleEvent): string[] => {
  if (event.hanhDong === "Hủy") return ["Hủy buổi học"];
  if (event.hanhDong === "Tạo") return ["Tạo buổi học"];

  const before = event.duLieuCu;
  const after = event.duLieuMoi;
  const labels: string[] = [];
  if (
    before?.ngayHoc !== after?.ngayHoc ||
    before?.gioBatDau !== after?.gioBatDau ||
    before?.gioKetThuc !== after?.gioKetThuc
  ) {
    labels.push("Đổi ngày hoặc giờ");
  }
  if (before?.phongHocId !== after?.phongHocId) labels.push("Đổi phòng học");
  if (before?.giangVienId !== after?.giangVienId) labels.push("Đổi giảng viên");
  return labels.length > 0 ? labels : ["Cập nhật buổi học"];
};

const errorMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error
      ? error.message
      : "Không thể tải thông báo và lịch sử. Vui lòng thử lại.";
  }
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (
    detail &&
    typeof detail === "object" &&
    "message" in detail &&
    typeof detail.message === "string"
  ) {
    return detail.message;
  }
  if (error.response?.status === 401) return "Phiên đăng nhập đã hết hạn.";
  if (error.response?.status === 403) return "Bạn không có quyền xem dữ liệu này.";
  if (!error.response) return "Không thể kết nối Backend. Vui lòng thử lại.";
  return `Không thể tải dữ liệu (HTTP ${error.response.status ?? "?"}). Vui lòng thử lại.`;
};

const snapshotSchedule = (
  title: string,
  schedule: ScheduleSnapshot | null,
) => {
  if (!schedule) return null;
  const roomName = schedule.tenPhong || schedule.maPhong;
  const hasTime = Boolean(
    schedule.ngayHoc || schedule.gioBatDau || schedule.gioKetThuc,
  );
  const hasRoom = Boolean(roomName || schedule.phongHocId);
  const hasInstructor = Boolean(schedule.giangVienTen || schedule.giangVienId);
  return (
    <section className="schedule-event-snapshot">
      <h3>{title}</h3>
      <dl>
        {hasTime && (
          <div>
            <dt>Ngày và giờ</dt>
            <dd>
              {schedule.ngayHoc ? formatDate(schedule.ngayHoc) : ""}
              {schedule.gioBatDau || schedule.gioKetThuc
                ? ` · ${schedule.gioBatDau ?? ""}–${schedule.gioKetThuc ?? ""}`
                : ""}
            </dd>
          </div>
        )}
        {hasRoom && (
          <div>
            <dt>Phòng học</dt>
            <dd>{roomName ?? `Phòng #${schedule.phongHocId}`}</dd>
          </div>
        )}
        {hasInstructor && (
          <div>
            <dt>Giảng viên</dt>
            <dd>{schedule.giangVienTen ?? `Giảng viên #${schedule.giangVienId}`}</dd>
          </div>
        )}
        {schedule.trangThai && (
          <div>
            <dt>Trạng thái</dt>
            <dd>{schedule.trangThai}</dd>
          </div>
        )}
      </dl>
    </section>
  );
};

function ScheduleHistory({ navigate }: ScheduleHistoryProps) {
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<ScheduleEventResponse | null>(null);
  const [completedRequestKey, setCompletedRequestKey] = useState("");
  const [loadError, setLoadError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const requestKey = `${page}|${debouncedSearch}|${eventFilter}|${retryCount}`;
  const loading = completedRequestKey !== requestKey;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    const controller = new AbortController();
    void api
      .get<ScheduleEventResponse>("/academic/schedule-history", {
        params: {
          page,
          pageSize: PAGE_SIZE,
          q: debouncedSearch || undefined,
          eventType: eventFilter,
        },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!data || !Array.isArray(data.items) || typeof data.total !== "number") {
          throw new Error("Backend trả về dữ liệu lịch sử không đúng định dạng.");
        }
        setResult(data);
        setLoadError("");
        setCompletedRequestKey(requestKey);
      })
      .catch((error: unknown) => {
        if (axios.isCancel(error)) return;
        console.error("Không thể tải thông báo và lịch sử lịch học:", error);
        setLoadError(errorMessage(error));
        setCompletedRequestKey(requestKey);
      });
    return () => controller.abort();
  }, [page, debouncedSearch, eventFilter, retryCount, requestKey]);

  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / PAGE_SIZE));
  const events = result?.items ?? [];

  return (
    <main className="schedule-history-page">
      <header className="schedule-history-hero">
        <button
          type="button"
          className="schedule-history-back"
          onClick={() => navigate("/quan-ly-lich-hoc")}
        >
          <span aria-hidden="true">←</span> Quay lại Quản lý lịch học
        </button>
        <span className="schedule-history-eyebrow">ĐIỀU PHỐI ĐÀO TẠO</span>
        <h1>Thông báo và lịch sử thay đổi lịch học</h1>
        <p>
          Tra cứu các thay đổi đã được ghi nhận, nội dung thông báo và trạng thái
          gửi trong phạm vi bạn được phép xem.
        </p>
      </header>

      <section className="schedule-history-panel" aria-label="Tìm kiếm và lọc">
        <div className="schedule-history-controls">
          <label className="schedule-history-search">
            <span>Tìm kiếm</span>
            <div>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setPage(1);
                }}
                placeholder="Mã buổi, lớp học, người thực hiện, nội dung..."
                aria-label="Tìm kiếm thông báo và lịch sử"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchText("");
                    setPage(1);
                  }}
                  aria-label="Xóa nội dung tìm kiếm"
                >
                  ×
                </button>
              )}
            </div>
          </label>
          <label className="schedule-history-filter">
            <span>Loại sự kiện</span>
            <select
              value={eventFilter}
              onChange={(event) => {
                setEventFilter(event.target.value as EventFilter);
                setPage(1);
              }}
            >
              <option value="all">Tất cả sự kiện</option>
              <option value="date_time">Đổi ngày hoặc giờ</option>
              <option value="room">Đổi phòng học</option>
              <option value="instructor">Đổi giảng viên</option>
              <option value="cancelled">Hủy buổi học</option>
            </select>
          </label>
        </div>
        <div className="schedule-history-result-count" aria-live="polite">
          {loading
            ? "Đang tải dữ liệu..."
            : loadError
              ? "Không tải được kết quả."
              : `${result?.total ?? 0} kết quả`}
        </div>
      </section>

      <section className="schedule-history-panel" aria-label="Danh sách sự kiện">
        {loading ? (
          <div className="schedule-history-state" role="status">
            <span className="schedule-history-spinner" aria-hidden="true" />
            Đang tải thông báo và lịch sử...
          </div>
        ) : loadError ? (
          <div className="schedule-history-state is-error" role="alert">
            <strong>Không thể tải dữ liệu</strong>
            <p>{loadError}</p>
            <button
              type="button"
              className="schedule-history-button"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              Thử lại
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="schedule-history-state">
            <span className="schedule-history-empty-icon" aria-hidden="true">⌕</span>
            <strong>{debouncedSearch || eventFilter !== "all" ? "Không tìm thấy kết quả" : "Chưa có thông báo hoặc lịch sử"}</strong>
            <p>
              {debouncedSearch || eventFilter !== "all"
                ? "Thử từ khóa khác hoặc điều chỉnh bộ lọc."
                : "Các sự kiện lịch học sẽ xuất hiện tại đây sau khi được ghi nhận."}
            </p>
          </div>
        ) : (
          <div className="schedule-history-event-list">
            {events.map((event) => {
              const labels = eventLabels(event);
              return (
                <article className="schedule-history-event" key={event.lichHocLichSuId}>
                  <span
                    className={`schedule-history-event-marker${event.hanhDong === "Hủy" ? " is-cancelled" : ""}`}
                    aria-hidden="true"
                  />
                  <div className="schedule-history-event-main">
                    <div className="schedule-history-event-heading">
                      <div>
                        <strong>
                          {event.hanhDong === "Hủy"
                            ? "Buổi học đã bị hủy"
                            : event.hanhDong === "Tạo"
                              ? "Buổi học đã được xếp lịch"
                              : "Buổi học đã thay đổi"}
                        </strong>
                        <span>{event.maBuoiHoc} · {event.maLop ?? event.tenLop ?? "Lớp học"}</span>
                      </div>
                      <time dateTime={event.thoiDiem}>{formatTimestamp(event.thoiDiem)}</time>
                    </div>
                    <div className="schedule-history-tags">
                      {labels.map((label) => <span key={label}>{label}</span>)}
                    </div>
                    {event.noiDungThongBao && (
                      <p className="schedule-history-message">{event.noiDungThongBao}</p>
                    )}
                    {!event.noiDungThongBao && event.lyDo && (
                      <p className="schedule-history-message">Lý do: {event.lyDo}</p>
                    )}
                    <div className="schedule-history-event-footer">
                      <span>{event.nguoiThucHien ? `Người thực hiện: ${event.nguoiThucHien}` : "Người thực hiện không có dữ liệu"}</span>
                      {event.trangThaiThongBao && (
                        <span className={`schedule-notification-status${event.trangThaiThongBao.failed ? " has-failed" : ""}`}>
                          Thông báo: {event.trangThaiThongBao.sent}/{event.trangThaiThongBao.total} đã gửi
                          {event.trangThaiThongBao.failed > 0 && ` · ${event.trangThaiThongBao.failed} thất bại`}
                          {event.trangThaiThongBao.pending > 0 && ` · ${event.trangThaiThongBao.pending} đang chờ`}
                        </span>
                      )}
                      <button
                        type="button"
                        className="schedule-history-detail-link"
                        onClick={() => setSelectedEvent(event)}
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!loading && !loadError && result && result.total > 0 && (
          <nav className="schedule-history-pagination" aria-label="Phân trang lịch sử">
            <span>
              Trang {page} / {pageCount} · {Math.min((page - 1) * PAGE_SIZE + 1, result.total)}–{Math.min(page * PAGE_SIZE, result.total)} trên {result.total}
            </span>
            <div>
              <button
                type="button"
                className="schedule-history-button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                Trước
              </button>
              <button
                type="button"
                className="schedule-history-button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={page >= pageCount}
              >
                Tiếp
              </button>
            </div>
          </nav>
        )}
      </section>

      {selectedEvent && (
        <div
          className="schedule-history-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedEvent(null);
          }}
        >
          <section
            className="schedule-history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-history-detail-title"
          >
            <header>
              <div>
                <span className="schedule-history-eyebrow">{selectedEvent.maBuoiHoc}</span>
                <h2 id="schedule-history-detail-title">Chi tiết sự kiện lịch học</h2>
              </div>
              <button type="button" onClick={() => setSelectedEvent(null)} aria-label="Đóng">
                ×
              </button>
            </header>
            <div className="schedule-history-detail">
              <dl className="schedule-history-meta">
                <div><dt>Lớp học</dt><dd>{selectedEvent.maLop ?? ""}{selectedEvent.tenLop ? ` · ${selectedEvent.tenLop}` : ""}</dd></div>
                <div><dt>Loại sự kiện</dt><dd>{eventLabels(selectedEvent).join(", ")}</dd></div>
                {selectedEvent.nguoiThucHien && <div><dt>Người thực hiện</dt><dd>{selectedEvent.nguoiThucHien}</dd></div>}
                <div><dt>Thời điểm</dt><dd>{formatTimestamp(selectedEvent.thoiDiem)}</dd></div>
              </dl>
              {selectedEvent.lyDo && (
                <section className={`schedule-history-reason${selectedEvent.hanhDong === "Hủy" ? " is-cancelled" : ""}`}>
                  <h3>{selectedEvent.hanhDong === "Hủy" ? "Lý do hủy buổi học" : "Lý do ghi nhận"}</h3>
                  <p>{selectedEvent.lyDo}</p>
                </section>
              )}
              <div className="schedule-history-snapshots">
                {snapshotSchedule("Giá trị trước thay đổi", selectedEvent.duLieuCu)}
                {snapshotSchedule(
                  selectedEvent.hanhDong === "Tạo" ? "Lịch đã tạo" : "Giá trị sau thay đổi",
                  selectedEvent.duLieuMoi,
                )}
              </div>
              {selectedEvent.noiDungThongBao && (
                <section className="schedule-history-notice-detail">
                  <h3>Nội dung thông báo</h3>
                  <p>{selectedEvent.noiDungThongBao}</p>
                </section>
              )}
              {selectedEvent.trangThaiThongBao && (
                <section className="schedule-history-notice-detail">
                  <h3>Trạng thái gửi thông báo</h3>
                  <p>
                    {selectedEvent.trangThaiThongBao.sent} đã gửi ·{" "}
                    {selectedEvent.trangThaiThongBao.failed} thất bại ·{" "}
                    {selectedEvent.trangThaiThongBao.pending} đang chờ
                  </p>
                </section>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default ScheduleHistory;
