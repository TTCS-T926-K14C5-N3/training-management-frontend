import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import api from "../services/api";
import "./ClassAttendanceManagement.css";

type AttendanceStatus = "present" | "late" | "excused_absence" | "unexcused_absence" | "unmarked";
type Tab = "attendance" | "requests" | "history" | "thresholds";
interface AttendanceClass { classId: number; classCode: string; className: string; programId: number | null; absenceThreshold: number }
interface StudentRow { studentId: number; studentName: string; email: string; status: AttendanceStatus; reason: string | null; requestId: number | null }
interface Matrix { classId: number; classCode: string; className: string; date: string; students: StudentRow[]; flaggedStudents: Array<{ studentId: number; studentName: string; absencePercent: number }>; counts: { present: number; late: number; excused: number; unexcused: number; absent: number; unmarked: number; total: number }; attendancePercent: number; absencePercent: number; absenceThreshold: number; aboveThreshold: boolean }
interface AbsenceRequest { requestId: number; classId: number; classCode: string; studentId: number; studentName: string; date: string; reason: string; evidence: string | null; status: string; reviewReason: string | null }
interface HistoryRecord { classId: number; classCode: string; className: string; date: string; status: AttendanceStatus; reason: string | null }
interface Threshold { programId: number; programCode: string; programName: string; percentage: number }
interface AttendanceNotice { id: number; type: string; title: string; message: string; at: string; read: boolean }

const statusLabels: Record<AttendanceStatus, string> = {
  present: "Present", late: "Late", excused_absence: "Excused absence",
  unexcused_absence: "Unexcused absence", unmarked: "Not marked",
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
    return response?.data?.detail || "The request could not be completed.";
  }
  return error instanceof Error ? error.message : "The request could not be completed.";
};

export default function ClassAttendanceManagement() {
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
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [requestClassId, setRequestClassId] = useState(0);
  const [requestDate, setRequestDate] = useState(today());
  const [requestReason, setRequestReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [sort, setSort] = useState("name");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

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
      setNotice("Attendance saved. Every change is recorded in the audit history.");
      await loadMatrix();
    } catch (saveError) { setError(messageOf(saveError)); }
    finally { setLoading(false); }
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setNotice("");
    try {
      await api.post("/attendance/absence-requests", {
        classId: requestClassId, date: requestDate, reason: requestReason.trim(), evidence: evidence.trim() || null,
      });
      setRequestReason(""); setEvidence(""); setNotice("Absence request sent to your teacher.");
      await loadHistory();
    } catch (submitError) { setError(messageOf(submitError)); }
  };

  const reviewRequest = async (requestId: number, decision: "approved" | "rejected") => {
    const reason = window.prompt(decision === "approved" ? "Reason for approval:" : "Reason for rejection:", "");
    if (reason === null || !reason.trim()) return;
    try {
      await api.post(`/attendance/absence-requests/${requestId}/decision`, { decision, reason: reason.trim() });
      setNotice(`Request ${decision}. The student has been notified.`);
      await loadRequests();
    } catch (reviewError) { setError(messageOf(reviewError)); }
  };

  const exportExcel = async () => {
    try {
      const response = await api.get(`/attendance/classes/${classId}/export`, { params: { date: day }, responseType: "blob" });
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl; link.download = `${matrix?.classCode || "class"}-${day}.xlsx`; link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (exportError) { setError(messageOf(exportError)); }
  };

  const saveThreshold = async (programId: number, percentage: number) => {
    try {
      await api.put(`/attendance/thresholds/${programId}`, { percentage });
      setNotice("Program absence threshold updated."); await loadThresholds();
    } catch (thresholdError) { setError(messageOf(thresholdError)); }
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    ...(!studentMode ? [{ id: "attendance" as const, label: "Class attendance" }] : []),
    { id: "requests", label: "Absence requests" },
    ...(studentMode ? [{ id: "history" as const, label: "My history" }] : []),
    ...(managerMode ? [{ id: "thresholds" as const, label: "Program thresholds" }] : []),
  ];

  return (
    <main className="attendance-page">
      <header className="attendance-hero">
        <div><span className="attendance-kicker">LEARNING OPERATIONS</span><h1>{studentMode ? "My attendance" : "Attendance management"}</h1>
          <p>{studentMode ? "Track your attendance and send an absence request with a reason or evidence." : "Record class attendance, review absence requests, and identify students who need support."}</p></div>
        <div className="attendance-page-actions">
          <button
            className="attendance-button attendance-light"
            onClick={() => window.location.assign("/quan-ly-diem-danh")}
          >
            Attendance by session
          </button>
          {!studentMode && matrix && <button className="attendance-button attendance-light" onClick={() => void exportExcel()}>Export Excel</button>}
        </div>
      </header>
      <nav className="attendance-tabs" aria-label="Attendance sections">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setError(""); }}>{item.label}</button>)}</nav>
      {error && <div className="attendance-alert error" role="alert">{error}</div>}
      {notice && <div className="attendance-alert success" role="status">{notice}</div>}

      {tab === "attendance" && !studentMode && <section className="attendance-panel">
        <div className="attendance-controls">
          <label>Class<select value={classId || ""} onChange={(event) => setClassId(Number(event.target.value))}><option value="">Select a class</option>{classes.map((item) => <option key={item.classId} value={item.classId}>{item.classCode} · {item.className}</option>)}</select></label>
          <label>Attendance date<input type="date" value={day} max={today()} onChange={(event) => setDay(event.target.value)} /></label>
          <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Student name</option><option value="status">Attendance status</option><option value="absent">Absent first</option></select></label>
        </div>
        {matrix && <>
          <div className="attendance-summary">
            <div><span>Students</span><strong>{matrix.counts.total}</strong></div><div><span>Present</span><strong>{matrix.counts.present}</strong></div>
            <div><span>Late</span><strong>{matrix.counts.late}</strong></div><div><span>Excused</span><strong>{matrix.counts.excused}</strong></div>
            <div><span>Unexcused</span><strong>{matrix.counts.unexcused}</strong></div><div><span>Not marked</span><strong>{matrix.counts.unmarked}</strong></div>
            <div><span>Attendance</span><strong>{matrix.attendancePercent}%</strong></div>
            <div><span>Unexcused</span><strong>{matrix.absencePercent}% / {matrix.absenceThreshold}%</strong></div>
          </div>
          {matrix.aboveThreshold && <div className="attendance-alert warning">Program threshold reached: {matrix.flaggedStudents.map((student) => `${student.studentName} (${student.absencePercent}%)`).join(", ")}.</div>}
          {!studentMode && notifications.filter((item) => item.type === "absence_threshold").map((item) => <div className="attendance-alert warning" key={item.id}><strong>{item.title}:</strong> {item.message}</div>)}
          <div className="attendance-toolbar"><span>{matrix.classCode} · {matrix.date}</span><div><button className="attendance-button secondary" disabled={loading || !matrix.students.length} onClick={async () => { try { await api.post(`/attendance/classes/${classId}/mark-all-present`, null, { params: { date: day } }); setNotice("All students marked present."); await loadMatrix(); } catch (markError) { setError(messageOf(markError)); } }}>Mark all present</button>
            <button className="attendance-button primary" disabled={loading} onClick={() => void saveRecords(matrix.students.map((student) => ({ studentId: student.studentId, status: draft[student.studentId] || student.status })).filter((row) => row.status !== "unmarked"))}>Save changes</button></div></div>
          <div className="attendance-students">{sortedStudents.map((student) => <article className="attendance-student" key={student.studentId}>
            <div className="student-name"><strong>{student.studentName}</strong><span>{student.email}</span></div>
            <label>Status<select value={draft[student.studentId] || student.status} onChange={(event) => setDraft((previous) => ({ ...previous, [student.studentId]: event.target.value as AttendanceStatus }))}>
              <option value="unmarked">Not marked</option><option value="present">Present</option><option value="late">Late</option><option value="excused_absence">Excused absence</option><option value="unexcused_absence">Unexcused absence</option>
            </select></label>{student.requestId && <span className="request-pending">Absence request pending</span>}
            <span className={`status-pill state-${draft[student.studentId] || student.status}`}>{statusLabels[draft[student.studentId] || student.status]}</span>
          </article>)}</div>
          <button className="attendance-link" onClick={async () => {
            try { const response = await api.get(`/attendance/classes/${classId}/audit`, { params: { date: day } });
              const lines = response.data.map((entry: { at: string; action: string; old: string; new: string; reason: string }) => `${entry.at} · ${entry.action} · ${entry.old || "—"} → ${entry.new} · ${entry.reason || "No reason"}`);
              window.alert(lines.join("\n") || "No edits recorded for this date.");
            } catch (auditError) { setError(messageOf(auditError)); }
          }}>View edit audit</button>
        </>}
        {!matrix && !loading && !classes.length && <p>No classes are available for attendance.</p>}
      </section>}

      {tab === "requests" && <section className="attendance-panel">
        {studentMode ? <form className="absence-form" onSubmit={(event) => void submitRequest(event)}><h2>Request an excused absence</h2>
          <label>Class<select required value={requestClassId || ""} onChange={(event) => setRequestClassId(Number(event.target.value))}><option value="">Select a class</option>{classes.map((item) => <option key={item.classId} value={item.classId}>{item.classCode} · {item.className}</option>)}</select></label>
          <label>Class date<input required type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} /></label>
          <label>Reason<textarea required minLength={1} maxLength={2000} value={requestReason} onChange={(event) => setRequestReason(event.target.value)} placeholder="Explain why you will be absent" /></label>
          <label>Evidence link (optional)<input type="url" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="https://…" /></label>
          <button className="attendance-button primary" disabled={!requestClassId}>Submit request</button>
          <p className="helper-text">Your teacher reviews the request and sends you the decision.</p>
        </form> : <><div className="attendance-section-heading"><h2>Requests for your classes</h2><button className="attendance-button secondary" onClick={() => void loadRequests()}>Refresh</button></div>
          {!requests.length && <p>No absence requests to review.</p>}{requests.map((request) => <article className="request-card" key={request.requestId}>
            <div><strong>{request.studentName}</strong><span>{request.classCode} · {request.date}</span><p>{request.reason}</p>{request.evidence && <a href={request.evidence} target="_blank" rel="noreferrer">View evidence</a>}{request.reviewReason && <small>Review note: {request.reviewReason}</small>}</div>
            <div className="request-actions"><span className={`request-status ${request.status}`}>{request.status}</span>{request.status === "pending" && <><button className="attendance-button primary" onClick={() => void reviewRequest(request.requestId, "approved")}>Approve</button><button className="attendance-button danger" onClick={() => void reviewRequest(request.requestId, "rejected")}>Reject</button></>}</div>
          </article>)}</>}
      </section>}

      {tab === "history" && studentMode && <section className="attendance-panel"><h2>Attendance history</h2>
        {warning && <div className="attendance-alert warning">{warning.message} Please contact your teacher or training manager if this is incorrect.</div>}
        {!history.length && <p>No attendance records yet.</p>}{history.map((record, index) => <article className="history-row" key={`${record.classId}-${record.date}-${index}`}>
          <div><strong>{record.classCode} · {record.className}</strong><span>{record.date}</span>{record.reason && <small>{record.reason}</small>}</div><span className={`status-pill state-${record.status}`}>{statusLabels[record.status]}</span>
        </article>)}
        <h2 className="history-subheading">Notifications</h2>{notifications.map((item) => <article className="history-row" key={item.id}><div><strong>{item.title}</strong><span>{item.message}</span><small>{new Date(item.at).toLocaleString()}</small></div></article>)}<h2 className="history-subheading">My absence requests</h2>{requests.map((request) => <article className="history-row" key={request.requestId}><div><strong>{request.classCode} · {request.date}</strong><span>{request.reason}</span>{request.reviewReason && <small>Teacher: {request.reviewReason}</small>}</div><span className={`request-status ${request.status}`}>{request.status}</span></article>)}
      </section>}

      {tab === "thresholds" && !studentMode && <section className="attendance-panel"><h2>Program absence thresholds</h2><p>Thresholds default to 20% and count unexcused absences only.</p>
        {!thresholds.length && <p>No training programs are available.</p>}{thresholds.map((threshold) => <ThresholdRow key={threshold.programId} threshold={threshold} onSave={saveThreshold} />)}
      </section>}
    </main>
  );
}

function ThresholdRow({ threshold, onSave }: { threshold: Threshold; onSave: (programId: number, percentage: number) => Promise<void> }) {
  const [value, setValue] = useState<number | null>(null);
  return <form className="threshold-row" onSubmit={(event) => { event.preventDefault(); void onSave(threshold.programId, value ?? threshold.percentage).then(() => setValue(null)); }}>
    <div><strong>{threshold.programCode} · {threshold.programName}</strong><span>Program-specific limit</span></div>
    <label><span className="sr-only">Absence percentage threshold</span><input type="number" min="0" max="100" value={value ?? threshold.percentage} onChange={(event) => setValue(Number(event.target.value))} /><span>%</span></label>
    <button className="attendance-button primary" type="submit">Save</button>
  </form>;
}
