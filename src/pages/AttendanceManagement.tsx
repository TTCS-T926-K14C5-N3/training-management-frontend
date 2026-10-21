import { useEffect, useState } from "react";
import axios from "axios";
import api from "../services/api";
import "./AttendanceManagement.css";

type AttendanceStatus =
  | "Có mặt"
  | "Đi muộn"
  | "Vắng có phép"
  | "Vắng không phép";

interface ScheduleOption {
  lichHocId: number;
  maBuoiHoc: string;
  maLop: string | null;
  tenLop: string | null;
  tenMonHoc: string | null;
  ngayHoc: string;
  gioBatDau: string;
  gioKetThuc: string;
  trangThai: string;
}

interface AttendanceStudent {
  hocVienId: number;
  hoTen: string;
  email: string;
  trangThai: AttendanceStatus | null;
  ghiChu: string | null;
}

interface AttendanceSession {
  lichHocId: number;
  maBuoiHoc: string;
  ngayHoc: string;
  records: AttendanceStudent[];
  coTheCapNhat: boolean;
}

interface AttendanceAuditEntry {
  id: number;
  hocVienId: number;
  trangThaiCu: AttendanceStatus | null;
  trangThaiMoi: AttendanceStatus | null;
  lyDo: string;
  nguoiThucHien: string;
  thoiDiem: string;
}

const STATUSES: AttendanceStatus[] = [
  "Có mặt",
  "Đi muộn",
  "Vắng có phép",
  "Vắng không phép",
];

const errorMessage = (error: unknown): string => {
  if (axios.isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (error.response?.status === 401) return "Phiên đăng nhập đã hết hạn.";
    if (error.response?.status === 403) return "Bạn không có quyền thao tác điểm danh buổi học này.";
    if (error.response?.status === 404) return "Không tìm thấy buổi học.";
    if (error.response?.status === 409) return detail?.toString() ?? "Buổi học chưa thể điểm danh.";
  }
  return error instanceof Error
    ? error.message
    : "Không thể tải hoặc lưu dữ liệu điểm danh.";
};

function AttendanceManagement() {
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [attendance, setAttendance] = useState<AttendanceSession | null>(null);
  const [audit, setAudit] = useState<AttendanceAuditEntry[]>([]);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus | "">>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scheduleReloadKey, setScheduleReloadKey] = useState(0);
  const [attendanceReloadKey, setAttendanceReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const loadSchedules = async () => {
      try {
        const response = await api.get<ScheduleOption[]>("/academic/schedules", {
          params: { excludeCompleted: true },
          signal: controller.signal,
        });
        setSchedules(response.data.filter((item) => item.trangThai !== "Đã hủy"));
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(errorMessage(loadError));
        }
      } finally {
        if (!controller.signal.aborted) setLoadingSchedules(false);
      }
    };
    void loadSchedules();
    return () => controller.abort();
  }, [scheduleReloadKey]);

  const activeScheduleId =
    selectedScheduleId || String(schedules[0]?.lichHocId ?? "");

  useEffect(() => {
    if (!activeScheduleId) return;
    const controller = new AbortController();
    const loadAttendance = async () => {
      setLoadingAttendance(true);
      setError("");
      setNotice("");
      try {
        const response = await api.get<AttendanceSession>(
          `/academic/schedules/${activeScheduleId}/attendance`,
          { signal: controller.signal },
        );
        setAttendance(response.data);
        setStatuses(
          Object.fromEntries(
            response.data.records.map((student) => [
              student.hocVienId,
              student.trangThai ?? "Có mặt",
            ]),
          ),
        );
        setNotes(
          Object.fromEntries(
            response.data.records.map((student) => [
              student.hocVienId,
              student.ghiChu ?? "",
            ]),
          ),
        );
        const auditResponse = await api.get<AttendanceAuditEntry[]>(
          `/academic/schedules/${activeScheduleId}/attendance/audit`,
          { signal: controller.signal },
        );
        setAudit(auditResponse.data);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setAttendance(null);
          setError(errorMessage(loadError));
        }
      } finally {
        if (!controller.signal.aborted) setLoadingAttendance(false);
      }
    };
    void loadAttendance();
    return () => controller.abort();
  }, [activeScheduleId, attendanceReloadKey]);

  const saveAttendance = async () => {
    if (!attendance) return;
    const entries = attendance.records.map((student) => ({
        hocVienId: student.hocVienId,
        trangThai: statuses[student.hocVienId] || "Có mặt",
        ghiChu: notes[student.hocVienId]?.trim() || null,
      }));
    if (entries.length === 0) {
      setError("Hãy chọn trạng thái cho ít nhất một học viên.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await api.put<AttendanceSession>(
        `/academic/schedules/${attendance.lichHocId}/attendance`,
        { records: entries, lyDo: reason.trim() || null },
      );
      setAttendance(response.data);
      setStatuses(
        Object.fromEntries(
          response.data.records.map((student) => [
            student.hocVienId,
            student.trangThai ?? "Có mặt",
          ]),
        ),
      );
      setNotes(
        Object.fromEntries(
          response.data.records.map((student) => [
            student.hocVienId,
            student.ghiChu ?? "",
          ]),
        ),
      );
      const auditResponse = await api.get<AttendanceAuditEntry[]>(
        `/academic/schedules/${attendance.lichHocId}/attendance/audit`,
      );
      setAudit(auditResponse.data);
      setNotice("Đã lưu điểm danh.");
      setReason("");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const selectedSchedule = schedules.find(
    (item) => String(item.lichHocId) === activeScheduleId,
  );

  return (
    <main className="attendance-page">
      <header className="attendance-page-hero">
        <div>
          <span>QUẢN LÝ HỌC TẬP</span>
          <h1>Điểm danh</h1>
          <p>Chọn buổi học để xem danh sách và ghi nhận chuyên cần.</p>
        </div>
        <div className="attendance-page-actions">
          <button
            type="button"
            className="attendance-page-switch"
            onClick={() => window.location.assign("/quan-ly-diem-danh-lop")}
          >
            Điểm danh theo lớp/ngày
          </button>
          <span className="attendance-page-icon" aria-hidden="true">✓</span>
        </div>
      </header>

      <section className="attendance-page-card">
        <label className="attendance-page-field">
          <span>Buổi học</span>
          <select
            value={activeScheduleId}
            onChange={(event) => {
              setSelectedScheduleId(event.target.value);
              setAttendance(null);
            }}
            disabled={loadingSchedules || schedules.length === 0}
          >
            {loadingSchedules && <option value="">Đang tải buổi học...</option>}
            {!loadingSchedules && schedules.length === 0 && (
              <option value="">Không có buổi học khả dụng</option>
            )}
            {schedules.map((schedule) => (
              <option key={schedule.lichHocId} value={schedule.lichHocId}>
                {schedule.maLop ?? schedule.maBuoiHoc} · {schedule.tenMonHoc ?? "Buổi học"} ·{" "}
                {schedule.ngayHoc} · {schedule.gioBatDau}–{schedule.gioKetThuc}
              </option>
            ))}
          </select>
        </label>

        {selectedSchedule && (
          <div className="attendance-page-summary">
            <strong>{selectedSchedule.tenLop ?? selectedSchedule.maLop ?? "Lớp học"}</strong>
            <span>
              {selectedSchedule.tenMonHoc ?? "Môn học"} · {selectedSchedule.ngayHoc} ·{" "}
              {selectedSchedule.gioBatDau}–{selectedSchedule.gioKetThuc}
            </span>
          </div>
        )}

        {error && (
          <div className="attendance-page-message error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setError("");
                if (schedules.length === 0) {
                  setScheduleReloadKey((current) => current + 1);
                } else {
                  setAttendanceReloadKey((current) => current + 1);
                }
              }}
              disabled={loadingAttendance || loadingSchedules}
            >
              Tải lại
            </button>
          </div>
        )}
        {notice && <div className="attendance-page-message success" role="status">{notice}</div>}

        {loadingAttendance ? (
          <p className="attendance-page-empty" role="status">Đang tải danh sách học viên...</p>
        ) : attendance?.records.length ? (
          <>
            <div className="attendance-page-table-wrap">
              <table className="attendance-page-table">
                <thead>
                  <tr>
                    <th>Học viên</th>
                    <th>Email</th>
                    <th>Trạng thái điểm danh</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.records.map((student) => (
                    <tr key={student.hocVienId}>
                      <td data-label="Học viên">{student.hoTen}</td>
                      <td data-label="Email">{student.email}</td>
                      <td data-label="Trạng thái điểm danh">
                        <select
                          value={statuses[student.hocVienId] ?? "Có mặt"}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (
                              value === "" ||
                              STATUSES.includes(value as AttendanceStatus)
                            ) {
                              setStatuses((current) => ({
                                ...current,
                                [student.hocVienId]: value as AttendanceStatus | "",
                              }));
                            }
                          }}
                          disabled={saving || !attendance.coTheCapNhat}
                          aria-label={`Trạng thái điểm danh của ${student.hoTen}`}
                        >
                          <option value="">Chưa điểm danh</option>
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Ghi chú">
                        <input
                          value={notes[student.hocVienId] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [student.hocVienId]: event.target.value,
                            }))
                          }
                          maxLength={1000}
                          placeholder="Ghi chú (không bắt buộc)"
                          disabled={saving || !attendance.coTheCapNhat}
                          aria-label={`Ghi chú cho ${student.hoTen}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {attendance.coTheCapNhat && (
              <>
                <label className="attendance-page-field attendance-page-reason">
                  <span>Lý do điều chỉnh (bắt buộc khi thay đổi dữ liệu đã lưu)</span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={3}
                    maxLength={1000}
                    disabled={saving}
                  />
                </label>
                <button
                  className="attendance-page-save"
                  type="button"
                  onClick={() => void saveAttendance()}
                  disabled={saving || loadingAttendance}
                >
                  {saving ? "Đang lưu..." : "Lưu điểm danh"}
                </button>
              </>
            )}
            {!!audit.length && (
              <section className="attendance-page-audit" aria-label="Lịch sử chỉnh sửa điểm danh">
                <h2>Lịch sử chỉnh sửa điểm danh (360 ngày)</h2>
                <ul>
                  {audit.map((entry) => (
                    <li key={entry.id}>
                      Học viên #{entry.hocVienId}: {entry.trangThaiCu ?? "Chưa điểm danh"} →{" "}
                      {entry.trangThaiMoi ?? "Đã xóa"} · {entry.lyDo} · {entry.nguoiThucHien} ·{" "}
                      {new Date(entry.thoiDiem).toLocaleString("vi-VN")}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : !loadingAttendance && !error ? (
          <p className="attendance-page-empty">
            {attendance
              ? "Buổi học chưa có học viên trong danh sách điểm danh."
              : "Chọn buổi học để xem danh sách điểm danh."}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default AttendanceManagement;
