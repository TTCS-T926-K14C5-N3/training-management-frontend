import React, { useEffect, useState, useMemo } from "react";
import api from "../services/api";
import "./StudentTransferModal.css";

export interface TransferStudentOption {
  nguoiDungId: number;
  hoTen: string;
  email?: string;
  ngayGhiDanh?: string | null;
  trangThaiGhiDanh?: string;
}

export interface TransferClassOption {
  lopHocId: number;
  maLop: string;
  tenLop: string;
  trangThai: string;
  giangVienTen?: string | null;
  hinhThuc?: string;
  maPhong?: string | null;
  siSoHienTai: number;
  siSoToiDa: number;
  hocViens?: TransferStudentOption[];
}

export interface StudentTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  initialMode?: "ChuyenLop" | "ThoiHoc";
  initialClassId?: number | null;
  initialStudentId?: number | null;
  initialStudentName?: string;
  classes?: TransferClassOption[];
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

const TRANSFER_REASONS = [
  "Đổi ca học phù hợp lịch làm việc",
  "Chuyển địa điểm học gần nơi ở",
  "Học bù tiến độ cá nhân",
  "Nguyện vọng học cùng nhóm/bạn bè",
];

const DROP_REASONS = [
  "Bận công tác / lịch làm việc đột xuất",
  "Chuyển nơi cư trú / đi xa",
  "Lý do sức khỏe cá nhân",
  "Thay đổi định hướng nghề nghiệp",
  "Việc bận gia đình dài ngày",
];

export const StudentTransferModal: React.FC<StudentTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "ChuyenLop",
  initialClassId,
  initialStudentId,
  initialStudentName,
  classes: providedClasses,
}) => {
  const [mode, setMode] = useState<"ChuyenLop" | "ThoiHoc">(initialMode);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [classList, setClassList] = useState<TransferClassOption[]>(providedClasses || []);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const [sourceClassId, setSourceClassId] = useState<number | "">(initialClassId || "");
  const [selectedStudentId, setSelectedStudentId] = useState<number | "">(initialStudentId || "");
  const [targetClassId, setTargetClassId] = useState<number | "">("");
  const [effectiveDate, setEffectiveDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [reason, setReason] = useState<string>("");
  const [dropConfirmed, setDropConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch classes if not supplied
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
        const res = await api.get<TransferClassOption[]>("/academic/classes");
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

  // Reset or initialize state
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setStep("form");
      setSourceClassId(initialClassId || "");
      setSelectedStudentId(initialStudentId || "");
      setTargetClassId("");
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setReason("");
      setDropConfirmed(false);
      setErrorMessage("");
    }
  }, [isOpen, initialMode, initialClassId, initialStudentId]);

  // Current source class
  const sourceClass = useMemo(() => {
    return classList.find((c) => c.lopHocId === sourceClassId) || null;
  }, [classList, sourceClassId]);

  // Target class
  const targetClass = useMemo(() => {
    return classList.find((c) => c.lopHocId === targetClassId) || null;
  }, [classList, targetClassId]);

  // Students in source class
  const availableStudents = useMemo(() => {
    if (!sourceClass || !sourceClass.hocViens) return [];
    return sourceClass.hocViens;
  }, [sourceClass]);

  // Current student object
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

  // Eligible target classes for transfer
  const eligibleTargetClasses = useMemo(() => {
    return classList.filter((c) => {
      if (c.lopHocId === sourceClassId) return false;
      if (!["Chuẩn bị", "Đang học", "Đang hoạt động"].includes(c.trangThai)) return false;
      return true;
    });
  }, [classList, sourceClassId]);

  if (!isOpen) return null;

  // Validation before proceed to confirm
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!sourceClassId) {
      setErrorMessage("Vui lòng chọn lớp học hiện tại.");
      return;
    }
    if (!selectedStudentId) {
      setErrorMessage("Vui lòng chọn học viên cần thao tác.");
      return;
    }
    if (mode === "ChuyenLop") {
      if (!targetClassId) {
        setErrorMessage("Vui lòng chọn lớp chuyển đến (lớp đích).");
        return;
      }
      if (targetClassId === sourceClassId) {
        setErrorMessage("Lớp chuyển đến phải khác lớp học hiện tại.");
        return;
      }
      if (targetClass && targetClass.siSoHienTai >= targetClass.siSoToiDa) {
        setErrorMessage(
          `Lớp đích (${targetClass.maLop}) đã đầy sĩ số (${targetClass.siSoHienTai}/${targetClass.siSoToiDa}). Vui lòng chọn lớp khác.`
        );
        return;
      }
    }
    if (!effectiveDate) {
      setErrorMessage("Vui lòng chọn ngày hiệu lực.");
      return;
    }
    if (!reason.trim()) {
      setErrorMessage("Vui lòng nhập lý do thực hiện.");
      return;
    }
    if (reason.trim().length < 5) {
      setErrorMessage("Lý do cần tối thiểu 5 ký tự.");
      return;
    }

    setStep("confirm");
  };

  // Submit action to backend
  const handleFinalSubmit = async () => {
    if (!sourceClassId || !selectedStudentId) return;

    if (mode === "ThoiHoc" && !dropConfirmed) {
      setErrorMessage("Vui lòng đánh dấu xác nhận đồng ý thôi học trước khi tiếp tục.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await api.post(
        `/academic/classes/${sourceClassId}/students/${selectedStudentId}/actions`,
        {
          loaiThaoTac: mode,
          ngayHieuLuc: effectiveDate,
          lyDo: reason.trim(),
          lopHocDichId: mode === "ChuyenLop" ? targetClassId : null,
        }
      );

      const actionText = mode === "ChuyenLop" ? "chuyển lớp" : "thôi học";
      onSuccess(
        `Đã lưu quyết định ${actionText} cho học viên ${
          currentStudent?.hoTen || ""
        } có hiệu lực từ ${formatDateVN(effectiveDate)}.`
      );
      onClose();
    } catch (err: unknown) {
      console.error("Lỗi thực hiện thao tác:", err);
      let message = "Không thể ghi nhận quyết định. Vui lòng kiểm tra lại.";
      if (
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail === "string"
      ) {
        message = (err as { response: { data: { detail: string } } }).response.data
          .detail;
      }
      setErrorMessage(message);
      setStep("form");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="transfer-modal-overlay"
      role="presentation"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="transfer-modal"
        role="dialog"
        aria-labelledby="transfer-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="transfer-modal-header">
          <div>
            <div
              className={`transfer-header-badge ${
                mode === "ThoiHoc" ? "thoi-hoc" : ""
              } ${step === "confirm" ? "confirm" : ""}`}
            >
              {step === "form"
                ? `📋 SCRUM-419 · ${mode === "ChuyenLop" ? "Chuyển lớp" : "Thôi học"}`
                : "⚠️ Bước xác nhận quyết định"}
            </div>
            <h3 id="transfer-modal-title">
              {step === "form"
                ? mode === "ChuyenLop"
                  ? "Xây dựng form chuyển lớp học viên"
                  : "Xây dựng form thôi học học viên"
                : mode === "ChuyenLop"
                ? "Xác nhận chuyển lớp học viên"
                : "Xác nhận thôi học học viên"}
            </h3>
            <p>
              {step === "form"
                ? mode === "ChuyenLop"
                  ? "Chọn lớp đích, học viên, ngày hiệu lực và so sánh thông tin lớp cũ - lớp mới."
                  : "Ghi nhận quyết định thôi học và loại bỏ học viên khỏi danh sách điểm danh."
                : "Vui lòng kiểm tra kỹ lưỡng các thông tin bên dưới trước khi áp dụng vào hệ thống."}
            </p>
          </div>
          <button
            type="button"
            className="transfer-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        {/* Mode Tabs (Only visible in Form step) */}
        {step === "form" && (
          <div className="transfer-mode-tabs">
            <button
              type="button"
              className={`transfer-tab-btn ${
                mode === "ChuyenLop" ? "active chuyen-lop" : ""
              }`}
              onClick={() => {
                setMode("ChuyenLop");
                setErrorMessage("");
              }}
            >
              🔄 Chuyển lớp
            </button>
            <button
              type="button"
              className={`transfer-tab-btn ${
                mode === "ThoiHoc" ? "active thoi-hoc" : ""
              }`}
              onClick={() => {
                setMode("ThoiHoc");
                setErrorMessage("");
              }}
            >
              🛑 Thôi học
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="transfer-modal-body">
          {errorMessage && (
            <div className="transfer-error-alert" role="alert">
              ⚠️ {errorMessage}
            </div>
          )}

          {step === "form" ? (
            <form id="transfer-action-form" onSubmit={handleProceedToConfirm}>
              <div className="transfer-form-grid">
                {/* 1. Lớp hiện tại */}
                <div className="transfer-field">
                  <label htmlFor="transfer-source-class">
                    Lớp học hiện tại (Lớp cũ) <span className="required">*</span>
                  </label>
                  <select
                    id="transfer-source-class"
                    value={sourceClassId}
                    disabled={Boolean(initialClassId) || loadingClasses}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : "";
                      setSourceClassId(val);
                      setSelectedStudentId("");
                      if (targetClassId === val) setTargetClassId("");
                    }}
                    required
                  >
                    <option value="">-- Chọn lớp học hiện tại --</option>
                    {classList.map((c) => (
                      <option key={c.lopHocId} value={c.lopHocId}>
                        {c.maLop} · {c.tenLop} ({c.siSoHienTai}/{c.siSoToiDa} HV)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Chọn học viên */}
                <div className="transfer-field">
                  <label htmlFor="transfer-student-select">
                    Học viên <span className="required">*</span>
                  </label>
                  <select
                    id="transfer-student-select"
                    value={selectedStudentId}
                    disabled={Boolean(initialStudentId) || !sourceClassId}
                    onChange={(e) =>
                      setSelectedStudentId(e.target.value ? Number(e.target.value) : "")
                    }
                    required
                  >
                    <option value="">
                      {!sourceClassId
                        ? "-- Vui lòng chọn lớp hiện tại trước --"
                        : availableStudents.length === 0
                        ? "-- Lớp này chưa có học viên --"
                        : "-- Chọn học viên --"}
                    </option>
                    {availableStudents.map((s) => (
                      <option key={s.nguoiDungId} value={s.nguoiDungId}>
                        {s.hoTen} {s.email ? `(${s.email})` : ""}{" "}
                        {s.trangThaiGhiDanh ? `· ${s.trangThaiGhiDanh}` : ""}
                      </option>
                    ))}
                  </select>
                  {initialStudentName && initialStudentId && (
                    <small style={{ color: "#64748b", marginTop: "3px" }}>
                      Đang xử lý cho: <strong>{initialStudentName}</strong>
                    </small>
                  )}
                </div>

                {/* 3. CHỌN LỚP ĐÍCH KHI CHUYỂN LỚP (SCRUM-419 Bullet 1) */}
                {mode === "ChuyenLop" && (
                  <div className="transfer-field">
                    <label htmlFor="transfer-target-class">
                      Lớp chuyển đến (Lớp đích) <span className="required">*</span>
                    </label>
                    <select
                      id="transfer-target-class"
                      value={targetClassId}
                      onChange={(e) =>
                        setTargetClassId(e.target.value ? Number(e.target.value) : "")
                      }
                      required
                    >
                      <option value="">-- Chọn lớp chuyển đến --</option>
                      {eligibleTargetClasses.map((c) => {
                        const isFull = c.siSoHienTai >= c.siSoToiDa;
                        return (
                          <option
                            key={c.lopHocId}
                            value={c.lopHocId}
                            disabled={isFull}
                          >
                            {c.maLop} · {c.tenLop} ({c.siSoHienTai}/{c.siSoToiDa} HV)
                            {isFull ? " [ĐÃ ĐỦ SĨ SỐ]" : ""}
                          </option>
                        );
                      })}
                    </select>
                    {targetClass && (
                      <small style={{ color: "#059669", marginTop: "2px" }}>
                        ✓ Lớp đích: {targetClass.tenLop} (Giảng viên:{" "}
                        {targetClass.giangVienTen || "Chưa phân công"} · Sức chứa còn:{" "}
                        {Math.max(0, targetClass.siSoToiDa - targetClass.siSoHienTai)} chỗ)
                      </small>
                    )}
                  </div>
                )}

                {/* SO SÁNH THÔNG TIN LỚP CŨ VÀ LỚP MỚI (SCRUM-419 Bullet 3) */}
                {mode === "ChuyenLop" && sourceClass && targetClass && (
                  <div className="transfer-comparison-box">
                    <div className="transfer-class-card source">
                      <div className="transfer-card-header">LỚP HIỆN TẠI (CŨ)</div>
                      <div className="transfer-class-name">
                        {sourceClass.maLop} · {sourceClass.tenLop}
                      </div>
                      <div className="transfer-class-meta">
                        <span>Giảng viên: {sourceClass.giangVienTen || "Chưa gán"}</span>
                        <span>Sĩ số: {sourceClass.siSoHienTai}/{sourceClass.siSoToiDa}</span>
                      </div>
                    </div>

                    <div className="transfer-arrow-icon" aria-hidden="true">
                      ➜
                    </div>

                    <div className="transfer-class-card target">
                      <div className="transfer-card-header">LỚP CHUYỂN ĐẾN (MỚI)</div>
                      <div className="transfer-class-name">
                        {targetClass.maLop} · {targetClass.tenLop}
                      </div>
                      <div className="transfer-class-meta">
                        <span>Giảng viên: {targetClass.giangVienTen || "Chưa gán"}</span>
                        <span>
                          Sĩ số sau chuyển:{" "}
                          <strong>
                            {targetClass.siSoHienTai + 1}/{targetClass.siSoToiDa}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Ngày hiệu lực (SCRUM-419 Bullet 2) */}
                <div className="transfer-field">
                  <label htmlFor="transfer-effective-date">
                    Ngày hiệu lực {mode === "ChuyenLop" ? "chuyển lớp" : "thôi học"}{" "}
                    <span className="required">*</span>
                  </label>
                  <input
                    id="transfer-effective-date"
                    type="date"
                    required
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                  <div className="transfer-date-pills">
                    <button
                      type="button"
                      className={`transfer-pill-btn ${
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
                      className={`transfer-pill-btn ${
                        effectiveDate === getTomorrowDate() ? "active" : ""
                      }`}
                      onClick={() => setEffectiveDate(getTomorrowDate())}
                    >
                      Ngày mai
                    </button>
                    <button
                      type="button"
                      className={`transfer-pill-btn ${
                        effectiveDate === getNextMondayDate() ? "active" : ""
                      }`}
                      onClick={() => setEffectiveDate(getNextMondayDate())}
                    >
                      Đầu tuần sau
                    </button>
                  </div>
                </div>

                {/* 5. Lý do (SCRUM-419 Bullet 2) */}
                <div className={`transfer-field ${mode === "ThoiHoc" ? "danger" : ""}`}>
                  <label htmlFor="transfer-reason-text">
                    Lý do {mode === "ChuyenLop" ? "chuyển lớp" : "thôi học"}{" "}
                    <span className="required">*</span>
                  </label>
                  <textarea
                    id="transfer-reason-text"
                    required
                    rows={3}
                    maxLength={1000}
                    placeholder={
                      mode === "ChuyenLop"
                        ? "Nhập lý do chuyển lớp (vd: thay đổi ca học, chuyển địa điểm)..."
                        : "Nhập lý do học viên xin thôi học..."
                    }
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="transfer-reason-templates">
                    <span style={{ fontSize: "11px", color: "#64748b", alignSelf: "center" }}>
                      Mẫu nhanh:
                    </span>
                    {(mode === "ChuyenLop" ? TRANSFER_REASONS : DROP_REASONS).map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="transfer-pill-btn"
                        onClick={() =>
                          setReason((prev) => (prev ? `${prev}. ${r}` : r))
                        }
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. CẢNH BÁO CHO THÔI HỌC (SCRUM-419 Bullet 4) */}
                {mode === "ThoiHoc" && (
                  <div className="transfer-danger-box">
                    <span className="transfer-danger-icon" aria-hidden="true">
                      🛑
                    </span>
                    <div className="transfer-danger-content">
                      <strong>Cảnh báo quan trọng về việc thôi học:</strong>
                      <span>
                        Học viên sẽ chính thức dừng chương trình học tại lớp này kể từ ngày{" "}
                        <strong>{formatDateVN(effectiveDate)}</strong>.
                      </span>
                      <ul>
                        <li>Học viên sẽ <strong>ngừng xuất hiện trong danh sách điểm danh</strong> từ ngày hiệu lực.</li>
                        <li>Trạng thái học viên sẽ chuyển thành <em>Thôi học</em>.</li>
                        <li>Lịch sử điểm và điểm danh trước ngày này vẫn được bảo lưu trong hồ sơ.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </form>
          ) : (
            /* Bước xác nhận trước khi thực hiện (SCRUM-419 Bullet 3 & 4) */
            <div className="transfer-confirm-card">
              <h4 className="transfer-confirm-title">
                {mode === "ChuyenLop"
                  ? "Tóm tắt thông tin chuyển lớp:"
                  : "Xác nhận học viên thôi học:"}
              </h4>
              <div className="transfer-confirm-rows">
                <div className="transfer-confirm-row">
                  <span className="transfer-confirm-label">Học viên:</span>
                  <span className="transfer-confirm-val">
                    {currentStudent?.hoTen || `ID: ${selectedStudentId}`}
                  </span>
                </div>
                <div className="transfer-confirm-row">
                  <span className="transfer-confirm-label">Lớp học hiện tại:</span>
                  <span className="transfer-confirm-val">
                    {sourceClass ? `${sourceClass.maLop} · ${sourceClass.tenLop}` : ""}
                  </span>
                </div>

                {mode === "ChuyenLop" && targetClass && (
                  <div className="transfer-confirm-row">
                    <span className="transfer-confirm-label">Lớp chuyển đến:</span>
                    <span className="transfer-confirm-val highlight-transfer">
                      {targetClass.maLop} · {targetClass.tenLop} (sĩ số mới:{" "}
                      {targetClass.siSoHienTai + 1}/{targetClass.siSoToiDa})
                    </span>
                  </div>
                )}

                <div className="transfer-confirm-row">
                  <span className="transfer-confirm-label">Ngày hiệu lực:</span>
                  <span
                    className={`transfer-confirm-val ${
                      mode === "ChuyenLop" ? "highlight-transfer" : "highlight-drop"
                    }`}
                  >
                    {formatDateVN(effectiveDate)}
                  </span>
                </div>

                <div className="transfer-confirm-row" style={{ flexDirection: "column", gap: "6px" }}>
                  <span className="transfer-confirm-label">Lý do:</span>
                  <div
                    style={{
                      padding: "8px 12px",
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontStyle: "italic",
                    }}
                  >
                    "{reason}"
                  </div>
                </div>
              </div>

              {/* Checkbox xác nhận bắt buộc trước khi thôi học (SCRUM-419 Bullet 4) */}
              {mode === "ThoiHoc" && (
                <label className="transfer-checkbox-label">
                  <input
                    type="checkbox"
                    checked={dropConfirmed}
                    onChange={(e) => {
                      setDropConfirmed(e.target.checked);
                      if (e.target.checked) setErrorMessage("");
                    }}
                  />
                  <span>
                    Tôi xác nhận đã kiểm tra kỹ lưỡng, đã trao đổi với học viên/phụ huynh
                    và đồng ý thực hiện cho học viên thôi học.
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="transfer-modal-footer">
          {step === "form" ? (
            <>
              <button
                type="button"
                className="transfer-btn-cancel"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="transfer-action-form"
                className={mode === "ChuyenLop" ? "transfer-btn-primary" : "transfer-btn-danger"}
                disabled={
                  isSubmitting ||
                  !sourceClassId ||
                  !selectedStudentId ||
                  (mode === "ChuyenLop" && !targetClassId)
                }
              >
                Tiếp tục xác nhận →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="transfer-btn-back"
                onClick={() => setStep("form")}
                disabled={isSubmitting}
              >
                ← Quay lại chỉnh sửa
              </button>
              <button
                type="button"
                className={mode === "ChuyenLop" ? "transfer-btn-primary" : "transfer-btn-danger"}
                onClick={handleFinalSubmit}
                disabled={isSubmitting || (mode === "ThoiHoc" && !dropConfirmed)}
              >
                {isSubmitting
                  ? "Đang lưu..."
                  : mode === "ChuyenLop"
                  ? "✓ Xác nhận chuyển lớp"
                  : "✓ Xác nhận thôi học"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentTransferModal;
