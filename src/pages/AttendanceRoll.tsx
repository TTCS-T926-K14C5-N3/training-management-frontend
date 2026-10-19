import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import "./AttendanceRoll.css";

// ─── Types ───────────────────────────────────────────────────────────────────
type AttendanceStatus =
  | "present"
  | "late"
  | "excused_absence"
  | "unexcused_absence"
  | "unmarked";

interface AttendanceClass {
  classId: number;
  classCode: string;
  className: string;
  programId: number | null;
  absenceThreshold: number;
}

interface StudentRow {
  studentId: number;
  studentName: string;
  studentCode?: string;
  email: string;
  status: AttendanceStatus;
  reason: string | null;
  requestId: number | null;
}

interface Matrix {
  classId: number;
  classCode: string;
  className: string;
  date: string;
  students: StudentRow[];
  flaggedStudents: Array<{
    studentId: number;
    studentName: string;
    absencePercent: number;
  }>;
  counts: {
    present: number;
    absent: number;
    unexcused: number;
    total: number;
  };
  attendancePercent: number;
  absencePercent: number;
  absenceThreshold: number;
  aboveThreshold: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const getTeacherMode = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const roles = Array.isArray(user.vaiTro)
      ? user.vaiTro
      : Array.isArray(user.vaiTros)
        ? user.vaiTros
        : [];
    const roleIds = [
      user.vaiTroId,
      user.roleId,
      user.role?.id,
      ...roles.map(
        (r: { vaiTroId?: number; id?: number }) => r.vaiTroId ?? r.id,
      ),
    ].map(Number);
    return !roleIds.includes(2);
  } catch {
    return true;
  }
};

const messageOf = (error: unknown) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as { response?: { data?: { detail?: string } } }
    ).response;
    return response?.data?.detail || "Không thể hoàn thành yêu cầu.";
  }
  return error instanceof Error ? error.message : "Không thể hoàn thành yêu cầu.";
};

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { labelVI: string; color: string; bg: string; border: string; icon: string; order: number }
> = {
  present: {
    labelVI: "Có mặt",
    color: "#15803d",
    bg: "#dcfce7",
    border: "#86efac",
    icon: "✓",
    order: 1,
  },
  late: {
    labelVI: "Đi muộn",
    color: "#92400e",
    bg: "#fef3c7",
    border: "#fcd34d",
    icon: "⏰",
    order: 2,
  },
  excused_absence: {
    labelVI: "Vắng có phép",
    color: "#3730a3",
    bg: "#e0e7ff",
    border: "#a5b4fc",
    icon: "📋",
    order: 3,
  },
  unexcused_absence: {
    labelVI: "Vắng không phép",
    color: "#be123c",
    bg: "#ffe4e6",
    border: "#fda4af",
    icon: "✗",
    order: 4,
  },
  unmarked: {
    labelVI: "Chưa điểm danh",
    color: "#64748b",
    bg: "#f8fafc",
    border: "#e2e8f0",
    icon: "–",
    order: 5,
  },
};

const STATUS_CYCLE: AttendanceStatus[] = [
  "present",
  "late",
  "excused_absence",
  "unexcused_absence",
  "unmarked",
];

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// ─── StudentCard ──────────────────────────────────────────────────────────────
function StudentCard({
  student,
  index,
  status,
  onStatusChange,
  readOnly,
  highlighted,
}: {
  student: StudentRow;
  index: number;
  status: AttendanceStatus;
  onStatusChange: (id: number, next: AttendanceStatus) => void;
  readOnly: boolean;
  highlighted: boolean;
}) {
  const cfg = STATUS_CONFIG[status];
  const isMarked = status !== "unmarked";

  const cycleStatus = () => {
    if (readOnly) return;
    const idx = STATUS_CYCLE.indexOf(status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    onStatusChange(student.studentId, next);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onStatusChange(student.studentId, e.target.value as AttendanceStatus);
  };

  return (
    <article
      className={`roll-student-card ${isMarked ? "roll-card--marked" : "roll-card--unmarked"} ${highlighted ? "roll-card--highlight" : ""}`}
      style={{
        borderLeftColor: cfg.color,
        "--card-color": cfg.color,
        "--card-bg": cfg.bg,
        "--card-border": cfg.border,
      } as React.CSSProperties}
    >
      <div className="roll-card-index">{index + 1}</div>

      <button
        type="button"
        className="roll-status-btn"
        style={{
          background: cfg.bg,
          color: cfg.color,
          borderColor: cfg.border,
        }}
        onClick={cycleStatus}
        disabled={readOnly}
        title={`Trạng thái: ${cfg.labelVI} — Click để thay đổi`}
      >
        <span className="roll-status-icon">{cfg.icon}</span>
        <span className="roll-status-text">{cfg.labelVI}</span>
      </button>

      <div className="roll-card-info">
        <div className="roll-card-name">
          <strong>{student.studentName}</strong>
          {student.studentCode && (
            <code className="roll-student-code">{student.studentCode}</code>
          )}
        </div>
        <span className="roll-card-email">{student.email}</span>
      </div>

      {student.requestId && (
        <span className="roll-pending-badge" title="Đơn xin vắng đang chờ duyệt">
          📩 Xin vắng
        </span>
      )}

      <select
        className="roll-card-select"
        value={status}
        onChange={handleSelect}
        disabled={readOnly}
        aria-label={`Trạng thái điểm danh của ${student.studentName}`}
      >
        <option value="unmarked">– Chưa điểm danh</option>
        <option value="present">✓ Có mặt</option>
        <option value="late">⏰ Đi muộn</option>
        <option value="excused_absence">📋 Vắng có phép</option>
        <option value="unexcused_absence">✗ Vắng không phép</option>
      </select>
    </article>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AttendanceRoll() {
  const isTeacher = useMemo(() => getTeacherMode(), []);

  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [classId, setClassId] = useState(0);
  const [day, setDay] = useState(today());
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [draft, setDraft] = useState<Record<number, AttendanceStatus>>({});
  const [filterStatus, setFilterStatus] = useState<AttendanceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const loadClasses = useCallback(async () => {
    try {
      const res = await api.get<AttendanceClass[]>("/attendance/classes");
      setClasses(res.data);
      setClassId((prev) => prev || res.data[0]?.classId || 0);
    } catch (err) {
      setError(messageOf(err));
    }
  }, []);

  const loadMatrix = useCallback(async () => {
    if (!classId || !isTeacher) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await api.get<Matrix>(
        `/attendance/classes/${classId}/matrix`,
        { params: { date: day } },
      );
      setMatrix(res.data);
      setDraft(
        Object.fromEntries(res.data.students.map((s) => [s.studentId, s.status])),
      );
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [classId, day, isTeacher]);

  useEffect(() => { void loadClasses(); }, [loadClasses]);
  useEffect(() => { void loadMatrix(); }, [loadMatrix]);

  const selectedClass = classes.find((c) => c.classId === classId);

  const stats = useMemo(() => {
    if (!matrix) return null;
    const total = matrix.students.length;
    const present = matrix.students.filter((s) =>
      ["present", "late"].includes(draft[s.studentId] ?? s.status),
    ).length;
    const absent = matrix.students.filter((s) =>
      ["excused_absence", "unexcused_absence"].includes(draft[s.studentId] ?? s.status),
    ).length;
    const unmarked = matrix.students.filter((s) =>
      (draft[s.studentId] ?? s.status) === "unmarked",
    ).length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, unmarked, rate };
  }, [matrix, draft]);

  const countByStatus = useMemo(() => {
    if (!matrix) return {} as Record<AttendanceStatus, number>;
    const counts: Record<AttendanceStatus, number> = {
      present: 0, late: 0, excused_absence: 0, unexcused_absence: 0, unmarked: 0,
    };
    matrix.students.forEach((s) => {
      const st = (draft[s.studentId] ?? s.status) as AttendanceStatus;
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [matrix, draft]);

  const filteredStudents = useMemo(() => {
    if (!matrix) return [];
    let list = [...matrix.students];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.studentName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.studentCode?.toLowerCase().includes(q)),
      );
    }
    if (filterStatus !== "all") {
      list = list.filter((s) => (draft[s.studentId] ?? s.status) === filterStatus);
    }
    return list.sort((a, b) => {
      const sa = STATUS_CONFIG[draft[a.studentId] ?? a.status].order;
      const sb = STATUS_CONFIG[draft[b.studentId] ?? b.status].order;
      if (sa !== sb) return sa - sb;
      return a.studentName.localeCompare(b.studentName, "vi");
    });
  }, [matrix, draft, filterStatus, search]);

  const handleStatusChange = (id: number, next: AttendanceStatus) => {
    setDraft((prev) => ({ ...prev, [id]: next }));
    setHighlighted(id);
    setTimeout(() => setHighlighted(null), 700);
  };

  const markAllPresent = async () => {
    if (!matrix) return;
    setError(""); setNotice("");
    try {
      await api.post(`/attendance/classes/${classId}/mark-all-present`, null, { params: { date: day } });
      setNotice("Đã điểm danh có mặt cho tất cả học viên.");
      await loadMatrix();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const saveAttendance = async () => {
    if (!matrix) return;
    setSaving(true); setError(""); setNotice("");
    const records = matrix.students
      .map((s) => ({ studentId: s.studentId, status: draft[s.studentId] ?? s.status }))
      .filter((r) => r.status !== "unmarked");
    try {
      await api.post(`/attendance/classes/${classId}/records`, { date: day, records });
      setNotice("Đã lưu điểm danh thành công.");
      await loadMatrix();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="roll-page">
      {/* Hero */}
      <header className="roll-hero">
        <div className="roll-hero-text">
          <span className="roll-kicker">ĐIỂM DANH BUỔI HỌC</span>
          <h1>Danh sách điểm danh</h1>
          <p>
            Điểm danh nhanh bằng cách nhấn vào nút trạng thái hoặc chọn từ danh
            sách. Hệ thống lưu lịch sử mọi thay đổi.
          </p>
        </div>
        <div className="roll-hero-deco" aria-hidden="true">
          <svg viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="90" stroke="rgba(255,255,255,.12)" strokeWidth="2" />
            <circle cx="100" cy="100" r="60" stroke="rgba(255,255,255,.08)" strokeWidth="2" />
            <text x="100" y="115" textAnchor="middle" fontSize="52" fill="rgba(255,255,255,.6)">📋</text>
          </svg>
        </div>
      </header>

      {/* Selector */}
      <section className="roll-selector">
        <div className="roll-selector-row">
          <label className="roll-field-label">
            <span>Lớp học</span>
            <div className="roll-select-wrapper">
              <select
                id="roll-class-select"
                className="roll-field-select"
                value={classId || ""}
                onChange={(e) => {
                  setClassId(Number(e.target.value));
                  setSearch("");
                  setFilterStatus("all");
                }}
              >
                <option value="">— Chọn lớp học —</option>
                {classes.map((c) => (
                  <option key={c.classId} value={c.classId}>
                    {c.classCode} · {c.className}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="roll-field-label">
            <span>Ngày học</span>
            <input
              id="roll-date-input"
              type="date"
              className="roll-field-input"
              value={day}
              max={today()}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>

          <div className="roll-selector-btns">
            <button
              id="roll-btn-refresh"
              type="button"
              className="roll-btn roll-btn--ghost"
              disabled={!classId || loading}
              onClick={() => void loadMatrix()}
            >
              🔄 Tải lại
            </button>
          </div>
        </div>

        {/* Session info */}
        {selectedClass && matrix && (
          <div className="roll-session-info">
            <div className="roll-session-item">
              <span className="roll-session-key">Lớp</span>
              <span className="roll-session-val">{selectedClass.classCode}</span>
            </div>
            <div className="roll-session-divider" />
            <div className="roll-session-item">
              <span className="roll-session-key">Môn học</span>
              <span className="roll-session-val">{selectedClass.className}</span>
            </div>
            <div className="roll-session-divider" />
            <div className="roll-session-item">
              <span className="roll-session-key">Buổi học</span>
              <span className="roll-session-val">{formatDate(matrix.date)}</span>
            </div>
            <div className="roll-session-divider" />
            <div className="roll-session-item">
              <span className="roll-session-key">Ngưỡng vắng</span>
              <span className="roll-session-val roll-session-threshold">
                {selectedClass.absenceThreshold}%
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Alerts */}
      {error && (
        <div className="roll-alert roll-alert--error" role="alert">⚠️ {error}</div>
      )}
      {notice && (
        <div className="roll-alert roll-alert--success" role="status">✅ {notice}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="roll-loading">
          <div className="roll-spinner" />
          <span>Đang tải danh sách học viên…</span>
        </div>
      )}

      {/* Main content */}
      {!loading && matrix && stats && (
        <>
          {/* Stats */}
          <div className="roll-stats-grid">
            <div className="roll-stat-card roll-stat--blue">
              <span className="roll-stat-num">{stats.total}</span>
              <span className="roll-stat-lbl">Tổng học viên</span>
            </div>
            <div className="roll-stat-card roll-stat--green">
              <span className="roll-stat-num">{stats.present}</span>
              <span className="roll-stat-lbl">Có mặt / Muộn</span>
            </div>
            <div className="roll-stat-card roll-stat--red">
              <span className="roll-stat-num">{stats.absent}</span>
              <span className="roll-stat-lbl">Vắng mặt</span>
            </div>
            <div className="roll-stat-card roll-stat--gray">
              <span className="roll-stat-num">{stats.unmarked}</span>
              <span className="roll-stat-lbl">Chưa điểm danh</span>
            </div>
            <div className="roll-stat-card roll-stat--purple">
              <span className="roll-stat-num">{stats.rate}%</span>
              <span className="roll-stat-lbl">Tỷ lệ có mặt</span>
            </div>
          </div>

          {/* Progress */}
          <div className="roll-progress-wrap">
            <div className="roll-progress-track">
              <div
                className="roll-progress-seg roll-seg--present"
                style={{ width: `${stats.total > 0 ? (stats.present / stats.total) * 100 : 0}%` }}
              />
              <div
                className="roll-progress-seg roll-seg--absent"
                style={{ width: `${stats.total > 0 ? (stats.absent / stats.total) * 100 : 0}%` }}
              />
            </div>
            <span className="roll-progress-hint">
              {stats.total - stats.unmarked}/{stats.total} đã điểm danh
            </span>
          </div>

          {/* Threshold warning */}
          {matrix.aboveThreshold && (
            <div className="roll-alert roll-alert--warning">
              ⚠️ <strong>Cảnh báo vượt ngưỡng:</strong>{" "}
              {matrix.flaggedStudents.map((s) => `${s.studentName} (${s.absencePercent}%)`).join(", ")}
            </div>
          )}

          {/* Toolbar */}
          <div className="roll-toolbar">
            <div className="roll-toolbar-search">
              <input
                id="roll-search-input"
                type="search"
                className="roll-search"
                placeholder="🔍 Tìm học viên theo tên hoặc email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="roll-filter-bar">
              <button
                type="button"
                id="roll-filter-all"
                className={`roll-chip ${filterStatus === "all" ? "roll-chip--on" : ""}`}
                onClick={() => setFilterStatus("all")}
              >
                Tất cả ({stats.total})
              </button>
              {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  id={`roll-filter-${s}`}
                  className={`roll-chip ${filterStatus === s ? "roll-chip--on" : ""}`}
                  onClick={() => setFilterStatus(s)}
                >
                  {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].labelVI} ({countByStatus[s] ?? 0})
                </button>
              ))}
            </div>

            <div className="roll-action-btns">
              <button
                id="roll-mark-all-btn"
                type="button"
                className="roll-btn roll-btn--secondary"
                disabled={saving}
                onClick={() => void markAllPresent()}
              >
                ✓ Điểm danh tất cả
              </button>
              <button
                id="roll-save-btn"
                type="button"
                className="roll-btn roll-btn--primary"
                disabled={saving || !matrix.students.length}
                onClick={() => void saveAttendance()}
              >
                {saving ? <><span className="roll-btn-spin" /> Đang lưu…</> : <>💾 Lưu điểm danh</>}
              </button>
            </div>
          </div>

          {/* Student list */}
          <div className="roll-list" ref={listRef}>
            {filteredStudents.length === 0 ? (
              <div className="roll-empty">
                <span>🔍</span>
                <p>Không tìm thấy học viên phù hợp với bộ lọc.</p>
              </div>
            ) : (
              filteredStudents.map((student, idx) => (
                <StudentCard
                  key={student.studentId}
                  student={student}
                  index={idx}
                  status={draft[student.studentId] ?? student.status}
                  onStatusChange={handleStatusChange}
                  readOnly={false}
                  highlighted={highlighted === student.studentId}
                />
              ))
            )}
          </div>

          {/* Bottom sticky bar when there are unmarked */}
          {stats.unmarked > 0 && (
            <div className="roll-sticky-bar">
              <span>
                <strong>{stats.unmarked}</strong> học viên chưa được điểm danh
              </span>
              <button
                id="roll-save-sticky"
                type="button"
                className="roll-btn roll-btn--primary"
                disabled={saving}
                onClick={() => void saveAttendance()}
              >
                {saving ? "Đang lưu…" : "💾 Lưu điểm danh"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty states */}
      {!loading && !matrix && classId && !error && (
        <div className="roll-empty-state">
          <div className="roll-empty-icon">📋</div>
          <h2>Chưa có dữ liệu điểm danh</h2>
          <p>Chọn lớp và ngày học để bắt đầu điểm danh buổi học.</p>
        </div>
      )}
      {!loading && !classId && (
        <div className="roll-empty-state">
          <div className="roll-empty-icon">🏫</div>
          <h2>Chọn lớp học để bắt đầu</h2>
          <p>Chọn lớp và ngày học ở trên để xem và thực hiện điểm danh.</p>
        </div>
      )}
    </main>
  );
}
