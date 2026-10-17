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

type AttendanceStatus = "Có mặt" | "Vắng" | "Muộn" | "Có phép";

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
  hocViens: AttendanceStudent[];
  trangThaiDiemDanh: string | null;
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

interface ScheduleHistory {
  lichHocLichSuId: number;
  lichHocId: number;
  maBuoiHoc: string;
  maLop: string | null;
  tenLop: string | null;
  hanhDong: string;
  duLieuCu: ScheduleRecord | null;
  duLieuMoi: ScheduleRecord | null;
  lyDo: string | null;
  thoiDiem: string;
  nguoiThucHien: string | null;
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

const localDateValue = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    `${left.ngayHoc}T${left.gioBatDau}`.localeCompare(
      `${right.ngayHoc}T${right.gioBatDau}`,
    ),
  );

const fetchScheduleData = () =>
  Promise.all([
    api.get<ScheduleOptions>("/academic/schedule-options"),
    api.get<ScheduleRecord[]>("/academic/schedules"),
    api.get<ScheduleHistory[]>("/academic/schedule-history"),
  ]);

interface ScheduleManagementProps {
  permissions: string[];
}

function ScheduleManagement({ permissions }: ScheduleManagementProps) {
  const canCreate = permissions.includes("SCHEDULE_CREATE");
  const canUpdate = permissions.includes("SCHEDULE_UPDATE");
  const canUpdateAttendance = permissions.includes("ATTENDANCE_UPDATE");
  const [options, setOptions] = useState<ScheduleOptions | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [history, setHistory] = useState<ScheduleHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [filter, setFilter] = useState("Tất cả");
  const [editing, setEditing] = useState<ScheduleRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<FormError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<ScheduleRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);
  const [attendanceSession, setAttendanceSession] =
    useState<ScheduleRecord | null>(null);
  const [attendanceStudents, setAttendanceStudents] = useState<AttendanceStudent[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const saveInProgress = useRef(false);
  const cancelInProgress = useRef(false);

  const loadData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setPageError("");
    }
    try {
      const [optionsResponse, schedulesResponse, historyResponse] =
        await fetchScheduleData();
      setOptions(optionsResponse.data);
      setSchedules(schedulesResponse.data);
      setHistory(historyResponse.data);
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
      ngayHoc: localDateValue(new Date()),
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
      form.gioKetThuc <= form.gioBatDau
    ) {
      errors.gioKetThuc = "Giờ kết thúc phải sau giờ bắt đầu.";
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
      setAttendanceStudents(response.data.hocViens);
      setSchedules((current) =>
        current.map((item) =>
          item.lichHocId === schedule.lichHocId
            ? { ...item, trangThaiDiemDanh: response.data.trangThaiDiemDanh }
            : item,
        ),
      );
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
          hocViens: attendanceStudents.map((student) => ({
            hocVienId: student.hocVienId,
            trangThai: student.trangThai,
            ghiChu: student.ghiChu || null,
          })),
        },
      );
      setSchedules((current) =>
        current.map((item) =>
          item.lichHocId === attendanceSession.lichHocId
            ? { ...item, trangThaiDiemDanh: response.data.trangThaiDiemDanh }
            : item,
        ),
      );
      setAttendanceSession(null);
      setToast({ type: "success", text: "Đã lưu điểm danh buổi học." });
      await loadData(false);
    } catch (error) {
      setAttendanceError(errorFromApi(error).message);
    } finally {
      setAttendanceSaving(false);
    }
  };

  return (
    <main className="schedule-page">
      <header className="schedule-hero">
        <div>
          <span className="schedule-eyebrow">ĐIỀU PHỐI ĐÀO TẠO</span>
          <h1>Quản lý lịch học</h1>
          <p>
            Theo dõi, cập nhật và lưu lịch sử thay đổi buổi học theo dữ liệu từ
            hệ thống.
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

      <section className="schedule-panel" aria-labelledby="schedule-list-title">
        <div className="schedule-panel-heading">
          <div>
            <h2 id="schedule-list-title">Danh sách buổi học</h2>
            <p>{schedules.length} buổi học trong phạm vi bạn được xem</p>
          </div>
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

        {loading ? (
          <div className="schedule-state" role="status">Đang tải lịch học...</div>
        ) : pageError ? (
          <div className="schedule-state schedule-state-error" role="alert">
            <span>{pageError}</span>
            <button type="button" onClick={() => void loadData()}>Thử lại</button>
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
                  <th>Điểm danh</th>
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
                    <td>{schedule.trangThaiDiemDanh ?? "—"}</td>
                    <td>
                      <div className="schedule-row-actions">
                        {canUpdateAttendance && schedule.trangThai !== "Đã hủy" && (
                          <button
                            type="button"
                            onClick={() => void openAttendance(schedule)}
                          >
                            Điểm danh
                          </button>
                        )}
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
        )}
      </section>

      <section className="schedule-panel schedule-history-panel" aria-labelledby="schedule-history-title">
        <div className="schedule-panel-heading">
          <div>
            <h2 id="schedule-history-title">Thông báo và lịch sử thay đổi</h2>
            <p>Các sự kiện đã được lưu xác nhận từ Backend</p>
          </div>
        </div>
        {loading ? (
          <div className="schedule-state">Đang tải lịch sử...</div>
        ) : history.length === 0 ? (
          <div className="schedule-state">Chưa có lịch sử cập nhật hoặc hủy buổi học.</div>
        ) : (
          <ol className="schedule-history-list">
            {history.map((item) => (
              <li className="schedule-history-item" key={item.lichHocLichSuId}>
                <span className={`schedule-history-mark ${item.hanhDong === "Hủy" ? "is-cancelled" : ""}`} aria-hidden="true" />
                <div className="schedule-history-content">
                  <div className="schedule-history-title">
                    <strong>
                      {item.hanhDong === "Hủy"
                        ? "Buổi học đã bị hủy"
                        : item.hanhDong === "Tạo"
                          ? "Buổi học đã được xếp lịch"
                          : "Buổi học đã thay đổi lịch"}
                    </strong>
                    <span>{item.maBuoiHoc} · {item.maLop ?? item.tenLop ?? "Lớp học"}</span>
                  </div>
                  {item.duLieuCu && (
                    <p>
                      <b>Lịch cũ:</b> {displayDate(item.duLieuCu.ngayHoc)} ·{" "}
                      {item.duLieuCu.gioBatDau}–{item.duLieuCu.gioKetThuc} ·{" "}
                      {item.duLieuCu.tenPhong ?? "Chưa gán phòng"} ·{" "}
                      {item.duLieuCu.giangVienTen ?? "Chưa có giảng viên"}
                    </p>
                  )}
                  {item.duLieuMoi && (
                    <p>
                      <b>{item.hanhDong === "Hủy" ? "Trạng thái:" : item.hanhDong === "Tạo" ? "Lịch:" : "Lịch mới:"}</b>{" "}
                      {item.hanhDong === "Hủy"
                        ? item.duLieuMoi.trangThai
                        : `${displayDate(item.duLieuMoi.ngayHoc)} · ${item.duLieuMoi.gioBatDau}–${item.duLieuMoi.gioKetThuc} · ${item.duLieuMoi.tenPhong ?? "Chưa gán phòng"} · ${item.duLieuMoi.giangVienTen ?? "Chưa có giảng viên"}`}
                    </p>
                  )}
                  {item.lyDo && (
                    <details className="schedule-history-reason">
                      <summary>Lý do hủy</summary>
                      <p>{item.lyDo}</p>
                    </details>
                  )}
                  <small>
                    {item.nguoiThucHien ? `${item.nguoiThucHien} · ` : ""}
                    {displayTimestamp(item.thoiDiem)}
                  </small>
                </div>
              </li>
            ))}
          </ol>
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
                          <option value="Vắng">Vắng</option>
                          <option value="Muộn">Muộn</option>
                          <option value="Có phép">Có phép</option>
                        </select>
                      </label>
                      <label className="schedule-field schedule-attendance-note">
                        <span>Ghi chú</span>
                        <input
                          maxLength={1000}
                          value={student.ghiChu}
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
                <div className="schedule-modal-actions">
                  <button
                    type="button"
                    className="schedule-secondary-button"
                    onClick={() => setAttendanceSession(null)}
                    disabled={attendanceSaving}
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="schedule-primary-button"
                    disabled={attendanceSaving || attendanceLoading}
                  >
                    {attendanceSaving ? "Đang lưu..." : "Lưu điểm danh"}
                  </button>
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
