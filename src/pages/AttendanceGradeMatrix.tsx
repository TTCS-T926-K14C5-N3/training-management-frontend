import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import api from "../services/api";
import "./AttendanceGradeMatrix.css";

interface AttendanceClass {
  classId: number;
  classCode: string;
  className: string;
  programId: number | null;
  absenceThreshold: number;
}

interface AttendanceSession {
  scheduleId: number;
  scheduleCode: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface AttendanceStudent {
  studentId: number;
  studentName: string;
  email: string;
  attendance: string[];
  totalSessions: number;
  totalAbsences: number;
  present: number;
  late: number;
  excusedAbsences: number;
  unexcusedAbsences: number;
  unmarked: number;
  attendanceRate: number;
}

interface AttendanceGradeMatrixData {
  classId: number;
  classCode: string;
  className: string;
  sessions: AttendanceSession[];
  students: AttendanceStudent[];
  totals: Record<string, number>;
}

interface Props {
  isStudent: boolean;
  onBack: () => void;
}

const errorMessage = (error: unknown): string => {
  if (axios.isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && /[À-ỹ]/.test(detail)) return detail;
    if (error.response?.status === 401) {
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    }
    if (error.response?.status === 403) {
      return "Bạn chỉ có thể xem điểm chuyên cần của lớp đang theo học.";
    }
    if (error.response?.status && error.response.status >= 500) {
      return "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.";
    }
    return "Không thể tải bảng điểm chuyên cần.";
  }
  return error instanceof Error
    ? error.message
    : "Không thể tải bảng điểm chuyên cần.";
};

const statusClass = (status: string) => {
  if (status === "Có mặt") return "present";
  if (status === "Đi muộn") return "late";
  if (status === "Vắng có phép") return "excused";
  if (status === "Vắng không phép") return "unexcused";
  return status === "Chưa điểm danh" ? "unmarked" : "not-applicable";
};

export default function AttendanceGradeMatrix({ isStudent, onBack }: Props) {
  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [classId, setClassId] = useState("");
  const [matrix, setMatrix] = useState<AttendanceGradeMatrixData | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [ascending, setAscending] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get<AttendanceClass[]>("/attendance/classes")
      .then(({ data }) => {
        if (!active) return;
        setClasses(data);
        const requestedId = new URLSearchParams(window.location.search).get(
          "classId",
        );
        const selectedId =
          requestedId && data.some((item) => String(item.classId) === requestedId)
            ? requestedId
            : String(data[0]?.classId ?? "");
        setClassId(selectedId);
        const url = new URL(window.location.href);
        if (selectedId) url.searchParams.set("classId", selectedId);
        else url.searchParams.delete("classId");
        window.history.replaceState({}, "", url);
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoadingClasses(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!classId) {
      setMatrix(null);
      return;
    }
    let active = true;
    setLoadingMatrix(true);
    setError("");
    api
      .get<AttendanceGradeMatrixData>(
        `/attendance/classes/${classId}/grade-matrix`,
      )
      .then(({ data }) => {
        if (active) setMatrix(data);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setMatrix(null);
          setError(errorMessage(loadError));
        }
      })
      .finally(() => {
        if (active) setLoadingMatrix(false);
      });
    return () => {
      active = false;
    };
  }, [classId]);

  const selectedClass = classes.find((item) => String(item.classId) === classId);
  const sortedStudents = useMemo(() => {
    if (!matrix) return [];
    return [...matrix.students].sort((left, right) => {
      const difference = left.attendanceRate - right.attendanceRate;
      return (ascending ? difference : -difference) ||
        left.studentName.localeCompare(right.studentName, "vi");
    });
  }, [ascending, matrix]);

  const exportExcel = async () => {
    if (!classId || exporting) return;
    setExporting(true);
    setError("");
    try {
      const response = await api.get<Blob>(
        `/attendance/classes/${classId}/export-matrix`,
        { responseType: "blob" },
      );
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      const disposition = response.headers["content-disposition"];
      const filename =
        typeof disposition === "string"
          ? /filename="([^"]+)"/i.exec(disposition)?.[1]
          : undefined;
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date());
      link.href = blobUrl;
      link.download =
        filename ?? `${matrix?.classCode ?? "lop-hoc"}-chuyen-can-${date}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (exportError: unknown) {
      setError(errorMessage(exportError));
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="attendance-grade-page">
      <header className="attendance-grade-hero">
        <div>
          <span className="attendance-grade-kicker">{isStudent ? "KẾT QUẢ HỌC TẬP" : "QUẢN LÝ ĐIỂM"}</span>
          <h1>Điểm chuyên cần</h1>
          <p>{isStudent ? "Xem kết quả chuyên cần của bạn trong các lớp đang theo học." : "Xem ma trận điểm danh và tỷ lệ chuyên cần tổng hợp theo từng lớp."}</p>
        </div>
        <button className="attendance-grade-button secondary" onClick={onBack}>
          {isStudent ? "Quay lại lịch sử điểm danh" : "Quay lại quản lý điểm"}
        </button>
      </header>

      <section className="attendance-grade-panel">
        <div className="attendance-grade-toolbar">
          <label>
            Lớp học
            <select
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                const url = new URL(window.location.href);
                if (event.target.value) {
                  url.searchParams.set("classId", event.target.value);
                } else {
                  url.searchParams.delete("classId");
                }
                window.history.replaceState({}, "", url);
              }}
              disabled={loadingClasses}
            >
              <option value="">Chọn lớp học</option>
              {classes.map((item) => (
                <option key={item.classId} value={item.classId}>
                  {item.classCode} — {item.className}
                </option>
              ))}
            </select>
          </label>
          <button
            className="attendance-grade-button primary"
            onClick={() => void exportExcel()}
            disabled={!matrix || loadingMatrix || exporting}
          >
            {exporting ? "Đang xuất file..." : "Xuất file Excel"}
          </button>
        </div>

        {error && <div className="attendance-grade-error" role="alert">{error}</div>}
        {loadingMatrix && <p className="attendance-grade-state">Đang tải bảng chuyên cần...</p>}
        {!loadingMatrix && !classId && (
          <p className="attendance-grade-state">Chọn lớp để xem bảng điểm chuyên cần.</p>
        )}
        {!loadingMatrix && classId && matrix && (
          <>
            <div className="attendance-grade-summary">
              <div><span>Lớp</span><strong>{matrix.classCode} · {matrix.className}</strong></div>
              {!isStudent && <div><span>Số học viên</span><strong>{matrix.students.length}</strong></div>}
              <div><span>Số buổi</span><strong>{matrix.sessions.length}</strong></div>
              <div><span>Tổng lượt vắng</span><strong>{matrix.totals["Vắng có phép"] + matrix.totals["Vắng không phép"]}</strong></div>
            </div>
            <div className="attendance-grade-table-wrap">
              <table className="attendance-grade-table">
                <thead>
                  <tr>
                    <th>Mã học viên</th>
                    <th>Họ tên</th>
                    {matrix.sessions.map((session) => (
                      <th key={session.scheduleId}>
                        {session.scheduleCode}
                        <small>{session.date} · {session.startTime}</small>
                      </th>
                    ))}
                    <th>Tổng buổi</th>
                    <th>Tổng vắng</th>
                    <th>Có mặt</th>
                    <th>Đi muộn</th>
                    <th>Vắng có phép</th>
                    <th>Vắng không phép</th>
                    <th>Chưa điểm danh</th>
                    <th>
                      <button
                        className="attendance-grade-sort"
                        onClick={() => setAscending((value) => !value)}
                        title="Đổi thứ tự sắp xếp"
                      >
                        Tỷ lệ chuyên cần {ascending ? "↑" : "↓"}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((student) => (
                    <tr key={student.studentId}>
                      <td>{student.studentId}</td>
                      <td><strong>{student.studentName}</strong><small>{student.email}</small></td>
                      {student.attendance.map((status, index) => (
                        <td key={`${student.studentId}-${matrix.sessions[index]?.scheduleId}`}>
                          <span className={`attendance-grade-status ${statusClass(status)}`}>
                            {status}
                          </span>
                        </td>
                      ))}
                      <td>{student.totalSessions}</td>
                      <td>{student.totalAbsences}</td>
                      <td>{student.present}</td>
                      <td>{student.late}</td>
                      <td>{student.excusedAbsences}</td>
                      <td>{student.unexcusedAbsences}</td>
                      <td>{student.unmarked}</td>
                      <td><strong>{student.attendanceRate.toFixed(1)}%</strong></td>
                    </tr>
                  ))}
                  {!sortedStudents.length && (
                    <tr><td colSpan={matrix.sessions.length + 10}>Lớp chưa có học viên.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="attendance-grade-footnote">
              Tỷ lệ chuyên cần được tính bằng (số buổi có mặt + đi muộn) / tổng số buổi thuộc phạm vi ghi danh.
              {selectedClass ? ` Ngưỡng cảnh báo của lớp: ${selectedClass.absenceThreshold}%.` : ""}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
