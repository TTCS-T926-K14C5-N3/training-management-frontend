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
  diemDanhDuocHoTro: boolean;
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
  trangThaiGuiThongBao?: {
    processed: number;
    sent: number;
    failed: number;
  } | null;
}

interface ScheduleHistorySummary {
  lichHocLichSuId: number;
  maBuoiHoc: string;
  maLop: string | null;
  tenLop: string | null;
  hanhDong: string;
  lyDo: string | null;
  thoiDiem: string;
  nguoiThucHien: string | null;
}

interface ScheduleHistoryResponse {
  items: ScheduleHistorySummary[];
  total: number;
  page: number;
  pageSize: number;
}

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
  loai: string;
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

const businessDateValue = (): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const businessTimeValue = (): string => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
};

const dayOrdinal = (value: string): number => {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
};

const minutesAfterMidnight = (value: string): number => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const tomorrowBusinessDate = (): string => {
  const [year, month, day] = businessDateValue().split("-").map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  return `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrow.getUTCDate()).padStart(2, "0")}`;
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

const errorFromApi = (error: unknown): FormError => {
  if (!axios.isAxiosError<ApiErrorBody>(error)) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi không xác định.",
      conflicts: [],
    };
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
  if (!error.response) {
    return {
      message:
        "Không kết nối được Backend. Kiểm tra Backend đang chạy và cấu hình VITE_API_URL.",
      conflicts,
    };
  }
  if (status !== undefined && status >= 500) {
    return {
      message: `Backend gặp lỗi khi xử lý yêu cầu (HTTP ${status}). Hãy kiểm tra log Backend rồi thử lại.`,
      conflicts,
    };
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
    if (firstError) {
      return {
        message: firstError.msg.replace(/^Value error,\s*/i, ""),
        conflicts,
      };
    }
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
  phongHocId: Number(form.phongHocId),
  giangVienId: Number(form.giangVienId),
});

const sortSchedules = (items: ScheduleRecord[]): ScheduleRecord[] =>
  [...items].sort((left, right) =>
    `${left.ngayHoc}T${left.gioBatDau}`.localeCompare(
      `${right.ngayHoc}T${right.gioBatDau}`,
    ),
  );

interface ScheduleManagementProps {
  permissions: string[];
  navigate: (path: string) => void;
}

function ScheduleManagement({ permissions, navigate }: ScheduleManagementProps) {
  const canCreate = permissions.includes("SCHEDULE_CREATE");
  const canUpdate = permissions.includes("SCHEDULE_UPDATE");
  const [options, setOptions] = useState<ScheduleOptions | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [historySummary, setHistorySummary] = useState<ScheduleHistoryResponse | null>(null);
  const [historySummaryError, setHistorySummaryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [filter, setFilter] = useState("Tất cả");
  const [editing, setEditing] = useState<ScheduleRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<FormError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<ScheduleRecord | null>(null);
  const [cancelling, setCancelling] = useState<ScheduleRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const saveInProgress = useRef(false);
  const cancelInProgress = useRef(false);
  const loadInProgress = useRef(false);

  const loadData = async (showLoading = true) => {
    if (loadInProgress.current) return;
    loadInProgress.current = true;
    if (showLoading) {
      setLoading(true);
      setScheduleError("");
      setOptionsError("");
    }

    try {
      const [optionsResult, schedulesResult, historyResult] =
        await Promise.allSettled([
          api.get<ScheduleOptions>("/academic/schedule-options"),
          api.get<ScheduleRecord[]>("/academic/schedules"),
          api.get<ScheduleHistoryResponse>("/academic/schedule-history", {
            params: { page: 1, pageSize: 1 },
          }),
        ]);

      if (optionsResult.status === "fulfilled") {
        const data = optionsResult.value.data;
        if (
          data &&
          Array.isArray(data.lopHocs) &&
          Array.isArray(data.giangViens) &&
          Array.isArray(data.phongHocs)
        ) {
          setOptions(data);
          setOptionsError("");
        } else {
          setOptions(null);
          setOptionsError(
            "Backend trả về danh mục lớp, giảng viên hoặc phòng học không đúng định dạng.",
          );
        }
      } else {
        console.error("Không thể tải danh mục lịch học:", optionsResult.reason);
        setOptions(null);
        setOptionsError(errorFromApi(optionsResult.reason).message);
      }

      if (
        schedulesResult.status === "fulfilled" &&
        Array.isArray(schedulesResult.value.data)
      ) {
        setSchedules(schedulesResult.value.data);
        setScheduleError("");
      } else {
        const error =
          schedulesResult.status === "rejected"
            ? schedulesResult.reason
            : new Error("Backend trả về danh sách buổi học không đúng định dạng.");
        console.error("Không thể tải lịch học:", error);
        setScheduleError(errorFromApi(error).message);
      }

      if (historyResult.status === "fulfilled" &&
          Array.isArray(historyResult.value.data.items)) {
        setHistorySummary(historyResult.value.data);
        setHistorySummaryError("");
      } else {
        const error =
          historyResult.status === "rejected"
            ? historyResult.reason
            : new Error("Backend trả về tóm tắt lịch sử không đúng định dạng.");
        console.error("Không thể tải lịch sử lịch học:", error);
        setHistorySummary(null);
        setHistorySummaryError(errorFromApi(error).message);
      }
    } finally {
      loadInProgress.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(false);
  }, []);

  const filteredSchedules = useMemo(() => {
    if (filter === "Tất cả") return schedules;
    return schedules.filter((schedule) => schedule.trangThai === filter);
  }, [filter, schedules]);

  const selectedClass = options?.lopHocs.find(
    (item) => item.lopHocId === form.lopHocId,
  );

  const openCreate = () => {
    const defaultClass = options?.lopHocs[0];
    setEditing(null);
    setFormOpen(true);
    setForm({
      ...EMPTY_FORM,
      ngayHoc: tomorrowBusinessDate(),
      gioBatDau: "08:00",
      gioKetThuc: "10:00",
      lopHocId: defaultClass?.lopHocId ?? "",
      monHocId: defaultClass?.monHocs[0]?.monHocId ?? "",
      phongHocId:
        options?.phongHocs.some(
          (room) => room.phongHocId === defaultClass?.phongHocId,
        )
          ? defaultClass?.phongHocId ?? ""
          : "",
      giangVienId:
        options?.giangViens.some(
          (teacher) => teacher.giangVienId === defaultClass?.giangVienId,
        )
          ? defaultClass?.giangVienId ?? ""
          : options?.giangViens[0]?.giangVienId ?? "",
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
    if (!form.lopHocId) errors.lopHocId = "Vui lòng chọn lớp học.";
    if (!form.monHocId) errors.monHocId = "Vui lòng chọn môn học.";
    if (!form.ngayHoc || Number.isNaN(Date.parse(`${form.ngayHoc}T00:00:00`))) {
      errors.ngayHoc = "Vui lòng chọn ngày học hợp lệ.";
    }
    if (!form.gioBatDau) errors.gioBatDau = "Vui lòng nhập giờ bắt đầu.";
    if (!form.gioKetThuc) errors.gioKetThuc = "Vui lòng nhập giờ kết thúc.";
    if (
      form.gioBatDau &&
      form.gioKetThuc &&
      minutesAfterMidnight(form.gioKetThuc) <=
        minutesAfterMidnight(form.gioBatDau)
    ) {
      errors.gioKetThuc = "Giờ kết thúc phải sau giờ bắt đầu.";
    }
    if (
      form.ngayHoc &&
      dayOrdinal(form.ngayHoc) < dayOrdinal(businessDateValue())
    ) {
      errors.ngayHoc = "Ngày học không được nằm trong quá khứ.";
    } else if (
      form.ngayHoc === businessDateValue() &&
      form.gioKetThuc &&
      minutesAfterMidnight(form.gioKetThuc) <=
        minutesAfterMidnight(businessTimeValue()) &&
      !errors.gioKetThuc
    ) {
      errors.gioKetThuc = "Buổi học phải kết thúc sau thời điểm hiện tại.";
    }
    if (!form.phongHocId) errors.phongHocId = "Vui lòng chọn phòng học.";
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
      let failedNotifications = 0;
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
        failedNotifications =
          response.data.trangThaiGuiThongBao?.failed ?? 0;
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
        text: failedNotifications > 0
          ? `${editing ? "Đã cập nhật buổi học" : "Đã tạo buổi học"}, nhưng ${failedNotifications} thông báo email chưa gửi được. Trạng thái đã được ghi nhận riêng.`
          : editing ? "Đã cập nhật buổi học." : "Đã tạo buổi học.",
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
      const failedNotifications =
        response.data.trangThaiGuiThongBao?.failed ?? 0;
      setToast({
        type: "success",
        text: failedNotifications > 0
          ? `Đã hủy buổi học, nhưng ${failedNotifications} thông báo email chưa gửi được. Trạng thái đã được ghi nhận riêng.`
          : "Đã hủy buổi học.",
      });
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

  return (
    <main className="schedule-page">
      <header className="schedule-hero">
        <div>
          <span className="schedule-eyebrow">ĐIỀU PHỐI ĐÀO TẠO</span>
          <h1>Quản lý lịch học</h1>
          <p>
            Theo dõi, cập nhật và quản lý các buổi học trong phạm vi bạn được
            phép truy cập.
          </p>
        </div>
        {canCreate && (
          <button
            className="schedule-primary-button"
            type="button"
            onClick={openCreate}
            disabled={!options || options.lopHocs.length === 0}
          >
            <span aria-hidden="true">＋</span> Tạo buổi học
          </button>
        )}
      </header>

      {optionsError && (
        <div className="schedule-state schedule-state-error" role="alert">
          <span>Không thể tải danh mục lớp học, phòng học và giảng viên: {optionsError}</span>
          <button type="button" onClick={() => void loadData()} disabled={loading}>
            Thử lại
          </button>
        </div>
      )}

      {!options?.diemDanhDuocHoTro && (
        <div className="schedule-info-banner" role="status">
          Backend hiện chưa có dữ liệu hoặc API điểm danh theo buổi học. Trạng
          thái điểm danh chưa được ghi nhận; buổi đã bắt đầu/đã qua giờ được
          khóa chỉnh sửa và hủy.
        </div>
      )}

      <section className="schedule-panel" aria-labelledby="schedule-list-title">
        <div className="schedule-panel-heading">
          <div>
            <h2 id="schedule-list-title">Danh sách buổi học</h2>
            <p>
              {loading
                ? "Đang tải danh sách buổi học..."
                : scheduleError
                  ? "Chưa tải được danh sách buổi học."
                  : `${schedules.length} buổi học trong phạm vi bạn được xem`}
            </p>
          </div>
          <div className="schedule-list-tools">
            <button
              className="schedule-secondary-button"
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
            >
              {loading ? "Đang tải..." : "Tải lại"}
            </button>
            <label className="schedule-filter">
              <span>Trạng thái</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option>Tất cả</option>
                <option>Đã lên lịch</option>
                <option>Đang diễn ra</option>
                <option>Đã diễn ra</option>
                <option>Đã hủy</option>
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="schedule-state" role="status">Đang tải lịch học...</div>
        ) : scheduleError ? (
          <div className="schedule-state schedule-state-error" role="alert">
            <span>{scheduleError}</span>
            <button type="button" onClick={() => void loadData()} disabled={loading}>
              Thử lại
            </button>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="schedule-state">
            {filter === "Tất cả"
              ? "Chưa có buổi học nào được xếp lịch."
              : "Không có buổi học phù hợp với trạng thái đã chọn."}
          </div>
        ) : (
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
                  <th><span className="schedule-sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.map((schedule) => (
                  <tr key={schedule.lichHocId}>
                    <td>
                      <strong>{schedule.maBuoiHoc}</strong>
                      <span>{schedule.maLop} · {schedule.tenLop}</span>
                    </td>
                    <td>
                      <strong>{displayDate(schedule.ngayHoc)}</strong>
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
                    <td>
                      <div className="schedule-row-actions">
                        <button type="button" onClick={() => setViewing(schedule)}>
                          Chi tiết
                        </button>
                        {canUpdate && schedule.coTheChinhSua && (
                          <button type="button" onClick={() => openEdit(schedule)}>
                            Chỉnh sửa
                          </button>
                        )}
                        {canUpdate && schedule.coTheHuy && (
                          <button
                            className="schedule-danger-link"
                            type="button"
                            onClick={() => openCancel(schedule)}
                          >
                            Hủy buổi
                          </button>
                        )}
                        {(!canUpdate ||
                          (!schedule.coTheChinhSua && !schedule.coTheHuy)) && (
                          <span className="schedule-read-only">Chỉ xem</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="schedule-history-summary" aria-labelledby="schedule-history-title">
        <div>
          <span className="schedule-summary-icon" aria-hidden="true">↻</span>
          <div>
            <h2 id="schedule-history-title">Thông báo và lịch sử thay đổi</h2>
            {historySummaryError ? (
              <p role="status">Chưa tải được tóm tắt: {historySummaryError}</p>
            ) : (
              <p>
                {historySummary
                  ? `${historySummary.total} sự kiện đã ghi nhận trong phạm vi bạn được xem.`
                  : "Đang tải số lượng sự kiện..."}
                {historySummary?.items[0] && (
                  <> Sự kiện gần nhất: {historySummary.items[0].maBuoiHoc} · {historySummary.items[0].hanhDong}.</>
                )}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          className="schedule-secondary-button"
          onClick={() => navigate("/quan-ly-lich-hoc/thong-bao")}
        >
          Xem tất cả thông báo và lịch sử
        </button>
      </section>

      {viewing && (
        <div className="schedule-modal-backdrop" role="presentation">
          <section
            className="schedule-modal schedule-cancel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-detail-title"
          >
            <div className="schedule-modal-heading">
              <div>
                <span className="schedule-eyebrow">{viewing.maBuoiHoc}</span>
                <h2 id="schedule-detail-title">Chi tiết buổi học</h2>
              </div>
              <button
                type="button"
                className="schedule-modal-close"
                onClick={() => setViewing(null)}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>
            <div className="schedule-cancel-summary">
              <strong>{viewing.maLop} · {viewing.tenLop}</strong>
              <span>Môn học: {viewing.tenMonHoc ?? "Chưa có thông tin"}</span>
              <span>Ngày học: {displayDate(viewing.ngayHoc)}</span>
              <span>Thời gian: {viewing.gioBatDau}–{viewing.gioKetThuc}</span>
              <span>Phòng học: {viewing.maPhong ? `${viewing.maPhong} · ${viewing.tenPhong}` : "Chưa gán phòng"}</span>
              <span>Giảng viên: {viewing.giangVienTen ?? "Chưa có thông tin"}</span>
              <span>Trạng thái: {viewing.trangThai}</span>
              <span>Điểm danh: {viewing.trangThaiDiemDanh ?? "Backend chưa hỗ trợ dữ liệu điểm danh"}</span>
              {viewing.lyDoHuy && <span>Lý do hủy: {viewing.lyDoHuy}</span>}
            </div>
            <div className="schedule-modal-actions">
              <button
                type="button"
                className="schedule-secondary-button"
                onClick={() => setViewing(null)}
              >
                Đóng
              </button>
            </div>
          </section>
        </div>
      )}

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
                          {conflict.loai === "giangVien" ? "Giảng viên" : "Phòng học"}{" "}
                          <b>{conflict.ten ?? conflict.maPhong ?? "đã chọn"}</b> đã có lịch{" "}
                          {conflict.gioBatDau}–{conflict.gioKetThuc} ngày{" "}
                          {displayDate(conflict.ngay)}
                          {conflict.tenLop ? ` tại lớp ${conflict.maLop} · ${conflict.tenLop}` : ""}{" "}
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
              <div className="schedule-form-grid">
                {editing && (
                  <div className="schedule-current-summary schedule-field-full">
                    <span><b>Trạng thái:</b> {editing.trangThai}</span>
                    <span>
                      <b>Điểm danh:</b>{" "}
                      {editing.trangThaiDiemDanh ?? "Backend chưa có dữ liệu điểm danh"}
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
                          monHocId: nextClass?.monHocs[0]?.monHocId ?? "",
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
                    value={form.ngayHoc}
                    min={businessDateValue()}
                    onChange={(event) => setForm((current) => ({ ...current, ngayHoc: event.target.value }))}
                    aria-invalid={!!fieldErrors.ngayHoc}
                  />
                  {fieldErrors.ngayHoc && <small>{fieldErrors.ngayHoc}</small>}
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
                  <span>Phòng học <i>*</i></span>
                  <select
                    value={form.phongHocId}
                    aria-invalid={!!fieldErrors.phongHocId}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      phongHocId: Number(event.target.value) || "",
                    }))}
                  >
                    <option value="">Chọn phòng học</option>
                    {options?.phongHocs.map((item) => (
                      <option key={item.phongHocId} value={item.phongHocId}>
                        {item.maPhong} · {item.tenPhong}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.phongHocId && <small>{fieldErrors.phongHocId}</small>}
                </label>
              </div>
              <p className="schedule-readonly-note">
                Lớp và môn học là thông tin chỉ đọc khi chỉnh sửa. Trạng thái điểm danh chưa được Backend hỗ trợ.
              </p>
              <div className="schedule-modal-actions">
                <button type="button" className="schedule-secondary-button" onClick={() => setFormOpen(false)} disabled={saving}>
                  Đóng
                </button>
                <button type="submit" className="schedule-primary-button" disabled={saving}>
                  {saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo buổi học"}
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
