import { useEffect, useState } from "react";
import SearchableSelect from "../components/SearchableSelect";
import type { FormEvent } from "react";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
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
  navigate?: (path: string) => void;
  embedded?: boolean;
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
  if (Array.isArray(detail)) {
    const message = detail.find(
      (item): item is { msg: string } =>
        !!item && typeof item === "object" && "msg" in item,
    );
    if (message) return message.msg;
  }
  if (error.response?.status === 401) return "Phiên đăng nhập đã hết hạn.";
  if (error.response?.status === 403) {
    return "Bạn không có quyền gửi đơn xin phép cho buổi học này.";
  }
  if (error.response?.status === 409) {
    return typeof detail === "string"
      ? detail
      : "Không thể gửi đơn cho buổi học này.";
  }
  if (error.response?.status === 413) return "Tệp minh chứng không được vượt quá 5 MB.";
  if (error.response?.status === 415) return "Minh chứng phải là tệp PDF, PNG hoặc JPEG hợp lệ.";
  if (!error.response) return "Không thể kết nối Backend. Vui lòng thử lại.";
  return `Không thể xử lý yêu cầu (HTTP ${error.response.status}).`;
};

const fetchAvailableSchedules = async (
  signal?: AbortSignal,
): Promise<ScheduleOption[]> => {
  const [scheduleResponse, requestResponse] = await Promise.all([
    api.get<ScheduleOption[]>("/academic/schedules", {
      params: { excludeCompleted: true },
      signal,
    }),
    api.get<Array<{ scheduleId: number }>>(
      "/attendance/sessions/absence-requests",
      { signal },
    ),
  ]);
  const today = getBusinessDate();
  const currentTime = getBusinessTime();
  const requestedScheduleIds = new Set(
    requestResponse.data.map((request) => request.scheduleId),
  );
  return scheduleResponse.data.filter(
    (schedule) =>
      schedule.trangThai === "Đã lên lịch" &&
      !requestedScheduleIds.has(schedule.lichHocId) &&
      (schedule.ngayHoc > today ||
        (schedule.ngayHoc === today && schedule.gioBatDau > currentTime)),
  );
};

function AbsenceRequest({
  navigate,
  embedded = false,
}: AbsenceRequestProps) {
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    if (errors.attachment) nextErrors.attachment = errors.attachment;
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError("");
    setToast(null);
    try {
      if (attachment) {
        const formData = new FormData();
        formData.append("scheduleId", scheduleId);
        formData.append("reason", reason.trim());
        formData.append("file", attachment);
        await api.post(
          "/attendance/sessions/absence-requests/with-evidence",
          formData,
        );
      } else {
        await api.post("/attendance/sessions/absence-requests", {
          scheduleId: Number(scheduleId),
          reason: reason.trim(),
        });
      }
      setToast({
        type: "success",
        text: "Đơn xin phép đã được gửi. Bạn có thể theo dõi kết quả xử lý tại mục Theo dõi đơn.",
      });
      setSchedules((current) =>
        current.filter((schedule) => schedule.lichHocId !== Number(scheduleId)),
      );
      setReason("");
      setAttachment(null);
      setScheduleId("");
    } catch (error) {
      console.error("Không thể gửi đơn xin phép vắng:", error);
      const message = getErrorMessage(error);
      setSubmitError(message);
      setToast({ type: "error", text: message });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSchedule = schedules.find(
    (schedule) => schedule.lichHocId === Number(scheduleId),
  );

  return (
    <main className={`absence-request-page${embedded ? " absence-request-page-embedded" : ""}`}>
      {toast && (
        <ToastNotification
          type={toast.type}
          text={toast.text}
          onClose={() => setToast(null)}
        />
      )}
      {!embedded && (
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
      )}

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

        <form className="absence-request-form" onSubmit={(event) => void submit(event)} noValidate>
          <label className="absence-request-field">
            <span>Buổi học cần xin phép <i>*</i></span>
            <SearchableSelect
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
            </SearchableSelect>
            {errors.schedule && (
              <small id="absence-schedule-error" role="alert">
                {errors.schedule}
              </small>
            )}
            {!loading && !loadError && schedules.length === 0 && (
              <small className="absence-request-hint">
                Không có buổi học sắp tới chưa gửi đơn để xin phép.
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
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file) {
                    const extension = file.name.split(".").pop()?.toLowerCase();
                    const allowed = new Set(["pdf", "png", "jpg", "jpeg"]);
                    const allowedTypes = new Set([
                      "application/pdf",
                      "image/png",
                      "image/jpeg",
                    ]);
                    if (!extension || !allowed.has(extension)) {
                      setAttachment(null);
                      setErrors((current) => ({
                        ...current,
                        attachment: "Minh chứng phải là tệp PDF, PNG hoặc JPEG.",
                      }));
                      event.target.value = "";
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      setAttachment(null);
                      setErrors((current) => ({
                        ...current,
                        attachment: "Tệp minh chứng không được vượt quá 5 MB.",
                      }));
                      event.target.value = "";
                      return;
                    }
                    if (file.type && !allowedTypes.has(file.type)) {
                      setAttachment(null);
                      setErrors((current) => ({
                        ...current,
                        attachment: "Định dạng tệp không khớp với loại minh chứng cho phép.",
                      }));
                      event.target.value = "";
                      return;
                    }
                  }
                  setAttachment(file);
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
            {errors.attachment && (
              <small role="alert">{errors.attachment}</small>
            )}
            <small className="absence-request-hint">
              Có thể đính kèm tệp PDF, PNG hoặc JPEG, tối đa 5 MB.
            </small>
          </div>

          {submitError && (
            <div className="absence-request-error" role="alert">
              {submitError}
            </div>
          )}

          <div className="absence-request-actions">
            {!embedded && (
              <button
                className="absence-request-cancel"
                type="button"
                onClick={() => navigate?.("/quan-ly-lich-hoc")}
              >
                Hủy
              </button>
            )}
            <button
              className="absence-request-submit"
              type="submit"
              disabled={loading || submitting || !scheduleId}
            >
              {submitting ? "Đang gửi..." : "Gửi đơn"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default AbsenceRequest;
