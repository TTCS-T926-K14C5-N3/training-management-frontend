import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import "./AcademicManagement.css";

interface StudentOption {
  nguoiDungId: number;
  hoTen: string;
  email: string;
}

interface SubjectOption {
  monHocId: number;
  maMonHoc: string;
  tenMonHoc: string;
}

interface ClassOption {
  lopHocId: number;
  maLop: string;
  tenLop: string;
  hocViens: StudentOption[];
  monHocs: SubjectOption[];
}

interface GradeRecord {
  diemId: number;
  lopHocId: number;
  maLop: string;
  tenLop: string;
  hocVienId: number;
  hocVienTen: string;
  monHocId: number;
  maMonHoc: string;
  tenMonHoc: string;
  hocKy: number;
  namHoc: string;
  diemQuaTrinh: number | null;
  diemGiuaKy: number | null;
  diemCuoiKy: number | null;
}

interface GradeForm {
  lopHocId: number;
  hocVienId: number;
  monHocId: number;
  hocKy: number;
  namHoc: string;
  diemQuaTrinh: string;
  diemGiuaKy: string;
  diemCuoiKy: string;
}

interface GradeManagementProps {
  permissions: string[];
  onOpenAttendanceMatrix: (classId: number) => void;
}

const EMPTY_FORM: GradeForm = {
  lopHocId: 0,
  hocVienId: 0,
  monHocId: 0,
  hocKy: 1,
  namHoc: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  diemQuaTrinh: "",
  diemGiuaKy: "",
  diemCuoiKy: "",
};

const responseError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          typeof item === "object" &&
          item !== null &&
          "msg" in item &&
          typeof item.msg === "string"
            ? item.msg
            : null,
        )
        .filter((item): item is string => item !== null);
      if (messages.length > 0) return messages.join(" ");
    }
  }
  return fallback;
};

const formatScore = (score: number | null) =>
  score === null ? "—" : score.toFixed(2).replace(/\.?0+$/, "");

const GradeManagement: React.FC<GradeManagementProps> = ({
  permissions,
  onOpenAttendanceMatrix,
}) => {
  const studentPickerRef = useRef<HTMLDetailsElement>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [form, setForm] = useState<GradeForm>(EMPTY_FORM);
  const [editingGradeId, setEditingGradeId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [gradesError, setGradesError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const canCreate = permissions.includes("GRADE_CREATE");
  const canUpdate = permissions.includes("GRADE_UPDATE");
  const canDelete = permissions.includes("GRADE_DELETE");
  const canExportAttendance = permissions.includes("ATTENDANCE_VIEW");
  const attendanceExportClass = classes.find(
    (item) => String(item.lopHocId) === classFilter,
  );
  const selectedClass = classes.find(
    (item) => item.lopHocId === form.lopHocId,
  );
  const selectedClassHasNoStudents = Boolean(
    selectedClass && selectedClass.hocViens.length === 0,
  );

  useEffect(() => {
    const closeStudentPickerOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !studentPickerRef.current?.contains(event.target)
      ) {
        studentPickerRef.current?.removeAttribute("open");
      }
    };

    document.addEventListener("mousedown", closeStudentPickerOnOutsideClick);
    return () => {
      document.removeEventListener(
        "mousedown",
        closeStudentPickerOnOutsideClick,
      );
    };
  }, []);

  useEffect(() => {
    let active = true;
    api
      .get<{ classes: ClassOption[] }>("/academic/grade-options")
      .then((response) => {
        if (active) {
          setClasses(response.data.classes);
          setOptionsError("");
        }
      })
      .catch((error: unknown) => {
        console.error("Không thể tải lớp và môn học để xem điểm:", error);
        if (active) {
          setOptionsError(
            responseError(error, "Không thể tải danh sách lớp và môn học."),
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const params: Record<string, string | number> = {};
    if (classFilter) params.lopHocId = Number(classFilter);
    if (subjectFilter) params.monHocId = Number(subjectFilter);
    if (termFilter) params.hocKy = Number(termFilter);
    if (yearFilter.trim()) params.namHoc = yearFilter.trim();

    api
      .get<GradeRecord[]>("/academic/grades", { params })
      .then((response) => {
        if (active) {
          setGrades(response.data);
          setGradesError("");
        }
      })
      .catch((error: unknown) => {
        console.error("Không thể tải bảng điểm:", error);
        if (active) {
          setGradesError(responseError(error, "Không thể tải bảng điểm."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [classFilter, subjectFilter, termFilter, yearFilter, reloadToken]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingGradeId(null);
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormOpen(false);
  };

  const saveGrade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingGradeId === null && selectedClassHasNoStudents) {
      setErrorMessage(
        "Lớp này chưa có học viên. Hãy ghi danh học viên trước khi nhập điểm.",
      );
      return;
    }
    if (!form.lopHocId || !form.hocVienId || !form.monHocId) {
      setErrorMessage("Vui lòng chọn lớp, học viên và môn học.");
      return;
    }
    const parseScore = (value: string) =>
      value.trim() === "" ? null : Number(value);
    const payload = {
      lopHocId: form.lopHocId,
      hocVienId: form.hocVienId,
      monHocId: form.monHocId,
      hocKy: form.hocKy,
      namHoc: form.namHoc.trim(),
      diemQuaTrinh: parseScore(form.diemQuaTrinh),
      diemGiuaKy: parseScore(form.diemGiuaKy),
      diemCuoiKy: parseScore(form.diemCuoiKy),
    };

    try {
      setSaving(true);
      setErrorMessage("");
      if (editingGradeId !== null) {
        await api.put(`/academic/grades/${editingGradeId}`, payload);
        setSuccessMessage("Cập nhật bảng điểm thành công.");
      } else {
        await api.post("/academic/grades", payload);
        setSuccessMessage("Lưu bảng điểm thành công.");
      }
      setForm(EMPTY_FORM);
      setEditingGradeId(null);
      setIsFormOpen(false);
      setLoading(true);
      setReloadToken((current) => current + 1);
    } catch (error: unknown) {
      console.error("Không thể lưu bảng điểm:", error);
      setErrorMessage(responseError(error, "Không thể lưu bảng điểm."));
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (grade: GradeRecord) => {
    setForm({
      lopHocId: grade.lopHocId,
      hocVienId: grade.hocVienId,
      monHocId: grade.monHocId,
      hocKy: grade.hocKy,
      namHoc: grade.namHoc,
      diemQuaTrinh: grade.diemQuaTrinh?.toString() ?? "",
      diemGiuaKy: grade.diemGiuaKy?.toString() ?? "",
      diemCuoiKy: grade.diemCuoiKy?.toString() ?? "",
    });
    setEditingGradeId(grade.diemId);
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormOpen(true);
  };

  const removeGrade = async (grade: GradeRecord) => {
    if (
      !window.confirm(
        `Bạn có chắc muốn xóa bảng điểm của ${grade.hocVienTen} môn ${grade.tenMonHoc}?`,
      )
    ) {
      return;
    }
    try {
      setErrorMessage("");
      setSuccessMessage("");
      await api.delete(`/academic/grades/${grade.diemId}`);
      setSuccessMessage("Đã xóa bảng điểm.");
      setLoading(true);
      setReloadToken((current) => current + 1);
    } catch (error: unknown) {
      console.error("Không thể xóa bảng điểm:", error);
      setErrorMessage(responseError(error, "Không thể xóa bảng điểm."));
    }
  };

  const availableSubjects = classFilter
    ? classes.find((item) => item.lopHocId === Number(classFilter))?.monHocs ?? []
    : classes.flatMap((item) => item.monHocs);
  const uniqueSubjects = Array.from(
    new Map(availableSubjects.map((item) => [item.monHocId, item])).values(),
  );
  const visibleError =
    optionsError || gradesError || (isFormOpen ? "" : errorMessage);

  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setEditingGradeId(null);
    setErrorMessage("");
    setSuccessMessage("");
    setIsFormOpen(true);
  };

  return (
    <section className="academic-page">
      {successMessage && (
        <ToastNotification
          type="success"
          text={successMessage}
          onClose={() => setSuccessMessage("")}
        />
      )}
      <header className="academic-page-banner">
        <div className="academic-banner-content">
          <div className="academic-banner-label">
            <span aria-hidden="true">🎓</span>
            ĐÀO TẠO
          </div>
          <h1>{canCreate || canUpdate ? "Quản lý điểm" : "Kết quả học tập"}</h1>
          <p>
            {canUpdate
              ? "Quản lý điểm theo lớp, môn học và học kỳ."
              : "Kết quả học tập theo lớp, môn học và học kỳ."}
          </p>
        </div>
        <div className="academic-banner-stat">
          <strong>{grades.length}</strong>
          <span>Bảng điểm</span>
        </div>
      </header>

      {visibleError && (
        <div
          className="academic-alert academic-alert-error"
          role="alert"
        >
          {visibleError}
        </div>
      )}

      {isFormOpen &&
        createPortal(
          <div
            className="academic-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) resetForm();
            }}
          >
            <form
              className="academic-modal grade-entry-modal"
              onSubmit={saveGrade}
            >
              <div className="academic-modal-heading">
                <div>
                  <h3>
                    {editingGradeId === null ? "Nhập điểm" : "Cập nhật điểm"}
                  </h3>
                  <p>
                    Điểm được nhập theo thang 0–10, tối đa hai chữ số thập
                    phân.
                  </p>
                </div>
                <button
                  type="button"
                  className="academic-modal-close"
                  onClick={resetForm}
                  disabled={saving}
                  aria-label="Đóng"
                >
                  ×
                </button>
              </div>
              {errorMessage && (
                <div
                  className="academic-alert academic-alert-error"
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}
              <div className="academic-form-grid">
            <label>
              Lớp
              <select
                required
                value={form.lopHocId || ""}
                disabled={editingGradeId !== null}
                onChange={(event) => {
                  const nextClass = classes.find(
                    (item) => item.lopHocId === Number(event.target.value),
                  );
                  setForm((current) => ({
                    ...current,
                    lopHocId: nextClass?.lopHocId ?? 0,
                    hocVienId: nextClass?.hocViens[0]?.nguoiDungId ?? 0,
                    monHocId: nextClass?.monHocs[0]?.monHocId ?? 0,
                  }));
                }}
              >
                <option value="">Chọn lớp</option>
                {classes.map((item) => (
                  <option key={item.lopHocId} value={item.lopHocId}>
                    {item.maLop} — {item.tenLop}
                  </option>
                ))}
              </select>
            </label>
            <div className="academic-student-field">
              <span className="academic-field-label">Học viên</span>
              <details
                className="academic-multi-select"
                ref={studentPickerRef}
              >
                <summary>
                  {form.hocVienId ? "Đã chọn 1 học viên" : "Chọn học viên"}
                  <span aria-hidden="true">▾</span>
                </summary>
                <div className="academic-student-picker academic-subject-picker">
                  {!selectedClass || selectedClass.hocViens.length === 0 ? (
                    <span className="academic-empty-options">
                      Chưa có học viên trong lớp.
                    </span>
                  ) : (
                    selectedClass.hocViens.map((student) => (
                      <label
                        className="academic-student-option"
                        key={student.nguoiDungId}
                      >
                        <input
                          type="checkbox"
                          checked={form.hocVienId === student.nguoiDungId}
                          disabled={editingGradeId !== null}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              hocVienId: event.target.checked
                                ? student.nguoiDungId
                                : 0,
                            }))
                          }
                        />
                        <span>{student.hoTen}</span>
                      </label>
                    ))
                  )}
                </div>
              </details>
              {selectedClassHasNoStudents && (
                <small className="academic-empty-options" role="status">
                  Ghi danh học viên vào lớp trước khi nhập điểm.
                </small>
              )}
            </div>
            <label>
              Môn học
              <select
                required
                value={form.monHocId || ""}
                disabled={editingGradeId !== null}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    monHocId: Number(event.target.value),
                  }))
                }
              >
                <option value="">Chọn môn học</option>
                {selectedClass?.monHocs.map((subject) => (
                  <option key={subject.monHocId} value={subject.monHocId}>
                    {subject.maMonHoc} — {subject.tenMonHoc}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Học kỳ
              <select
                value={form.hocKy}
                disabled={editingGradeId !== null}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    hocKy: Number(event.target.value),
                  }))
                }
              >
                <option value={1}>Học kỳ 1</option>
                <option value={2}>Học kỳ 2</option>
                <option value={3}>Học kỳ 3</option>
              </select>
            </label>
            <label>
              Năm học
              <input
                required
                pattern="\d{4}-\d{4}"
                placeholder="2025-2026"
                value={form.namHoc}
                disabled={editingGradeId !== null}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    namHoc: event.target.value,
                  }))
                }
              />
            </label>
            {(
              [
                ["diemQuaTrinh", "Điểm quá trình"],
                ["diemGiuaKy", "Điểm giữa kỳ"],
                ["diemCuoiKy", "Điểm cuối kỳ"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  value={form[key]}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="academic-form-actions">
            <button
              className="academic-secondary-button"
              type="button"
              onClick={resetForm}
              disabled={saving}
            >
              Hủy
            </button>
            <button
              className="academic-primary-button"
              type="submit"
              disabled={
                saving ||
                (editingGradeId === null && !canCreate) ||
                (editingGradeId === null && selectedClassHasNoStudents) ||
                (editingGradeId !== null && !canUpdate)
              }
            >
              {saving ? "Đang lưu..." : "Lưu bảng điểm"}
            </button>
          </div>
            </form>
          </div>,
          document.body,
        )}

      <section className="academic-card">
        <div className="academic-card-heading">
          <div>
            <h2>Bảng điểm</h2>
            <p>{grades.length} kết quả phù hợp</p>
          </div>
          <div className="academic-row-actions">
          {canExportAttendance && (
            <button
              className="academic-secondary-button"
              type="button"
              onClick={() => {
                if (attendanceExportClass) {
                  onOpenAttendanceMatrix(attendanceExportClass.lopHocId);
                }
              }}
              disabled={!classFilter}
              title={
                classFilter
                  ? `Xem bảng chuyên cần lớp ${attendanceExportClass?.maLop ?? ""}`
                  : "Chọn một lớp để xem bảng chuyên cần."
              }
            >
              Chuyên cần
            </button>
          )}
          {canCreate && (
            <button
              className="academic-primary-button"
              type="button"
              onClick={openCreateForm}
            >
              + Nhập điểm
            </button>
          )}
          </div>
        </div>
        <div className="academic-filters">
          <label>
            Lớp
            <select
              value={classFilter}
              onChange={(event) => {
                setLoading(true);
                setClassFilter(event.target.value);
                setSubjectFilter("");
              }}
            >
              <option value="">Tất cả lớp được phép xem</option>
              {classes.map((item) => (
                <option key={item.lopHocId} value={item.lopHocId}>
                  {item.maLop} — {item.tenLop}
                </option>
              ))}
            </select>
          </label>
          <label>
            Môn học
            <select
              value={subjectFilter}
              onChange={(event) => {
                setLoading(true);
                setSubjectFilter(event.target.value);
              }}
            >
              <option value="">Tất cả môn học</option>
              {uniqueSubjects.map((subject) => (
                <option key={subject.monHocId} value={subject.monHocId}>
                  {subject.maMonHoc} — {subject.tenMonHoc}
                </option>
              ))}
            </select>
          </label>
          <label>
            Học kỳ
            <select
              value={termFilter}
              onChange={(event) => {
                setLoading(true);
                setTermFilter(event.target.value);
              }}
            >
              <option value="">Tất cả học kỳ</option>
              <option value="1">Học kỳ 1</option>
              <option value="2">Học kỳ 2</option>
              <option value="3">Học kỳ 3</option>
            </select>
          </label>
          <label>
            Năm học
            <input
              placeholder="Ví dụ: 2025-2026"
              value={yearFilter}
              onChange={(event) => {
                setLoading(true);
                setYearFilter(event.target.value);
              }}
            />
          </label>
        </div>
        <div className="academic-table-wrap">
          <table className="academic-table">
            <thead>
              <tr>
                <th>Học viên</th>
                <th>Lớp</th>
                <th>Môn học</th>
                <th>Học kỳ</th>
                <th>Quá trình</th>
                <th>Giữa kỳ</th>
                <th>Cuối kỳ</th>
                {(canUpdate || canDelete) && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>Đang tải bảng điểm...</td>
                </tr>
              ) : grades.length === 0 ? (
                <tr>
                  <td colSpan={8}>Chưa có dữ liệu điểm phù hợp.</td>
                </tr>
              ) : (
                grades.map((grade) => (
                  <tr key={grade.diemId}>
                    <td>{grade.hocVienTen}</td>
                    <td>{grade.maLop}</td>
                    <td>
                      <strong>{grade.maMonHoc}</strong>
                      <span className="academic-cell-subtitle">
                        {grade.tenMonHoc}
                      </span>
                    </td>
                    <td>
                      HK{grade.hocKy}
                      <span className="academic-cell-subtitle">
                        {grade.namHoc}
                      </span>
                    </td>
                    <td>{formatScore(grade.diemQuaTrinh)}</td>
                    <td>{formatScore(grade.diemGiuaKy)}</td>
                    <td>{formatScore(grade.diemCuoiKy)}</td>
                    {(canUpdate || canDelete) && (
                      <td className="academic-row-actions">
                        {canUpdate && (
                          <button
                            className="academic-text-button"
                            type="button"
                            onClick={() => startEditing(grade)}
                          >
                            Sửa
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="academic-danger-button"
                            type="button"
                            onClick={() => void removeGrade(grade)}
                          >
                            Xóa
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};

export default GradeManagement;
