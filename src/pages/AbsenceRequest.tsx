import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import api from "../services/api";
import "./AbsenceRequest.css";

interface ScheduleOption {
  lichHocId: number;
  maBuoiHoc: string;
  lopHocId: number;
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
}

interface AbsenceRequestProps {
  navigate: (path: string) => void;
}

interface FormErrors {
  schedule?: string;
  reason?: string;
  attachment?: string;
}

const getBusinessDate = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const getBusinessTime = (): string =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());

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

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getErrorMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error
      ? error.message
      : "Không thể tải danh sách buổi học.";
  }
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (error.response?.status === 401) return "Phiên đăng nhập đã hết hạn.";
  if (error.response?.status === 403) {
    return "Tài khoản không có quyền xem các buổi học.";
  }
  if (!error.response) return "Không thể kết nối Backend. Vui lòng thử lại.";
  return `Không thể tải buổi học (HTTP ${error.response.status}).`;
};

const fetchAvailableSchedules = async (
  signal?: AbortSignal,
): Promise<ScheduleOption[]> => {
  const response = await api.get<ScheduleOption[]>("/academic/schedules", {
    params: { excludeCompleted: true },
    signal,
  });
  const today = getBusinessDate();
  const currentTime = getBusinessTime();
  return response.data.filter(
    (schedule) =>
      schedule.trangThai === "Đã lên lịch" &&
      (schedule.ngayHoc > today ||
        (schedule.ngayHoc === today && schedule.gioBatDau > currentTime)),
  );
};

function AbsenceRequest({ navigate }: AbsenceRequestProps) {
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadInitialSchedules = async () => {
      try {
        setSchedules(await fetchAvailableSchedules(controller.signal));
      } catch (error) {
        if (axios.isCancel(error) || controller.signal.aborted) return;
        console.error("Không thể tải buổi học để xin phép:", error);
        setLoadError(getErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadInitialSchedules();
    return () => controller.abort();
  }, []);

  const retryLoadSchedules = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setSchedules(await fetchAvailableSchedules());
    } catch (error) {
      console.error("Không thể tải buổi học để xin phép:", error);
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    if (!scheduleId) nextErrors.schedule = "Vui lòng chọn buổi học cần xin phép.";
    if (!reason.trim()) nextErrors.reason = "Vui lòng nhập lý do xin phép.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitError(
      "Backend hiện chưa có API nhận đơn xin phép hoặc tệp minh chứng. Đơn chưa được gửi và chưa có dữ liệu nào được lưu.",
    );
  };

  const selectedSchedule = schedules.find(
    (schedule) => schedule.lichHocId === Number(scheduleId),
  );

  return (
    <main className="absence-request-page">
      <header className="absence-request-hero">
        <div>
          <span className="absence-request-eyebrow">HỌC TẬP CÁ NHÂN</span>
          <h1>Gửi đơn xin phép vắng học</h1>
          <p>
            Chọn buổi học sắp tới, trình bày lý do và đính kèm minh chứng nếu có.
          </p>
        </div>
        <span className="absence-request-hero-icon" aria-hidden="true">✉</span>
      </header>

      <section className="absence-request-card">
        <div className="absence-request-card-heading">
          <div>
            <h2>Thông tin đơn xin phép</h2>
            <p>Các trường có dấu * là bắt buộc.</p>
          </div>
        </div>

        {loadError && (
          <div className="absence-request-error" role="alert">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => void retryLoadSchedules()}
            >
              Tải lại
            </button>
          </div>
        )}

        <div className="absence-request-api-notice" role="status">
          <strong>Chưa thể gửi đơn</strong>
          <span>
            Backend chưa cung cấp API gửi đơn xin phép. Biểu mẫu chỉ giúp chuẩn
            bị thông tin; hệ thống sẽ không báo thành công giả.
          </span>
        </div>

        <form className="absence-request-form" onSubmit={submit} noValidate>
          <label className="absence-request-field">
            <span>Buổi học cần xin phép <i>*</i></span>
            <select
              value={scheduleId}
              onChange={(event) => {
                setScheduleId(event.target.value);
                setErrors((current) => ({ ...current, schedule: undefined }));
                setSubmitError("");
              }}
              aria-invalid={!!errors.schedule}
              aria-describedby={errors.schedule ? "absence-schedule-error" : undefined}
              disabled={loading || !!loadError}
            >
              <option value="">
                {loading ? "Đang tải buổi học..." : "Chọn buổi học"}
              </option>
              {schedules.map((schedule) => (
                <option key={schedule.lichHocId} value={schedule.lichHocId}>
                  {formatDate(schedule.ngayHoc)} · {schedule.gioBatDau}–
                  {schedule.gioKetThuc} · {schedule.tenMonHoc ?? schedule.maBuoiHoc}
                  {schedule.maLop ? ` · ${schedule.maLop}` : ""}
                </option>
              ))}
            </select>
            {errors.schedule && (
              <small id="absence-schedule-error" role="alert">
                {errors.schedule}
              </small>
            )}
            {!loading && !loadError && schedules.length === 0 && (
              <small className="absence-request-hint">
                Không có buổi học sắp tới phù hợp để xin phép.
              </small>
            )}
          </label>

          {selectedSchedule && (
            <div className="absence-request-session-summary">
              <strong>
                {selectedSchedule.maBuoiHoc} · {selectedSchedule.maLop} —{" "}
                {selectedSchedule.tenLop}
              </strong>
              <span>
                {selectedSchedule.tenMonHoc} ·{" "}
                {formatDate(selectedSchedule.ngayHoc)} ·{" "}
                {selectedSchedule.gioBatDau}–{selectedSchedule.gioKetThuc}
              </span>
              <span>
                {selectedSchedule.maPhong
                  ? `${selectedSchedule.maPhong} · ${selectedSchedule.tenPhong}`
                  : "Chưa gán phòng"}
                {" · "}
                {selectedSchedule.giangVienTen ?? "Chưa phân công giảng viên"}
              </span>
            </div>
          )}

          <label className="absence-request-field">
            <span>Lý do xin phép <i>*</i></span>
            <textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setErrors((current) => ({ ...current, reason: undefined }));
                setSubmitError("");
              }}
              rows={5}
              placeholder="Nhập lý do xin phép vắng học"
              aria-invalid={!!errors.reason}
              aria-describedby={errors.reason ? "absence-reason-error" : undefined}
            />
            {errors.reason && (
              <small id="absence-reason-error" role="alert">
                {errors.reason}
              </small>
            )}
          </label>

          <div className="absence-request-field">
            <span>Minh chứng đính kèm</span>
            <label className="absence-request-file-picker">
              <input
                type="file"
                onChange={(event) => {
                  setAttachment(event.target.files?.[0] ?? null);
                  setErrors((current) => ({ ...current, attachment: undefined }));
                  setSubmitError("");
                }}
                aria-invalid={!!errors.attachment}
              />
              <span className="absence-request-file-button">Chọn tệp</span>
              <span>
                {attachment ? attachment.name : "Chọn tệp minh chứng (không bắt buộc)"}
              </span>
            </label>
            {attachment && (
              <div className="absence-request-file-detail">
                <span>{attachment.name} · {formatFileSize(attachment.size)}</span>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  aria-label={`Xóa tệp ${attachment.name}`}
                >
                  Xóa tệp
                </button>
              </div>
            )}
            <small className="absence-request-hint">
              Chưa có quy định định dạng hoặc dung lượng tệp từ backend; hiện
              chưa thể tải minh chứng lên.
            </small>
          </div>

          {submitError && (
            <div className="absence-request-error" role="alert">
              {submitError}
            </div>
          )}

          <div className="absence-request-actions">
            <button
              className="absence-request-cancel"
              type="button"
              onClick={() => navigate("/quan-ly-lich-hoc")}
            >
              Hủy
            </button>
            <button
              className="absence-request-submit"
              type="submit"
              disabled={loading}
            >
              Gửi đơn
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default AbsenceRequest;
