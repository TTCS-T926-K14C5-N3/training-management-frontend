import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import "./AttendanceManagement.css";

type AttendanceStatus = "present" | "late" | "excused_absence" | "unexcused_absence" | "unmarked";
type Tab = "attendance" | "requests" | "history" | "thresholds";
interface AttendanceClass { classId: number; classCode: string; className: string; programId: number | null; absenceThreshold: number }
interface StudentRow { studentId: number; studentName: string; email: string; status: AttendanceStatus; reason: string | null; requestId: number | null }
interface Matrix { classId: number; classCode: string; className: string; date: string; students: StudentRow[]; flaggedStudents: Array<{ studentId: number; studentName: string; absencePercent: number }>; counts: { present: number; absent: number; unexcused: number; total: number }; attendancePercent: number; absencePercent: number; absenceThreshold: number; aboveThreshold: boolean }
interface AbsenceRequest { requestId: number; classId: number; classCode: string; studentId: number; studentName: string; date: string; reason: string; evidence: string | null; status: string; reviewReason: string | null }
interface HistoryRecord { classId: number; classCode: string; className: string; date: string; status: AttendanceStatus; reason: string | null }
interface Threshold { programId: number; programCode: string; programName: string; percentage: number }
interface AttendanceNotice { id: number; type: string; title: string; message: string; at: string; read: boolean }
interface ScheduleNotification { id: number; title: string; message: string; at: string }
interface AttendanceAuditRecord {
  at: string;
  action: string;
  old: unknown;
  new: unknown;
  reason: string | null;
}

const statusLabels: Record<AttendanceStatus, string> = {
  present: "Có mặt", late: "Đi muộn", excused_absence: "Vắng có phép",
  unexcused_absence: "Vắng không phép", unmarked: "Chưa điểm danh",
};
const requestStatusLabels: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
};
const attendanceAuditValue = (value: unknown): string => {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return statusLabels[value as AttendanceStatus] || value || "—";
    }
  }
  if (typeof parsed === "object" && parsed !== null) {
    const item = parsed as { status?: unknown; reason?: unknown };
    const status = typeof item.status === "string"
      ? statusLabels[item.status as AttendanceStatus] || item.status
      : "—";
    const reason = typeof item.reason === "string" && item.reason
      ? ` · Lý do: ${item.reason}`
      : "";
    return `${status}${reason}`;
  }
  return typeof parsed === "string"
    ? statusLabels[parsed as AttendanceStatus] || parsed
    : "—";
};
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const getStudentMode = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const roleList = Array.isArray(user.vaiTro) ? user.vaiTro : Array.isArray(user.vaiTros) ? user.vaiTros : [];
    return [user.vaiTroId, user.roleId, user.role?.id, ...roleList.map((role: { vaiTroId?: number; id?: number }) => role.vaiTroId ?? role.id)].map(Number).includes(2);
  } catch { return false; }
};
const getManagerMode = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const roles = Array.isArray(user.vaiTro) ? user.vaiTro : Array.isArray(user.vaiTros) ? user.vaiTros : [];
    return roles.some((role: { vaiTroId?: number; id?: number }) => [7, 8].includes(Number(role.vaiTroId ?? role.id))) || [7, 8].includes(Number(user.vaiTroId ?? user.roleId));
  } catch { return false; }
};
const messageOf = (error: unknown) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || "Không thể hoàn tất yêu cầu.";
  }
  return error instanceof Error ? error.message : "Không thể hoàn tất yêu cầu.";
};

export default function AttendanceManagement() {
  const studentMode = useMemo(() => getStudentMode(), []);
  const managerMode = useMemo(() => getManagerMode(), []);
  const [tab, setTab] = useState<Tab>(studentMode ? "history" : "attendance");
  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [classId, setClassId] = useState(0);
  const [day, setDay] = useState(today());
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [draft, setDraft] = useState<Record<number, AttendanceStatus>>({});
  const [requests, setRequests] = useState<AbsenceRequest[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [warning, setWarning] = useState<{ message: string; absencePercent: number; threshold: number } | null>(null);
  const [notifications, setNotifications] = useState<AttendanceNotice[]>([]);
  const [scheduleNotifications, setScheduleNotifications] = useState<ScheduleNotification[]>([]);
  const [scheduleNotificationError, setScheduleNotificationError] = useState("");
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [requestClassId, setRequestClassId] = useState(0);
  const [requestDate, setRequestDate] = useState(today());
  const [requestReason, setRequestReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [sort, setSort] = useState("name");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditRecords, setAuditRecords] = useState<AttendanceAuditRecord[]>([]);
  const [auditError, setAuditError] = useState("");

  const loadClasses = useCallback(async () => {
    try {
      const response = await api.get<AttendanceClass[]>("/attendance/classes");
      setClasses(response.data);
      setClassId((previous) => previous || response.data[0]?.classId || 0);
      setRequestClassId((previous) => previous || response.data[0]?.classId || 0);
    } catch (loadError) { setError(messageOf(loadError)); }
  }, []);

  const loadMatrix = useCallback(async () => {
    if (!classId || studentMode) return;
    setLoading(true); setError("");
    try {
      const response = await api.get<Matrix>(`/attendance/classes/${classId}/matrix`, { params: { date: day } });
      setMatrix(response.data);
      setDraft(Object.fromEntries(response.data.students.map((student) => [student.studentId, student.status])));
    } catch (loadError) { setError(messageOf(loadError)); }
    finally { setLoading(false); }
  }, [classId, day, studentMode]);

  const loadNotifications = useCallback(async () => {
    try { const response = await api.get<AttendanceNotice[]>("/attendance/notifications"); setNotifications(response.data); }
    catch (loadError) { setError(messageOf(loadError)); }
  }, []);

  const loadRequests = useCallback(async () => {
    try { const response = await api.get<AbsenceRequest[]>("/attendance/absence-requests"); setRequests(response.data); }
    catch (loadError) { setError(messageOf(loadError)); }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.get<{ records: HistoryRecord[]; requests: AbsenceRequest[]; warning: typeof warning; notifications: AttendanceNotice[] }>("/attendance/my-history");
      setHistory(response.data.records); setWarning(response.data.warning);
      setRequests(response.data.requests); setNotifications(response.data.notifications || []);
    } catch (loadError) { setError(messageOf(loadError)); }
    try {
      const response = await api.get<ScheduleNotification[]>("/academic/schedule-notifications");
      setScheduleNotifications(response.data);
      setScheduleNotificationError("");
    } catch (loadError) {
      setScheduleNotificationError(messageOf(loadError));
    }
  }, []);

  const loadThresholds = useCallback(async () => {
    try { const response = await api.get<Threshold[]>("/attendance/thresholds"); setThresholds(response.data); }
    catch (loadError) { setError(messageOf(loadError)); }
  }, []);

  useEffect(() => { void loadClasses(); }, [loadClasses]);
  useEffect(() => { if (tab === "attendance") { void loadMatrix(); if (!studentMode) void loadNotifications(); } }, [tab, loadMatrix, loadNotifications, studentMode]);
  useEffect(() => {
    if (tab === "requests") void loadRequests();
    if (tab === "history") void loadHistory();
    if (tab === "thresholds") void loadThresholds();
  }, [tab, loadHistory, loadRequests, loadThresholds]);

  const sortedStudents = useMemo(() => {
    if (!matrix) return [];
    return [...matrix.students].sort((a, b) => {
      const stateA = draft[a.studentId] || a.status;
      const stateB = draft[b.studentId] || b.status;
      if (sort === "status") return stateA.localeCompare(stateB) || a.studentName.localeCompare(b.studentName);
      if (sort === "absent") return Number(stateB.includes("absence")) - Number(stateA.includes("absence")) || a.studentName.localeCompare(b.studentName);
      return a.studentName.localeCompare(b.studentName);
    });
  }, [draft, matrix, sort]);

  const saveRecords = async (records: Array<{ studentId: number; status: string }>) => {
    if (!matrix) return;
    setError(""); setNotice(""); setLoading(true);
    try {
      await api.post(`/attendance/classes/${classId}/records`, { date: day, records });
      setNotice("Đã lưu điểm danh. Mọi thay đổi đều được ghi lại trong lịch sử chỉnh sửa.");
      await loadMatrix();
    } catch (saveError) { setError(messageOf(saveError)); }
    finally { setLoading(false); }
  };

  const loadAttendanceAudit = async () => {
    setAuditOpen(true);
    setAuditLoading(true);
    setAuditError("");
    setAuditRecords([]);
    try {
      const response = await api.get<AttendanceAuditRecord[]>(
        `/attendance/classes/${classId}/audit`,
        { params: { date: day } },
      );
      setAuditRecords(response.data);
    } catch (auditError) {
      setAuditError(messageOf(auditError));
    } finally {
      setAuditLoading(false);
    }
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setNotice("");
    try {
      await api.post("/attendance/absence-requests", {
        classId: requestClassId, date: requestDate, reason: requestReason.trim(), evidence: evidence.trim() || null,
      });
      setRequestReason(""); setEvidence(""); setNotice("Đã gửi đơn xin phép đến giảng viên.");
      await loadHistory();
    } catch (submitError) { setError(messageOf(submitError)); }
  };

  const reviewRequest = async (requestId: number, decision: "approved" | "rejected") => {
    const reason = window.prompt(decision === "approved" ? "Lý do duyệt đơn:" : "Lý do từ chối đơn:", "");
    if (reason === null || !reason.trim()) return;
    try {
      await api.post(`/attendance/absence-requests/${requestId}/decision`, { decision, reason: reason.trim() });
      setNotice(`Đã ${decision === "approved" ? "duyệt" : "từ chối"} đơn. Học viên đã được thông báo.`);
      await loadRequests();
    } catch (reviewError) { setError(messageOf(reviewError)); }
  };

  const exportExcel = async () => {
    try {
      const response = await api.get(`/attendance/classes/${classId}/export`, { params: { date: day }, responseType: "blob" });
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl; link.download = `${matrix?.classCode || "class"}-${day}.xls`; link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (exportError) { setError(messageOf(exportError)); }
  };

  const saveThreshold = async (programId: number, percentage: number) => {
    try {
      await api.put(`/attendance/thresholds/${programId}`, { percentage });
      setNotice("Đã cập nhật ngưỡng vắng mặt của chương trình."); await loadThresholds();
    } catch (thresholdError) { setError(messageOf(thresholdError)); }
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    ...(!studentMode ? [{ id: "attendance" as const, label: "Điểm danh lớp" }] : []),
    { id: "requests", label: "Đơn xin phép" },
    ...(studentMode ? [{ id: "history" as const, label: "Lịch sử của tôi" }] : []),
    ...(managerMode ? [{ id: "thresholds" as const, label: "Ngưỡng chuyên cần" }] : []),
  ];

  return (
    <main className="attendance-page">
      {(error || notice) && (
        <ToastNotification
          type={error ? "error" : "success"}
          text={error || notice}
          onClose={() => {
            setError("");
            setNotice("");
          }}
        />
      )}
      <header className="attendance-hero">
        <div><span className="attendance-kicker">QUẢN LÝ ĐÀO TẠO</span><h1>{studentMode ? "Điểm danh của tôi" : "Quản lý điểm danh"}</h1>
          <p>{studentMode ? "Theo dõi tình hình điểm danh và gửi đơn xin phép kèm lý do hoặc minh chứng." : "Ghi nhận điểm danh lớp, duyệt đơn xin phép và theo dõi học viên cần hỗ trợ."}</p></div>
        {!studentMode && matrix && <button className="attendance-button attendance-light" onClick={() => void exportExcel()}>Xuất Excel</button>}
      </header>
      <nav className="attendance-tabs" aria-label="Các mục điểm danh">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setError(""); }}>{item.label}</button>)}</nav>

      {tab === "attendance" && !studentMode && <section className="attendance-panel">
        <div className="attendance-controls">
          <label>Lớp<select value={classId || ""} onChange={(event) => setClassId(Number(event.target.value))}><option value="">Chọn lớp</option>{classes.map((item) => <option key={item.classId} value={item.classId}>{item.classCode} · {item.className}</option>)}</select></label>
          <label>Ngày điểm danh<input type="date" value={day} max={today()} onChange={(event) => setDay(event.target.value)} /></label>
          <label>Sắp xếp theo<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Tên học viên</option><option value="status">Trạng thái điểm danh</option><option value="absent">Vắng mặt trước</option></select></label>
        </div>
        {matrix && <>
          <div className="attendance-summary">
            <div><span>Học viên</span><strong>{matrix.counts.total}</strong></div><div><span>Có mặt / đi muộn</span><strong>{matrix.counts.present}</strong></div>
            <div><span>Vắng mặt</span><strong>{matrix.counts.absent}</strong></div><div><span>Tỷ lệ có mặt</span><strong>{matrix.attendancePercent}%</strong></div>
            <div><span>Vắng không phép</span><strong>{matrix.absencePercent}% / {matrix.absenceThreshold}%</strong></div>
          </div>
          {matrix.aboveThreshold && <div className="attendance-alert warning">Đã chạm ngưỡng vắng mặt của chương trình: {matrix.flaggedStudents.map((student) => `${student.studentName} (${student.absencePercent}%)`).join(", ")}.</div>}
          {!studentMode && notifications.filter((item) => item.type === "absence_threshold").map((item) => <div className="attendance-alert warning" key={item.id}><strong>{item.title}:</strong> {item.message}</div>)}
          <div className="attendance-toolbar"><span>{matrix.classCode} · {matrix.date}</span><div><button className="attendance-button secondary" disabled={loading || !matrix.students.length} onClick={async () => { try { await api.post(`/attendance/classes/${classId}/mark-all-present`, null, { params: { date: day } }); setNotice("Đã điểm danh có mặt cho toàn bộ học viên."); await loadMatrix(); } catch (markError) { setError(messageOf(markError)); } }}>Điểm danh tất cả có mặt</button>
            <button className="attendance-button primary" disabled={loading} onClick={() => void saveRecords(matrix.students.map((student) => ({ studentId: student.studentId, status: draft[student.studentId] || student.status })).filter((row) => row.status !== "unmarked"))}>Lưu thay đổi</button></div></div>
          <div className="attendance-students">{sortedStudents.map((student) => <article className="attendance-student" key={student.studentId}>
            <div className="student-name"><strong>{student.studentName}</strong><span>{student.email}</span></div>
            <label>Trạng thái<select value={draft[student.studentId] || student.status} onChange={(event) => setDraft((previous) => ({ ...previous, [student.studentId]: event.target.value as AttendanceStatus }))}>
              <option value="unmarked">Chưa điểm danh</option><option value="present">Có mặt</option><option value="late">Đi muộn</option><option value="excused_absence">Vắng có phép</option><option value="unexcused_absence">Vắng không phép</option>
            </select></label>{student.requestId && <span className="request-pending">Đơn xin phép đang chờ duyệt</span>}
            <span className={`status-pill state-${draft[student.studentId] || student.status}`}>{statusLabels[draft[student.studentId] || student.status]}</span>
          </article>)}</div>
          <button className="attendance-link" onClick={() => void loadAttendanceAudit()}>
            Xem lịch sử chỉnh sửa
          </button>
        </>}
        {!matrix && !loading && !classes.length && <p>Không có lớp nào để điểm danh.</p>}
      </section>}

      {tab === "requests" && <section className="attendance-panel">
        {studentMode ? <form className="absence-form" onSubmit={(event) => void submitRequest(event)}><h2>Gửi đơn xin nghỉ có phép</h2>
          <label>Lớp<select required value={requestClassId || ""} onChange={(event) => setRequestClassId(Number(event.target.value))}><option value="">Chọn lớp</option>{classes.map((item) => <option key={item.classId} value={item.classId}>{item.classCode} · {item.className}</option>)}</select></label>
          <label>Ngày học<input required type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} /></label>
          <label>Lý do<textarea required minLength={1} maxLength={2000} value={requestReason} onChange={(event) => setRequestReason(event.target.value)} placeholder="Giải thích lý do bạn vắng mặt" /></label>
          <label>Liên kết minh chứng (không bắt buộc)<input type="url" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="https://…" /></label>
          <button className="attendance-button primary" disabled={!requestClassId}>Gửi đơn</button>
          <p className="helper-text">Giảng viên sẽ xem xét đơn và thông báo kết quả cho bạn.</p>
        </form> : <><div className="attendance-section-heading"><h2>Đơn xin phép của các lớp</h2><button className="attendance-button secondary" onClick={() => void loadRequests()}>Làm mới</button></div>
          {!requests.length && <p>Không có đơn xin phép cần duyệt.</p>}{requests.map((request) => <article className="request-card" key={request.requestId}>
            <div><strong>{request.studentName}</strong><span>{request.classCode} · {request.date}</span><p>{request.reason}</p>{request.evidence && <a href={request.evidence} target="_blank" rel="noreferrer">Xem minh chứng</a>}{request.reviewReason && <small>Ghi chú xét duyệt: {request.reviewReason}</small>}</div>
            <div className="request-actions"><span className={`request-status ${request.status}`}>{requestStatusLabels[request.status] || request.status}</span>{request.status === "pending" && <><button className="attendance-button primary" onClick={() => void reviewRequest(request.requestId, "approved")}>Duyệt</button><button className="attendance-button danger" onClick={() => void reviewRequest(request.requestId, "rejected")}>Từ chối</button></>}</div>
          </article>)}</>}
      </section>}

      {tab === "history" && studentMode && <section className="attendance-panel"><h2>Lịch sử điểm danh</h2>
        {warning && <div className="attendance-alert warning">{warning.message} Vui lòng liên hệ giảng viên hoặc quản lý đào tạo nếu thông tin này không chính xác.</div>}
        {!history.length && <p>Chưa có dữ liệu điểm danh.</p>}{history.map((record, index) => <article className="history-row" key={`${record.classId}-${record.date}-${index}`}>
          <div><strong>{record.classCode} · {record.className}</strong><span>{record.date}</span>{record.reason && <small>{record.reason}</small>}</div><span className={`status-pill state-${record.status}`}>{statusLabels[record.status]}</span>
        </article>)}
        <h2 className="history-subheading">Thông báo</h2>{notifications.map((item) => <article className="history-row" key={item.id}><div><strong>{item.title}</strong><span>{item.message}</span><small>{new Date(item.at).toLocaleString("vi-VN")}</small></div></article>)}
        <h2 className="history-subheading">Thông báo lịch học</h2>
        {scheduleNotificationError ? (
          <div className="attendance-alert error" role="alert">{scheduleNotificationError}</div>
        ) : scheduleNotifications.length ? (
          scheduleNotifications.map((item) => (
            <article className="history-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.message}</span>
                <small>{new Date(item.at).toLocaleString("vi-VN")}</small>
              </div>
            </article>
          ))
        ) : (
          <p>Chưa có thông báo thay đổi lịch học.</p>
        )}
        <h2 className="history-subheading">Đơn xin nghỉ của tôi</h2>{requests.map((request) => <article className="history-row" key={request.requestId}><div><strong>{request.classCode} · {request.date}</strong><span>{request.reason}</span>{request.reviewReason && <small>Giảng viên: {request.reviewReason}</small>}</div><span className={`request-status ${request.status}`}>{requestStatusLabels[request.status] || request.status}</span></article>)}
      </section>}

      {tab === "thresholds" && !studentMode && <section className="attendance-panel"><h2>Ngưỡng vắng mặt theo chương trình</h2><p>Ngưỡng mặc định là 20% và chỉ tính số buổi vắng không phép.</p>
        {!thresholds.length && <p>Không có chương trình đào tạo.</p>}{thresholds.map((threshold) => <ThresholdRow key={threshold.programId} threshold={threshold} onSave={saveThreshold} />)}
      </section>}

      {auditOpen && (
        <div
          className="attendance-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAuditOpen(false);
          }}
        >
          <section
            className="attendance-audit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-audit-title"
          >
            <header className="attendance-audit-heading">
              <div>
                <span className="attendance-kicker">LỊCH SỬ ĐIỂM DANH</span>
                <h2 id="attendance-audit-title">Lịch sử chỉnh sửa</h2>
                <p>{matrix?.classCode} · {day}</p>
              </div>
              <button
                type="button"
                className="attendance-audit-close"
                onClick={() => setAuditOpen(false)}
                aria-label="Đóng"
              >
                ×
              </button>
            </header>
            <div className="attendance-audit-content" aria-live="polite">
              {auditLoading ? (
                <p className="attendance-audit-empty">Đang tải lịch sử chỉnh sửa...</p>
              ) : auditError ? (
                <div className="attendance-alert error" role="alert">{auditError}</div>
              ) : auditRecords.length === 0 ? (
                <p className="attendance-audit-empty">Chưa có chỉnh sửa nào trong ngày này.</p>
              ) : (
                <ol className="attendance-audit-list">
                  {auditRecords.map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="attendance-audit-item">
                      <div className="attendance-audit-item-heading">
                        <strong>{entry.action === "updated" ? "Cập nhật điểm danh" : entry.action}</strong>
                        <time dateTime={entry.at}>{new Date(entry.at).toLocaleString("vi-VN")}</time>
                      </div>
                      <p>
                        <span>{attendanceAuditValue(entry.old)}</span>
                        <span aria-hidden="true">→</span>
                        <strong>{attendanceAuditValue(entry.new)}</strong>
                      </p>
                      {entry.reason && <small>Lý do: {entry.reason}</small>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <footer className="attendance-audit-footer">
              <button
                type="button"
                className="attendance-button secondary"
                onClick={() => setAuditOpen(false)}
              >
                Đóng
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

function ThresholdRow({ threshold, onSave }: { threshold: Threshold; onSave: (programId: number, percentage: number) => Promise<void> }) {
  const [value, setValue] = useState<number | null>(null);
  return <form className="threshold-row" onSubmit={(event) => { event.preventDefault(); void onSave(threshold.programId, value ?? threshold.percentage).then(() => setValue(null)); }}>
    <div><strong>{threshold.programCode} · {threshold.programName}</strong><span>Ngưỡng áp dụng riêng cho chương trình</span></div>
    <label><span className="sr-only">Tỷ lệ ngưỡng vắng mặt</span><input type="number" min="0" max="100" value={value ?? threshold.percentage} onChange={(event) => setValue(Number(event.target.value))} /><span>%</span></label>
    <button className="attendance-button primary" type="submit">Lưu</button>
  </form>;
}

