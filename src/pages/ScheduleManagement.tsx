import { startTransition, useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./ScheduleManagement.css";

interface SubjectOption {
  monHocId: number;
  maMonHoc: string;
  tenMonHoc: string;
}

interface ClassOption {
  lopHocId: number;
  maLop: string;
  tenLop: string;
  giangVienId: number | null;
  phongHocId: number | null;
  monHocs: SubjectOption[];
}

interface TeacherOption {
  giangVienId: number;
  hoTen: string;
}

interface RoomOption {
  phongHocId: number;
  maPhong: string;
  tenPhong: string;
}

interface ScheduleOptions {
  lopHocs: ClassOption[];
  giangViens: TeacherOption[];
  phongHocs: RoomOption[];
}

interface Schedule {
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
  tenPhong: string | null;
  giangVienId: number;
  giangVienTen: string | null;
  trangThai: string;
  coTheChinhSua: boolean;
}

interface ScheduleConflict {
  loai: "giangVien" | "phongHoc";
  ten: string | null;
  vaiTro?: string;
  maPhong?: string | null;
  ngay: string;
  gioBatDau: string;
  gioKetThuc: string;
  lichHocId: number;
  maBuoiHoc: string;
  maLop: string | null;
  tenLop: string | null;
}

interface ConflictWarning {
  message: string;
  conflicts: ScheduleConflict[];
}

interface ConflictPreviewResponse {
  hasConflicts: boolean;
  conflicts: ScheduleConflict[];
  canOverride: boolean;
}

interface ScheduleForm {
  lopHocId: string;
  monHocId: string;
  ngayHoc: string;
  gioBatDau: string;
  gioKetThuc: string;
  phongHocId: string;
  giangVienId: string;
}

interface ScheduleManagementProps {
  permissions: string[];
  isTrainingManager: boolean;
  isSystemAdmin: boolean;
}

const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const emptyForm = (): ScheduleForm => ({
  lopHocId: "",
  monHocId: "",
  ngayHoc: localDate(),
  gioBatDau: "09:00",
  gioKetThuc: "10:00",
  phongHocId: "",
  giangVienId: "",
});

const ScheduleManagement = ({
  permissions,
  isTrainingManager,
  isSystemAdmin,
}: ScheduleManagementProps) => {
  const canCreate = isSystemAdmin || permissions.includes("SCHEDULE_CREATE");
  const canUpdate = isSystemAdmin || permissions.includes("SCHEDULE_UPDATE");
  const [options, setOptions] = useState<ScheduleOptions>({
    lopHocs: [],
    giangViens: [],
    phongHocs: [],
  });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [conflictWarning, setConflictWarning] =
    useState<ConflictWarning | null>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [optionsResponse, schedulesResponse] = await Promise.all([
        api.get<ScheduleOptions>("/academic/schedule-options"),
        api.get<Schedule[]>("/academic/schedules"),
      ]);
      startTransition(() => {
        setError("");
        setOptions(optionsResponse.data);
        setSchedules(schedulesResponse.data);
      });
    } catch (requestError: unknown) {
      const detail =
        typeof requestError === "object" && requestError !== null &&
        "response" in requestError
          ? (requestError as { response?: { data?: { detail?: unknown } } })
              .response?.data?.detail
          : null;
      startTransition(() => {
        setError(
          typeof detail === "string"
            ? detail
            : "Không thể tải danh sách lịch học.",
        );
      });
    } finally {
      startTransition(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedClass = options.lopHocs.find(
    (item) => String(item.lopHocId) === form.lopHocId,
  );

  const openCreate = () => {
    setEditingId(null);
    setConflictWarning(null);
    setOverrideDialogOpen(false);
    setOverrideReason("");
    setPreviewMessage("");
    setError("");
    setForm(emptyForm());
    setEditorOpen(true);
  };

  const openEdit = (schedule: Schedule) => {
    setEditingId(schedule.lichHocId);
    setConflictWarning(null);
    setOverrideDialogOpen(false);
    setOverrideReason("");
    setPreviewMessage("");
    setError("");
    setForm({
      lopHocId: String(schedule.lopHocId),
      monHocId: String(schedule.monHocId),
      ngayHoc: schedule.ngayHoc,
      gioBatDau: schedule.gioBatDau,
      gioKetThuc: schedule.gioKetThuc,
      phongHocId: schedule.phongHocId ? String(schedule.phongHocId) : "",
      giangVienId: String(schedule.giangVienId),
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setConflictWarning(null);
    setOverrideDialogOpen(false);
    setError("");
  };

  const saveSchedule = async (
    acknowledgeConflicts = false,
    reason = "",
  ) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        lopHocId: Number(form.lopHocId),
        monHocId: Number(form.monHocId),
        ngayHoc: form.ngayHoc,
        gioBatDau: form.gioBatDau,
        gioKetThuc: form.gioKetThuc,
        phongHocId: Number(form.phongHocId),
        giangVienId: Number(form.giangVienId),
        xacNhanTrungLich: acknowledgeConflicts,
        lyDoGhiDe: acknowledgeConflicts ? reason.trim() : null,
      };
      let overrideResult: {
        lyDo?: string;
        soXungDot?: number;
      } | undefined;
      if (editingId === null) {
        const response = await api.post<{ ghiDe?: typeof overrideResult }>(
          "/academic/schedules",
          payload,
        );
        overrideResult = response.data.ghiDe;
      } else {
        const response = await api.put<{ ghiDe?: typeof overrideResult }>(
          `/academic/schedules/${editingId}`,
          payload,
        );
        overrideResult = response.data.ghiDe;
      }
      setEditorOpen(false);
      setConflictWarning(null);
      setOverrideDialogOpen(false);
      setPreviewMessage("");
      setNotice(acknowledgeConflicts
        ? `Đã lưu lịch có ${overrideResult?.soXungDot ?? 0} xung đột. Lý do ghi đè: ${overrideResult?.lyDo ?? reason.trim()}`
        : editingId === null ? "Đã tạo buổi học." : "Đã cập nhật buổi học.");
      setLoading(true);
      await loadData();
    } catch (requestError: unknown) {
      const response =
        typeof requestError === "object" && requestError !== null &&
        "response" in requestError
          ? (requestError as {
              response?: { status?: number; data?: { detail?: unknown } };
            }).response
          : undefined;
      const detail = response?.data?.detail;
      if (
        response?.status === 409 &&
        typeof detail === "object" &&
        detail !== null &&
        "conflicts" in detail &&
        Array.isArray(detail.conflicts)
      ) {
        const conflictDetail = detail as {
          message?: unknown;
          conflicts: ScheduleConflict[];
        };
        setConflictWarning({
          message:
            typeof conflictDetail.message === "string"
              ? conflictDetail.message
              : "Lịch học bị trùng với buổi học đã được xếp.",
          conflicts: conflictDetail.conflicts,
        });
        setPreviewMessage("");
        setOverrideDialogOpen(false);
        setOverrideReason("");
        return;
      }
      setError(
        typeof detail === "string"
          ? detail
          : "Không thể lưu buổi học.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (updates: Partial<ScheduleForm>) => {
    setForm((current) => ({ ...current, ...updates }));
    setConflictWarning(null);
    setOverrideDialogOpen(false);
    setOverrideReason("");
    setPreviewMessage("");
  };

  const scheduleWritePayload = () => ({
    lopHocId: Number(form.lopHocId),
    monHocId: Number(form.monHocId),
    ngayHoc: form.ngayHoc,
    gioBatDau: form.gioBatDau,
    gioKetThuc: form.gioKetThuc,
    phongHocId: Number(form.phongHocId),
    giangVienId: Number(form.giangVienId),
    xacNhanTrungLich: false,
    lyDoGhiDe: null,
  });

  const checkScheduleConflicts = async () => {
    if (
      !form.lopHocId ||
      !form.monHocId ||
      !form.ngayHoc ||
      !form.gioBatDau ||
      !form.gioKetThuc ||
      !form.phongHocId ||
      !form.giangVienId
    ) {
      setError("Vui lòng điền đầy đủ thông tin trước khi kiểm tra.");
      return;
    }
    setCheckingConflicts(true);
    setError("");
    setPreviewMessage("");
    setConflictWarning(null);
    try {
      const response = await api.post<ConflictPreviewResponse>(
        "/academic/schedules/check-conflicts",
        scheduleWritePayload(),
        {
          params:
            editingId === null
              ? undefined
              : { excludeScheduleId: editingId },
        },
      );
      if (response.data.hasConflicts) {
        setConflictWarning({
          message: "Tìm thấy lịch học đang bị xung đột.",
          conflicts: response.data.conflicts,
        });
        setPreviewMessage("");
      } else {
        setConflictWarning(null);
        setPreviewMessage("Không phát hiện xung đột. Bạn có thể lưu lịch.");
      }
    } catch (requestError: unknown) {
      const detail =
        typeof requestError === "object" && requestError !== null &&
        "response" in requestError
          ? (requestError as { response?: { data?: { detail?: unknown } } })
              .response?.data?.detail
          : null;
      setError(
        typeof detail === "string"
          ? detail
          : "Không thể kiểm tra xung đột lịch học.",
      );
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleClassChange = (lopHocId: string) => {
    const classOption = options.lopHocs.find(
      (item) => String(item.lopHocId) === lopHocId,
    );
    updateForm({
      lopHocId,
      monHocId: classOption?.monHocs[0]
        ? String(classOption.monHocs[0].monHocId)
        : "",
      giangVienId: classOption?.giangVienId
        ? String(classOption.giangVienId)
        : form.giangVienId,
      phongHocId: classOption?.phongHocId
        ? String(classOption.phongHocId)
        : form.phongHocId,
    });
  };

  return (
    <main className="schedule-page academic-page">
      <header className="academic-page-banner">
        <div className="academic-banner-content">
          <div className="academic-banner-label">ĐÀO TẠO</div>
          <h1>Quản lý lịch học</h1>
          <p>Xếp lịch và phát hiện xung đột giảng viên, phòng học.</p>
        </div>
        <div className="academic-banner-stat">
          <strong>{schedules.length}</strong>
          <span>Buổi học</span>
        </div>
      </header>

      {(error || notice) && (
        <div
          className={`schedule-feedback ${error ? "is-error" : "is-success"}`}
          role={error ? "alert" : "status"}
        >
          {error || notice}
        </div>
      )}

      <section className="academic-card">
        <div className="academic-card-heading schedule-list-heading">
          <div>
            <h2>Danh sách buổi học</h2>
            <p>Kiểm tra lịch hiện có trước khi xếp buổi mới.</p>
          </div>
          {canCreate && (
            <button
              type="button"
              className="schedule-primary-button"
              onClick={openCreate}
            >
              + Xếp lịch
            </button>
          )}
        </div>

        <div className="schedule-table-wrap">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>Mã buổi</th>
                <th>Lớp / môn học</th>
                <th>Ngày</th>
                <th>Thời gian</th>
                <th>Giảng viên</th>
                <th>Phòng</th>
                <th>Trạng thái</th>
                {(canUpdate || canCreate) && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canUpdate || canCreate ? 8 : 7}>
                    Đang tải lịch học...
                  </td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={canUpdate || canCreate ? 8 : 7}>
                    Chưa có buổi học nào.
                  </td>
                </tr>
              ) : (
                schedules.map((schedule) => (
                  <tr key={schedule.lichHocId} id={`schedule-${schedule.lichHocId}`}>
                    <td>{schedule.maBuoiHoc}</td>
                    <td>
                      <strong>{schedule.maLop}</strong>
                      <small>{schedule.tenMonHoc}</small>
                    </td>
                    <td>{new Date(`${schedule.ngayHoc}T00:00:00`).toLocaleDateString("vi-VN")}</td>
                    <td>{schedule.gioBatDau}–{schedule.gioKetThuc}</td>
                    <td>{schedule.giangVienTen || "Chưa phân công"}</td>
                    <td>{schedule.tenPhong || "Chưa xếp phòng"}</td>
                    <td>{schedule.trangThai}</td>
                    {(canUpdate || canCreate) && (
                      <td>
                        {canUpdate && schedule.coTheChinhSua ? (
                          <button
                            type="button"
                            className="schedule-text-button"
                            onClick={() => openEdit(schedule)}
                          >
                            Sửa
                          </button>
                        ) : "—"}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editorOpen && (
        <div className="schedule-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditor();
        }}>
          <section
            className="schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-modal-title"
          >
            <header className="schedule-modal-header">
              <div>
                <h2 id="schedule-modal-title">
                  {editingId === null ? "Xếp buổi học" : "Sửa buổi học"}
                </h2>
                <p>Buổi học trùng giảng viên hoặc phòng sẽ bị chặn lưu.</p>
              </div>
              <button type="button" onClick={closeEditor} aria-label="Đóng">
                ×
              </button>
            </header>
            <form
              className="schedule-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveSchedule();
              }}
            >
              <label>
                Lớp học
                <select
                  required
                  disabled={editingId !== null}
                  value={form.lopHocId}
                  onChange={(event) => handleClassChange(event.target.value)}
                >
                  <option value="">Chọn lớp</option>
                  {options.lopHocs.map((item) => (
                    <option key={item.lopHocId} value={item.lopHocId}>
                      {item.maLop} · {item.tenLop}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Môn học
                <select
                  required
                  disabled={editingId !== null || !selectedClass}
                  value={form.monHocId}
                  onChange={(event) => updateForm({ monHocId: event.target.value })}
                >
                  <option value="">Chọn môn</option>
                  {selectedClass?.monHocs.map((item) => (
                    <option key={item.monHocId} value={item.monHocId}>
                      {item.maMonHoc} · {item.tenMonHoc}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ngày học
                <input
                  required
                  type="date"
                  value={form.ngayHoc}
                  onChange={(event) => updateForm({ ngayHoc: event.target.value })}
                />
              </label>
              <label>
                Giờ bắt đầu
                <input
                  required
                  type="time"
                  value={form.gioBatDau}
                  onChange={(event) => updateForm({ gioBatDau: event.target.value })}
                />
              </label>
              <label>
                Giờ kết thúc
                <input
                  required
                  type="time"
                  value={form.gioKetThuc}
                  onChange={(event) => updateForm({ gioKetThuc: event.target.value })}
                />
              </label>
              <label>
                Giảng viên
                <select
                  required
                  value={form.giangVienId}
                  onChange={(event) => updateForm({ giangVienId: event.target.value })}
                >
                  <option value="">Chọn giảng viên</option>
                  {options.giangViens.map((item) => (
                    <option key={item.giangVienId} value={item.giangVienId}>
                      {item.hoTen}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Phòng học
                <select
                  required
                  value={form.phongHocId}
                  onChange={(event) => updateForm({ phongHocId: event.target.value })}
                >
                  <option value="">Chọn phòng học</option>
                  {options.phongHocs.map((item) => (
                    <option key={item.phongHocId} value={item.phongHocId}>
                      {item.maPhong} · {item.tenPhong}
                    </option>
                  ))}
                </select>
              </label>
              {options.phongHocs.length === 0 && (
                <p className="schedule-room-empty" role="alert">
                  Chưa có phòng học đang hoạt động. Hãy thêm phòng trong{" "}
                  <a href="/quan-ly-lop">Quản lý lớp</a> trước khi xếp lịch.
                </p>
              )}

              {error && <p className="schedule-form-error" role="alert">{error}</p>}
              {previewMessage && (
                <p className="schedule-preview-success" role="status">
                  {previewMessage}
                </p>
              )}

              {conflictWarning && (
                <div className="schedule-conflict-warning" role="alert">
                  <strong>{conflictWarning.message}</strong>
                  <ul>
                    {conflictWarning.conflicts.map((conflict, index) => (
                      <li key={`${conflict.lichHocId}-${conflict.loai}-${index}`}>
                        <span>
                          {conflict.loai === "giangVien"
                            ? `Trùng giảng viên${conflict.vaiTro ? ` (${conflict.vaiTro})` : ""}`
                            : "Trùng phòng"}
                          {conflict.ten ? `: ${conflict.ten}` : ""}
                          {conflict.maPhong ? ` (${conflict.maPhong})` : ""}
                          {` · ${conflict.maLop || "Lớp"} ${conflict.tenLop || ""}`}
                          {` · ${new Date(`${conflict.ngay}T00:00:00`).toLocaleDateString("vi-VN")}`}
                          {` · ${conflict.gioBatDau}–${conflict.gioKetThuc}`}
                        </span>
                        <a
                          href={`/quan-ly-lich-hoc#schedule-${conflict.lichHocId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {conflict.maBuoiHoc}
                        </a>
                      </li>
                    ))}
                  </ul>
                  {isTrainingManager ? (
                    <p>
                      Muốn tiếp tục, hãy xác nhận ghi đè và nhập lý do. Các buổi đang xung đột vẫn giữ nguyên.
                    </p>
                  ) : (
                    <p>Chỉ quản lý đào tạo được xác nhận lưu lịch bị trùng.</p>
                  )}
                </div>
              )}

              <div className="schedule-form-actions">
                <button
                  type="button"
                  className="schedule-secondary-button"
                  disabled={checkingConflicts || saving}
                  onClick={() => void checkScheduleConflicts()}
                >
                  {checkingConflicts ? "Đang kiểm tra..." : "Kiểm tra xung đột"}
                </button>
                {conflictWarning && isTrainingManager && (
                  <button
                    type="button"
                    className="schedule-danger-button"
                    disabled={saving}
                    onClick={() => {
                      setOverrideReason("");
                      setOverrideDialogOpen(true);
                    }}
                  >
                    Xác nhận ghi đè
                  </button>
                )}
                {!conflictWarning && (
                  <button
                    type="submit"
                    className="schedule-primary-button"
                    disabled={saving || options.phongHocs.length === 0}
                  >
                    {saving ? "Đang lưu..." : "Lưu lịch"}
                  </button>
                )}
                <button type="button" className="schedule-secondary-button" onClick={closeEditor} disabled={saving}>
                  Đóng
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {overrideDialogOpen && conflictWarning && isTrainingManager && (
        <div
          className="schedule-override-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setOverrideDialogOpen(false);
            }
          }}
        >
          <section
            className="schedule-override-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-override-title"
          >
            <h2 id="schedule-override-title">Xác nhận ghi đè lịch trùng</h2>
            <p>
              Bạn đang xác nhận lưu lịch dù có {conflictWarning.conflicts.length} mục xung đột. Các buổi hiện có sẽ không bị thay đổi.
            </p>
            <label htmlFor="schedule-override-reason">Lý do ghi đè</label>
            <textarea
              id="schedule-override-reason"
              required
              minLength={5}
              maxLength={1000}
              rows={4}
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Nhập lý do cần xếp lịch trùng..."
            />
            {error && <p className="schedule-form-error" role="alert">{error}</p>}
            <div className="schedule-form-actions">
              <button
                type="button"
                className="schedule-danger-button"
                disabled={saving || overrideReason.trim().length < 5}
                onClick={() => void saveSchedule(true, overrideReason)}
              >
                {saving ? "Đang gửi xác nhận..." : "Gửi xác nhận và lưu"}
              </button>
              <button
                type="button"
                className="schedule-secondary-button"
                disabled={saving}
                onClick={() => setOverrideDialogOpen(false)}
              >
                Quay lại
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default ScheduleManagement;