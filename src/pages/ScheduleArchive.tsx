import { useEffect, useState } from "react";
import axios from "axios";
import api from "../services/api";
import "./ScheduleManagement.css";
import "./ScheduleArchive.css";

type ArchiveStatus = "completed" | "cancelled";

interface ScheduleRecord {
  lichHocId: number;
  maBuoiHoc: string;
  maLop: string | null;
  tenLop: string | null;
  tenMonHoc: string | null;
  ngayHoc: string;
  gioBatDau: string;
  gioKetThuc: string;
  maPhong: string | null;
  tenPhong: string | null;
  giangVienTen: string | null;
  trangThai: string;
  trangThaiDiemDanh: string | null;
  lyDoHuy: string | null;
  ngayHuy: string | null;
};

interface SchedulePageResponse {
  items: ScheduleRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface ScheduleArchiveProps {
  navigate: (path: string) => void;
}

const PAGE_SIZE = 20;

const displayDate = (value: string): string => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return "Không thể tải danh sách buổi học. Vui lòng thử lại.";
};

function ScheduleArchive({ navigate }: ScheduleArchiveProps) {
  const [status, setStatus] = useState<ArchiveStatus>("completed");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<SchedulePageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const endpoint =
      status === "completed"
        ? "/academic/schedules/completed"
        : "/academic/schedules/cancelled";

    setLoading(true);
    setLoadError("");
    void api
      .get<SchedulePageResponse>(endpoint, {
        params: {
          page,
          pageSize: PAGE_SIZE,
          q: debouncedSearch || undefined,
        },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (
          !data ||
          !Array.isArray(data.items) ||
          typeof data.total !== "number"
        ) {
          throw new Error("Backend trả về danh sách buổi học không đúng định dạng.");
        }
        setResult(data);
      })
      .catch((error: unknown) => {
        if (axios.isCancel(error) || controller.signal.aborted) return;
        console.error("Không thể tải danh sách buổi học đã lưu trữ:", error);
        setLoadError(getErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [status, page, retryCount, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / PAGE_SIZE));
  const schedules = result?.items ?? [];
  const title =
    status === "completed" ? "Buổi học đã diễn ra" : "Buổi học đã hủy";

  return (
    <main className="schedule-page schedule-archive-page">
      <header className="schedule-hero">
        <div>
          <button
            className="schedule-archive-back"
            type="button"
            onClick={() => navigate("/quan-ly-lich-hoc")}
          >
            <span aria-hidden="true">←</span> Quay lại Quản lý lịch học
          </button>
          <span className="schedule-eyebrow">ĐIỀU PHỐI ĐÀO TẠO</span>
          <h1>Lịch học đã kết thúc</h1>
          <p>
            Tra cứu riêng các buổi đã diễn ra và đã hủy để danh sách lịch học
            chính chỉ tập trung vào lịch sắp tới và đang diễn ra.
          </p>
        </div>
      </header>

      <section className="schedule-panel" aria-labelledby="schedule-archive-title">
        <div className="schedule-archive-tabs" role="tablist" aria-label="Trạng thái buổi học">
          <button
            type="button"
            role="tab"
            aria-selected={status === "completed"}
            className={status === "completed" ? "is-active" : ""}
            onClick={() => {
              setStatus("completed");
              setPage(1);
            }}
          >
            Đã diễn ra
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={status === "cancelled"}
            className={status === "cancelled" ? "is-active" : ""}
            onClick={() => {
              setStatus("cancelled");
              setPage(1);
            }}
          >
            Đã hủy
          </button>
        </div>

        <div className="schedule-panel-heading">
          <div>
            <h2 id="schedule-archive-title">{title}</h2>
            <p>
              {loading
                ? "Đang tải dữ liệu..."
                : `${result?.total ?? 0} buổi học trong phạm vi bạn được xem`}
            </p>
          </div>
          <button
            className="schedule-secondary-button"
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            disabled={loading}
          >
            Làm mới
          </button>
        </div>

        <form
          className="schedule-archive-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setDebouncedSearch(search.trim());
            setPage(1);
          }}
        >
          <label htmlFor="schedule-archive-search">Tìm kiếm</label>
          <input
            id="schedule-archive-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Mã buổi, lớp, môn học, giảng viên, phòng..."
          />
          <button className="schedule-secondary-button" type="submit">
            Tìm kiếm
          </button>
          {search && (
            <button
              className="schedule-archive-clear"
              type="button"
              onClick={() => setSearch("")}
            >
              Xóa
            </button>
          )}
        </form>

        {loading ? (
          <div className="schedule-state" role="status">
            Đang tải danh sách buổi học...
          </div>
        ) : loadError ? (
          <div className="schedule-state schedule-state-error" role="alert">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              Thử lại
            </button>
          </div>
        ) : schedules.length === 0 ? (
          <div className="schedule-state">
            Chưa có buổi học nào ở trạng thái này.
          </div>
        ) : (
          <>
            <div className="schedule-table-wrap">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th>Mã buổi / lớp</th>
                    <th>Ngày, giờ</th>
                    <th>Môn học</th>
                    <th>Phòng học</th>
                    <th>Giảng viên</th>
                    <th>Trạng thái</th>
                    <th>{status === "cancelled" ? "Lý do hủy" : "Điểm danh"}</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr key={schedule.lichHocId}>
                      <td>
                        <strong>{schedule.maBuoiHoc}</strong>
                        <span>
                          {schedule.maLop ?? "—"} · {schedule.tenLop ?? "Chưa rõ lớp"}
                        </span>
                      </td>
                      <td>
                        <strong>{displayDate(schedule.ngayHoc)}</strong>
                        <span>
                          {schedule.gioBatDau}–{schedule.gioKetThuc}
                        </span>
                      </td>
                      <td>{schedule.tenMonHoc ?? "—"}</td>
                      <td>
                        {schedule.maPhong
                          ? `${schedule.maPhong} · ${schedule.tenPhong ?? ""}`
                          : "Chưa gán"}
                      </td>
                      <td>{schedule.giangVienTen ?? "—"}</td>
                      <td>
                        <span
                          className={`schedule-status ${
                            schedule.trangThai === "Đã hủy"
                              ? "schedule-status-cancelled"
                              : "schedule-status-past"
                          }`}
                        >
                          {schedule.trangThai}
                        </span>
                      </td>
                      <td className="schedule-archive-note">
                        {status === "cancelled"
                          ? schedule.lyDoHuy ?? "Không có lý do"
                          : schedule.trangThaiDiemDanh ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <nav className="schedule-archive-pagination" aria-label="Phân trang">
                <button
                  className="schedule-secondary-button"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Trang trước
                </button>
                <span>
                  Trang {page} / {pageCount}
                </span>
                <button
                  className="schedule-secondary-button"
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Trang sau
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default ScheduleArchive;
