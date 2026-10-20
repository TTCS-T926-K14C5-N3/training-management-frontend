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
  buoiHocs?: Array<{
    buoiHocId: number;
    soThuTu: number;
    chuDe: string;
  }>;
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
  buoiHocId: number | null;
  soThuTuBuoi: number | null;
  chuDeBuoiHoc: string | null;
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

interface ScheduleNotification {
  id: number;
  title: string;
  message: string;
  at: string;
}

interface ScheduleForm {
  lopHocId: number | "";
  monHocId: number | "";
  buoiHocId: number | "";
  ngayHoc: string;
  gioBatDau: string;
  gioKetThuc: string;
  phongHocId: number | "";
  giangVienId: number | "";
}

interface ScheduleGenerateForm {
  lopHocId: number | "";
  monHocId: number | "";
  ngayBatDau: string;
  thuTrongTuan: number[];
  soBuoi: number;
  gioBatDau: string;
  gioKetThuc: string;
  phongHocId: number | "";
  giangVienId: number | "";
  ngayNghi: string[];
}

interface GeneratedPreview {
  sessions: Array<{
    ngayHoc: string;
    buoiHocId: number;
    soThuTu: number;
    chuDe: string;
  }>;
  skippedHolidays: string[];
  conflicts: ScheduleConflict[];
}

interface ScheduleAttendanceRecord {
  hocVienId: number;
  hoTen: string;
  email: string;
  trangThai: string | null;
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
  buoiHocId: "",
  ngayHoc: "",
  gioBatDau: "",
  gioKetThuc: "",
  phongHocId: "",
  giangVienId: "",
};

const WEEKDAYS = [
  { value: 1, label: "Thứ Hai" },
  { value: 2, label: "Thứ Ba" },
  { value: 3, label: "Thứ Tư" },
  { value: 4, label: "Thứ Năm" },
  { value: 5, label: "Thứ Sáu" },
  { value: 6, label: "Thứ Bảy" },
  { value: 7, label: "Chủ nhật" },
];

const lessonsOf = (subject: ScheduleSubjectOption | undefined) =>
  subject?.buoiHocs ?? [];

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
    if (detail === "Not Found") {
      return {
        message: "Backend hiện chưa nạp API điểm danh theo buổi. Hãy khởi động lại backend từ thư mục training-management-backend-main rồi thử lại.",
        conflicts,
      };
    }
    if (typeof detail === "string") {
      return { message: detail, conflicts };
    }
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
  if (axios.isAxiosError(error) && !error.response) {
    return {
      message: "Không kết nối được backend. Hãy kiểm tra backend đang chạy rồi thử lại.",
      conflicts,
    };
  }
  return { message: "Không thể xử lý yêu cầu. Vui lòng thử lại.", conflicts };
};

const schedulePayload = (form: ScheduleForm) => ({
  lopHocId: Number(form.lopHocId),
  monHocId: Number(form.monHocId),
  buoiHocId: form.buoiHocId === "" ? null : Number(form.buoiHocId),
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
  const [options, setOptions] = useState<ScheduleOptions | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [history, setHistory] = useState<ScheduleHistory[]>([]);
  const [notifications, setNotifications] = useState<ScheduleNotification[]>([]);
  const [notificationError, setNotificationError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [filter, setFilter] = useState("Tất cả");
  const [editing, setEditing] = useState<ScheduleRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<FormError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorForm, setGeneratorForm] = useState<ScheduleGenerateForm | null>(null);
  const [holidayInput, setHolidayInput] = useState("");
  const [generationPreview, setGenerationPreview] = useState<GeneratedPreview | null>(null);
  const [generationError, setGenerationError] = useState<FormError | null>(null);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [attendanceSchedule, setAttendanceSchedule] = useState<ScheduleRecord | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<ScheduleAttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceErrorAction, setAttendanceErrorAction] = useState<"load" | "save" | null>(null);
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
  const generationInProgress = useRef(false);

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
      try {
        const notificationsResponse = await api.get<ScheduleNotification[]>(
          "/academic/schedule-notifications",
        );
        setNotifications(notificationsResponse.data);
        setNotificationError("");
      } catch (notificationLoadError) {
        console.error("Không thể tải thông báo lịch học:", notificationLoadError);
        setNotificationError(errorFromApi(notificationLoadError).message);
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
  }, []);

  const filteredSchedules = useMemo(() => {
    if (filter === "Tất cả") return schedules;
    return schedules.filter((schedule) => schedule.trangThai === filter);
  }, [filter, schedules]);

  const selectedClass = options?.lopHocs.find(
    (item) => item.lopHocId === form.lopHocId,
  );
  const selectedSubject = selectedClass?.monHocs.find(
    (item) => item.monHocId === form.monHocId,
  );
  const generatorClass = options?.lopHocs.find(
    (item) => item.lopHocId === generatorForm?.lopHocId,
  );
  const generatorSubject = generatorClass?.monHocs.find(
    (item) => item.monHocId === generatorForm?.monHocId,
  );
  const hasGeneratableSubject = options?.lopHocs.some(
    (item) => item.monHocs.length > 0,
  ) ?? false;

  const updateGeneratorForm = (changes: Partial<ScheduleGenerateForm>) => {
    setGeneratorForm((current) => current ? { ...current, ...changes } : current);
    setGenerationPreview(null);
    setGenerationError(null);
  };

  const openGenerator = () => {
    const defaultClass = options?.lopHocs.find((item) => item.monHocs.length > 0);
    const defaultSubject = defaultClass?.monHocs.find(
      (subject) => lessonsOf(subject).length > 0,
    ) ?? defaultClass?.monHocs[0];
    if (!defaultClass || !defaultSubject) return;
    setGeneratorForm({
      lopHocId: defaultClass.lopHocId,
      monHocId: defaultSubject.monHocId,
      ngayBatDau: localDateValue(new Date()),
      thuTrongTuan: [1, 2, 3, 4, 5],
      soBuoi: Math.min(200, Math.max(1, lessonsOf(defaultSubject).length)),
      gioBatDau: "08:00",
      gioKetThuc: "10:00",
      phongHocId: options?.phongHocs.some(
        (room) => room.phongHocId === defaultClass.phongHocId,
      ) ? defaultClass.phongHocId ?? "" : "",
      giangVienId: options?.giangViens.some(
        (teacher) => teacher.giangVienId === defaultClass.giangVienId,
      ) ? defaultClass.giangVienId ?? "" : options?.giangViens[0]?.giangVienId ?? "",
      ngayNghi: [],
    });
    setHolidayInput("");
    setGenerationPreview(null);
    setGenerationError(null);
    setGeneratorOpen(true);
  };

  const previewGeneratedSchedules = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!generatorForm || generationInProgress.current) return;
    if (lessonsOf(generatorSubject).length === 0) {
      setGenerationError({
        message: "Môn học này chưa có danh sách bài học. Hãy bổ sung bài học trong chương trình đào tạo trước khi tạo lịch tự động.",
        conflicts: [],
      });
      return;
    }
    if (generatorForm.thuTrongTuan.length === 0) {
      setGenerationError({ message: "Vui lòng chọn ít nhất một ngày trong tuần.", conflicts: [] });
      return;
    }
    generationInProgress.current = true;
    setGenerationLoading(true);
    setGenerationError(null);
    setGenerationPreview(null);
    try {
      const response = await api.post<GeneratedPreview>(
        "/academic/schedules/generate-preview",
        {
          ...generatorForm,
          lopHocId: Number(generatorForm.lopHocId),
          monHocId: Number(generatorForm.monHocId),
          phongHocId: generatorForm.phongHocId === "" ? null : Number(generatorForm.phongHocId),
          giangVienId: Number(generatorForm.giangVienId),
        },
      );
      setGenerationPreview(response.data);
    } catch (error) {
      console.error("Không thể xem trước lịch tự động:", error);
      setGenerationError(errorFromApi(error));
    } finally {
      generationInProgress.current = false;
      setGenerationLoading(false);
    }
  };

  const confirmGeneratedSchedules = async () => {
    if (!generatorForm || !generationPreview || generationPreview.conflicts.length > 0 || generationInProgress.current) return;
    generationInProgress.current = true;
    setGenerationLoading(true);
    setGenerationError(null);
    try {
      const response = await api.post<ScheduleRecord[]>(
        "/academic/schedules/generate",
        {
          ...generatorForm,
          lopHocId: Number(generatorForm.lopHocId),
          monHocId: Number(generatorForm.monHocId),
          phongHocId: generatorForm.phongHocId === "" ? null : Number(generatorForm.phongHocId),
          giangVienId: Number(generatorForm.giangVienId),
        },
      );
      setSchedules((current) => sortSchedules([...current, ...response.data]));
      setGeneratorOpen(false);
      setGeneratorForm(null);
      setGenerationPreview(null);
      setToast({ type: "success", text: `Đã tạo ${response.data.length} buổi học theo mẫu.` });
      await loadData(false);
    } catch (error) {
      console.error("Không thể tạo lịch tự động:", error);
      setGenerationError(errorFromApi(error));
    } finally {
      generationInProgress.current = false;
      setGenerationLoading(false);
    }
  };

  const openAttendance = async (schedule: ScheduleRecord) => {
    setAttendanceSchedule(schedule);
    setAttendanceRecords([]);
    setAttendanceLoading(true);
    setAttendanceError("");
    setAttendanceErrorAction(null);
    try {
      const response = await api.get<{ records: ScheduleAttendanceRecord[] }>(
        `/academic/schedules/${schedule.lichHocId}/attendance`,
      );
      setAttendanceRecords(response.data.records);
    } catch (error) {
      console.error("Không thể tải danh sách điểm danh:", error);
      setAttendanceError(errorFromApi(error).message);
      setAttendanceErrorAction("load");
    } finally {
      setAttendanceLoading(false);
    }
  };

  const saveAttendance = async () => {
    if (!attendanceSchedule || attendanceLoading) return;
    setAttendanceLoading(true);
    setAttendanceError("");
    setAttendanceErrorAction(null);
    try {
      const response = await api.put<{ records: ScheduleAttendanceRecord[] }>(
        `/academic/schedules/${attendanceSchedule.lichHocId}/attendance`,
        {
          records: attendanceRecords.map(({ hocVienId, trangThai }) => ({
            hocVienId,
            trangThai,
          })),
        },
      );
      setAttendanceRecords(response.data.records);
      setSchedules((current) =>
        current.map((schedule) =>
          schedule.lichHocId === attendanceSchedule.lichHocId
            ? {
                ...schedule,
                trangThaiDiemDanh: `Đã ghi nhận ${
                  response.data.records.filter((record) => record.trangThai).length
                }/${response.data.records.length}`,
              }
            : schedule,
        ),
      );
      setToast({ type: "success", text: "Đã lưu điểm danh buổi học." });
      setAttendanceSchedule(null);
    } catch (error) {
      console.error("Không thể lưu điểm danh:", error);
      setAttendanceError(errorFromApi(error).message);
      setAttendanceErrorAction("save");
    } finally {
      setAttendanceLoading(false);
    }
  };

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
      buoiHocId: lessonsOf(defaultClass?.monHocs[0])[0]?.buoiHocId ?? "",
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
      buoiHocId: schedule.buoiHocId ?? "",
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
          <div className="schedule-hero-actions">
            <button
              className="schedule-secondary-button"
              type="button"
              onClick={openGenerator}
              disabled={!options || !hasGeneratableSubject}
            >
              Tạo lịch tự động
            </button>
            <button
              className="schedule-primary-button"
              type="button"
              onClick={openCreate}
              disabled={!options || options.lopHocs.length === 0}
            >
              <span aria-hidden="true">＋</span> Tạo buổi học
            </button>
          </div>
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
                    <td>
                      {schedule.tenMonHoc ?? "—"}
                      {schedule.chuDeBuoiHoc && (
                        <span className="schedule-lesson-topic">
                          Buổi {schedule.soThuTuBuoi}: {schedule.chuDeBuoiHoc}
                        </span>
                      )}
                    </td>
                    <td>{schedule.maPhong ? `${schedule.maPhong} · ${schedule.tenPhong}` : "Chưa gán"}</td>
                    <td>{schedule.giangVienTen ?? "—"}</td>
                    <td>
                      <span className={`schedule-status schedule-status-${schedule.trangThai === "Đã hủy" ? "cancelled" : schedule.trangThai === "Đã diễn ra" ? "past" : schedule.trangThai === "Đang diễn ra" ? "active" : "planned"}`}>
                        {schedule.trangThai}
                      </span>
                    </td>
                    <td>
                      <div className="schedule-row-actions">
                        {canUpdate && schedule.coTheChinhSua && (
                          <button type="button" onClick={() => openEdit(schedule)}>
                            Chỉnh sửa
                          </button>
                        )}
                        {canUpdate && schedule.trangThai !== "Đã hủy" && (
                          <button type="button" onClick={() => void openAttendance(schedule)}>
                            Điểm danh
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
                          <span className="schedule-read-only">
                            {schedule.trangThaiDiemDanh?.startsWith("Đã ghi nhận")
                              ? "Đã điểm danh · chỉ xem"
                              : "Chỉ xem"}
                          </span>
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

      <section className="schedule-panel schedule-notification-panel" aria-labelledby="schedule-notification-title">
        <div className="schedule-panel-heading">
          <div>
            <h2 id="schedule-notification-title">Thông báo lịch học</h2>
            <p>Thông báo thay đổi lịch gửi riêng cho học viên và giảng viên liên quan</p>
          </div>
        </div>
        {notificationError ? (
          <div className="schedule-state schedule-state-error" role="alert">{notificationError}</div>
        ) : notifications.length === 0 ? (
          <div className="schedule-state">Bạn chưa có thông báo thay đổi lịch học.</div>
        ) : (
          <ol className="schedule-notification-list">
            {notifications.map((item) => (
              <li key={item.id} className="schedule-notification-item">
                <span className="schedule-notification-mark" aria-hidden="true" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  <time dateTime={item.at}>{displayTimestamp(item.at)}</time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="schedule-panel schedule-history-panel" aria-labelledby="schedule-history-title">
        <div className="schedule-panel-heading">
          <div>
            <h2 id="schedule-history-title">Lịch sử thay đổi</h2>
            <p>Thông tin trước/sau, lý do và người thực hiện được lưu trong hệ thống</p>
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

      {attendanceSchedule && (
        <div className="schedule-modal-backdrop" role="presentation">
          <section
            className="schedule-modal schedule-attendance-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-attendance-title"
          >
            <div className="schedule-modal-heading">
              <div>
                <span className="schedule-eyebrow">{attendanceSchedule.maBuoiHoc} · {attendanceSchedule.maLop}</span>
                <h2 id="schedule-attendance-title">Điểm danh học viên</h2>
                <p>{displayDate(attendanceSchedule.ngayHoc)} · {attendanceSchedule.gioBatDau}–{attendanceSchedule.gioKetThuc}</p>
              </div>
              <button
                type="button"
                className="schedule-modal-close"
                onClick={() => setAttendanceSchedule(null)}
                aria-label="Đóng"
                disabled={attendanceLoading}
              >
                ×
              </button>
            </div>
            {attendanceError ? (
              <div className="schedule-form-error" role="alert">
                <strong>{attendanceError}</strong>
                <div className="schedule-modal-actions">
                  <button
                    type="button"
                    className="schedule-secondary-button"
                    onClick={() => setAttendanceSchedule(null)}
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    className="schedule-primary-button"
                    onClick={() => void (attendanceErrorAction === "save"
                      ? saveAttendance()
                      : openAttendance(attendanceSchedule))}
                    disabled={attendanceLoading}
                  >
                    {attendanceErrorAction === "save" ? "Lưu lại" : "Thử lại"}
                  </button>
                </div>
              </div>
            ) : attendanceLoading && attendanceRecords.length === 0 ? (
              <div className="schedule-state" role="status">Đang tải danh sách học viên...</div>
            ) : attendanceRecords.length === 0 ? (
              <div className="schedule-state">
                Lớp chưa có học viên ghi danh. Hãy ghi danh học viên trước khi điểm danh.
              </div>
            ) : (
              <>
                <div className="schedule-attendance-list">
                  {attendanceRecords.map((record) => (
                    <label className="schedule-attendance-row" key={record.hocVienId}>
                      <span>
                        <strong>{record.hoTen}</strong>
                        <small>{record.email}</small>
                      </span>
                      <select
                        value={record.trangThai ?? ""}
                        disabled={attendanceLoading}
                        onChange={(event) => setAttendanceRecords((current) =>
                          current.map((item) =>
                            item.hocVienId === record.hocVienId
                              ? { ...item, trangThai: event.target.value || null }
                              : item,
                          ),
                        )}
                      >
                        <option value="">Chưa điểm danh</option>
                        <option value="Có mặt">Có mặt</option>
                        <option value="Đi muộn">Đi muộn</option>
                        <option value="Vắng có phép">Vắng có phép</option>
                        <option value="Vắng không phép">Vắng không phép</option>
                      </select>
                    </label>
                  ))}
                </div>
                <div className="schedule-modal-actions schedule-attendance-actions">
                  <button
                    type="button"
                    className="schedule-secondary-button"
                    onClick={() => setAttendanceSchedule(null)}
                    disabled={attendanceLoading}
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    className="schedule-primary-button"
                    onClick={() => void saveAttendance()}
                    disabled={attendanceLoading}
                  >
                    {attendanceLoading ? "Đang lưu..." : "Lưu điểm danh"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {generatorOpen && generatorForm && (
        <div className="schedule-modal-backdrop" role="presentation">
          <section
            className="schedule-modal schedule-generator-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-generator-title"
          >
            <div className="schedule-modal-heading">
              <div>
                <span className="schedule-eyebrow">XẾP LỊCH THEO MẪU</span>
                <h2 id="schedule-generator-title">Tạo lịch học tự động</h2>
              </div>
              <button
                type="button"
                className="schedule-modal-close"
                onClick={() => setGeneratorOpen(false)}
                aria-label="Đóng"
                disabled={generationLoading}
              >
                ×
              </button>
            </div>
            <form onSubmit={(event) => void previewGeneratedSchedules(event)} noValidate>
              {generationError && (
                <div className="schedule-form-error" role="alert">
                  <strong>{generationError.message}</strong>
                  {generationError.conflicts.length > 0 && (
                    <ul>
                      {generationError.conflicts.map((conflict, index) => (
                        <li key={`${conflict.lichHocId}-${conflict.loai}-${index}`}>
                          {conflict.loai === "giangVien" ? "Giảng viên" : conflict.loai === "lopHoc" ? "Lớp học" : "Phòng học"}{" "}
                          {conflict.ten ?? conflict.maPhong ?? ""} bị trùng lịch
                          ngày {displayDate(conflict.ngay)} ({conflict.gioBatDau}–{conflict.gioKetThuc}).
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {generatorSubject && lessonsOf(generatorSubject).length === 0 && (
                <div className="schedule-info-banner" role="status">
                  Môn học này chưa có bài học trong chương trình đào tạo. Hãy bổ sung danh sách bài học trước khi xem trước và lưu lịch.
                </div>
              )}

              <div className="schedule-form-grid">
                <label className="schedule-field schedule-field-full">
                  <span>Lớp học <i>*</i></span>
                  <select
                    required
                    value={generatorForm.lopHocId}
                    onChange={(event) => {
                      const classId = Number(event.target.value) || "";
                      const nextClass = options?.lopHocs.find((item) => item.lopHocId === classId);
                      const nextSubject = nextClass?.monHocs.find(
                        (subject) => lessonsOf(subject).length > 0,
                      ) ?? nextClass?.monHocs[0];
                      updateGeneratorForm({
                        lopHocId: classId,
                        monHocId: nextSubject?.monHocId ?? "",
                        soBuoi: Math.min(200, Math.max(1, lessonsOf(nextSubject).length)),
                        giangVienId: options?.giangViens.some(
                          (teacher) => teacher.giangVienId === nextClass?.giangVienId,
                        ) ? nextClass?.giangVienId ?? "" : options?.giangViens[0]?.giangVienId ?? "",
                        phongHocId: options?.phongHocs.some(
                          (room) => room.phongHocId === nextClass?.phongHocId,
                        ) ? nextClass?.phongHocId ?? "" : "",
                      });
                    }}
                  >
                    <option value="">Chọn lớp học</option>
                    {options?.lopHocs.map((item) => (
                      <option key={item.lopHocId} value={item.lopHocId}>
                        {item.maLop} · {item.tenLop}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="schedule-field schedule-field-full">
                  <span>Môn học <i>*</i></span>
                  <select
                    required
                    value={generatorForm.monHocId}
                    disabled={!generatorClass}
                    onChange={(event) => {
                      const subjectId = Number(event.target.value) || "";
                      const subject = generatorClass?.monHocs.find((item) => item.monHocId === subjectId);
                      updateGeneratorForm({
                        monHocId: subjectId,
                        soBuoi: Math.min(200, Math.max(1, lessonsOf(subject).length)),
                      });
                    }}
                  >
                    <option value="">Chọn môn học</option>
                    {generatorClass?.monHocs.map((item) => (
                      <option key={item.monHocId} value={item.monHocId}>
                        {item.maMonHoc} · {item.tenMonHoc}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="schedule-field">
                  <span>Ngày bắt đầu <i>*</i></span>
                  <input
                    required
                    type="date"
                    min={localDateValue(new Date())}
                    value={generatorForm.ngayBatDau}
                    onChange={(event) => updateGeneratorForm({ ngayBatDau: event.target.value })}
                  />
                </label>
                <label className="schedule-field">
                  <span>Số buổi cần xếp <i>*</i></span>
                  <input
                    required
                    type="number"
                    min="1"
                    max="200"
                    value={generatorForm.soBuoi}
                    onChange={(event) => updateGeneratorForm({ soBuoi: Number(event.target.value) })}
                  />
                  <small className="schedule-hint">
                    Môn hiện có {lessonsOf(generatorSubject).length} bài học; mỗi buổi được gắn tuần tự với một bài học.
                  </small>
                </label>
                <div className="schedule-field schedule-field-full">
                  <span>Các ngày học trong tuần <i>*</i></span>
                  <div className="schedule-weekday-list">
                    {WEEKDAYS.map((weekday) => (
                      <label key={weekday.value}>
                        <input
                          type="checkbox"
                          checked={generatorForm.thuTrongTuan.includes(weekday.value)}
                          onChange={(event) => {
                            const selected = new Set(generatorForm.thuTrongTuan);
                            if (event.target.checked) selected.add(weekday.value);
                            else selected.delete(weekday.value);
                            updateGeneratorForm({ thuTrongTuan: [...selected].sort((a, b) => a - b) });
                          }}
                        />
                        {weekday.label}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="schedule-field">
                  <span>Giờ bắt đầu <i>*</i></span>
                  <input
                    required
                    type="time"
                    value={generatorForm.gioBatDau}
                    onChange={(event) => updateGeneratorForm({ gioBatDau: event.target.value })}
                  />
                </label>
                <label className="schedule-field">
                  <span>Giờ kết thúc <i>*</i></span>
                  <input
                    required
                    type="time"
                    value={generatorForm.gioKetThuc}
                    onChange={(event) => updateGeneratorForm({ gioKetThuc: event.target.value })}
                  />
                </label>
                <label className="schedule-field">
                  <span>Giảng viên <i>*</i></span>
                  <select
                    required
                    value={generatorForm.giangVienId}
                    onChange={(event) => updateGeneratorForm({ giangVienId: Number(event.target.value) || "" })}
                  >
                    <option value="">Chọn giảng viên</option>
                    {options?.giangViens.map((item) => (
                      <option key={item.giangVienId} value={item.giangVienId}>
                        {item.hoTen} · {item.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="schedule-field">
                  <span>Phòng học</span>
                  <select
                    value={generatorForm.phongHocId}
                    onChange={(event) => updateGeneratorForm({ phongHocId: Number(event.target.value) || "" })}
                  >
                    <option value="">Chưa gán phòng</option>
                    {options?.phongHocs.map((item) => (
                      <option key={item.phongHocId} value={item.phongHocId}>
                        {item.maPhong} · {item.tenPhong}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="schedule-field schedule-field-full">
                  <span>Ngày nghỉ lễ cần bỏ qua</span>
                  <div className="schedule-holiday-entry">
                    <input
                      type="date"
                      value={holidayInput}
                      onChange={(event) => setHolidayInput(event.target.value)}
                      aria-label="Chọn ngày nghỉ lễ"
                    />
                    <button
                      type="button"
                      className="schedule-secondary-button"
                      disabled={!holidayInput || generatorForm.ngayNghi.includes(holidayInput)}
                      onClick={() => {
                        updateGeneratorForm({ ngayNghi: [...generatorForm.ngayNghi, holidayInput].sort() });
                        setHolidayInput("");
                      }}
                    >
                      Thêm ngày nghỉ
                    </button>
                  </div>
                  <small className="schedule-hint">
                    Ngày đã khai báo trùng với ngày học sẽ được tự động bỏ qua.
                  </small>
                  {generatorForm.ngayNghi.length > 0 && (
                    <ul className="schedule-holiday-list">
                      {generatorForm.ngayNghi.map((holiday) => (
                        <li key={holiday}>
                          {displayDate(holiday)}
                          <button
                            type="button"
                            aria-label={`Xóa ngày nghỉ ${displayDate(holiday)}`}
                            onClick={() => updateGeneratorForm({
                              ngayNghi: generatorForm.ngayNghi.filter((item) => item !== holiday),
                            })}
                          >
                            Xóa
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {generationPreview && (
                <div className="schedule-generated-preview">
                  <h3>Xem trước {generationPreview.sessions.length} buổi học</h3>
                  {generationPreview.skippedHolidays.length > 0 && (
                    <p>
                      Đã bỏ qua {generationPreview.skippedHolidays.length} ngày nghỉ:{" "}
                      {generationPreview.skippedHolidays.map(displayDate).join(", ")}.
                    </p>
                  )}
                  {generationPreview.conflicts.length > 0 && (
                    <div className="schedule-form-error" role="alert">
                      <strong>Có {generationPreview.conflicts.length} xung đột lịch. Hãy điều chỉnh thời gian hoặc phòng/giảng viên.</strong>
                      <ul>
                        {generationPreview.conflicts.map((conflict, index) => (
                          <li key={`${conflict.lichHocId}-${conflict.loai}-${index}`}>
                            {conflict.loai === "giangVien" ? "Giảng viên" : conflict.loai === "lopHoc" ? "Lớp học" : "Phòng học"}{" "}
                            {conflict.ten ?? conflict.maPhong ?? ""} đã có lịch ngày{" "}
                            {displayDate(conflict.ngay)} ({conflict.gioBatDau}–{conflict.gioKetThuc}).
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="schedule-generated-table-wrap">
                    <table className="schedule-generated-table">
                      <thead><tr><th>Buổi</th><th>Ngày học</th><th>Bài học</th></tr></thead>
                      <tbody>
                        {generationPreview.sessions.map((session) => (
                          <tr key={session.buoiHocId}>
                            <td>{session.soThuTu}</td>
                            <td>{displayDate(session.ngayHoc)} · {generatorForm.gioBatDau}–{generatorForm.gioKetThuc}</td>
                            <td>{session.chuDe}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="schedule-modal-actions">
                <button
                  type="button"
                  className="schedule-secondary-button"
                  onClick={() => setGeneratorOpen(false)}
                  disabled={generationLoading}
                >
                  Đóng
                </button>
                {generationPreview ? (
                  <>
                    <button
                      type="submit"
                      className="schedule-secondary-button"
                      disabled={generationLoading}
                    >
                      Tạo lại bản xem trước
                    </button>
                    <button
                      type="button"
                      className="schedule-primary-button"
                      onClick={() => void confirmGeneratedSchedules()}
                      disabled={generationLoading || generationPreview.conflicts.length > 0}
                    >
                      {generationLoading ? "Đang tạo lịch..." : "Xác nhận và lưu lịch"}
                    </button>
                  </>
                ) : (
                  <button type="submit" className="schedule-primary-button" disabled={generationLoading}>
                    {generationLoading ? "Đang tạo bản xem trước..." : "Xem trước lịch"}
                  </button>
                )}
              </div>
            </form>
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
                          {conflict.loai === "giangVien" ? "Giảng viên" : conflict.loai === "lopHoc" ? "Lớp học" : "Phòng học"}{" "}
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
                          buoiHocId: lessonsOf(nextClass?.monHocs[0])[0]?.buoiHocId ?? "",
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
                        buoiHocId: lessonsOf(selectedClass?.monHocs.find(
                          (item) => item.monHocId === Number(event.target.value),
                        ))[0]?.buoiHocId ?? "",
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
                {lessonsOf(selectedSubject).length > 0 && (
                  <label className="schedule-field schedule-field-full">
                    <span>Bài học trong môn</span>
                    <select
                      value={form.buoiHocId}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        buoiHocId: Number(event.target.value) || "",
                      }))}
                    >
                      <option value="">Không gắn bài học</option>
                      {lessonsOf(selectedSubject).map((lesson) => (
                        <option key={lesson.buoiHocId} value={lesson.buoiHocId}>
                          Buổi {lesson.soThuTu} · {lesson.chuDe}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
