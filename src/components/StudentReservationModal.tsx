import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import api from "../services/api";
import "./StudentReservationModal.css";

export interface StudentOption {
  nguoiDungId: number;
  hoTen: string;
  email?: string;
  ngayGhiDanh?: string | null;
  trangThaiGhiDanh?: string;
}

export interface ClassOption {
  lopHocId: number;
  maLop: string;
  tenLop: string;
  trangThai?: string;
  siSoHienTai?: number;
  siSoToiDa?: number;
  hocViens?: StudentOption[];
}

export interface StudentReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  initialClassId?: number | null;
  initialStudentId?: number | null;
  initialStudentName?: string;
  classes?: ClassOption[];
}

const formatDateVN = (dateStr: string): string => {
  if (!dateStr) return "";
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const getTomorrowDate = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const getNextMondayDate = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? 1 : 8) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

const COMMON_REASONS = [
  "Lý do sức khỏe / điều trị",
  "Bận công tác / lịch làm việc cá nhân",
  "Bận việc gia đình",
  "Trùng lịch học chuyên ngành",
  "Thu xếp tài chính cá nhân",
];

const reservationErrorMessage = (error: unknown): string => {
  if (!axios.isAxiosError<{ detail?: unknown }>(error)) {
    return "Không thể ghi nhận quyết định bảo lưu. Vui lòng thử lại.";
  }

  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? item.msg
          : null,
      )
      .filter((message): message is string => typeof message === "string");
    if (messages.length) return messages.join(" ");
  }

  if (!error.response) {
    return "Không nhận được phản hồi từ máy chủ. Vui lòng thử lại; nếu quyết định đã được lưu, gửi lại cùng thông tin sẽ không tạo bản ghi trùng.";
  }
  return "Không thể ghi nhận quyết định bảo lưu. Vui lòng thử lại.";
};

export const StudentReservationModal: React.FC<StudentReservationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialClassId,
  initialStudentId,
  initialStudentName,
  classes: providedClasses,
}) => {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [classList, setClassList] = useState<ClassOption[]>(providedClasses || []);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState<number | "">(
    initialClassId || ""
  );
  const [selectedStudentId, setSelectedStudentId] = useState<number | "">(
    initialStudentId || ""
  );
  const [effectiveDate, setEffectiveDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load classes if not provided
  useEffect(() => {
    if (!isOpen) return;

    if (providedClasses && providedClasses.length > 0) {
      setClassList(providedClasses);
      return;
    }

    let active = true;
    const fetchClasses = async () => {
      setLoadingClasses(true);
      try {
        const res = await api.get<ClassOption[]>("/academic/classes");
        if (!active) return;
        setClassList(res.data);
      } catch (err) {
        console.error("Lỗi tải danh sách lớp:", err);
      } finally {
        if (active) setLoadingClasses(false);
      }
    };

    void fetchClasses();
    return () => {
      active = false;
    };
  }, [isOpen, providedClasses]);

  // Reset or initialize state when opening
  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setSelectedClassId(initialClassId || "");
      setSelectedStudentId(initialStudentId || "");
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setReason("");
      setErrorMessage("");
    }
  }, [isOpen, initialClassId, initialStudentId]);

  // Determine current class object
  const currentClass = useMemo(() => {
    return classList.find((c) => c.lopHocId === selectedClassId) || null;
  }, [classList, selectedClassId]);

  // Determine available students in the selected class
  const availableStudents = useMemo(() => {
    if (!currentClass || !currentClass.hocViens) return [];
    return currentClass.hocViens;
  }, [currentClass]);

  // Determine current student object
  const currentStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    const found = availableStudents.find((s) => s.nguoiDungId === selectedStudentId);
    if (found) return found;
    if (initialStudentName && selectedStudentId === initialStudentId) {
      return {
        nguoiDungId: initialStudentId,
        hoTen: initialStudentName,
      };
    }
    return null;
  }, [availableStudents, selectedStudentId, initialStudentId, initialStudentName]);

  if (!isOpen) return null;

  // Validation before proceeding to confirmation
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!selectedClassId) {
      setErrorMessage("Vui lòng chọn lớp học của học viên.");
      return;
    }
    if (!selectedStudentId) {
      setErrorMessage("Vui lòng chọn học viên cần bảo lưu.");
      return;
    }
    if (!effectiveDate) {
      setErrorMessage("Vui lòng chọn ngày hiệu lực bảo lưu.");
      return;
    }
    if (!reason.trim()) {
      setErrorMessage("Vui lòng nhập lý do bảo lưu.");
      return;
    }
    if (reason.trim().length < 5) {
      setErrorMessage("Lý do bảo lưu cần ít nhất 5 ký tự.");
      return;
    }

    setStep("confirm");
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    if (!selectedClassId || !selectedStudentId) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const url = `/academic/classes/${selectedClassId}/students/${selectedStudentId}/actions`;
      const payload = {
        loaiThaoTac: "BaoLuu",
        ngayHieuLuc: effectiveDate,
        lyDo: reason.trim(),
        lopHocDichId: null,
      };
      try {
        await api.post(url, payload);
      } catch (error) {
        if (
          !axios.isAxiosError(error) ||
          (error.response && error.response.status < 500)
        ) {
          throw error;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        await api.post(url, payload);
      }

      onSuccess(
        `Đã ghi nhận bảo lưu cho học viên ${
          currentStudent?.hoTen || ""
        } có hiệu lực từ ${formatDateVN(effectiveDate)}.`
      );
      onClose();
    } catch (err: unknown) {
      console.error("Lỗi thực hiện bảo lưu:", err);
      setErrorMessage(reservationErrorMessage(err));
      // Return to form step so user can fix issue (e.g., date before enrollment)
      setStep("form");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="reservation-modal-overlay"
      role="presentation"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="reservation-modal"
        role="dialog"
        aria-labelledby="reservation-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="reservation-modal-header">
          <div>
            <div
              className={`reservation-header-badge ${
                step === "confirm" ? "confirm" : ""
              }`}
            >
              {step === "form" ? "📋 SCRUM-418 · Biểu mẫu đào tạo" : "⚠️ Bước xác nhận"}
            </div>
            <h3 id="reservation-modal-title">
              {step === "form"
                ? "Xây dựng form bảo lưu học viên"
                : "Xác nhận quyết định bảo lưu học viên"}
            </h3>
            <p>
              {step === "form"
                ? "Thiết lập bảo lưu, chọn học viên, nhập lý do và ngày hiệu lực ngừng điểm danh."
                : "Vui lòng rà soát lại thông tin trước khi lưu chính thức vào hồ sơ học viên."}
            </p>
          </div>
          <button
            type="button"
            className="reservation-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="reservation-modal-body">
          {errorMessage && (
            <div className="reservation-error-alert" role="alert">
              ⚠️ {errorMessage}
            </div>
          )}

          {step === "form" ? (
            <form id="reservation-form" onSubmit={handleProceedToConfirm}>
              <div className="reservation-form-grid">
                {/* 1. Chọn lớp học */}
                <div className="reservation-field">
                  <label htmlFor="res-class-select">
                    Lớp học <span className="required">*</span>
                  </label>
                  <select
                    id="res-class-select"
                    value={selectedClassId}
                    disabled={Boolean(initialClassId) || loadingClasses}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : "";
                      setSelectedClassId(val);
                      setSelectedStudentId("");
                    }}
                    required
                  >
                    <option value="">-- Chọn lớp học --</option>
                    {classList.map((c) => (
                      <option key={c.lopHocId} value={c.lopHocId}>
                        {c.maLop} · {c.tenLop} ({c.siSoHienTai ?? (c.hocViens?.length || 0)} học viên)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Chọn học viên cần bảo lưu (Bullet 1) */}
                <div className="reservation-field">
                  <label htmlFor="res-student-select">
                    Học viên cần bảo lưu <span className="required">*</span>
                  </label>
                  <select
                    id="res-student-select"
                    value={selectedStudentId}
                    disabled={Boolean(initialStudentId) || !selectedClassId}
                    onChange={(e) =>
                      setSelectedStudentId(
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                    required
                  >
                    <option value="">
                      {!selectedClassId
                        ? "-- Vui lòng chọn lớp học trước --"
                        : availableStudents.length === 0
                        ? "-- Lớp học chưa có học viên --"
                        : "-- Chọn học viên cần bảo lưu --"}
                    </option>
                    {availableStudents.map((s) => (
                      <option key={s.nguoiDungId} value={s.nguoiDungId}>
                        {s.hoTen} {s.email ? `(${s.email})` : ""} {s.trangThaiGhiDanh ? `· ${s.trangThaiGhiDanh}` : ""}
                      </option>
                    ))}
                  </select>
                  {initialStudentName && initialStudentId && (
                    <small style={{ color: "#64748b", marginTop: "3px" }}>
                      Đang xử lý cho: <strong>{initialStudentName}</strong>
                    </small>
                  )}
                </div>

                {/* 3. Ngày hiệu lực (Bullet 2) */}
                <div className="reservation-field">
                  <label htmlFor="res-effective-date">
                    Ngày hiệu lực bảo lưu <span className="required">*</span>
                  </label>
                  <input
                    id="res-effective-date"
                    type="date"
                    required
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                  <div className="reservation-date-pills">
                    <button
                      type="button"
                      className={`reservation-pill-btn ${
                        effectiveDate === new Date().toISOString().slice(0, 10)
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setEffectiveDate(new Date().toISOString().slice(0, 10))
                      }
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      className={`reservation-pill-btn ${
                        effectiveDate === getTomorrowDate() ? "active" : ""
                      }`}
                      onClick={() => setEffectiveDate(getTomorrowDate())}
                    >
                      Ngày mai
                    </button>
                    <button
                      type="button"
                      className={`reservation-pill-btn ${
                        effectiveDate === getNextMondayDate() ? "active" : ""
                      }`}
                      onClick={() => setEffectiveDate(getNextMondayDate())}
                    >
                      Đầu tuần sau
                    </button>
                  </div>
                </div>

                {/* 4. Nhập lý do (Bullet 2) */}
                <div className="reservation-field">
                  <label htmlFor="res-reason-text">
                    Lý do bảo lưu <span className="required">*</span>
                  </label>
                  <textarea
                    id="res-reason-text"
                    required
                    rows={3}
                    maxLength={1000}
                    placeholder="Nhập chi tiết lý do học viên xin bảo lưu (vd: công việc, sức khỏe, gia đình)..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="reservation-reason-templates">
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#64748b",
                        alignSelf: "center",
                      }}
                    >
                      Mẫu nhanh:
                    </span>
                    {COMMON_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="reservation-pill-btn"
                        onClick={() =>
                          setReason((prev) => (prev ? `${prev}. ${r}` : r))
                        }
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. CẢNH BÁO ĐIỂM DANH (Bullet 3) */}
                <div className="reservation-warning-box">
                  <span className="reservation-warning-icon" aria-hidden="true">
                    ⚠️
                  </span>
                  <div className="reservation-warning-content">
                    <strong>Cảnh báo ngừng điểm danh:</strong>
                    <span>
                      Kể từ ngày{" "}
                      <strong>
                        {effectiveDate
                          ? formatDateVN(effectiveDate)
                          : "[chưa chọn]"}
                      </strong>
                      , học viên sẽ{" "}
                      <span
                        style={{
                          textDecoration: "underline",
                          fontWeight: 700,
                        }}
                      >
                        ngừng xuất hiện trong danh sách điểm danh
                      </span>{" "}
                      của lớp học.
                    </span>
                    <ul>
                      <li>
                        Hệ thống sẽ cập nhật trạng thái học viên thành{" "}
                        <em>Bảo lưu</em>.
                      </li>
                      <li>
                        Toàn bộ lịch sử điểm và điểm danh trước ngày hiệu lực vẫn
                        được bảo toàn trong hồ sơ.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* Bước xác nhận trước khi thực hiện (Bullet 4) */
            <div className="reservation-confirm-card">
              <h4 className="reservation-confirm-title">
                Tóm tắt thông tin bảo lưu:
              </h4>
              <div className="reservation-confirm-rows">
                <div className="reservation-confirm-row">
                  <span className="reservation-confirm-label">Học viên:</span>
                  <span className="reservation-confirm-val">
                    {currentStudent?.hoTen || `ID: ${selectedStudentId}`}
                  </span>
                </div>
                <div className="reservation-confirm-row">
                  <span className="reservation-confirm-label">Lớp học:</span>
                  <span className="reservation-confirm-val">
                    {currentClass
                      ? `${currentClass.maLop} — ${currentClass.tenLop}`
                      : `Lớp #${selectedClassId}`}
                  </span>
                </div>
                <div className="reservation-confirm-row">
                  <span className="reservation-confirm-label">
                    Ngày hiệu lực bảo lưu:
                  </span>
                  <span className="reservation-confirm-val highlight-date">
                    {formatDateVN(effectiveDate)}
                  </span>
                </div>
                <div className="reservation-confirm-row" style={{ flexDirection: "column", gap: "6px" }}>
                  <span className="reservation-confirm-label">Lý do bảo lưu:</span>
                  <div className="reservation-confirm-val reason-text">
                    "{reason}"
                  </div>
                </div>
              </div>

              <div className="reservation-confirm-notice">
                ⚠️ Xin xác nhận: Sau khi bấm "Xác nhận bảo lưu", học viên sẽ
                chính thức ngừng xuất hiện trong danh sách điểm danh từ ngày{" "}
                {formatDateVN(effectiveDate)}.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="reservation-modal-footer">
          {step === "form" ? (
            <>
              <button
                type="button"
                className="reservation-btn-cancel"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="reservation-form"
                className="reservation-btn-primary"
                disabled={isSubmitting || !selectedClassId || !selectedStudentId}
              >
                Tiếp tục xác nhận →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="reservation-btn-back"
                onClick={() => setStep("form")}
                disabled={isSubmitting}
              >
                ← Quay lại chỉnh sửa
              </button>
              <button
                type="button"
                className="reservation-btn-confirm"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang xử lý..." : "✓ Xác nhận bảo lưu"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentReservationModal;
