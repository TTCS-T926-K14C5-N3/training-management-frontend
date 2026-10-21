import React from "react";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import api from "../services/api";
import "./Assignments.css";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

type Attachment = { attachmentId: number; tenTep: string; kichThuoc: number; url: string };
type Submission = {
  submissionId: number;
  version: number;
  repositoryUrl: string;
  submittedAt: string;
  status: string;
  late: boolean;
  grade: number | null;
  feedback: string | null;
  attachments: Attachment[];
};
type Assignment = {
  assignmentId: number;
  lopHocId: number;
  tenLop: string;
  monHocId: number;
  tenMonHoc: string;
  lichHocId: number;
  ngayHoc: string | null;
  tieuDe: string;
  moTa: string;
  hanNop: string;
  diemToiDa: number;
  choNopMuon: boolean;
  trangThai: string;
  attachments: Attachment[];
  submission?: Submission | null;
  canResubmit?: boolean;
};
type LessonOption = { lichHocId: number; label: string };
type SubjectOption = { monHocId: number; tenMonHoc: string; lessons: LessonOption[] };
type ClassOption = { lopHocId: number; tenLop: string; subjects: SubjectOption[] };
type RosterRow = { studentId: number; studentName: string; email: string; status: string; submission: Submission | null };
type Roster = {
  assignmentId: number;
  totalStudents: number;
  submittedCount: number;
  gradedCount: number;
  lateCount: number;
  missingCount: number;
  progressPercent: number;
  students: RosterRow[];
};
type AssignmentNotice = {
  id: number;
  assignmentId: number;
  type: string;
  title: string;
  message: string;
  at: string;
};

const errorText = (error: unknown): string => {
  if (axios.isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg).join(" · ");
  }
  return error instanceof Error ? error.message : "Đã xảy ra lỗi. Vui lòng thử lại.";
};

const formatDate = (value: string) => new Date(value).toLocaleString("vi-VN");
const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const Assignments: React.FC<{ studentOnly?: boolean; canSubmit?: boolean }> = ({
  studentOnly = false,
  canSubmit = false,
}) => {
  const [tab, setTab] = useState<"teacher" | "student">(studentOnly ? "student" : "teacher");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [form, setForm] = useState({ title: "", description: "", deadline: "", points: "100", allowLate: false, lessonId: "" });
  const [assignmentFiles, setAssignmentFiles] = useState<File[]>([]);
  const [submissionFiles, setSubmissionFiles] = useState<Record<number, File[]>>({});
  const [repositoryUrls, setRepositoryUrls] = useState<Record<number, string>>({});
  const [roster, setRoster] = useState<Roster | null>(null);
  const [rosterFilter, setRosterFilter] = useState("all");
  const [activeAssignment, setActiveAssignment] = useState<number | null>(null);
  const [assignmentClassFilter, setAssignmentClassFilter] = useState("");
  const [assignmentSubjectFilter, setAssignmentSubjectFilter] = useState("");
  const [notifications, setNotifications] = useState<AssignmentNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTeacher = useCallback(async () => {
    try {
      const [assignmentResponse, optionsResponse, notificationResponse] = await Promise.all([
        api.get<Assignment[]>("/assignments/teacher"),
        api.get<ClassOption[]>("/assignments/options"),
        api.get<AssignmentNotice[]>("/assignments/notifications"),
      ]);
      setAssignments(assignmentResponse.data);
      setClassOptions(optionsResponse.data);
      setNotifications(notificationResponse.data);
      setError("");
    } catch (requestError: unknown) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStudent = useCallback(async () => {
    try {
      const [response, notificationResponse] = await Promise.all([
        api.get<Assignment[]>("/assignments/mine"),
        api.get<AssignmentNotice[]>("/assignments/notifications"),
      ]);
      setAssignments(response.data);
      setNotifications(notificationResponse.data);
      setError("");
    } catch (requestError: unknown) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === "teacher") void loadTeacher();
      else void loadStudent();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, loadTeacher, loadStudent]);

  const currentClass = classOptions.find((item) => String(item.lopHocId) === selectedClass);
  const currentSubject = currentClass?.subjects.find((item) => String(item.monHocId) === selectedSubject);
  const filteredAssignments = assignments.filter((item) =>
    (!assignmentClassFilter || String(item.lopHocId) === assignmentClassFilter) &&
    (!assignmentSubjectFilter || String(item.monHocId) === assignmentSubjectFilter),
  );
  const availableFilterSubjects = Array.from(
    new Map(
      classOptions
        .filter((item) => !assignmentClassFilter || String(item.lopHocId) === assignmentClassFilter)
        .flatMap((item) => item.subjects.map((subject) => [subject.monHocId, subject] as const)),
    ).values(),
  );

  const validateFiles = (files: File[]) => {
    const tooLarge = files.find((item) => item.size > MAX_FILE_BYTES);
    if (tooLarge) {
      setError(`Tệp “${tooLarge.name}” vượt quá giới hạn 20 MB.`);
      return false;
    }
    setError("");
    return true;
  };

  const createDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentClass || !currentSubject || !form.lessonId) {
      setError("Vui lòng chọn lớp, môn học và buổi học.");
      return;
    }
    if (!validateFiles(assignmentFiles)) return;
    setSaving(true);
    setError("");
    try {
      const data = new FormData();
      data.append("assignment_json", JSON.stringify({
        lopHocId: currentClass.lopHocId,
        monHocId: currentSubject.monHocId,
        lichHocId: Number(form.lessonId),
        tieuDe: form.title,
        moTa: form.description,
        hanNop: new Date(form.deadline).toISOString(),
        diemToiDa: Number(form.points),
        choNopMuon: form.allowLate,
      }));
      assignmentFiles.forEach((file) => data.append("files", file));
      await api.post<Assignment>("/assignments", data);
      setForm({ title: "", description: "", deadline: "", points: "100", allowLate: false, lessonId: "" });
      setAssignmentFiles([]);
      setNotice("Đã lưu bản nháp bài tập.");
      await loadTeacher();
    } catch (requestError: unknown) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const publish = async (assignmentId: number) => {
    setSaving(true);
    setError("");
    try {
      await api.post(`/assignments/${assignmentId}/publish`);
      setNotice("Bài tập đã được phát hành cho học viên.");
      await loadTeacher();
    } catch (requestError: unknown) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const loadRoster = async (assignmentId: number, filter = rosterFilter) => {
    setActiveAssignment(assignmentId);
    setSaving(true);
    try {
      const response = await api.get<Roster>(`/assignments/${assignmentId}/roster`, { params: { status: filter } });
      setRoster(response.data);
      setError("");
    } catch (requestError: unknown) {
      setError(errorText(requestError));
      setRoster(null);
    } finally {
      setSaving(false);
    }
  };

  const submitWork = async (assignmentId: number) => {
    const files = submissionFiles[assignmentId] ?? [];
    const repositoryUrl = repositoryUrls[assignmentId]?.trim() ?? "";
    if (!repositoryUrl) {
      setError("Vui lòng nhập đường dẫn repository HTTPS.");
      return;
    }
    if (!validateFiles(files)) return;
    setSaving(true);
    setError("");
    try {
      const data = new FormData();
      data.append("repository_url", repositoryUrl);
      files.forEach((file) => data.append("files", file));
      await api.post(`/assignments/${assignmentId}/submissions`, data);
      setNotice("Đã nộp phiên bản mới.");
      setSubmissionFiles((current) => ({ ...current, [assignmentId]: [] }));
      await loadStudent();
    } catch (requestError: unknown) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const gradeSubmission = async (submissionId: number, assignmentId: number, studentName: string, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const points = Number(values.get("points"));
    const feedback = String(values.get("feedback") ?? "");
    setSaving(true);
    try {
      await api.post(`/assignments/submissions/${submissionId}/grade`, new URLSearchParams({
        payload_json: JSON.stringify({ diem: points, nhanXet: feedback || null }),
      }));
      setNotice(`Đã lưu điểm cho ${studentName}.`);
      await loadRoster(assignmentId);
    } catch (requestError: unknown) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const reopen = async (assignmentId: number, studentId: number) => {
    const reason = window.prompt("Lý do mở lại bài nộp:")?.trim();
    if (!reason) return;
    setSaving(true);
    try {
      await api.post(`/assignments/${assignmentId}/students/${studentId}/reopen`, { lyDo: reason });
      setNotice("Đã mở lại bài để học viên nộp phiên bản mới.");
      await loadRoster(assignmentId);
    } catch (requestError: unknown) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await api.get(attachment.url, { responseType: "blob" });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.tenTep;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError: unknown) {
      setError(errorText(requestError));
    }
  };

  return (
    <main className="assignments-page">
      <header className="assignments-header">
        <div><p className="assignments-eyebrow">HỌC TẬP</p><h1>Bài tập</h1><p>Giao bài, nộp bài và theo dõi tiến độ lớp học.</p></div>
        <div className="assignments-tabs" role="tablist" aria-label="Chế độ bài tập">
          {!studentOnly && <button type="button" className={tab === "teacher" ? "active" : ""} onClick={() => { setTab("teacher"); setLoading(true); setRoster(null); }}>Giảng viên</button>}
          {(studentOnly || canSubmit) && <button type="button" className={tab === "student" ? "active" : ""} onClick={() => { setTab("student"); setLoading(true); setRoster(null); }}>Học viên</button>}
        </div>
      </header>
      {error && <div className="assignment-alert error" role="alert">{error}</div>}
      {notice && <div className="assignment-alert success" role="status">{notice}<button type="button" aria-label="Đóng thông báo" onClick={() => setNotice("")}>×</button></div>}
      {!!notifications.length && (
        <section className="assignment-panel" aria-label="Thông báo bài tập">
          <h2>Thông báo</h2>
          <ul>
            {notifications.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> — {item.message}{" "}
                <small>{formatDate(item.at)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
      {loading ? <p className="assignment-loading">Đang tải bài tập…</p> : tab === "teacher" ? <>
        <section className="assignment-panel">
          <h2>Tạo bản nháp</h2>
          <form className="assignment-form" onSubmit={(event) => void createDraft(event)}>
            <label>Lớp<select required value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setSelectedSubject(""); setForm((value) => ({ ...value, lessonId: "" })); }}><option value="">Chọn lớp</option>{classOptions.map((item) => <option key={item.lopHocId} value={item.lopHocId}>{item.tenLop}</option>)}</select></label>
            <label>Môn học<select required value={selectedSubject} onChange={(event) => { setSelectedSubject(event.target.value); setForm((value) => ({ ...value, lessonId: "" })); }}><option value="">Chọn môn</option>{currentClass?.subjects.map((item) => <option key={item.monHocId} value={item.monHocId}>{item.tenMonHoc}</option>)}</select></label>
            <label>Buổi học<select required value={form.lessonId} onChange={(event) => setForm((value) => ({ ...value, lessonId: event.target.value }))}><option value="">Chọn buổi học</option>{currentSubject?.lessons.map((item) => <option key={item.lichHocId} value={item.lichHocId}>{item.label}</option>)}</select></label>
            <label>Tiêu đề<input required maxLength={200} value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} /></label>
            <label>Hạn nộp<input required type="datetime-local" value={form.deadline} onChange={(event) => setForm((value) => ({ ...value, deadline: event.target.value }))} /></label>
            <label>Điểm tối đa<input required type="number" min="0.01" max="99999.99" step="0.01" value={form.points} onChange={(event) => setForm((value) => ({ ...value, points: event.target.value }))} /></label>
            <label className="assignment-wide">Mô tả<textarea required rows={4} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></label>
            <label className="assignment-wide">Tệp đính kèm (tối đa 20 MB/tệp)<input type="file" multiple onChange={(event) => setAssignmentFiles(Array.from(event.target.files ?? []))} /></label>
            <label className="assignment-checkbox"><input type="checkbox" checked={form.allowLate} onChange={(event) => setForm((value) => ({ ...value, allowLate: event.target.checked }))} /> Cho phép nộp muộn</label>
            <button className="assignment-primary" type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Lưu bản nháp"}</button>
          </form>
        </section>
        <section className="assignment-list-section"><h2>Bài tập phụ trách</h2>
          <div className="assignment-filters">
            <label>Lớp<select value={assignmentClassFilter} onChange={(event) => { setAssignmentClassFilter(event.target.value); setAssignmentSubjectFilter(""); }}><option value="">Tất cả lớp</option>{classOptions.map((item) => <option key={item.lopHocId} value={item.lopHocId}>{item.tenLop}</option>)}</select></label>
            <label>Môn học<select value={assignmentSubjectFilter} onChange={(event) => setAssignmentSubjectFilter(event.target.value)}><option value="">Tất cả môn</option>{availableFilterSubjects.map((item) => <option key={`${item.monHocId}-${item.tenMonHoc}`} value={item.monHocId}>{item.tenMonHoc}</option>)}</select></label>
          </div>
          {filteredAssignments.length === 0 ? <p className="assignment-empty">Không có bài tập phù hợp với bộ lọc.</p> : filteredAssignments.map((item) => <article className="assignment-card" key={item.assignmentId}>
            <div className="assignment-card-top"><div><span className={`assignment-status ${item.trangThai.toLowerCase()}`}>{item.trangThai === "Draft" ? "Bản nháp" : "Đã phát hành"}</span><h3>{item.tieuDe}</h3><p>{item.tenLop} · {item.tenMonHoc}</p></div><strong>{item.diemToiDa} điểm</strong></div>
            <p className="assignment-description">{item.moTa}</p><p className="assignment-meta">Hạn nộp: {formatDate(item.hanNop)} · {item.choNopMuon ? "Cho phép nộp muộn" : "Không nhận bài muộn"}</p>
            <div className="assignment-attachments">{item.attachments.map((attachment) => <button type="button" key={attachment.attachmentId} onClick={() => void downloadAttachment(attachment)}>↓ {attachment.tenTep} ({formatSize(attachment.kichThuoc)})</button>)}</div>
            <div className="assignment-actions">{item.trangThai === "Draft" && <button type="button" className="assignment-primary" disabled={saving} onClick={() => void publish(item.assignmentId)}>Phát hành</button>}{item.trangThai === "Published" && <button type="button" onClick={() => void loadRoster(item.assignmentId)}>Danh sách nộp bài</button>}</div>
          </article>)}
        </section>
        {roster && activeAssignment !== null && <section className="assignment-panel roster-panel"><div className="roster-heading"><div><h2>Danh sách học viên</h2><p>{roster.submittedCount}/{roster.totalStudents} đã nộp · {roster.gradedCount} đã chấm · {roster.lateCount} muộn · {roster.missingCount} chưa nộp</p></div><label>Lọc<select value={rosterFilter} onChange={(event) => { setRosterFilter(event.target.value); void loadRoster(activeAssignment, event.target.value); }}><option value="all">Tất cả</option><option value="missing">Chưa nộp</option><option value="submitted">Đã nộp</option><option value="ungraded">Chưa chấm</option><option value="late">Nộp muộn</option><option value="graded">Đã chấm</option></select></label></div>
          <div className="progress-track"><span style={{ width: `${roster.progressPercent}%` }} /></div><small>Tiến độ chấm {roster.progressPercent}%</small>
          <div className="roster-list">{roster.students.map((student) => <article className="roster-row" key={student.studentId}><div className="roster-student"><strong>{student.studentName}</strong><small>{student.email}</small><span className={`assignment-status ${student.status}`}>{student.status === "missing" ? "Chưa nộp" : student.status === "graded" ? "Đã chấm" : student.status === "late" ? "Nộp muộn" : "Đã nộp"}</span></div>
            {student.submission ? <div className="roster-submission"><a href={student.submission.repositoryUrl} target="_blank" rel="noreferrer">Repository · phiên bản {student.submission.version}</a><small>Nộp lúc {formatDate(student.submission.submittedAt)}{student.submission.grade !== null ? ` · ${student.submission.grade} điểm` : ""}</small><div className="assignment-attachments">{student.submission.attachments.map((attachment) => <button type="button" key={attachment.attachmentId} onClick={() => void downloadAttachment(attachment)}>↓ {attachment.tenTep}</button>)}</div>
              {student.submission.grade === null ? <form className="grade-form" onSubmit={(event) => void gradeSubmission(student.submission!.submissionId, activeAssignment, student.studentName, event)}><input name="points" type="number" min="0" max={assignments.find((item) => item.assignmentId === activeAssignment)?.diemToiDa ?? 100} step="0.01" required placeholder="Điểm" /><input name="feedback" maxLength={2000} placeholder="Nhận xét" /><button type="submit" disabled={saving}>Chấm bài</button></form> : <button type="button" onClick={() => void reopen(activeAssignment, student.studentId)}>Mở lại bài</button>}</div> : <span className="roster-placeholder">Chưa có bài nộp</span>}</article>)}</div>
        </section>}
      </> : <section className="assignment-list-section student-assignment-list"><h2>Bài tập của tôi</h2>{assignments.length === 0 ? <p className="assignment-empty">Chưa có bài tập được phát hành cho lớp của bạn.</p> : assignments.map((item) => <article className="assignment-card" key={item.assignmentId}><div className="assignment-card-top"><div><span className={`assignment-status ${item.submission?.status ?? "missing"}`}>{item.submission?.status === "graded" ? "Đã chấm" : item.submission?.late ? "Đã nộp muộn" : item.submission ? "Đã nộp" : "Chưa nộp"}</span><h3>{item.tieuDe}</h3><p>{item.tenLop} · {item.tenMonHoc} · buổi {item.lichHocId}</p></div><strong>{item.diemToiDa} điểm</strong></div>
          <p className="assignment-description">{item.moTa}</p><p className="assignment-meta">Hạn nộp: {formatDate(item.hanNop)} · {item.choNopMuon ? "Cho phép nộp muộn" : "Không nhận bài muộn"}</p><div className="assignment-attachments">{item.attachments.map((attachment) => <button type="button" key={attachment.attachmentId} onClick={() => void downloadAttachment(attachment)}>↓ {attachment.tenTep} ({formatSize(attachment.kichThuoc)})</button>)}</div>
          {item.submission && <div className="student-submission-summary"><a href={item.submission.repositoryUrl} target="_blank" rel="noreferrer">Repository · phiên bản {item.submission.version}</a><span>Nộp lúc {formatDate(item.submission.submittedAt)}{item.submission.grade !== null ? ` · Điểm ${item.submission.grade}/${item.diemToiDa}` : ""}</span>{item.submission.feedback && <p>Nhận xét: {item.submission.feedback}</p>}{item.submission.attachments.map((attachment) => <button type="button" key={attachment.attachmentId} onClick={() => void downloadAttachment(attachment)}>↓ {attachment.tenTep}</button>)}</div>}
          {item.canResubmit !== false && <div className="student-submit-form"><label>Repository HTTPS<input type="url" required placeholder="https://github.com/ten-ban/du-an" value={repositoryUrls[item.assignmentId] ?? item.submission?.repositoryUrl ?? ""} onChange={(event) => setRepositoryUrls((current) => ({ ...current, [item.assignmentId]: event.target.value }))} /></label><label>Tệp bài làm (tối đa 20 MB/tệp)<input type="file" multiple onChange={(event) => setSubmissionFiles((current) => ({ ...current, [item.assignmentId]: Array.from(event.target.files ?? []) }))} /></label><button type="button" className="assignment-primary" disabled={saving} onClick={() => void submitWork(item.assignmentId)}>{item.submission ? "Nộp phiên bản mới" : "Nộp bài"}</button></div>}
        </article>)}</section>}
    </main>
  );
};

export default Assignments;




