import { useCallback, useEffect, useMemo, useState } from "react";
import SearchableSelect from "../components/SearchableSelect";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import AbsenceRequest from "./AbsenceRequest";
import "./ClassAttendanceManagement.css";

type AttendanceStatus = "present" | "late" | "excused_absence" | "unexcused_absence" | "unmarked";
type Tab = "attendance" | "requests" | "request-tracking" | "history" | "sessions" | "notifications" | "thresholds";
interface AttendanceClass { classId: number; classCode: string; className: string; programId: number | null; absenceThreshold: number }
interface StudentRow { studentId: number; studentName: string; email: string; status: AttendanceStatus; reason: string | null; requestId: number | null; absencePercent: number; unexcusedAbsences: number; totalMarked: number; absenceThreshold: number; aboveThreshold: boolean }
interface Matrix { classId: number; classCode: string; className: string; date: string; students: StudentRow[]; flaggedStudents: Array<{ studentId: number; studentName: string; absencePercent: number }>; counts: { present: number; late: number; excused: number; unexcused: number; absent: number; unmarked: number; total: number }; attendancePercent: number; absencePercent: number; absenceThreshold: number; aboveThreshold: boolean }
interface AbsenceRequest { requestId: number; classId: number; classCode: string; studentId: number; studentName: string; date: string; reason: string; evidence: string | null; status: string; reviewReason: string | null }
interface HistoryRecord { classId: number; classCode: string; className: string; programId: number | null; date: string; startTime: string | null; endTime: string | null; scheduleCode: string | null; status: AttendanceStatus | "Có mặt" | "Đi muộn" | "Vắng có phép" | "Vắng không phép" | "Chưa điểm danh"; reason: string | null }
interface AttendanceSummary { classId: number; classCode: string; className: string; programId: number | null; present: number; late: number; excusedAbsences: number; unexcusedAbsences: number; unmarked: number; totalMarked: number; totalSessions: number; absencePercent: number; attendancePercent: number; threshold: number; thresholdReached: boolean; remainingAbsences: number | null; nearThreshold: boolean }
interface Threshold { programId: number; programCode: string; programName: string; percentage: number }
interface AttendanceNotice { id: number; type: string; title: string; message: string; at: string; read: boolean }
interface ClassAttendanceManagementProps { initialTab?: Tab }

const statusLabels: Record<AttendanceStatus, string> = {
  present: "Có mặt", late: "Đi muộn", excused_absence: "Vắng có phép",
  unexcused_absence: "Vắng không phép", unmarked: "Chưa điểm danh",
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
    const response = (error as {
      response?: { status?: number; data?: { detail?: string } };
    }).response;
    const detail = response?.data?.detail;
    if (detail && /[À-ỹ]/.test(detail)) return detail;
    if (response?.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (response?.status === 403) return "Bạn không có quyền thực hiện thao tác này.";
    if (response?.status === 404) return "Không tìm thấy dữ liệu yêu cầu.";
    if (response?.status && response.status >= 500) {
      return "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.";
    }
    return "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
  }
  return "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
};
const noticeTitle = (item: AttendanceNotice) => {
  if (item.type === "absence_request_approved") return "Đơn xin vắng đã được duyệt";
  if (item.type === "absence_request_rejected") return "Đơn xin vắng đã bị từ chối";
  return item.title;
};
const noticeMessage = (item: AttendanceNotice) => {
  if (item.type === "absence_request_approved" || item.type === "absence_request_rejected") {
    const match = /Your request for ([\d-]+) was (approved|rejected)\.\s*(.*)/i.exec(item.message);
    if (match) {
      const decision = match[2].toLowerCase() === "approved" ? "đã được duyệt" : "đã bị từ chối";
      return `Đơn xin vắng ngày ${match[1]} ${decision}.${match[3] ? ` ${match[3]}` : ""}`;
    }
  }
  return item.message;
};

export default function ClassAttendanceManagement({
  initialTab,
}: ClassAttendanceManagementProps = {}) {
  const studentMode = useMemo(() => getStudentMode(), []);
  const managerMode = useMemo(() => getManagerMode(), []);
  const [tab, setTab] = useState<Tab>(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    const studentTabs: Tab[] = ["history", "sessions", "notifications", "requests", "request-tracking"];
    if (studentMode && studentTabs.includes(requestedTab as Tab)) return requestedTab as Tab;
    return studentMode ? initialTab ?? "history" : "attendance";
  });
  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [classId, setClassId] = useState(0);
  const [day, setDay] = useState(today());
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [draft, setDraft] = useState<Record<number, AttendanceStatus>>({});
  const [requests, setRequests] = useState<AbsenceRequest[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState<AttendanceSummary[]>([]);
  const [historyClassId, setHistoryClassId] = useState("");
  const [warning, setWarning] = useState<{ message: string; absencePercent: number; threshold: number } | null>(null);
  const [notifications, setNotifications] = useState<AttendanceNotice[]>([]);
  const [sessionNotifications, setSessionNotifications] = useState<AttendanceNotice[]>([]);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [sort, setSort] = useState("name");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const loadClasses = useCallback(async () => {
    try {
      const response = await api.get<AttendanceClass[]>("/attendance/classes");
      setClasses(response.data);
      const requestedClassId = Number(
        new URLSearchParams(window.location.search).get("classId"),
      );
      if (requestedClassId) {
        if (response.data.some((item) => item.classId === requestedClassId)) {
          setClassId(requestedClassId);
        } else {
          setClassId(0);
          setError("Lớp này không có trong danh sách lớp bạn được phép điểm danh.");
        }
      } else {
        setClassId((previous) => previous || response.data[0]?.classId || 0);
      }
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
    try {
      const endpoint = studentMode
        ? "/attendance/sessions/absence-requests"
        : "/attendance/absence-requests";
      const response = await api.get<AbsenceRequest[]>(endpoint);
      setRequests(response.data);
    }
    catch (loadError) { setError(messageOf(loadError)); }
  }, [studentMode]);

  const loadSessionNotifications = useCallback(async () => {
    try {
      const response = await api.get<AttendanceNotice[]>("/attendance/sessions/notifications");
      setSessionNotifications(response.data);
    } catch (loadError) { setError(messageOf(loadError)); }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.get<{ records: HistoryRecord[]; requests: AbsenceRequest[]; warning: typeof warning; attendanceSummaries: AttendanceSummary[]; notifications: AttendanceNotice[] }>("/attendance/my-history");
      setHistory(response.data.records); setWarning(response.data.warning);
      setAttendanceSummaries(response.data.attendanceSummaries ?? []);
      setNotifications(response.data.notifications || []);
    } catch (loadError) { setError(messageOf(loadError)); }
  }, []);

  const loadThresholds = useCallback(async () => {
    try { const response = await api.get<Threshold[]>("/attendance/thresholds"); setThresholds(response.data); }
    catch (loadError) { setError(messageOf(loadError)); }
  }, []);

  useEffect(() => { void loadClasses(); }, [loadClasses]);
  useEffect(() => { if (tab === "attendance") { void loadMatrix(); if (!studentMode) void loadNotifications(); } }, [tab, loadMatrix, loadNotifications, studentMode]);
  useEffect(() => {
    if ((tab === "requests" && !studentMode) || tab === "request-tracking") void loadRequests();
    if (tab === "history") void loadHistory();
    if (tab === "notifications") {
      if (studentMode) {
        void loadSessionNotifications();
        void loadNotifications();
      }
      else void loadNotifications();
    }
    if (tab === "thresholds") void loadThresholds();
  }, [tab, studentMode, loadHistory, loadNotifications, loadRequests, loadSessionNotifications, loadThresholds]);

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
  const visibleHistory = useMemo(
    () => history.filter(
      (record) => !historyClassId || String(record.classId) === historyClassId,
    ),
    [history, historyClassId],
  );

  const saveRecords = async (records: Array<{ studentId: number; status: string }>) => {
    if (!matrix) return;
    setError(""); setNotice(""); setLoading(true);
    try {
      await api.post(`/attendance/classes/${classId}/records`, { date: day, records });
      setNotice("Đã lưu điểm danh. Mọi thay đổi đều được ghi vào lịch sử.");
      await loadMatrix();
    } catch (saveError) { setError(messageOf(saveError)); }
    finally { setLoading(false); }
  };

  const reviewRequest = async (requestId: number, decision: "approved" | "rejected") => {
    const reason = window.prompt(decision === "approved" ? "Lý do duyệt đơn:" : "Lý do từ chối đơn:", "");
    if (reason === null || !reason.trim()) return;
    try {
      await api.post(`/attendance/absence-requests/${requestId}/decision`, { decision, reason: reason.trim() });
      setNotice(decision === "approved" ? "Đã duyệt đơn và gửi thông báo cho học viên." : "Đã từ chối đơn và gửi thông báo cho học viên.");
      await loadRequests();
    } catch (reviewError) { setError(messageOf(reviewError)); }
  };

  const exportExcel = async () => {
    try {
      const response = await api.get(`/attendance/classes/${classId}/export`, { params: { date: day }, responseType: "blob" });
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl; link.download = `${matrix?.classCode || "lop-hoc"}-${day}.xlsx`; link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (exportError) { setError(messageOf(exportError)); }
  };

  const saveThreshold = async (programId: number, percentage: number) => {
    try {
      await api.put(`/attendance/thresholds/${programId}`, { percentage });
      setNotice("Đã cập nhật ngưỡng vắng của chương trình."); await loadThresholds();
    } catch (thresholdError) { setError(messageOf(thresholdError)); }
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    ...(!studentMode ? [{ id: "attendance" as const, label: "Điểm danh lớp" }] : []),
    ...(studentMode
      ? [
          { id: "history" as const, label: "Lịch sử điểm danh" },
          { id: "sessions" as const, label: "Danh sách buổi học" },
          { id: "notifications" as const, label: "Thông báo" },
          { id: "requests" as const, label: "Gửi đơn xin vắng" },
          { id: "request-tracking" as const, label: "Theo dõi đơn xin phép" },
        ]
      : [{ id: "requests" as const, label: "Đơn xin vắng của lớp" }]),
    ...(managerMode ? [{ id: "thresholds" as const, label: "Ngưỡng vắng" }] : []),
  ];
  const selectTab = (nextTab: Tab) => {
    setTab(nextTab);
    setError("");
    if (studentMode) {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      window.history.replaceState({}, "", url);
    }
  };

  return (
    <main className="attendance-page">
      <header className="attendance-hero">
        <div><span className="attendance-kicker">QUẢN LÝ ĐÀO TẠO</span><h1>{studentMode ? "Điểm danh của tôi" : "Quản lý điểm danh"}</h1>
          <p>{studentMode ? "Theo dõi lịch sử điểm danh và gửi đơn xin vắng kèm lý do hoặc minh chứng." : "Ghi nhận điểm danh, duyệt đơn xin vắng và theo dõi học viên cần hỗ trợ."}</p></div>
        <div className="attendance-page-actions">
          <button
            className="attendance-button attendance-light"
            onClick={() => window.location.assign("/quan-ly-diem-danh")}
          >
            Điểm danh theo buổi
          </button>
          {!studentMode && matrix && <button className="attendance-button attendance-light" onClick={() => void exportExcel()}>Xuất Excel</button>}
        </div>
      </header>
      <nav className="attendance-tabs" aria-label="Các mục điểm danh">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => selectTab(item.id)}>{item.label}</button>)}</nav>
      {error && <div className="attendance-alert error" role="alert">{error}</div>}
      {notice && (
        <ToastNotification
          type="success"
          text={notice}
          onClose={() => setNotice("")}
        />
      )}

      {tab === "attendance" && !studentMode && <section className="attendance-panel">
        <div className="attendance-controls">
          <label>Lớp<SearchableSelect value={classId || ""} onChange={(event) => setClassId(Number(event.target.value))}><option value="">Chọn lớp</option>{classes.map((item) => <option key={item.classId} value={item.classId}>{item.classCode} · {item.className}</option>)}</SearchableSelect></label>
          <label>Ngày điểm danh<input type="date" value={day} max={today()} onChange={(event) => setDay(event.target.value)} /></label>
          <label>Sắp xếp theo<SearchableSelect value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Tên học viên</option><option value="status">Trạng thái điểm danh</option><option value="absent">Học viên vắng trước</option></SearchableSelect></label>
        </div>
        {matrix && <>
          <div className="attendance-summary">
            <div><span>Học viên</span><strong>{matrix.counts.total}</strong></div><div><span>Có mặt</span><strong>{matrix.counts.present}</strong></div>
            <div><span>Đi muộn</span><strong>{matrix.counts.late}</strong></div><div><span>Vắng có phép</span><strong>{matrix.counts.excused}</strong></div>
            <div><span>Vắng không phép</span><strong>{matrix.counts.unexcused}</strong></div><div><span>Chưa điểm danh</span><strong>{matrix.counts.unmarked}</strong></div>
            <div><span>Tỷ lệ tham gia</span><strong>{matrix.attendancePercent}%</strong></div>
            <div><span>Học viên chạm ngưỡng</span><strong>{matrix.flaggedStudents.length} · {matrix.absenceThreshold}%</strong></div>
          </div>
          {matrix.aboveThreshold && <div className="attendance-alert warning">Đã có học viên chạm ngưỡng vắng: {matrix.flaggedStudents.map((student) => `${student.studentName} (${student.absencePercent}%)`).join(", ")}.</div>}
          {!studentMode && notifications.filter((item) => item.type === "absence_threshold").map((item) => <div className="attendance-alert warning" key={item.id}><strong>{noticeTitle(item)}:</strong> {noticeMessage(item)}</div>)}
          <div className="attendance-toolbar"><span>{matrix.classCode} · {matrix.date}</span><div><button className="attendance-button secondary" disabled={loading || !matrix.students.length} onClick={async () => { try { await api.post(`/attendance/classes/${classId}/mark-all-present`, null, { params: { date: day } }); setNotice("Đã điểm danh có mặt cho toàn bộ học viên."); await loadMatrix(); } catch (markError) { setError(messageOf(markError)); } }}>Điểm danh cả lớp</button>
            <button className="attendance-button primary" disabled={loading} onClick={() => void saveRecords(matrix.students.map((student) => ({ studentId: student.studentId, status: draft[student.studentId] || student.status })).filter((row) => row.status !== "unmarked"))}>Lưu điểm danh</button></div></div>
          <div className="attendance-students">{sortedStudents.map((student) => <article className="attendance-student" key={student.studentId}>
            <div className="student-name"><strong>{student.studentName}</strong><span>{student.email}</span>
              {student.aboveThreshold && <span className="attendance-alert warning">Vắng {student.unexcusedAbsences}/{student.totalMarked} buổi · {student.absencePercent}% / {student.absenceThreshold}%</span>}
            </div>
            <label>Trạng thái<SearchableSelect value={draft[student.studentId] || student.status} onChange={(event) => setDraft((previous) => ({ ...previous, [student.studentId]: event.target.value as AttendanceStatus }))}>
              <option value="unmarked">Chưa điểm danh</option><option value="present">Có mặt</option><option value="late">Đi muộn</option><option value="excused_absence">Vắng có phép</option><option value="unexcused_absence">Vắng không phép</option>
            </SearchableSelect></label>{student.requestId && <span className="request-pending">Đang chờ duyệt đơn xin vắng</span>}
            <span className={`status-pill state-${draft[student.studentId] || student.status}`}>{statusLabels[draft[student.studentId] || student.status]}</span>
          </article>)}</div>
          <button className="attendance-link" onClick={async () => {
            try { const response = await api.get(`/attendance/classes/${classId}/audit`, { params: { date: day } });
              const lines = response.data.map((entry: { at: string; action: string; old: string; new: string; reason: string }) => `${entry.at} · ${entry.action} · ${entry.old || "—"} → ${entry.new} · ${entry.reason || "Không có lý do"}`);
              window.alert(lines.join("\n") || "Ngày này chưa có lịch sử chỉnh sửa.");
            } catch (auditError) { setError(messageOf(auditError)); }
          }}>Xem lịch sử chỉnh sửa</button>
        </>}
        {!matrix && !loading && !classes.length && <p>Hiện không có lớp học để điểm danh.</p>}
      </section>}

      {tab === "requests" && studentMode && <section className="attendance-panel">
        <AbsenceRequest embedded />
      </section>}
      {tab === "requests" && !studentMode && <section className="attendance-panel">
        <><div className="attendance-section-heading"><h2>Đơn xin vắng của các lớp</h2><button className="attendance-button secondary" onClick={() => void loadRequests()}>Làm mới</button></div>
          {!requests.length && <p>Không có đơn xin vắng cần xử lý.</p>}{requests.map((request) => <article className="request-card" key={request.requestId}>
            <div><strong>{request.studentName}</strong><span>{request.classCode} · {request.date}</span><p>{request.reason}</p>{request.evidence && <a href={request.evidence} target="_blank" rel="noreferrer">Xem minh chứng</a>}{request.reviewReason && <small>Ghi chú xử lý: {request.reviewReason}</small>}</div>
            <div className="request-actions"><span className={`request-status ${request.status}`}>{request.status === "pending" ? "Đang chờ" : request.status === "approved" ? "Đã duyệt" : "Đã từ chối"}</span>{request.status === "pending" && <><button className="attendance-button primary" onClick={() => void reviewRequest(request.requestId, "approved")}>Duyệt</button><button className="attendance-button danger" onClick={() => void reviewRequest(request.requestId, "rejected")}>Từ chối</button></>}</div>
          </article>)}</>
      </section>}

      {tab === "history" && studentMode && <section className="attendance-panel">
        <div className="attendance-section-heading">
          <div><h2>Lịch sử điểm danh</h2><p className="helper-text">Theo dõi trạng thái từng buổi và số buổi vắng còn lại trước ngưỡng cảnh báo.</p></div>
          <label className="history-class-filter">Lớp
            <SearchableSelect value={historyClassId} onChange={(event) => setHistoryClassId(event.target.value)}>
              <option value="">Tất cả lớp</option>
              {attendanceSummaries.map((item) => <option key={item.classId} value={item.classId}>{item.classCode} · {item.className}</option>)}
            </SearchableSelect>
          </label>
        </div>
        {warning && <div className="attendance-alert warning">{warning.message} Vui lòng liên hệ giảng viên hoặc quản lý đào tạo nếu cần kiểm tra lại.</div>}
        {!!attendanceSummaries.length && <div className="student-attendance-summaries">
          {attendanceSummaries
            .filter((item) => !historyClassId || String(item.classId) === historyClassId)
            .map((item) => <article className={`student-attendance-summary${item.thresholdReached ? " reached" : item.nearThreshold ? " near" : ""}`} key={item.classId}>
              <div className="student-attendance-summary-heading"><strong>{item.classCode} · {item.className}</strong>
                {(item.thresholdReached || item.nearThreshold) && <span className={`student-attendance-warning-tag${item.thresholdReached ? " reached" : ""}`}>{item.thresholdReached ? "Đã chạm ngưỡng" : "Sắp chạm ngưỡng"}</span>}
              </div>
              <div className="student-attendance-summary-stats">
                <span><small>Tỷ lệ chuyên cần</small><strong>{item.attendancePercent}%</strong></span>
                <span><small>Vắng không phép</small><strong>{item.unexcusedAbsences}/{item.totalMarked} buổi ({item.absencePercent}%)</strong></span>
                <span><small>Ngưỡng cảnh báo</small><strong>{item.threshold}%</strong></span>
                <span><small>Còn có thể vắng không phép</small><strong>{item.remainingAbsences === null ? "Không chạm ngưỡng khi còn buổi tham gia" : `${item.remainingAbsences} buổi`}</strong></span>
              </div>
              {item.thresholdReached && <p className="student-attendance-summary-message">Tỷ lệ vắng đã đạt hoặc vượt ngưỡng. Hãy liên hệ giảng viên để được hỗ trợ.</p>}
              {item.nearThreshold && <p className="student-attendance-summary-message">
                {item.remainingAbsences === 0
                  ? "Thêm một buổi vắng không phép nữa là có thể chạm ngưỡng cảnh báo."
                  : `Bạn còn ${item.remainingAbsences} buổi vắng không phép trước khi chạm ngưỡng cảnh báo.`}
              </p>}
            </article>)}
        </div>}
      </section>}
      {tab === "sessions" && studentMode && <section className="attendance-panel">
        <div className="attendance-section-heading">
          <div><h2>Danh sách buổi học</h2><p className="helper-text">Các buổi học và trạng thái điểm danh của bạn.</p></div>
          <label className="history-class-filter">Lớp
            <SearchableSelect value={historyClassId} onChange={(event) => setHistoryClassId(event.target.value)}>
              <option value="">Tất cả lớp</option>
              {attendanceSummaries.map((item) => <option key={item.classId} value={item.classId}>{item.classCode} · {item.className}</option>)}
            </SearchableSelect>
          </label>
        </div>
        {!visibleHistory.length && <p>Chưa có dữ liệu điểm danh cho lớp này.</p>}
        {visibleHistory.map((record, index) => {
          const stateClass = record.status === "Có mặt" || record.status === "present" ? "present"
            : record.status === "Đi muộn" || record.status === "late" ? "late"
              : record.status === "Vắng có phép" || record.status === "excused_absence" ? "excused_absence"
                : record.status === "Vắng không phép" || record.status === "unexcused_absence" ? "unexcused_absence"
                  : "unmarked";
          const stateLabel = record.status in statusLabels
            ? statusLabels[record.status as AttendanceStatus]
            : record.status;
          return <article className="history-row student-attendance-history-row" key={`${record.classId}-${record.date}-${record.scheduleCode ?? "daily"}-${index}`}>
            <div><strong>{record.classCode} · {record.className}</strong><span>{record.scheduleCode ? `${record.scheduleCode} · ` : ""}{record.date}{record.startTime ? ` · ${record.startTime}${record.endTime ? `–${record.endTime}` : ""}` : ""}</span>{record.reason && <small>Ghi chú: {record.reason}</small>}</div>
            <span className={`status-pill state-${stateClass}`}>{stateLabel}</span>
          </article>;
        })}
      </section>}
      {tab === "notifications" && studentMode && <section className="attendance-panel">
        <div className="attendance-section-heading"><div><h2>Thông báo</h2><p className="helper-text">Cập nhật kết quả đơn xin phép và tình hình chuyên cần.</p></div><button className="attendance-button secondary" onClick={() => { void loadSessionNotifications(); void loadNotifications(); }}>Làm mới</button></div>
        {[...sessionNotifications, ...notifications]
          .sort((left, right) => right.at.localeCompare(left.at))
          .map((item, index) => <article className="history-row" key={`${item.id}-${index}`}><div><strong>{noticeTitle(item)}</strong><span>{noticeMessage(item)}</span><small>{new Date(item.at).toLocaleString("vi-VN")}</small></div></article>)}
        {!sessionNotifications.length && !notifications.length && <p>Hiện chưa có thông báo.</p>}
      </section>}
      {tab === "request-tracking" && studentMode && <section className="attendance-panel">
        <div className="attendance-section-heading"><div><h2>Theo dõi đơn xin phép</h2><p className="helper-text">Xem trạng thái xử lý và phản hồi của giảng viên.</p></div><button className="attendance-button secondary" onClick={() => void loadRequests()}>Làm mới</button></div>
        {!requests.length && <p>Bạn chưa gửi đơn xin phép nào.</p>}
        {requests.map((request) => <article className="history-row" key={request.requestId}>
          <div><strong>{request.classCode} · {request.date}</strong><span>{request.reason}</span>{request.evidence && <a href={request.evidence} target="_blank" rel="noreferrer">Xem minh chứng</a>}{request.reviewReason && <small>Phản hồi của giảng viên: {request.reviewReason}</small>}</div>
          <span className={`request-status ${request.status}`}>{request.status === "pending" ? "Đang chờ duyệt" : request.status === "approved" ? "Đã duyệt" : "Đã từ chối"}</span>
        </article>)}
      </section>}

      {tab === "thresholds" && !studentMode && <section className="attendance-panel"><h2>Ngưỡng vắng của chương trình</h2><p>Ngưỡng mặc định là 20% và chỉ tính số buổi vắng không phép.</p>
        {!thresholds.length && <p>Hiện chưa có chương trình đào tạo.</p>}{thresholds.map((threshold) => <ThresholdRow key={threshold.programId} threshold={threshold} onSave={saveThreshold} />)}
      </section>}
    </main>
  );
}

function ThresholdRow({ threshold, onSave }: { threshold: Threshold; onSave: (programId: number, percentage: number) => Promise<void> }) {
  const [value, setValue] = useState<number | null>(null);
  return <form className="threshold-row" onSubmit={(event) => { event.preventDefault(); void onSave(threshold.programId, value ?? threshold.percentage).then(() => setValue(null)); }}>
    <div><strong>{threshold.programCode} · {threshold.programName}</strong><span>Ngưỡng áp dụng riêng cho chương trình</span></div>
    <label><span className="sr-only">Tỷ lệ vắng tối đa</span><input type="number" min="0" max="100" value={value ?? threshold.percentage} onChange={(event) => setValue(Number(event.target.value))} /><span>%</span></label>
    <button className="attendance-button primary" type="submit">Lưu</button>
  </form>;
}
