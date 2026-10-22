import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import "./ScheduleManagement.css";

interface ScheduleSubjectOption {
  monHocId: number;
  maMonHoc: string;
  tenMonHoc: string;
}

interface ScheduleClassOption {
  lopHocId: number;
  maLop: string;
  tenLop: string;
  giangVienId: number | null;
  phongHocId: number | null;
  monHocs: ScheduleSubjectOption[];
}

interface ScheduleOptions {
  lopHocs: ScheduleClassOption[];
  giangViens: Array<{
    giangVienId: number;
    hoTen: string;
    email: string;
  }>;
  phongHocs: Array<{
    phongHocId: number;
    maPhong: string;
    tenPhong: string;
    trangThai: string;
  }>;
}

type AttendanceStatus =
  | "Có mặt"
  | "Đi muộn"
  | "Vắng có phép"
  | "Vắng không phép";

interface AttendanceStudent {
  hocVienId: number;
  hoTen: string;
  email: string;
  trangThai: AttendanceStatus | "";
  ghiChu: string;
  nguoiDiemDanh: string | null;
  ngayCapNhat: string | null;
}

interface AttendanceResponse {
  lichHocId: number;
  maBuoiHoc: string;
  ngayHoc: string;
  records: Array<{
    hocVienId: number;
    trangThai: AttendanceStatus | null;
  }>;
  hocViens: Array<{
    hocVienId: number;
    hoTen: string;
    email: string;
    trangThai: AttendanceStatus | null;
    ghiChu: string | null;
    nguoiDiemDanh: string | null;
    ngayCapNhat: string | null;
  }>;
  coTheCapNhat: boolean;
  canLyDoDieuChinhBatBuoc: boolean;
}

interface ScheduleRecord {
  lichHocId: number;
  maBuoiHoc: string;
  lopHocId: number;
  maLop: string | null;
  tenLop: string | null;
  monHocId: number;
  tenMonHoc: string | null;
  ngayHoc: string;
  gioBatDau: string;
  gioKetThuc: string;
  phongHocId: number | null;
  maPhong: string | null;
  tenPhong: string | null;
  giangVienId: number;
  giangVienTen: string | null;
  trangThai: string;
  coTheChinhSua: boolean;
  coTheHuy: boolean;
  trangThaiDiemDanh: string | null;
  lyDoHuy: string | null;
  ngayTao: string;
  ngayCapNhat: string;
  ngayHuy: string | null;
}

const hasAttendanceRecords = (schedule: ScheduleRecord): boolean => {
  const status = schedule.trangThaiDiemDanh;
  if (!status) return false;
  if (status.startsWith("Đã ghi nhận")) return true;

  const recordedCount = /^(\d+)\s*\/\s*\d+\s+đã điểm danh$/i.exec(status);
  return Number(recordedCount?.[1] ?? 0) > 0;
};

interface ScheduleForm {
  lopHocId: number | "";
  monHocId: number | "";
  ngayHoc: string;
  gioBatDau: string;
  gioKetThuc: string;
  phongHocId: number | "";
  giangVienId: number | "";
}

interface ScheduleConflict {
  loai: "giangVien" | "lopHoc" | "phongHoc";
  ten: string | null;
  maPhong?: string | null;
  ngay: string;
  gioBatDau: string;
  gioKetThuc: string;
  lichHocId: number;
  maBuoiHoc: string;
  maLop: string | null;
  tenLop: string | null;
}

interface ScheduleConflictCheck {
  hasConflicts: boolean;
  conflicts: ScheduleConflict[];
  canOverride: boolean;
}

interface FormError {
  message: string;
  conflicts: ScheduleConflict[];
}

interface ApiErrorBody {
  detail?: unknown;
}

const EMPTY_FORM: ScheduleForm = {
  lopHocId: "",
  monHocId: "",
  ngayHoc: "",
  gioBatDau: "",
  gioKetThuc: "",
  phongHocId: "",
  giangVienId: "",
};

const businessDateValue = (value = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const businessTimeMinutes = (value = new Date()): number => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
};

const addDaysToDateValue = (value: string, days: number): string => {
  const parsed = new Date(`${value}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const startOfWeek = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00Z`);
  const daysFromMonday = (parsed.getUTCDay() + 6) % 7;
  return addDaysToDateValue(value, -daysFromMonday);
};

const monthDateRange = (value: string): { start: string; end: string } => {
  const [year, month] = value.split("-").map(Number);
  return {
    start: `${value}-01`,
    end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
};

const shiftMonth = (value: string, amount: number): string => {
  const [year, month] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(
    shifted.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
};

const isValidDateValue = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const minutesAfterMidnight = (value: string): number | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const displayDate = (value: string): string => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

const displayDateWithWeekday = (value: string): string => {
  if (!isValidDateValue(value)) return value;
  const parsed = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
};

const displayTimestamp = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(parsed);
};

const errorFromApi = (error: unknown): FormError => {
  if (!axios.isAxiosError<ApiErrorBody>(error)) {
    return { message: "Đã xảy ra lỗi không xác định.", conflicts: [] };
  }

  const status = error.response?.status;
  const detail = error.response?.data?.detail;
  const responseDetail =
    detail && typeof detail === "object" && !Array.isArray(detail)
      ? (detail as { message?: unknown; conflicts?: unknown })
      : null;
  const conflicts = Array.isArray(responseDetail?.conflicts)
    ? responseDetail.conflicts.filter(
        (item): item is ScheduleConflict =>
          !!item &&
          typeof item === "object" &&
          "loai" in item &&
          "gioBatDau" in item &&
          "gioKetThuc" in item,
      )
    : [];

  if (status === 401) {
    return { message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.", conflicts };
  }
  if (status === 403) {
    return { message: "Bạn không có quyền thực hiện thao tác này.", conflicts };
  }
  if (status === 404) {
    return { message: "Buổi học hoặc dữ liệu liên quan không còn tồn tại.", conflicts };
  }

  if (typeof responseDetail?.message === "string") {
    return { message: responseDetail.message, conflicts };
  }
  if (typeof detail === "string") {
    return { message: detail, conflicts };
  }
  if (Array.isArray(detail)) {
    const firstError = detail.find(
      (item): item is { msg: string } =>
        !!item && typeof item === "object" && "msg" in item,
    );
    if (firstError) return { message: firstError.msg, conflicts };
  }
  if (status === 409) {
    return {
      message: "Lịch đang xung đột hoặc buổi học không còn ở trạng thái có thể sửa.",
      conflicts,
    };
  }
  if (status === 422) {
    return { message: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.", conflicts };
  }
  return { message: "Không thể xử lý yêu cầu. Vui lòng thử lại.", conflicts };
};

const schedulePayload = (form: ScheduleForm) => ({
  lopHocId: Number(form.lopHocId),
  monHocId: Number(form.monHocId),
  ngayHoc: form.ngayHoc,
  gioBatDau: form.gioBatDau,
  gioKetThuc: form.gioKetThuc,
  phongHocId: form.phongHocId === "" ? null : Number(form.phongHocId),
  giangVienId: Number(form.giangVienId),
});

const sortSchedules = (items: ScheduleRecord[]): ScheduleRecord[] =>
  [...items].sort((left, right) =>
    `${right.ngayHoc}T${right.gioBatDau}`.localeCompare(
      `${left.ngayHoc}T${left.gioBatDau}`,
    ),
  );

const attendanceStudentsFromResponse = (
  response: AttendanceResponse,
): AttendanceStudent[] =>
  response.hocViens.map((student) => ({
    ...student,
    trangThai: student.trangThai ?? "",
    ghiChu: student.ghiChu ?? "",
  }));

function ScheduleDetailsModal({
  schedule,
  onClose,
}: {
  schedule: ScheduleRecord;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="schedule-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="schedule-modal schedule-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-details-title"
      >
        <header className="schedule-modal-heading">
          <div>
            <span className="schedule-eyebrow">CHI TIẾT BUỔI HỌC</span>
            <h2 id="schedule-details-title">{schedule.maBuoiHoc}</h2>
          </div>
          <button
            type="button"
            className="schedule-modal-close"
            onClick={onClose}
            aria-label="Đóng chi tiết buổi học"
          >
            ×
          </button>
        </header>
        <div className="schedule-details-grid">
          <div><span>Lớp học</span><strong>{schedule.maLop ?? "—"} · {schedule.tenLop ?? "—"}</strong></div>
          <div><span>Môn học</span><strong>{schedule.tenMonHoc ?? "—"}</strong></div>
          <div><span>Ngày học</span><strong>{displayDateWithWeekday(schedule.ngayHoc)}</strong></div>
          <div><span>Thời gian</span><strong>{schedule.gioBatDau} – {schedule.gioKetThuc}</strong></div>
          <div><span>Phòng học</span><strong>{schedule.maPhong ? `${schedule.maPhong} · ${schedule.tenPhong ?? ""}` : "Chưa gán phòng"}</strong></div>
          <div><span>Giảng viên</span><strong>{schedule.giangVienTen ?? "Chưa phân công"}</strong></div>
          <div>
            <span>Trạng thái buổi học</span>
            <strong>{schedule.trangThai}</strong>
          </div>
          <div><span>Điểm danh</span><strong>{schedule.trangThaiDiemDanh ?? "Chưa có dữ liệu điểm danh"}</strong></div>
          {schedule.lyDoHuy && (
            <div className="schedule-details-full">
              <span>Lý do hủy</span>
              <strong>{schedule.lyDoHuy}</strong>
            </div>
          )}
          <div><span>Ngày tạo</span><strong>{displayTimestamp(schedule.ngayTao)}</strong></div>
          <div><span>Cập nhật lần cuối</span><strong>{displayTimestamp(schedule.ngayCapNhat)}</strong></div>
        </div>
      </section>
    </div>
  );
}

interface ScheduleManagementProps {
  permissions: string[];
  isStudent?: boolean;
  canReviewAbsenceRequests: boolean;
  onOpenHistory: () => void;
  onOpenArchive: () => void;
  onOpenAbsenceRequests: () => void;
}

interface StudentScheduleViewProps {
  schedules: ScheduleRecord[];
  loading: boolean;
  error: string;
  month: string;
  weekStart: string;
  onMonthChange: (month: string) => void;
  onWeekChange: (weekStart: string) => void;
  onRetry: () => void;
}

function StudentScheduleView({
  schedules,
  loading,
  error,
  month,
  weekStart,
  onMonthChange,
  onWeekChange,
  onRetry,
}: StudentScheduleViewProps) {
  const [selectedSchedule, setSelectedSchedule] =
    useState<ScheduleRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState(businessDateValue());
  const [selectedClassId, setSelectedClassId] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tất cả");
  const [viewMode, setViewMode] = useState<"list" | "week">("list");

  useEffect(() => {
    if (startOfWeek(selectedDate) !== weekStart) {
      setSelectedDate(weekStart);
    }
  }, [selectedDate, weekStart]);

  const weeklySchedules = useMemo(
    () =>
      schedules.filter(
        (schedule) =>
          schedule.ngayHoc >= weekStart &&
          schedule.ngayHoc <= addDaysToDateValue(weekStart, 6),
      ),
    [schedules, weekStart],
  );
  const classOptions = useMemo(
    () =>
      Array.from(
        new Map(
          schedules.map((schedule) => [
            schedule.lopHocId,
            {
              lopHocId: schedule.lopHocId,
              label: `${schedule.maLop ?? ""} · ${schedule.tenLop ?? ""}`,
            },
          ]),
        ).values(),
      ),
    [schedules],
  );
  const filteredWeekSchedules = useMemo(
    () =>
      weeklySchedules.filter(
        (schedule) =>
          (!selectedClassId ||
            schedule.lopHocId === Number(selectedClassId)) &&
          (statusFilter === "Tất cả" ||
            schedule.trangThai === statusFilter),
      ),
    [selectedClassId, statusFilter, weeklySchedules],
  );
  const groupedSchedules = useMemo(() => {
    const groups = new Map<string, ScheduleRecord[]>();
    filteredWeekSchedules.forEach((schedule) => {
      const group = groups.get(schedule.ngayHoc) ?? [];
      group.push(schedule);
      groups.set(schedule.ngayHoc, group);
    });
    return Array.from(groups, ([day, items]) => [
      day,
      items.sort((left, right) =>
        left.gioBatDau.localeCompare(right.gioBatDau),
      ),
    ] as const);
  }, [filteredWeekSchedules]);
  const calendarCells = useMemo(() => {
    const { start } = monthDateRange(month);
    const first = new Date(`${start}T00:00:00Z`);
    const offset = (first.getUTCDay() + 6) % 7;
    const [year, monthNumber] = month.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) =>
      addDaysToDateValue(start, index - offset),
    );
  }, [month]);
  const schedulesByDate = useMemo(() => {
    const byDate = new Map<string, string[]>();
    schedules.forEach((schedule) => {
      const statuses = byDate.get(schedule.ngayHoc) ?? [];
      statuses.push(schedule.trangThai);
      byDate.set(schedule.ngayHoc, statuses);
    });
    return byDate;
  }, [schedules]);
  const weekLabel = `${displayDate(weekStart)} – ${displayDate(
    addDaysToDateValue(weekStart, 6),
  )}`;
  const monthLabel = new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
  const upcomingCount = weeklySchedules.filter((schedule) =>
    ["Đã lên lịch", "Đang diễn ra"].includes(schedule.trangThai),
  ).length;

  const selectDate = (date: string) => {
    setSelectedDate(date);
    const nextMonth = date.slice(0, 7);
    if (nextMonth !== month) onMonthChange(nextMonth);
    onWeekChange(startOfWeek(date));
  };

  const changeMonth = (amount: number) => {
    const nextMonth = shiftMonth(month, amount);
    const nextDate = `${nextMonth}-01`;
    setSelectedDate(nextDate);
    onMonthChange(nextMonth);
    onWeekChange(startOfWeek(nextDate));
  };

  const changeWeek = (amount: number) => {
    const nextWeek = addDaysToDateValue(weekStart, amount * 7);
    setSelectedDate(nextWeek);
    const nextMonth = nextWeek.slice(0, 7);
    if (nextMonth !== month) onMonthChange(nextMonth);
    onWeekChange(nextWeek);
  };

  return (
    <section className="student-schedule-dashboard">
      <div className="student-schedule-summary">
        <article className="student-schedule-stat">
          <span className="student-schedule-stat-icon" aria-hidden="true">▦</span>
          <div>
            <small>Tổng số buổi học trong tuần</small>
            <strong>{weeklySchedules.length} buổi</strong>
          </div>
        </article>
        <article className="student-schedule-stat">
          <span className="student-schedule-stat-icon student-schedule-stat-icon-blue" aria-hidden="true">✓</span>
          <div>
            <small>Sắp diễn ra / đang diễn ra</small>
            <strong>{upcomingCount} buổi</strong>
          </div>
        </article>
        <label className="student-schedule-filter">
          <span>Lớp học</span>
          <select
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
          >
            <option value="">Tất cả lớp</option>
            {classOptions.map((item) => (
              <option key={item.lopHocId} value={item.lopHocId}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="student-schedule-filter">
          <span>Trạng thái</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>Tất cả</option>
            <option>Đã lên lịch</option>
            <option>Đang diễn ra</option>
            <option>Đã diễn ra</option>
            <option>Đã hủy</option>
          </select>
        </label>
      </div>

      <div className="student-schedule-content">
        <aside className="student-calendar-panel">
          <div className="student-calendar-heading">
            <h2>{monthLabel}</h2>
            <div>
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Tháng trước">‹</button>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Tháng sau">›</button>
              <button
                type="button"
                className="student-calendar-today"
                onClick={() => selectDate(businessDateValue())}
              >
                Hôm nay
              </button>
            </div>
          </div>
          <div className="student-calendar-grid" role="grid" aria-label={monthLabel}>
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
              <strong key={day} role="columnheader">{day}</strong>
            ))}
            {calendarCells.map((day) => {
              const statuses = schedulesByDate.get(day) ?? [];
              const inMonth = day.startsWith(month);
              return (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  aria-label={displayDateWithWeekday(day)}
                  aria-pressed={day === selectedDate}
                  className={[
                    "student-calendar-day",
                    inMonth ? "" : "outside-month",
                    day === selectedDate ? "selected" : "",
                    day === businessDateValue() ? "today" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => selectDate(day)}
                >
                  <span>{Number(day.slice(-2))}</span>
                  {statuses.length > 0 && (
                    <i className={statuses.includes("Đã hủy") ? "cancelled" : statuses.includes("Đã diễn ra") ? "completed" : ""} />
                  )}
                </button>
              );
            })}
          </div>
          <div className="student-calendar-legend">
            <span><i /> Lịch học</span>
            <span><i className="completed" /> Đã diễn ra</span>
            <span><i className="cancelled" /> Đã hủy</span>
          </div>
          <div className="student-calendar-note">
            <strong>{weeklySchedules.length} buổi học trong tuần</strong>
            <span>Lịch được cập nhật tự động khi có thay đổi.</span>
          </div>
        </aside>

        <section className="student-agenda-panel" aria-labelledby="student-agenda-title">
          <header className="student-agenda-heading">
            <div>
              <h2 id="student-agenda-title">Danh sách lịch học</h2>
              <p>{weekLabel} · {filteredWeekSchedules.length} buổi học</p>
            </div>
            <div className="student-agenda-actions">
              <div className="student-week-navigation">
                <button type="button" onClick={() => changeWeek(-1)} aria-label="Tuần trước">‹</button>
                <button type="button" onClick={() => selectDate(businessDateValue())}>Tuần này</button>
                <button type="button" onClick={() => changeWeek(1)} aria-label="Tuần sau">›</button>
              </div>
              <div className="student-view-toggle" aria-label="Kiểu hiển thị">
                <button
                  type="button"
                  className={viewMode === "list" ? "active" : ""}
                  onClick={() => setViewMode("list")}
                >
                  Danh sách
                </button>
                <button
                  type="button"
                  className={viewMode === "week" ? "active" : ""}
                  onClick={() => setViewMode("week")}
                >
                  Tuần
                </button>
              </div>
            </div>
          </header>
          {loading ? (
            <div className="schedule-state" role="status">Đang tải lịch học...</div>
          ) : error ? (
            <div className="schedule-state schedule-state-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={onRetry}>Thử lại</button>
            </div>
          ) : groupedSchedules.length === 0 ? (
            <div className="schedule-state">Không có buổi học trong tuần đã chọn.</div>
          ) : (
            <div className={`student-agenda-list ${viewMode === "week" ? "week-view" : ""}`}>
              {groupedSchedules.map(([day, daySchedules]) => (
                <section className="student-agenda-day" key={day}>
                  <h3>
                    <span aria-hidden="true">▣</span>
                    {displayDateWithWeekday(day)}
                  </h3>
                  {daySchedules.map((schedule) => (
                    <article
                      className="student-agenda-session"
                      key={schedule.lichHocId}
                      role="button"
                      tabIndex={0}
                      aria-label={`Xem chi tiết buổi ${schedule.maBuoiHoc}`}
                      onClick={() => setSelectedSchedule(schedule)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedSchedule(schedule);
                        }
                      }}
                    >
                      <div className="student-session-time">
                        <strong>{schedule.gioBatDau} – {schedule.gioKetThuc}</strong>
                        <small>{schedule.gioBatDau && schedule.gioKetThuc ? "Buổi học" : ""}</small>
                      </div>
                      <div className="student-session-icon" aria-hidden="true">▤</div>
                      <div className="student-session-details">
                        <strong>{schedule.tenMonHoc ?? "Buổi học"}</strong>
                        <span>{schedule.maLop} · {schedule.tenLop}</span>
                        <small>{schedule.maPhong ? `${schedule.maPhong} · ${schedule.tenPhong}` : "Chưa gán phòng"}</small>
                      </div>
                      <div className="student-session-teacher">
                        <strong>{schedule.giangVienTen ?? "Chưa phân công"}</strong>
                        <small>Giảng viên</small>
                      </div>
                      <span className={`student-session-status ${schedule.trangThai === "Đã hủy" ? "cancelled" : schedule.trangThai === "Đã diễn ra" ? "completed" : schedule.trangThai === "Đang diễn ra" ? "active" : ""}`}>
                        {schedule.trangThai}
                      </span>
                    </article>
                  ))}
                </section>
              ))}
            </div>
          )}
        </section>
        {selectedSchedule && (
          <ScheduleDetailsModal
            schedule={selectedSchedule}
            onClose={() => setSelectedSchedule(null)}
          />
        )}
      </div>
    </section>
  );
}

function ScheduleManagement({
  permissions,
  isStudent = false,
  canReviewAbsenceRequests,
  onOpenHistory,
  onOpenArchive,
  onOpenAbsenceRequests,
}: ScheduleManagementProps) {
  const canCreate = !isStudent && permissions.includes("SCHEDULE_CREATE");
  const canUpdate = !isStudent && permissions.includes("SCHEDULE_UPDATE");
  const canUpdateAttendance =
    !isStudent && permissions.includes("ATTENDANCE_UPDATE");
  const [options, setOptions] = useState<ScheduleOptions | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [selectedSchedule, setSelectedSchedule] =
    useState<ScheduleRecord | null>(null);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(businessDateValue()),
  );
  const [month, setMonth] = useState(() => businessDateValue().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pendingAbsenceRequestCount, setPendingAbsenceRequestCount] =
    useState(0);
  const [filter, setFilter] = useState("Tất cả");
  const [schedulePage, setSchedulePage] = useState(1);
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [calendarMode, setCalendarMode] = useState<
    "list" | "week" | "month"
  >("list");
  const calendarMenuRef = useRef<HTMLDetailsElement>(null);
  const [editing, setEditing] = useState<ScheduleRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<FormError | null>(null);
  const [conflictCheck, setConflictCheck] =
    useState<ScheduleConflictCheck | null>(null);
  const [conflictCheckError, setConflictCheckError] = useState("");
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<ScheduleRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);
  const [attendanceSession, setAttendanceSession] =
    useState<ScheduleRecord | null>(null);
  const [attendanceStudents, setAttendanceStudents] = useState<AttendanceStudent[]>([]);
  const [attendanceReason, setAttendanceReason] = useState("");
  const [attendanceCanUpdate, setAttendanceCanUpdate] = useState(false);
  const [attendanceReasonRequired, setAttendanceReasonRequired] =
    useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const saveInProgress = useRef(false);
  const cancelInProgress = useRef(false);
  const currentWeekRef = useRef(startOfWeek(businessDateValue()));

  useEffect(() => {
    if (!canReviewAbsenceRequests) return;

    let active = true;
    const loadPendingAbsenceRequestCount = async () => {
      try {
        const response = await api.get<Array<{ status: string }>>(
          "/attendance/sessions/absence-requests",
        );
        if (active) {
          setPendingAbsenceRequestCount(
            response.data.filter((request) => request.status === "pending")
              .length,
          );
        }
      } catch (error) {
        if (active) {
          console.error("Không thể tải số đơn xin phép cần duyệt:", error);
        }
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadPendingAbsenceRequestCount();
      }
    };

    void loadPendingAbsenceRequestCount();
    const refreshInterval = window.setInterval(
      refreshWhenVisible,
      60_000,
    );
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [canReviewAbsenceRequests]);

  const loadData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setPageError("");
    }
    try {
      const range = monthDateRange(month);
      const schedulesRequest = api.get<ScheduleRecord[]>("/academic/schedules", {
        params: {
          excludeCompleted: true,
          ...(isStudent
            ? {
              startDate: range.start,
              endDate: range.end,
            }
            : {}),
        },
      });
      if (canCreate || canUpdate) {
        const [optionsResponse, schedulesResponse] = await Promise.all([
          api.get<ScheduleOptions>("/academic/schedule-options"),
          schedulesRequest,
        ]);
        setOptions(optionsResponse.data);
        setSchedules(schedulesResponse.data);
      } else {
        const schedulesResponse = await schedulesRequest;
        setOptions({ lopHocs: [], giangViens: [], phongHocs: [] });
        setSchedules(schedulesResponse.data);
      }
      setPageError("");
    } catch (error) {
      console.error("Không thể tải lịch học:", error);
      setPageError(errorFromApi(error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    if (!isStudent) return;

    const refreshStudentSchedule = () => {
      if (document.visibilityState !== "visible") return;
      const currentWeek = startOfWeek(businessDateValue());
      if (currentWeek !== currentWeekRef.current) {
        currentWeekRef.current = currentWeek;
        setWeekStart(currentWeek);
        setMonth(businessDateValue().slice(0, 7));
        return;
      }
      void loadData(false);
    };
    const interval = window.setInterval(refreshStudentSchedule, 60_000);
    window.addEventListener("focus", refreshStudentSchedule);
    document.addEventListener("visibilitychange", refreshStudentSchedule);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshStudentSchedule);
      document.removeEventListener("visibilitychange", refreshStudentSchedule);
    };
  }, [isStudent, month]);

  useEffect(() => {
    setConflictCheck(null);
    setConflictCheckError("");

    if (!formOpen) {
      setCheckingConflicts(false);
      return;
    }

    const selectedClass = options?.lopHocs.find(
      (item) => item.lopHocId === form.lopHocId,
    );
    const startMinutes = minutesAfterMidnight(form.gioBatDau);
    const endMinutes = minutesAfterMidnight(form.gioKetThuc);
    const now = businessDateValue();
    const isComplete =
      !!selectedClass &&
      selectedClass.monHocs.some(
        (subject) => subject.monHocId === form.monHocId,
      ) &&
      !!form.phongHocId &&
      options?.phongHocs.some(
        (room) => room.phongHocId === form.phongHocId,
      ) === true &&
      !!options?.giangViens.some(
        (teacher) => teacher.giangVienId === form.giangVienId,
      ) &&
      isValidDateValue(form.ngayHoc) &&
      form.ngayHoc >= now &&
      startMinutes !== null &&
      (form.ngayHoc > now || startMinutes > businessTimeMinutes()) &&
      endMinutes !== null &&
      endMinutes > startMinutes;

    if (!isComplete) {
      setCheckingConflicts(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setCheckingConflicts(true);
      void api
        .post<ScheduleConflictCheck>(
          "/academic/schedules/check-conflicts",
          schedulePayload(form),
          {
            params: editing
              ? { excludeScheduleId: editing.lichHocId }
              : undefined,
            signal: controller.signal,
          },
        )
        .then((response) => setConflictCheck(response.data))
        .catch((error: unknown) => {
          if (axios.isCancel(error) || controller.signal.aborted) return;
          console.error("Không thể kiểm tra lịch học bị trùng:", error);
          setConflictCheckError(
            "Chưa kiểm tra được lịch trùng. Hệ thống vẫn sẽ kiểm tra khi lưu.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setCheckingConflicts(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [editing, form, formOpen, options]);

  const filteredSchedules = useMemo(() => {
    if (isStudent) {
      if (filter === "Tất cả") return schedules;
      return schedules.filter((schedule) => schedule.trangThai === filter);
    }
    const activeSchedules = schedules.filter(
      (schedule) =>
        (calendarMode === "week"
          ? schedule.ngayHoc >= weekStart &&
            schedule.ngayHoc <= addDaysToDateValue(weekStart, 6)
          : schedule.ngayHoc.startsWith(month)) &&
        (!classFilter || String(schedule.lopHocId) === classFilter) &&
        (!teacherFilter || String(schedule.giangVienId) === teacherFilter) &&
        (!roomFilter || String(schedule.phongHocId ?? "") === roomFilter),
    );
    if (filter === "Tất cả") return activeSchedules;
    return activeSchedules.filter((schedule) => schedule.trangThai === filter);
  }, [
    calendarMode,
    classFilter,
    filter,
    isStudent,
    month,
    roomFilter,
    schedules,
    teacherFilter,
    weekStart,
  ]);
  const schedulePageSize = 10;
  const schedulePageCount = Math.max(
    1,
    Math.ceil(filteredSchedules.length / schedulePageSize),
  );
  const currentSchedulePage = Math.min(schedulePage, schedulePageCount);
  const paginatedSchedules = useMemo(() => {
    const startIndex = (currentSchedulePage - 1) * schedulePageSize;
    return filteredSchedules.slice(startIndex, startIndex + schedulePageSize);
  }, [currentSchedulePage, filteredSchedules]);

  const managerCalendarDays = useMemo(() => {
    if (calendarMode === "week") {
      return Array.from({ length: 7 }, (_, index) =>
        addDaysToDateValue(weekStart, index),
      );
    }
    const { start, end } = monthDateRange(month);
    const days: string[] = [];
    for (let current = start; current <= end; current = addDaysToDateValue(current, 1)) {
      days.push(current);
    }
    return days;
  }, [calendarMode, month, weekStart]);

  const changeManagerWeek = (amount: number) => {
    const nextWeek = addDaysToDateValue(weekStart, amount * 7);
    setWeekStart(nextWeek);
    setMonth(nextWeek.slice(0, 7));
    setSchedulePage(1);
  };

  const changeManagerMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    setWeekStart(startOfWeek(`${nextMonth}-01`));
    setSchedulePage(1);
  };

  const selectedClass = options?.lopHocs.find(
    (item) => item.lopHocId === form.lopHocId,
  );

  const openCreate = () => {
    if (!options?.lopHocs.length) return;
    setEditing(null);
    setFormOpen(true);
    setForm({
      ...EMPTY_FORM,
      ngayHoc: businessDateValue(),
      gioBatDau: "08:00",
      gioKetThuc: "10:00",
      giangVienId: options?.giangViens[0]?.giangVienId ?? "",
    });
    setFieldErrors({});
    setFormError(null);
  };

  const openEdit = (schedule: ScheduleRecord) => {
    setEditing(schedule);
    setFormOpen(true);
    setForm({
      lopHocId: schedule.lopHocId,
      monHocId: schedule.monHocId,
      ngayHoc: schedule.ngayHoc,
      gioBatDau: schedule.gioBatDau,
      gioKetThuc: schedule.gioKetThuc,
      phongHocId: schedule.phongHocId ?? "",
      giangVienId: schedule.giangVienId,
    });
    setFieldErrors({});
    setFormError(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const today = businessDateValue();
    const selectedClass = options?.lopHocs.find(
      (item) => item.lopHocId === form.lopHocId,
    );
    if (
      !form.lopHocId ||
      (!editing && !selectedClass)
    ) {
      errors.lopHocId = "Vui lòng chọn lớp học trong danh sách lớp.";
    }
    if (
      !form.monHocId ||
      (!editing &&
        !selectedClass?.monHocs.some(
          (subject) => subject.monHocId === form.monHocId,
        ))
    ) {
      errors.monHocId = "Vui lòng chọn môn học đã được gán cho lớp.";
    }
    if (!isValidDateValue(form.ngayHoc)) {
      errors.ngayHoc = "Vui lòng chọn ngày học hợp lệ.";
    } else if (form.ngayHoc < today) {
      errors.ngayHoc = "Ngày học không được nằm trong quá khứ.";
    }
    if (!form.gioBatDau) errors.gioBatDau = "Vui lòng nhập giờ bắt đầu.";
    if (!form.gioKetThuc) errors.gioKetThuc = "Vui lòng nhập giờ kết thúc.";
    const startMinutes = minutesAfterMidnight(form.gioBatDau);
    const endMinutes = minutesAfterMidnight(form.gioKetThuc);
    if (form.gioBatDau && startMinutes === null) {
      errors.gioBatDau = "Vui lòng nhập giờ bắt đầu hợp lệ.";
    }
    if (form.gioKetThuc && endMinutes === null) {
      errors.gioKetThuc = "Vui lòng nhập giờ kết thúc hợp lệ.";
    }
    if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
      errors.gioKetThuc = "Giờ kết thúc phải sau giờ bắt đầu.";
    }
    if (
      form.ngayHoc === today &&
      startMinutes !== null &&
      startMinutes <= businessTimeMinutes()
    ) {
      errors.gioBatDau = "Buổi học trong ngày phải bắt đầu sau giờ hiện tại.";
    }
    if (!form.giangVienId) errors.giangVienId = "Vui lòng chọn giảng viên.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveInProgress.current || !validateForm()) return;

    saveInProgress.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const payload = schedulePayload(form);
      if (editing) {
        const response = await api.put<ScheduleRecord>(
          `/academic/schedules/${editing.lichHocId}`,
          payload,
        );
        setSchedules((current) =>
          sortSchedules(
            current.map((schedule) =>
              schedule.lichHocId === response.data.lichHocId
                ? response.data
                : schedule,
            ),
          ),
        );
      } else {
        const response = await api.post<ScheduleRecord>(
          "/academic/schedules",
          payload,
        );
        setSchedules((current) => sortSchedules([...current, response.data]));
      }
      setFormOpen(false);
      setEditing(null);
      setToast({
        type: "success",
        text: editing ? "Đã cập nhật buổi học." : "Đã tạo buổi học.",
      });
      await loadData(false);
    } catch (error) {
      console.error("Không thể lưu lịch học:", error);
      setFormError(errorFromApi(error));
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  };

  const submitCancellation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cancelInProgress.current || !cancelling) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError("Vui lòng nhập lý do hủy buổi học.");
      return;
    }

    cancelInProgress.current = true;
    setCancelSaving(true);
    setCancelError("");
    try {
      const response = await api.post<ScheduleRecord>(
        `/academic/schedules/${cancelling.lichHocId}/cancel`,
        { lyDo: reason },
      );
      setSchedules((current) =>
        current.map((schedule) =>
          schedule.lichHocId === response.data.lichHocId
            ? response.data
            : schedule,
        ),
      );
      setCancelling(null);
      setCancelReason("");
      setToast({ type: "success", text: "Đã hủy buổi học." });
      await loadData(false);
    } catch (error) {
      console.error("Không thể hủy buổi học:", error);
      setCancelError(errorFromApi(error).message);
    } finally {
      cancelInProgress.current = false;
      setCancelSaving(false);
    }
  };

  const openCancel = (schedule: ScheduleRecord) => {
    setCancelling(schedule);
    setCancelReason("");
    setCancelError("");
  };

  const openAttendance = async (schedule: ScheduleRecord) => {
    setAttendanceSession(schedule);
    setAttendanceLoading(true);
    setAttendanceError("");
    try {
      const response = await api.get<AttendanceResponse>(
        `/academic/schedules/${schedule.lichHocId}/attendance`,
      );
      setAttendanceStudents(attendanceStudentsFromResponse(response.data));
      setAttendanceCanUpdate(
        canUpdateAttendance && response.data.coTheCapNhat,
      );
      setAttendanceReasonRequired(
        response.data.canLyDoDieuChinhBatBuoc,
      );
      setAttendanceReason("");
    } catch (error) {
      setAttendanceError(errorFromApi(error).message);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const saveAttendance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!attendanceSession || attendanceSaving) return;
    if (attendanceStudents.some((student) => !student.trangThai)) {
      setAttendanceError("Vui lòng chọn trạng thái cho từng học viên.");
      return;
    }

    setAttendanceSaving(true);
    setAttendanceError("");
    try {
      const response = await api.put<AttendanceResponse>(
        `/academic/schedules/${attendanceSession.lichHocId}/attendance`,
        {
          records: attendanceStudents.map((student) => ({
            hocVienId: student.hocVienId,
            trangThai: student.trangThai,
            ghiChu: student.ghiChu || null,
          })),
          lyDo: attendanceReason.trim() || null,
        },
      );
      setAttendanceStudents(attendanceStudentsFromResponse(response.data));
      setAttendanceReason("");
      setAttendanceSession(null);
      setToast({ type: "success", text: "Đã lưu điểm danh buổi học." });
      await loadData(false);
    } catch (error) {
      setAttendanceError(errorFromApi(error).message);
    } finally {
      setAttendanceSaving(false);
    }
  };

  if (isStudent) {
    return (
      <main className="schedule-page student-schedule-page">
        <header className="schedule-hero student-schedule-hero">
          <div>
            <span className="schedule-eyebrow">LỊCH HỌC CÁ NHÂN</span>
            <h1>Lịch học của tôi</h1>
            <p>
              Xem và theo dõi lịch học các lớp của bạn. Lịch sẽ tự cập nhật để
              bạn không bỏ lỡ buổi học quan trọng.
            </p>
          </div>
          <div className="student-hero-decoration" aria-hidden="true">▦</div>
        </header>
        <StudentScheduleView
          schedules={schedules}
          loading={loading}
          error={pageError}
          month={month}
          weekStart={weekStart}
          onMonthChange={setMonth}
          onWeekChange={setWeekStart}
          onRetry={() => void loadData()}
        />
      </main>
    );
  }

  return (
    <main className="schedule-page">
      <header className="schedule-hero">
        <div>
          <span className="schedule-eyebrow">
            {isStudent ? "LỊCH HỌC CÁ NHÂN" : "ĐIỀU PHỐI ĐÀO TẠO"}
          </span>
          <h1>{isStudent ? "Lịch học của tôi" : "Quản lý lịch học"}</h1>
          <p>
            {isStudent
              ? "Lịch các buổi học thuộc những lớp bạn đang được ghi danh."
              : "Theo dõi, cập nhật và lưu lịch sử thay đổi buổi học theo dữ liệu từ hệ thống."}
          </p>
        </div>
        <div className="schedule-hero-actions">
          {!isStudent && (
            <button
              className="schedule-secondary-button"
              type="button"
              onClick={onOpenArchive}
            >
              Buổi đã diễn ra / đã hủy
            </button>
          )}
          {canCreate && (
            <button
              className="schedule-primary-button"
              type="button"
              onClick={openCreate}
              disabled={!options || options.lopHocs.length === 0}
              title={
                options?.lopHocs.length === 0
                  ? "Cần có ít nhất một lớp trong danh sách để tạo buổi học."
                  : undefined
              }
            >
              <span aria-hidden="true">＋</span> Tạo buổi học
            </button>
          )}
          {canCreate && !loading && options?.lopHocs.length === 0 && (
            <p className="schedule-no-classes" role="status">
              Chưa có lớp học khả dụng. Hãy tạo lớp trước khi tạo buổi học.
            </p>
          )}
        </div>
      </header>

      {selectedSchedule && (
        <ScheduleDetailsModal
          schedule={selectedSchedule}
          onClose={() => setSelectedSchedule(null)}
        />
      )}

      <section
        className={`schedule-panel${isStudent ? "" : " manager-schedule-panel"}`}
        aria-labelledby="schedule-list-title"
      >
        <div className="schedule-panel-heading">
          <div>
            <h2 id="schedule-list-title">
              {!isStudent && calendarMode === "week"
                ? "Lịch học tuần"
                : !isStudent && calendarMode === "month"
                  ? "Lịch học tháng"
                  : "Danh sách buổi học"}
            </h2>
            <p>
              {isStudent
                ? `${displayDate(weekStart)} – ${displayDate(
                    addDaysToDateValue(weekStart, 6),
                  )} · ${filteredSchedules.length} buổi học trong tuần`
                : calendarMode === "week"
                  ? `${displayDate(weekStart)} – ${displayDate(
                      addDaysToDateValue(weekStart, 6),
                    )} · ${filteredSchedules.length} buổi học trong tuần`
                  : `${filteredSchedules.length} buổi học trong tháng`}
            </p>
          </div>
          {!isStudent && (
            <div className="schedule-header-actions">
              <button
                className="schedule-secondary-button schedule-history-link"
                type="button"
                onClick={onOpenHistory}
              >
                Xem tất cả thông báo và lịch sử
              </button>
              {canReviewAbsenceRequests && (
                <button
                  className="schedule-secondary-button schedule-absence-review-link"
                  type="button"
                  onClick={onOpenAbsenceRequests}
                  aria-label={
                    pendingAbsenceRequestCount > 0
                      ? `Duyệt đơn xin phép, ${pendingAbsenceRequestCount} đơn đang chờ`
                      : "Duyệt đơn xin phép"
                  }
                >
                  Duyệt đơn
                  {pendingAbsenceRequestCount > 0 && (
                    <span
                      className="schedule-absence-review-count"
                      aria-hidden="true"
                    >
                      {pendingAbsenceRequestCount > 99
                        ? "99+"
                        : pendingAbsenceRequestCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
          <div className="schedule-panel-tools">
            {isStudent && (
              <div className="schedule-week-navigation" aria-label="Chọn tuần">
                <button
                  type="button"
                  className="schedule-secondary-button"
                  onClick={() =>
                    {
                      setWeekStart((current) => addDaysToDateValue(current, -7));
                      setSchedulePage(1);
                    }
                  }
                  aria-label="Tuần trước"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="schedule-secondary-button"
                  onClick={() => {
                    setWeekStart(startOfWeek(businessDateValue()));
                    setSchedulePage(1);
                  }}
                >
                  Tuần này
                </button>
                <button
                  type="button"
                  className="schedule-secondary-button"
                  onClick={() =>
                    {
                      setWeekStart((current) => addDaysToDateValue(current, 7));
                      setSchedulePage(1);
                    }
                  }
                  aria-label="Tuần sau"
                >
                  ›
                </button>
              </div>
            )}
            {!isStudent && (
              <div className="schedule-manager-view-controls">
                <div className="schedule-view-toggle" aria-label="Chế độ xem lịch">
                  <button type="button" aria-pressed={calendarMode === "list"} onClick={() => {
                    setCalendarMode("list");
                    setSchedulePage(1);
                  }}>Danh sách</button>
                  <details className="schedule-calendar-menu" ref={calendarMenuRef}>
                    <summary aria-label="Chọn chế độ lịch">Lịch <span aria-hidden="true">▾</span></summary>
                    <div className="schedule-calendar-menu-options">
                      <button
                        type="button"
                        aria-pressed={calendarMode === "week"}
                        onClick={() => {
                          setCalendarMode("week");
                          setSchedulePage(1);
                          if (calendarMenuRef.current) {
                            calendarMenuRef.current.open = false;
                          }
                        }}
                      >
                        Lịch tuần
                      </button>
                      <button
                        type="button"
                        aria-pressed={calendarMode === "month"}
                        onClick={() => {
                          setCalendarMode("month");
                          setSchedulePage(1);
                          if (calendarMenuRef.current) {
                            calendarMenuRef.current.open = false;
                          }
                        }}
                      >
                        Lịch tháng
                      </button>
                    </div>
                  </details>
                </div>
                {calendarMode === "week" && (
                  <div
                    className="schedule-week-navigation manager-month-navigation"
                    aria-label="Điều hướng tuần"
                  >
                    <button
                      type="button"
                      className="schedule-secondary-button"
                      onClick={() => changeManagerWeek(-1)}
                      aria-label="Tuần trước"
                    >
                      ‹
                    </button>
                    <span className="schedule-selected-period">
                      {displayDate(weekStart)} – {displayDate(
                        addDaysToDateValue(weekStart, 6),
                      )}
                    </span>
                    <button
                      type="button"
                      className="schedule-secondary-button"
                      onClick={() => changeManagerWeek(1)}
                      aria-label="Tuần sau"
                    >
                      ›
                    </button>
                  </div>
                )}
                {calendarMode !== "week" && (
                  <div
                    className="schedule-week-navigation manager-month-navigation"
                    aria-label="Chọn tháng"
                  >
                    <button
                      type="button"
                      className="schedule-secondary-button"
                      onClick={() => changeManagerMonth(shiftMonth(month, -1))}
                      aria-label="Tháng trước"
                    >
                      ‹
                    </button>
                    <span className="schedule-selected-period">
                      {new Intl.DateTimeFormat("vi-VN", {
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(`${month}-01T00:00:00Z`))}
                    </span>
                    <button
                      type="button"
                      className="schedule-secondary-button"
                      onClick={() => changeManagerMonth(shiftMonth(month, 1))}
                      aria-label="Tháng sau"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            )}
            <label className="schedule-filter">
              <span>Trạng thái</span>
              <select
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setSchedulePage(1);
                }}
              >
                <option>Tất cả</option>
                <option>Đã lên lịch</option>
                <option>Đang diễn ra</option>
                <option>Đã diễn ra</option>
                <option>Đã hủy</option>
              </select>
            </label>
            {!isStudent && (
              <>
                <label className="schedule-filter">
                  <span>Lớp</span>
                  <select value={classFilter} onChange={(event) => {
                    setClassFilter(event.target.value);
                    setSchedulePage(1);
                  }}>
                    <option value="">Tất cả lớp</option>
                    {Array.from(new Map(schedules.map((item) => [item.lopHocId, item.maLop ?? String(item.lopHocId)])).entries()).map(([id, code]) => (
                      <option key={id} value={id}>{code}</option>
                    ))}
                  </select>
                </label>
                <label className="schedule-filter">
                  <span>Giảng viên</span>
                  <select value={teacherFilter} onChange={(event) => {
                    setTeacherFilter(event.target.value);
                    setSchedulePage(1);
                  }}>
                    <option value="">Tất cả giảng viên</option>
                    {Array.from(new Map(schedules.map((item) => [item.giangVienId, item.giangVienTen ?? String(item.giangVienId)])).entries()).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </label>
                <label className="schedule-filter">
                  <span>Phòng</span>
                  <select value={roomFilter} onChange={(event) => {
                    setRoomFilter(event.target.value);
                    setSchedulePage(1);
                  }}>
                    <option value="">Tất cả phòng</option>
                    {Array.from(new Map(schedules.filter((item) => item.phongHocId !== null).map((item) => [item.phongHocId!, item.maPhong ?? String(item.phongHocId)])).entries()).map(([id, room]) => (
                      <option key={id} value={id}>{room}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        </div>

        {!isStudent && (calendarMode === "month" || calendarMode === "week") && !loading && !pageError && (
          <div
            className={`schedule-manager-calendar${calendarMode === "week" ? " week-view" : ""}`}
            role="grid"
            aria-label={calendarMode === "week"
              ? `Lịch học tuần ${displayDate(weekStart)} – ${displayDate(addDaysToDateValue(weekStart, 6))}`
              : `Lịch học tháng ${month}`}
          >
            {["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"].map((label) => (
              <strong className="schedule-manager-calendar-weekday" key={label}>{label}</strong>
            ))}
            {managerCalendarDays.map((day) => (
              <section className="schedule-manager-calendar-day" role="gridcell" key={day}>
                <strong>
                  {calendarMode === "week"
                    ? displayDateWithWeekday(day)
                    : Number(day.slice(-2))}
                </strong>
                {filteredSchedules.filter((item) => item.ngayHoc === day).map((item) => (
                  <div
                    className="schedule-manager-calendar-event"
                    key={item.lichHocId}
                    role="button"
                    tabIndex={0}
                    aria-label={`Xem chi tiết buổi ${item.maBuoiHoc}`}
                    onClick={() => setSelectedSchedule(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedSchedule(item);
                      }
                    }}
                  >
                    <span>{item.gioBatDau} · {item.maLop ?? "Lớp"} · {item.tenMonHoc ?? "Buổi học"}</span>
                    {canUpdateAttendance && item.trangThai !== "Đã hủy" && (
                      <button
                        type="button"
                        className={hasAttendanceRecords(item) ? "schedule-attendance-recorded" : ""}
                        onClick={(event) => {
                          event.stopPropagation();
                          void openAttendance(item);
                        }}
                      >
                        {hasAttendanceRecords(item) ? "Đã điểm danh" : "Điểm danh"}
                      </button>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}

        {(isStudent || calendarMode === "list") && (
          loading ? (
            <div className="schedule-state" role="status">Đang tải lịch học...</div>
          ) : pageError ? (
            <div className="schedule-state schedule-state-error" role="alert">
              <span>{pageError}</span>
              <button type="button" onClick={() => void loadData()}>Thử lại</button>
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="schedule-state">
              {filter === "Tất cả"
                ? isStudent
                  ? "Chưa có lịch học nào được xếp cho các lớp bạn đang tham gia."
                  : "Chưa có buổi học nào được xếp lịch."
                : "Không có buổi học phù hợp với trạng thái đã chọn."}
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
                  <th>Điểm danh</th>
                  <th><span className="schedule-sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {paginatedSchedules.map((schedule) => (
                  <tr
                    key={schedule.lichHocId}
                    className="schedule-table-row-clickable"
                    tabIndex={0}
                    aria-label={`Xem chi tiết buổi ${schedule.maBuoiHoc}`}
                    onClick={() => setSelectedSchedule(schedule)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedSchedule(schedule);
                      }
                    }}
                  >
                    <td>
                      <strong>{schedule.maBuoiHoc}</strong>
                      <span>{schedule.maLop} · {schedule.tenLop}</span>
                    </td>
                    <td>
                      <strong>
                        {isStudent
                          ? displayDateWithWeekday(schedule.ngayHoc)
                          : displayDate(schedule.ngayHoc)}
                      </strong>
                      <span>{schedule.gioBatDau}–{schedule.gioKetThuc}</span>
                    </td>
                    <td>{schedule.tenMonHoc ?? "—"}</td>
                    <td>{schedule.maPhong ? `${schedule.maPhong} · ${schedule.tenPhong}` : "Chưa gán"}</td>
                    <td>{schedule.giangVienTen ?? "—"}</td>
                    <td>
                      <span className={`schedule-status schedule-status-${schedule.trangThai === "Đã hủy" ? "cancelled" : schedule.trangThai === "Đã diễn ra" ? "past" : schedule.trangThai === "Đang diễn ra" ? "active" : "planned"}`}>
                        {schedule.trangThai}
                      </span>
                    </td>
                    <td>{schedule.trangThaiDiemDanh ?? "—"}</td>
                    <td>
                      <div className="schedule-row-actions">
                        {canUpdateAttendance && schedule.trangThai !== "Đã hủy" && (
                          <button
                            type="button"
                            className={hasAttendanceRecords(schedule) ? "schedule-attendance-recorded" : ""}
                            onClick={(event) => {
                              event.stopPropagation();
                              void openAttendance(schedule);
                            }}
                            title={hasAttendanceRecords(schedule) ? "Mở để xem hoặc chỉnh sửa điểm danh" : undefined}
                          >
                            {hasAttendanceRecords(schedule) ? "Đã điểm danh" : "Điểm danh"}
                          </button>
                        )}
                        {canUpdate && schedule.coTheChinhSua && (
                          <button type="button" onClick={(event) => {
                            event.stopPropagation();
                            openEdit(schedule);
                          }}>
                            Chỉnh sửa
                          </button>
                        )}
                        {canUpdate && schedule.coTheHuy && (
                          <button
                            className="schedule-danger-link"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openCancel(schedule);
                            }}
                          >
                            Hủy buổi
                          </button>
                        )}
                        {!schedule.coTheChinhSua && !schedule.coTheHuy && (
                          <span className="schedule-read-only">Chỉ xem</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
              <nav className="schedule-pagination" aria-label="Phân trang danh sách buổi học">
              <span>
                Hiển thị {(currentSchedulePage - 1) * schedulePageSize + 1}–
                {Math.min(
                  currentSchedulePage * schedulePageSize,
                  filteredSchedules.length,
                )}{" "}
                trong {filteredSchedules.length} buổi học
              </span>
              <div>
                <button
                  type="button"
                  className="schedule-secondary-button"
                  onClick={() =>
                    setSchedulePage((current) => Math.max(1, current - 1))
                  }
                  disabled={currentSchedulePage <= 1}
                  aria-label="Trang trước"
                >
                  Trước
                </button>
                <span aria-live="polite">
                  Trang {currentSchedulePage} / {schedulePageCount}
                </span>
                <button
                  type="button"
                  className="schedule-secondary-button"
                  onClick={() =>
                    setSchedulePage((current) =>
                      Math.min(schedulePageCount, current + 1),
                    )
                  }
                  disabled={currentSchedulePage >= schedulePageCount}
                  aria-label="Trang sau"
                >
                  Sau
                </button>
              </div>
              </nav>
            </>
          )
        )}
        {!isStudent && (calendarMode === "month" || calendarMode === "week") && (loading || pageError) && (
          loading ? (
            <div className="schedule-state" role="status">Đang tải lịch học...</div>
          ) : (
            <div className="schedule-state schedule-state-error" role="alert">
              <span>{pageError}</span>
              <button type="button" onClick={() => void loadData()}>Thử lại</button>
            </div>
          )
        )}
      </section>

      {formOpen && (
        <div className="schedule-modal-backdrop" role="presentation">
          <section
            className="schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-form-title"
          >
            <div className="schedule-modal-heading">
              <div>
                <span className="schedule-eyebrow">{editing ? editing.maBuoiHoc : "LỊCH HỌC MỚI"}</span>
                <h2 id="schedule-form-title">{editing ? "Chỉnh sửa buổi học" : "Tạo buổi học"}</h2>
              </div>
              <button type="button" className="schedule-modal-close" onClick={() => setFormOpen(false)} aria-label="Đóng" disabled={saving}>
                ×
              </button>
            </div>
            <form onSubmit={(event) => void submitSchedule(event)} noValidate>
              {formError && (
                <div className="schedule-form-error" role="alert">
                  <strong>{formError.message}</strong>
                  {formError.conflicts.length > 0 && (
                    <ul>
                      {formError.conflicts.map((conflict, index) => (
                        <li key={`${conflict.lichHocId}-${conflict.loai}-${index}`}>
                          {conflict.loai === "giangVien"
                            ? "Giảng viên"
                            : conflict.loai === "lopHoc"
                              ? "Lớp học"
                              : "Phòng học"}{" "}
                          <b>{conflict.ten ?? conflict.maPhong ?? conflict.maLop ?? "đã chọn"}</b> đã có lịch{" "}
                          {conflict.gioBatDau}–{conflict.gioKetThuc} ngày{" "}
                          {displayDate(conflict.ngay)}
                          {conflict.loai !== "lopHoc" && conflict.tenLop
                            ? ` tại lớp ${conflict.maLop} · ${conflict.tenLop}`
                            : ""}{" "}
                          ({conflict.maBuoiHoc}).
                        </li>
                      ))}
                    </ul>
                  )}
                  {formError.conflicts.length > 0 && (
                    <span>Vui lòng đổi thời gian, phòng học hoặc giảng viên rồi thử lại.</span>
                  )}
                </div>
              )}
              {conflictCheck?.hasConflicts && (
                <div className="schedule-form-error" role="alert">
                  <strong>Lịch học bị trùng với buổi học đã được xếp.</strong>
                  <ul>
                    {conflictCheck.conflicts.map((conflict, index) => (
                      <li key={`${conflict.lichHocId}-${conflict.loai}-${index}`}>
                        {conflict.loai === "giangVien"
                          ? "Giảng viên"
                          : conflict.loai === "lopHoc"
                            ? "Lớp học"
                            : "Phòng học"}{" "}
                        <b>{conflict.ten ?? conflict.maPhong ?? conflict.maLop ?? "đã chọn"}</b> đã có lịch{" "}
                        {conflict.gioBatDau}–{conflict.gioKetThuc} ngày{" "}
                        {displayDate(conflict.ngay)}
                        {conflict.loai !== "lopHoc" && conflict.tenLop
                          ? ` tại lớp ${conflict.maLop} · ${conflict.tenLop}`
                          : ""}{" "}
                        ({conflict.maBuoiHoc}).
                      </li>
                    ))}
                  </ul>
                  <span>Vui lòng chọn thời gian hoặc phòng học khác.</span>
                </div>
              )}
              {checkingConflicts && (
                <p className="schedule-readonly-note" role="status">
                  Đang kiểm tra trùng lịch...
                </p>
              )}
              {conflictCheckError && (
                <p className="schedule-form-error" role="status">
                  {conflictCheckError}
                </p>
              )}
              <div className="schedule-form-grid">
                {editing && (
                  <div className="schedule-current-summary schedule-field-full">
                    <span><b>Trạng thái:</b> {editing.trangThai}</span>
                    <span>
                      <b>Điểm danh:</b>{" "}
                      {editing.trangThaiDiemDanh ?? "Chưa ghi nhận"}
                    </span>
                  </div>
                )}
                <label className="schedule-field schedule-field-full">
                  <span>Lớp học <i>*</i></span>
                  {editing ? (
                    <input value={`${editing.maLop ?? ""} · ${editing.tenLop ?? ""}`} readOnly />
                  ) : (
                    <select
                      value={form.lopHocId}
                      onChange={(event) => {
                        const classId = Number(event.target.value) || "";
                        const nextClass = options?.lopHocs.find((item) => item.lopHocId === classId);
                        setForm((current) => ({
                          ...current,
                          lopHocId: classId,
                          monHocId: "",
                          giangVienId: options?.giangViens.some(
                            (teacher) => teacher.giangVienId === nextClass?.giangVienId,
                          )
                            ? nextClass?.giangVienId ?? ""
                            : options?.giangViens[0]?.giangVienId ?? "",
                          phongHocId: options?.phongHocs.some(
                            (room) => room.phongHocId === nextClass?.phongHocId,
                          )
                            ? nextClass?.phongHocId ?? ""
                            : "",
                        }));
                        setFieldErrors((current) => ({ ...current, lopHocId: "", monHocId: "" }));
                      }}
                      aria-invalid={!!fieldErrors.lopHocId}
                    >
                      <option value="">Chọn lớp học</option>
                      {options?.lopHocs.map((item) => (
                        <option key={item.lopHocId} value={item.lopHocId}>
                          {item.maLop} · {item.tenLop}
                        </option>
                      ))}
                    </select>
                  )}
                  {fieldErrors.lopHocId && <small>{fieldErrors.lopHocId}</small>}
                </label>
                <label className="schedule-field schedule-field-full">
                  <span>Môn học <i>*</i></span>
                  {editing ? (
                    <input value={editing.tenMonHoc ?? ""} readOnly />
                  ) : (
                    <select
                      value={form.monHocId}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        monHocId: Number(event.target.value) || "",
                      }))}
                      aria-invalid={!!fieldErrors.monHocId}
                      disabled={!selectedClass}
                    >
                      <option value="">Chọn môn học</option>
                      {selectedClass?.monHocs.map((item) => (
                        <option key={item.monHocId} value={item.monHocId}>
                          {item.maMonHoc} · {item.tenMonHoc}
                        </option>
                      ))}
                    </select>
                  )}
                  {fieldErrors.monHocId && <small>{fieldErrors.monHocId}</small>}
                </label>
                <label className="schedule-field">
                  <span>Ngày học <i>*</i></span>
                  <input
                    type="date"
                    min={businessDateValue()}
                    value={form.ngayHoc}
                    onChange={(event) => setForm((current) => ({ ...current, ngayHoc: event.target.value }))}
                    aria-invalid={!!fieldErrors.ngayHoc}
                  />
                  {fieldErrors.ngayHoc && <small>{fieldErrors.ngayHoc}</small>}
                  {isValidDateValue(form.ngayHoc) && (
                    <small className="schedule-hint">
                      {displayDateWithWeekday(form.ngayHoc)}
                    </small>
                  )}
                </label>
                <label className="schedule-field">
                  <span>Giảng viên dạy <i>*</i></span>
                  <select
                    value={form.giangVienId}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      giangVienId: Number(event.target.value) || "",
                    }))}
                    aria-invalid={!!fieldErrors.giangVienId}
                  >
                    <option value="">Chọn giảng viên</option>
                    {options?.giangViens.map((item) => (
                      <option key={item.giangVienId} value={item.giangVienId}>
                        {item.hoTen} · {item.email}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.giangVienId && <small>{fieldErrors.giangVienId}</small>}
                </label>
                <label className="schedule-field">
                  <span>Giờ bắt đầu <i>*</i></span>
                  <input
                    type="time"
                    value={form.gioBatDau}
                    onChange={(event) => setForm((current) => ({ ...current, gioBatDau: event.target.value }))}
                    aria-invalid={!!fieldErrors.gioBatDau}
                  />
                  {fieldErrors.gioBatDau && <small>{fieldErrors.gioBatDau}</small>}
                </label>
                <label className="schedule-field">
                  <span>Giờ kết thúc <i>*</i></span>
                  <input
                    type="time"
                    value={form.gioKetThuc}
                    onChange={(event) => setForm((current) => ({ ...current, gioKetThuc: event.target.value }))}
                    aria-invalid={!!fieldErrors.gioKetThuc}
                  />
                  {fieldErrors.gioKetThuc && <small>{fieldErrors.gioKetThuc}</small>}
                </label>
                <label className="schedule-field schedule-field-full">
                  <span>Phòng học</span>
                  <select
                    value={form.phongHocId}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      phongHocId: Number(event.target.value) || "",
                    }))}
                  >
                    <option value="">Chưa gán phòng</option>
                    {options?.phongHocs.map((item) => (
                      <option key={item.phongHocId} value={item.phongHocId}>
                        {item.maPhong} · {item.tenPhong}
                      </option>
                    ))}
                  </select>
                  <small className="schedule-hint">Để trống nếu buổi học không cần sử dụng phòng.</small>
                </label>
              </div>
              <p className="schedule-readonly-note">
                Lớp và môn học là thông tin chỉ đọc khi chỉnh sửa. Điểm danh được quản lý riêng theo từng buổi học.
              </p>
              <div className="schedule-modal-actions">
                <button type="button" className="schedule-secondary-button" onClick={() => setFormOpen(false)} disabled={saving}>
                  Đóng
                </button>
                <button
                  type="submit"
                  className="schedule-primary-button"
                  disabled={
                    saving || checkingConflicts || !!conflictCheck?.hasConflicts
                  }
                >
                  {saving
                    ? "Đang lưu..."
                    : checkingConflicts
                      ? "Đang kiểm tra lịch..."
                      : editing
                        ? "Lưu thay đổi"
                        : "Tạo buổi học"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {cancelling && (
        <div className="schedule-modal-backdrop" role="presentation">
          <section
            className="schedule-modal schedule-cancel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-cancel-title"
          >
            <div className="schedule-modal-heading">
              <div>
                <span className="schedule-eyebrow">THAO TÁC KHÔNG THỂ HOÀN TÁC</span>
                <h2 id="schedule-cancel-title">Xác nhận hủy buổi học</h2>
              </div>
              <button type="button" className="schedule-modal-close" onClick={() => setCancelling(null)} aria-label="Đóng" disabled={cancelSaving}>
                ×
              </button>
            </div>
            <div className="schedule-cancel-summary">
              <strong>{cancelling.maBuoiHoc} · {cancelling.maLop} — {cancelling.tenLop}</strong>
              <span>{cancelling.tenMonHoc}</span>
              <span>{displayDate(cancelling.ngayHoc)} · {cancelling.gioBatDau}–{cancelling.gioKetThuc}</span>
              <span>{cancelling.tenPhong ?? "Chưa gán phòng"} · {cancelling.giangVienTen ?? "Chưa có giảng viên"}</span>
            </div>
            <form onSubmit={(event) => void submitCancellation(event)} noValidate>
              <label className="schedule-field">
                <span>Lý do hủy <i>*</i></span>
                <textarea
                  value={cancelReason}
                  onChange={(event) => {
                    setCancelReason(event.target.value);
                    if (event.target.value.trim()) setCancelError("");
                  }}
                  rows={4}
                  maxLength={1000}
                  aria-invalid={!!cancelError}
                  placeholder="Nhập lý do hủy buổi học"
                  autoFocus
                />
                {cancelError && <small>{cancelError}</small>}
              </label>
              <div className="schedule-modal-actions">
                <button type="button" className="schedule-secondary-button" onClick={() => setCancelling(null)} disabled={cancelSaving}>
                  Quay lại
                </button>
                <button type="submit" className="schedule-danger-button" disabled={cancelSaving}>
                  {cancelSaving ? "Đang hủy..." : "Xác nhận hủy"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {attendanceSession && (
        <div className="schedule-modal-backdrop" role="presentation">
          <section
            className="schedule-modal schedule-attendance-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-attendance-title"
          >
            <div className="schedule-modal-heading">
              <div>
                <span className="schedule-eyebrow">
                  {attendanceSession.maBuoiHoc} · {attendanceSession.maLop}
                </span>
                <h2 id="schedule-attendance-title">Điểm danh học viên</h2>
                <p>
                  {displayDate(attendanceSession.ngayHoc)} · {attendanceSession.gioBatDau}–{attendanceSession.gioKetThuc} · {attendanceSession.tenMonHoc}
                </p>
              </div>
              <button
                type="button"
                className="schedule-modal-close"
                onClick={() => setAttendanceSession(null)}
                aria-label="Đóng"
                disabled={attendanceSaving}
              >
                ×
              </button>
            </div>
            {attendanceError && (
              <div className="schedule-form-error" role="alert">
                {attendanceError}
              </div>
            )}
            {attendanceLoading ? (
              <div className="schedule-state" role="status">
                Đang tải danh sách học viên...
              </div>
            ) : attendanceStudents.length === 0 ? (
              <div className="schedule-state">
                Không có học viên thuộc lớp vào ngày diễn ra buổi học.
              </div>
            ) : (
              <form onSubmit={(event) => void saveAttendance(event)}>
                {attendanceCanUpdate && (
                  <div className="schedule-attendance-toolbar">
                    <button
                      type="button"
                      className="schedule-secondary-button"
                      disabled={attendanceSaving}
                      onClick={() =>
                        setAttendanceStudents((current) =>
                          current.map((student) => ({
                            ...student,
                            trangThai: "Có mặt",
                          })),
                        )
                      }
                    >
                      Đánh dấu tất cả có mặt
                    </button>
                  </div>
                )}
                <div className="schedule-attendance-list">
                  {attendanceStudents.map((student, index) => (
                    <div className="schedule-attendance-row" key={student.hocVienId}>
                      <div className="schedule-attendance-student">
                        <strong>{student.hoTen}</strong>
                        <small>{student.email}</small>
                        {student.nguoiDiemDanh && student.ngayCapNhat && (
                          <small>
                            Cập nhật bởi {student.nguoiDiemDanh} · {displayTimestamp(student.ngayCapNhat)}
                          </small>
                        )}
                      </div>
                      <label className="schedule-field">
                        <span>Trạng thái</span>
                        <select
                          required
                          value={student.trangThai}
                          disabled={!attendanceCanUpdate || attendanceSaving}
                          onChange={(event) =>
                            setAttendanceStudents((current) =>
                              current.map((item) =>
                                item.hocVienId === student.hocVienId
                                  ? { ...item, trangThai: event.target.value as AttendanceStatus }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="">Chọn trạng thái</option>
                          <option value="Có mặt">Có mặt</option>
                          <option value="Đi muộn">Đi muộn</option>
                          <option value="Vắng có phép">Vắng có phép</option>
                          <option value="Vắng không phép">Vắng không phép</option>
                        </select>
                      </label>
                      <label className="schedule-field schedule-attendance-note">
                        <span>Ghi chú</span>
                        <input
                          maxLength={1000}
                          value={student.ghiChu}
                          disabled={!attendanceCanUpdate || attendanceSaving}
                          onChange={(event) =>
                            setAttendanceStudents((current) =>
                              current.map((item) =>
                                item.hocVienId === student.hocVienId
                                  ? { ...item, ghiChu: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          aria-label={`Ghi chú điểm danh ${student.hoTen}`}
                        />
                      </label>
                      <span className="schedule-attendance-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                  ))}
                </div>
                {attendanceCanUpdate &&
                  attendanceReasonRequired && (
                  <label className="schedule-field">
                    <span>Lý do điều chỉnh (bắt buộc)</span>
                    <textarea
                      value={attendanceReason}
                      onChange={(event) => setAttendanceReason(event.target.value)}
                      rows={3}
                      maxLength={1000}
                      disabled={attendanceSaving}
                    />
                  </label>
                )}
                <div className="schedule-modal-actions">
                  <button
                    type="button"
                    className="schedule-secondary-button"
                    onClick={() => setAttendanceSession(null)}
                    disabled={attendanceSaving}
                  >
                    Đóng
                  </button>
                  {attendanceCanUpdate && <button
                    type="submit"
                    className="schedule-primary-button"
                    disabled={attendanceSaving || attendanceLoading}
                  >
                    {attendanceSaving ? "Đang lưu..." : "Lưu điểm danh"}
                  </button>}
                </div>
              </form>
            )}
          </section>
        </div>
      )}

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

export default ScheduleManagement;
