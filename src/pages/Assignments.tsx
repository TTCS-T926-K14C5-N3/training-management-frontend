import React from "react";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
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
  gradedAt?: string | null;
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
const ROSTER_PAGE_SIZE = 5;
const STUDENT_STATUSES = ["missing", "submitted", "graded", "redo"] as const;
type StudentAssignmentStatus = (typeof STUDENT_STATUSES)[number];
const studentAssignmentStatus = (assignment: Assignment): StudentAssignmentStatus => {
  if (!assignment.submission) return "missing";
  if (assignment.submission.grade !== null) {
    return assignment.canResubmit !== false ? "redo" : "graded";
  }
  return "submitted";
};
const studentStatusLabel: Record<StudentAssignmentStatus, string> = {
  missing: "Chưa nộp",
  submitted: "Đã nộp",
  graded: "Đã chấm",
  redo: "Cần làm lại",
};
const formatTimeRemaining = (deadline: string, now: number) => {
  const remainingMs = new Date(deadline).getTime() - now;
  if (remainingMs <= 0) return "Đã quá hạn";
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Còn ${days} ngày ${hours} giờ`;
  if (hours > 0) return `Còn ${hours} giờ ${minutes} phút`;
  return `Còn ${minutes} phút`;
};
const localDateTimeValue = (value: Date) => {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
};

const Assignments: React.FC<{ studentOnly?: boolean; canSubmit?: boolean }> = ({
  studentOnly = false,
  canSubmit = false,
}) => {
  const [tab, setTab] = useState<"teacher" | "student">(studentOnly ? "student" : "teacher");
  const [teacherSection, setTeacherSection] = useState<"create" | "list">("create");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [teacherSubmissionHistories, setTeacherSubmissionHistories] = useState<
    Record<number, Record<number, Submission[]>>
  >({});
  const [loadingTeacherHistoryKey, setLoadingTeacherHistoryKey] = useState<string | null>(null);
  const [submissionHistories, setSubmissionHistories] = useState<Record<number, Submission[]>>({});
  const [loadingHistoryId, setLoadingHistoryId] = useState<number | null>(null);
  const [submissionFormVersions, setSubmissionFormVersions] = useState<Record<number, number>>({});
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [form, setForm] = useState({ title: "", description: "", deadline: "", points: "100", allowLate: false, lessonId: "" });
  const [assignmentFiles, setAssignmentFiles] = useState<File[]>([]);
  const [submissionFiles, setSubmissionFiles] = useState<Record<number, File[]>>({});
  const [repositoryUrls, setRepositoryUrls] = useState<Record<number, string>>({});
  const [rosters, setRosters] = useState<Record<number, Roster>>({});
  const [rosterFilters, setRosterFilters] = useState<Record<number, string>>({});
  const [rosterPages, setRosterPages] = useState<Record<number, number>>({});
  const [loadingRosterId, setLoadingRosterId] = useState<number | null>(null);
  const [studentStatusFilter, setStudentStatusFilter] = useState<"all" | StudentAssignmentStatus>("all");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [assignmentClassFilter, setAssignmentClassFilter] = useState("");
  const [assignmentSubjectFilter, setAssignmentSubjectFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const minimumDeadline = localDateTimeValue(new Date(clockNow));

  const loadTeacher = useCallback(async () => {
    setError("");
    try {
      const [assignmentResult, optionsResult] = await Promise.allSettled([
        api.get<Assignment[]>("/assignments/teacher"),
        api.get<ClassOption[]>("/assignments/options"),
      ]);
      const errors: string[] = [];
      if (assignmentResult.status === "fulfilled") {
        setAssignments(assignmentResult.value.data);
      } else {
        errors.push(`Danh sách bài tập: ${errorText(assignmentResult.reason)}`);
      }
      if (optionsResult.status === "fulfilled") {
        setClassOptions(optionsResult.value.data);
      } else {
        errors.push(`Lớp và buổi học: ${errorText(optionsResult.reason)}`);
      }
      setError(errors.join(" · "));
    } finally {
      setLoading(false);
    }
  }, []);
  const loadStudent = useCallback(async () => {
    setError("");
    try {
      const response = await api.get<Assignment[]>("/assignments/mine");
      setAssignments(response.data);
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

  useEffect(() => {
    if (tab !== "student") return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [tab]);

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
  const studentAssignments = assignments
    .filter((item) => studentStatusFilter === "all" || studentAssignmentStatus(item) === studentStatusFilter)
    .sort((left, right) => new Date(left.hanNop).getTime() - new Date(right.hanNop).getTime());

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
    if (!form.deadline || new Date(form.deadline).getTime() <= clockNow) {
      setError("Hạn nộp phải ở thời điểm tương lai.");
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

  const loadRoster = async (assignmentId: number, filter = rosterFilters[assignmentId] ?? "all") => {
    setLoadingRosterId(assignmentId);
    try {
      const response = await api.get<Roster>(`/assignments/${assignmentId}/roster`, { params: { status: filter } });
      setRosters((current) => ({ ...current, [assignmentId]: response.data }));
      setError("");
    } catch (requestError: unknown) {
      setError(errorText(requestError));
    } finally {
      setLoadingRosterId(null);
    }
  };

  const toggleRoster = async (assignmentId: number) => {
    if (rosters[assignmentId]) {
      setRosters((current) => {
        const { [assignmentId]: _closedRoster, ...remaining } = current;
        return remaining;
      });
      setRosterPages((current) => {
        const { [assignmentId]: _closedPage, ...remaining } = current;
        return remaining;
      });
      setRosterFilters((current) => {
        const { [assignmentId]: _closedFilter, ...remaining } = current;
        return remaining;
      });
      return;
    }
    setRosterPages((current) => ({ ...current, [assignmentId]: 1 }));
    await loadRoster(assignmentId);
  };

  const toggleSubmissionHistory = async (assignmentId: number) => {
    if (submissionHistories[assignmentId]) {
      setSubmissionHistories((current) => {
        const { [assignmentId]: _closedHistory, ...remaining } = current;
        return remaining;
      });
      return;
    }

    setLoadingHistoryId(assignmentId);
    try {
      const response = await api.get<Submission[]>(
        `/assignments/${assignmentId}/submissions/history`,
      );
      setSubmissionHistories((current) => ({
        ...current,
        [assignmentId]: response.data,
      }));
    } catch (requestError: unknown) {
      setError(errorText(requestError));
    } finally {
      setLoadingHistoryId(null);
    }
  };

  const toggleTeacherSubmissionHistory = async (assignmentId: number, studentId: number) => {
    const history = teacherSubmissionHistories[assignmentId]?.[studentId];
    if (history) {
      setTeacherSubmissionHistories((current) => {
        const assignmentHistories = { ...current[assignmentId] };
        delete assignmentHistories[studentId];
        if (Object.keys(assignmentHistories).length === 0) {
          const { [assignmentId]: _closedHistories, ...remaining } = current;
          return remaining;
        }
        return { ...current, [assignmentId]: assignmentHistories };
      });
      return;
    }

    const loadingKey = `${assignmentId}:${studentId}`;
    setLoadingTeacherHistoryKey(loadingKey);
    try {
      const response = await api.get<Submission[]>(
        `/assignments/${assignmentId}/students/${studentId}/submissions/history`,
      );
      setTeacherSubmissionHistories((current) => ({
        ...current,
        [assignmentId]: {
          ...current[assignmentId],
          [studentId]: response.data,
        },
      }));
    } catch (requestError: unknown) {
      setError(errorText(requestError));
    } finally {
      setLoadingTeacherHistoryKey(null);
    }
  };

  const invalidateTeacherSubmissionHistory = (assignmentId: number, studentId: number) => {
    setTeacherSubmissionHistories((current) => {
      const assignmentHistories = { ...current[assignmentId] };
      delete assignmentHistories[studentId];
      if (Object.keys(assignmentHistories).length === 0) {
        const { [assignmentId]: _invalidatedHistories, ...remaining } = current;
        return remaining;
      }
      return { ...current, [assignmentId]: assignmentHistories };
    });
  };

  const submitWork = async (assignmentId: number) => {
    const files = submissionFiles[assignmentId] ?? [];
    const repositoryUrl = repositoryUrls[assignmentId]?.trim() ?? "";
    let parsedRepository: URL;
    try {
      parsedRepository = new URL(repositoryUrl);
    } catch {
      setError("Vui lòng nhập đường dẫn repository HTTPS hợp lệ.");
      return;
    }
    if (
      parsedRepository.protocol !== "https:"
      || !parsedRepository.hostname
      || !parsedRepository.pathname.replaceAll("/", "")
      || parsedRepository.username
      || parsedRepository.password
    ) {
      setError("Liên kết repository phải dùng HTTPS và có đường dẫn repository.");
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
      setSubmissionFiles((current) => {
        const { [assignmentId]: _submittedFiles, ...remaining } = current;
        return remaining;
      });
      setRepositoryUrls((current) => {
        const { [assignmentId]: _submittedUrl, ...remaining } = current;
        return remaining;
      });
      setSubmissionFormVersions((current) => ({
        ...current,
        [assignmentId]: (current[assignmentId] ?? 0) + 1,
      }));
      setSubmissionHistories((current) => {
        const { [assignmentId]: _staleHistory, ...remaining } = current;
        return remaining;
      });
      await loadStudent();
    } catch (requestError: unknown) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const gradeSubmission = async (submissionId: number, assignmentId: number, studentId: number, studentName: string, event: React.FormEvent<HTMLFormElement>) => {
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
      invalidateTeacherSubmissionHistory(assignmentId, studentId);
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
      invalidateTeacherSubmissionHistory(assignmentId, studentId);
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
          {!studentOnly && <button type="button" className={tab === "teacher" ? "active" : ""} onClick={() => { setTab("teacher"); setLoading(true); setRosters({}); setRosterPages({}); setRosterFilters({}); }}>Giảng viên</button>}
          {(studentOnly || canSubmit) && <button type="button" className={tab === "student" ? "active" : ""} onClick={() => { setTab("student"); setLoading(true); setRosters({}); setRosterPages({}); setRosterFilters({}); }}>Học viên</button>}
        </div>
      </header>
      {error && <div className="assignment-alert error" role="alert">{error}</div>}
      {notice && (
        <ToastNotification
          type="success"
          text={notice}
          onClose={() => setNotice("")}
        />
      )}
      {loading ? <p className="assignment-loading">Đang tải bài tập…</p> : tab === "teacher" ? <>
        <nav className="assignment-section-tabs" aria-label="Mục bài tập giảng viên">
          <button type="button" className={teacherSection === "create" ? "active" : ""} aria-current={teacherSection === "create" ? "page" : undefined} onClick={() => { setTeacherSection("create"); setRosters({}); setRosterPages({}); setRosterFilters({}); }}>Tạo bản nháp</button>
          <button type="button" className={teacherSection === "list" ? "active" : ""} aria-current={teacherSection === "list" ? "page" : undefined} onClick={() => setTeacherSection("list")}>Bài tập phụ trách</button>
        </nav>
        {teacherSection === "create" ? <section className="assignment-panel">
          <h2>Tạo bản nháp</h2>
          <form className="assignment-form" onSubmit={(event) => void createDraft(event)}>
            <label>Lớp<select required disabled={!classOptions.length} value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setSelectedSubject(""); setForm((value) => ({ ...value, lessonId: "" })); }}><option value="">{classOptions.length ? "Chọn lớp" : "Chưa có lớp được phân công"}</option>{classOptions.map((item) => <option key={item.lopHocId} value={item.lopHocId}>{item.tenLop}</option>)}</select></label>
            <label>Môn học<select required disabled={!currentClass?.subjects.length} value={selectedSubject} onChange={(event) => { setSelectedSubject(event.target.value); setForm((value) => ({ ...value, lessonId: "" })); }}><option value="">{currentClass ? currentClass.subjects.length ? "Chọn môn" : "Lớp chưa có môn được phân công" : "Chọn lớp trước"}</option>{currentClass?.subjects.map((item) => <option key={item.monHocId} value={item.monHocId}>{item.tenMonHoc}</option>)}</select></label>
            <label>Buổi học<select required disabled={!currentSubject?.lessons.length} value={form.lessonId} onChange={(event) => setForm((value) => ({ ...value, lessonId: event.target.value }))}><option value="">{currentSubject ? currentSubject.lessons.length ? "Chọn buổi học" : "Môn chưa có buổi học" : "Chọn môn trước"}</option>{currentSubject?.lessons.map((item) => <option key={item.lichHocId} value={item.lichHocId}>{item.label}</option>)}</select></label>
            <label>Tiêu đề<input required maxLength={200} value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} /></label>
            <label>Hạn nộp<input required type="datetime-local" min={minimumDeadline} value={form.deadline} onChange={(event) => setForm((value) => ({ ...value, deadline: event.target.value }))} /></label>
            <label>Điểm tối đa<input required type="number" min="0.01" max="99999.99" step="0.01" value={form.points} onChange={(event) => setForm((value) => ({ ...value, points: event.target.value }))} /></label>
            <label className="assignment-wide">Mô tả<textarea required rows={4} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></label>
            <label className="assignment-wide">Tệp đính kèm (tối đa 20 MB/tệp)<input type="file" multiple onChange={(event) => setAssignmentFiles(Array.from(event.target.files ?? []))} /></label>
            <label className="assignment-checkbox"><input type="checkbox" checked={form.allowLate} onChange={(event) => setForm((value) => ({ ...value, allowLate: event.target.checked }))} /> Cho phép nộp muộn</label>
            <button className="assignment-primary" type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Lưu bản nháp"}</button>
          </form>
        </section>
        : <>
        <section className="assignment-list-section">
          <div className="assignment-list-heading">
            <div><h2>Bài tập phụ trách</h2><p>Theo dõi bản nháp và bài tập đã phát hành.</p></div>
            <span className="assignment-count">{filteredAssignments.length} bài tập</span>
          </div>
          <div className="assignment-filters">
            <div className="assignment-filter-title"><strong>Lọc danh sách</strong><span>Chọn lớp hoặc môn học</span></div>
            <label><span>Lớp học</span><select value={assignmentClassFilter} onChange={(event) => { setAssignmentClassFilter(event.target.value); setAssignmentSubjectFilter(""); }}><option value="">Tất cả lớp</option>{classOptions.map((item) => <option key={item.lopHocId} value={item.lopHocId}>{item.tenLop}</option>)}</select></label>
            <label><span>Môn học</span><select value={assignmentSubjectFilter} onChange={(event) => setAssignmentSubjectFilter(event.target.value)}><option value="">Tất cả môn</option>{availableFilterSubjects.map((item) => <option key={`${item.monHocId}-${item.tenMonHoc}`} value={item.monHocId}>{item.tenMonHoc}</option>)}</select></label>
            {(assignmentClassFilter || assignmentSubjectFilter) && <button type="button" className="assignment-filter-reset" onClick={() => { setAssignmentClassFilter(""); setAssignmentSubjectFilter(""); }}>Xóa bộ lọc</button>}
          </div>
          {filteredAssignments.length === 0 ? <p className="assignment-empty">Không có bài tập phù hợp với bộ lọc.</p> : filteredAssignments.map((item) => {
            const roster = rosters[item.assignmentId];
            const rosterPageCount = Math.max(1, Math.ceil((roster?.students.length ?? 0) / ROSTER_PAGE_SIZE));
            const rosterPage = Math.min(rosterPages[item.assignmentId] ?? 1, rosterPageCount);
            const rosterStartIndex = (rosterPage - 1) * ROSTER_PAGE_SIZE;
            const visibleStudents = roster?.students.slice(rosterStartIndex, rosterStartIndex + ROSTER_PAGE_SIZE) ?? [];
            return <article className="assignment-card" key={item.assignmentId}>
            <div className="assignment-card-top"><div><span className={`assignment-status ${item.trangThai.toLowerCase()}`}>{item.trangThai === "Draft" ? "Bản nháp" : "Đã phát hành"}</span><h3>{item.tieuDe}</h3><p>{item.tenLop} · {item.tenMonHoc}</p></div><strong>{item.diemToiDa} điểm</strong></div>
            <p className="assignment-description">{item.moTa}</p><p className="assignment-meta">Hạn nộp: {formatDate(item.hanNop)} · {item.choNopMuon ? "Cho phép nộp muộn" : "Không nhận bài muộn"}</p>
            <div className="assignment-attachments">{item.attachments.map((attachment) => <button type="button" key={attachment.attachmentId} onClick={() => void downloadAttachment(attachment)}>↓ {attachment.tenTep} ({formatSize(attachment.kichThuoc)})</button>)}</div>
            <div className="assignment-actions">{item.trangThai === "Draft" && <button type="button" className="assignment-primary" disabled={saving} onClick={() => void publish(item.assignmentId)}>Phát hành</button>}{item.trangThai === "Published" && <button type="button" aria-expanded={Boolean(roster)} disabled={loadingRosterId === item.assignmentId} onClick={() => void toggleRoster(item.assignmentId)}>{loadingRosterId === item.assignmentId ? "Đang tải danh sách…" : roster ? "Đóng danh sách nộp bài" : "Danh sách nộp bài"}</button>}</div>
            {loadingRosterId === item.assignmentId && !roster && <p className="assignment-loading">Đang tải danh sách học viên…</p>}
            {roster && <section className="assignment-panel roster-panel"><div className="roster-heading"><div><h2>Danh sách học viên</h2><p>{roster.submittedCount}/{roster.totalStudents} đã nộp · {roster.gradedCount} đã chấm · {roster.lateCount} muộn · {roster.missingCount} chưa nộp</p></div><label>Lọc<select value={rosterFilters[item.assignmentId] ?? "all"} onChange={(event) => { setRosterFilters((current) => ({ ...current, [item.assignmentId]: event.target.value })); setRosterPages((current) => ({ ...current, [item.assignmentId]: 1 })); void loadRoster(item.assignmentId, event.target.value); }}><option value="all">Tất cả</option><option value="missing">Chưa nộp</option><option value="submitted">Đã nộp</option><option value="ungraded">Chưa chấm</option><option value="late">Nộp muộn</option><option value="graded">Đã chấm</option></select></label></div>
              <div className="progress-track"><span style={{ width: `${roster.progressPercent}%` }} /></div><small>Tiến độ chấm {roster.progressPercent}%</small>
              <div className="roster-list">{visibleStudents.map((student) => <article className="roster-row" key={student.studentId}><div className="roster-student"><strong>{student.studentName}</strong><small>{student.email}</small><span className={`assignment-status ${student.status}`}>{student.status === "missing" ? "Chưa nộp" : student.status === "graded" ? "Đã chấm" : student.status === "late" ? "Nộp muộn" : "Đã nộp"}</span></div>
                {student.submission ? <div className="roster-submission"><a href={student.submission.repositoryUrl} target="_blank" rel="noreferrer">Repository · phiên bản {student.submission.version}</a><small>Nộp lúc {formatDate(student.submission.submittedAt)}{student.submission.grade !== null ? ` · ${student.submission.grade} điểm` : ""}</small><div className="assignment-attachments">{student.submission.attachments.map((attachment) => <button type="button" key={attachment.attachmentId} onClick={() => void downloadAttachment(attachment)}>↓ {attachment.tenTep}</button>)}</div>
                  {student.submission.grade === null ? <form className="grade-form" onSubmit={(event) => void gradeSubmission(student.submission!.submissionId, item.assignmentId, student.studentId, student.studentName, event)}><input name="points" type="number" min="0" max={item.diemToiDa} step="0.01" required placeholder="Điểm" /><input name="feedback" maxLength={2000} placeholder="Nhận xét" /><button type="submit" disabled={saving}>Chấm bài</button></form> : <button type="button" onClick={() => void reopen(item.assignmentId, student.studentId)}>Mở lại bài</button>}
                  <button type="button" className="submission-history-trigger" aria-expanded={Boolean(teacherSubmissionHistories[item.assignmentId]?.[student.studentId])} disabled={loadingTeacherHistoryKey === `${item.assignmentId}:${student.studentId}`} onClick={() => void toggleTeacherSubmissionHistory(item.assignmentId, student.studentId)}>{loadingTeacherHistoryKey === `${item.assignmentId}:${student.studentId}` ? "Đang tải lịch sử…" : teacherSubmissionHistories[item.assignmentId]?.[student.studentId] ? "Ẩn lịch sử nộp" : "Lịch sử nộp"}</button>
                  {teacherSubmissionHistories[item.assignmentId]?.[student.studentId] && <section className="submission-history teacher-submission-history" aria-label={`Lịch sử nộp của ${student.studentName}`}><h4>Các phiên đã nộp ({teacherSubmissionHistories[item.assignmentId][student.studentId].length})</h4>{teacherSubmissionHistories[item.assignmentId][student.studentId].map((submission) => <article className="submission-history-version" key={submission.submissionId}><div className="submission-history-heading"><strong>Phiên bản {submission.version}</strong><span>{submission.late ? "Nộp muộn" : "Đã nộp"} lúc {formatDate(submission.submittedAt)}</span></div><a href={submission.repositoryUrl} target="_blank" rel="noreferrer">Mở liên kết repository</a>{submission.grade !== null && <p>Điểm: {submission.grade}/{item.diemToiDa}{submission.gradedAt ? ` · Chấm lúc ${formatDate(submission.gradedAt)}` : ""}</p>}{submission.feedback && <p>Nhận xét: {submission.feedback}</p>}<div className="assignment-attachments">{submission.attachments.length ? submission.attachments.map((attachment) => <button type="button" key={attachment.attachmentId} onClick={() => void downloadAttachment(attachment)}>↓ {attachment.tenTep} ({formatSize(attachment.kichThuoc)})</button>) : <span className="roster-placeholder">Phiên bản này không có tệp đính kèm.</span>}</div></article>)}</section>}
                </div> : <span className="roster-placeholder">Chưa có bài nộp</span>}</article>)}</div>
              <nav className="roster-pagination" aria-label={`Phân trang danh sách học viên của ${item.tieuDe}`}>
                <span>Hiển thị {roster.students.length === 0 ? 0 : rosterStartIndex + 1}–{Math.min(rosterStartIndex + ROSTER_PAGE_SIZE, roster.students.length)} / {roster.students.length} học viên</span>
                {rosterPageCount > 1 && <div><button type="button" disabled={rosterPage <= 1} onClick={() => setRosterPages((current) => ({ ...current, [item.assignmentId]: rosterPage - 1 }))}>Trang trước</button><span>Trang {rosterPage} / {rosterPageCount}</span><button type="button" disabled={rosterPage >= rosterPageCount} onClick={() => setRosterPages((current) => ({ ...current, [item.assignmentId]: rosterPage + 1 }))}>Trang sau</button></div>}
              </nav>
            </section>}
          </article>;
          })}
        </section>
        </>}
      </> : <section className="assignment-list-section student-assignment-list">
        <div className="student-assignment-heading"><h2>Bài tập của tôi</h2><label>Trạng thái<select value={studentStatusFilter} onChange={(event) => setStudentStatusFilter(event.target.value as "all" | StudentAssignmentStatus)}><option value="all">Tất cả trạng thái</option>{STUDENT_STATUSES.map((status) => <option key={status} value={status}>{studentStatusLabel[status]}</option>)}</select></label></div>
        {assignments.length === 0 ? <p className="assignment-empty">Chưa có bài tập được phát hành cho lớp của bạn.</p> : studentAssignments.length === 0 ? <p className="assignment-empty">Không có bài tập ở trạng thái này.</p> : studentAssignments.map((item) => {
          const status = studentAssignmentStatus(item);
          const remainingMs = new Date(item.hanNop).getTime() - clockNow;
          const dueSoon = remainingMs > 0 && remainingMs <= 24 * 60 * 60 * 1000;
          const canSubmit = item.canResubmit !== false && (!item.submission || status === "redo" || item.submission.grade === null);
          return <article className={`assignment-card student-assignment-card${dueSoon && !item.submission ? " due-soon" : ""}`} key={item.assignmentId}>
            <div className="assignment-card-top"><div><span className={`assignment-status ${status}`}>{studentStatusLabel[status]}{item.submission?.late ? " · Nộp muộn" : ""}</span><h3>{item.tieuDe}</h3><p>{item.tenLop} · {item.tenMonHoc} · buổi {item.lichHocId}</p></div><strong>{item.diemToiDa} điểm</strong></div>
            <p className="assignment-description">{item.moTa}</p>
            <p className={`assignment-meta student-deadline${dueSoon && !item.submission ? " deadline-soon" : ""}`}>Hạn nộp: {formatDate(item.hanNop)} · <strong>{formatTimeRemaining(item.hanNop, clockNow)}</strong>{dueSoon && !item.submission && <span className="deadline-warning">Sắp hết hạn</span>} · {item.choNopMuon ? "Cho phép nộp muộn" : "Không nhận bài muộn"}</p>
            <div className="assignment-attachments">{item.attachments.map((attachment) => <button type="button" key={attachment.attachmentId} onClick={() => void downloadAttachment(attachment)}>↓ {attachment.tenTep} ({formatSize(attachment.kichThuoc)})</button>)}</div>
            {item.submission && <div className="student-submission-summary"><a href={item.submission.repositoryUrl} target="_blank" rel="noreferrer">Repository · phiên bản {item.submission.version}</a><span>{item.submission.late ? "Nộp muộn" : "Đã nộp"} lúc {formatDate(item.submission.submittedAt)}{item.submission.grade !== null ? ` · Điểm ${item.submission.grade}/${item.diemToiDa}` : ""}</span>{item.submission.feedback && <p>Nhận xét: {item.submission.feedback}</p>}{item.submission.attachments.map((attachment) => <button type="button" key={attachment.attachmentId} onClick={() => void downloadAttachment(attachment)}>↓ {attachment.tenTep}</button>)}</div>}
            {item.submission && <div className="submission-history-toggle"><button type="button" aria-expanded={Boolean(submissionHistories[item.assignmentId])} disabled={loadingHistoryId === item.assignmentId} onClick={() => void toggleSubmissionHistory(item.assignmentId)}>{loadingHistoryId === item.assignmentId ? "Đang tải chi tiết…" : submissionHistories[item.assignmentId] ? "Ẩn chi tiết các phiên đã nộp" : "Chi tiết các phiên đã nộp"}</button></div>}
            {submissionHistories[item.assignmentId] && <section className="submission-history" aria-label={`Lịch sử nộp bài ${item.tieuDe}`}><h4>Các phiên đã nộp ({submissionHistories[item.assignmentId].length})</h4>{submissionHistories[item.assignmentId].length === 0 ? <p>Chưa có phiên nộp bài.</p> : submissionHistories[item.assignmentId].map((submission) => <article className="submission-history-version" key={submission.submissionId}><div className="submission-history-heading"><strong>Phiên bản {submission.version}</strong><span>{submission.late ? "Nộp muộn" : "Đã nộp"} lúc {formatDate(submission.submittedAt)}</span></div><a href={submission.repositoryUrl} target="_blank" rel="noreferrer">Mở liên kết repository</a>{submission.grade !== null && <p>Điểm: {submission.grade}/{item.diemToiDa}{submission.gradedAt ? ` · Chấm lúc ${formatDate(submission.gradedAt)}` : ""}</p>}{submission.feedback && <p>Nhận xét: {submission.feedback}</p>}<div className="assignment-attachments">{submission.attachments.length ? submission.attachments.map((attachment) => <button type="button" key={attachment.attachmentId} onClick={() => void downloadAttachment(attachment)}>↓ {attachment.tenTep} ({formatSize(attachment.kichThuoc)})</button>) : <span className="roster-placeholder">Phiên bản này không có tệp đính kèm.</span>}</div></article>)}</section>}
            {canSubmit && <div className="student-submit-form"><label>Liên kết repository HTTPS<input type="url" maxLength={1000} required placeholder="https://github.com/ten-ban/du-an" value={repositoryUrls[item.assignmentId] ?? ""} onChange={(event) => setRepositoryUrls((current) => ({ ...current, [item.assignmentId]: event.target.value }))} /></label><label><span className="submission-file-label"><span>Tệp bài làm (nhiều tệp, tối đa 20 MB/tệp)</span>{(submissionFiles[item.assignmentId]?.length ?? 0) > 0 && <small>Đã chọn {submissionFiles[item.assignmentId].length} tệp</small>}</span><input key={`${item.assignmentId}-${submissionFormVersions[item.assignmentId] ?? 0}`} type="file" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); if (validateFiles(files)) setSubmissionFiles((current) => ({ ...current, [item.assignmentId]: files })); else event.currentTarget.value = ""; }} /></label><button type="button" className="assignment-primary" disabled={saving} onClick={() => void submitWork(item.assignmentId)}>{item.submission ? "Nộp phiên bản mới" : "Nộp bài"}</button></div>}
          </article>;
        })}
      </section>}
    </main>
  );
};

export default Assignments;
