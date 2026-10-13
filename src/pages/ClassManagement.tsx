import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import "./AcademicManagement.css";

interface UserOption {
  nguoiDungId: number;
  hoTen: string;
  email: string;
}

interface SubjectOption {
  monHocId: number;
  maMonHoc: string;
  tenMonHoc: string;
  soTinChi: number | null;
}

interface ClassRecord {
  lopHocId: number;
  maLop: string;
  tenLop: string;
  namHoc: string;
  chuongTrinhId: number | null;
  maChuongTrinh: string | null;
  tenChuongTrinh: string | null;
  giangVienId: number | null;
  giangVienTen: string | null;
  canBanGiao: boolean;
  trangThai: string;
  hocVienIds: number[];
  hocViens: UserOption[];
  monHocIds: number[];
  monHocs: SubjectOption[];
}

interface TrainingProgram {
  chuongTrinhId: number;
  maChuongTrinh: string;
  tenChuongTrinh: string;
  moTa: string | null;
  tongThoiLuong: number;
  hocPhiChuan: number;
  trangThai: string;
  soLop: number;
}

interface ClassOptions {
  giangViens: UserOption[];
  hocViens: UserOption[];
  monHocs: SubjectOption[];
}

interface ClassForm {
  maLop: string;
  tenLop: string;
  namHoc: string;
  chuongTrinhId: number | "";
  giangVienId: number | "";
  hocVienIds: number[];
  monHocIds: number[];
}

interface ClassManagementProps {
  permissions: string[];
  listOnly?: boolean;
}

const EMPTY_FORM: ClassForm = {
  maLop: "",
  tenLop: "",
  namHoc: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  chuongTrinhId: "",
  giangVienId: "",
  hocVienIds: [],
  monHocIds: [],
};

const responseError = (error: unknown, fallback: string): string => {
  if (
    axios.isAxiosError<{ detail?: unknown }>(error) &&
    typeof error.response?.data?.detail === "string"
  ) {
    return error.response.data.detail;
  }
  return fallback;
};

const ClassManagement: React.FC<ClassManagementProps> = ({
  permissions,
  listOnly = false,
}) => {
  const studentPickerRef = useRef<HTMLDetailsElement>(null);
  const canUpdateClasses = permissions.includes("CLASS_UPDATE");
  const canDeleteClasses = permissions.includes("CLASS_DELETE");
  const canCreateSubjects = permissions.includes("CLASS_CREATE");
  const canManageRows = canUpdateClasses || canDeleteClasses;
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [trainingPrograms, setTrainingPrograms] = useState<TrainingProgram[]>([]);
  const [options, setOptions] = useState<ClassOptions>({
    giangViens: [],
    hocViens: [],
    monHocs: [],
  });
  const [form, setForm] = useState<ClassForm>(EMPTY_FORM);
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    maMonHoc: "",
    tenMonHoc: "",
    soTinChi: "",
    soBuoi: "1",
    trongSo: "1",
    moTaChuanDauRa: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filteredClasses = useMemo(() => {
    const searchTerm = classSearch.trim().toLocaleLowerCase("vi");
    return classes.filter((record) => {
      const matchesSearch =
        !searchTerm ||
        [
          record.maLop,
          record.tenLop,
          record.namHoc,
          record.giangVienTen ?? "",
          record.maChuongTrinh ?? "",
          record.tenChuongTrinh ?? "",
          ...record.monHocs.map((subject) => subject.tenMonHoc),
        ]
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(searchTerm);
      const matchesStatus = !statusFilter || record.trangThai === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [classSearch, classes, statusFilter]);

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

  const loadData = async () => {
    try {
      const classResponse = await api.get<ClassRecord[]>("/academic/classes", {
        params: { include_inactive: true },
      });
      setClasses(classResponse.data);
      if (canUpdateClasses) {
        const optionsResponse =
          await api.get<ClassOptions>("/academic/class-options");
        setOptions(optionsResponse.data);
      }
      const programResponse =
        await api.get<TrainingProgram[]>("/academic/programs");
      setTrainingPrograms(programResponse.data);
      setErrorMessage("");
    } catch (error: unknown) {
      console.error("Không thể tải dữ liệu quản lý lớp:", error);
      setErrorMessage(
        responseError(error, "Không thể tải danh sách lớp và danh mục đào tạo."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const initialLoad = async () => {
      try {
        const classResponse = await api.get<ClassRecord[]>("/academic/classes", {
          params: { include_inactive: true },
        });
        const optionsResponse = canUpdateClasses
          ? await api.get<ClassOptions>("/academic/class-options")
          : null;
        const programResponse =
          await api.get<TrainingProgram[]>("/academic/programs");
        if (active) {
          setClasses(classResponse.data);
          if (optionsResponse) setOptions(optionsResponse.data);
          setTrainingPrograms(programResponse.data);
          setErrorMessage("");
        }
      } catch (error: unknown) {
        console.error("Không thể tải dữ liệu quản lý lớp:", error);
        if (active) {
          setErrorMessage(
            responseError(
              error,
              "Không thể tải danh sách lớp và danh mục đào tạo.",
            ),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void initialLoad();
    return () => {
      active = false;
    };
  }, [canUpdateClasses, listOnly]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingClassId(null);
    setSuccessMessage("");
    setErrorMessage("");
  };

  const saveClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isEditing = editingClassId !== null;
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");
      const payload = {
        ...form,
        chuongTrinhId:
          form.chuongTrinhId === "" ? null : form.chuongTrinhId,
        giangVienId: form.giangVienId === "" ? null : form.giangVienId,
      };
      if (editingClassId === null) {
        await api.post("/academic/classes", payload);
      } else {
        await api.put(`/academic/classes/${editingClassId}`, payload);
      }
      resetForm();
      setSuccessMessage(isEditing ? "Đã cập nhật lớp học." : "Đã tạo lớp học.");
      await loadData();
    } catch (error: unknown) {
      console.error("Không thể lưu lớp học:", error);
      setErrorMessage(responseError(error, "Không thể lưu lớp học."));
    } finally {
      setSaving(false);
    }
  };

  const editClass = (record: ClassRecord) => {
    setForm({
      maLop: record.maLop,
      tenLop: record.tenLop,
      namHoc: record.namHoc,
      chuongTrinhId: record.chuongTrinhId ?? "",
      giangVienId: record.giangVienId ?? "",
      hocVienIds: record.hocVienIds,
      monHocIds: record.monHocIds,
    });
    setEditingClassId(record.lopHocId);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const archiveClass = async (record: ClassRecord) => {
    if (
      !window.confirm(
        `Ngừng hoạt động lớp ${record.maLop}? Thông tin lớp và điểm sẽ được giữ lại.`,
      )
    ) {
      return;
    }
    try {
      setErrorMessage("");
      setSuccessMessage("");
      await api.delete(`/academic/classes/${record.lopHocId}`);
      setSuccessMessage("Đã ngừng hoạt động lớp học.");
      await loadData();
    } catch (error: unknown) {
      console.error("Không thể lưu trữ lớp học:", error);
      setErrorMessage(responseError(error, "Không thể ngừng hoạt động lớp."));
    }
  };

  const saveSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");
      await api.post("/academic/subjects", {
        maMonHoc: subjectForm.maMonHoc,
        tenMonHoc: subjectForm.tenMonHoc,
        soTinChi: subjectForm.soTinChi ? Number(subjectForm.soTinChi) : null,
        soBuoi: Number(subjectForm.soBuoi),
        trongSo: Number(subjectForm.trongSo),
        moTaChuanDauRa: subjectForm.moTaChuanDauRa || null,
      });
      setSubjectForm({
        maMonHoc: "",
        tenMonHoc: "",
        soTinChi: "",
        soBuoi: "1",
        trongSo: "1",
        moTaChuanDauRa: "",
      });
      setSuccessMessage("Đã thêm môn học.");
      await loadData();
    } catch (error: unknown) {
      console.error("Không thể thêm môn học:", error);
      setErrorMessage(responseError(error, "Không thể thêm môn học."));
    } finally {
      setSaving(false);
    }
  };

  const selectedProgram = trainingPrograms.find(
    (program) => program.chuongTrinhId === form.chuongTrinhId,
  );

  return (
    <section className="academic-page">
      {(errorMessage || successMessage) && (
        <ToastNotification
          type={successMessage ? "success" : "error"}
          text={successMessage || errorMessage}
          durationMs={3000}
          onClose={() => {
            setSuccessMessage("");
            setErrorMessage("");
          }}
        />
      )}

      <header className="academic-page-banner">
        <div className="academic-banner-content">
          <div className="academic-banner-label">
            <span aria-hidden="true">🎓</span>
            ĐÀO TẠO
          </div>
          <h1>
            {listOnly
              ? "Danh sách lớp"
              : canUpdateClasses
                ? "Quản lý lớp"
                : "Xem lớp"}
          </h1>
          <p>
            {listOnly
              ? "Tìm kiếm và lọc lớp theo mã, tên, năm học, giảng viên hoặc môn học."
              : canUpdateClasses
              ? "Tổ chức lớp, phân công giảng viên, môn học và danh sách học viên."
              : "Danh sách lớp được phân công hoặc ghi danh cùng thông tin môn học."}
          </p>
        </div>
        <div className="academic-banner-stat">
          <strong>{classes.length}</strong>
          <span>Lớp học</span>
        </div>
      </header>

      {canUpdateClasses && (!listOnly || editingClassId !== null) && (
        <form className="academic-card academic-form" onSubmit={saveClass}>
        <div className="academic-card-heading">
          <div>
            <h2>{editingClassId === null ? "Thông tin lớp" : "Cập nhật lớp"}</h2>
            <p>Học viên và môn học chỉ được chọn từ danh mục đang hoạt động.</p>
          </div>
          {editingClassId !== null && (
            <button
              className="academic-secondary-button"
              type="button"
              onClick={resetForm}
            >
              Hủy chỉnh sửa
            </button>
          )}
        </div>
        <div className="academic-form-grid">
          <label>
            Chương trình đào tạo
            <select
              required={editingClassId === null}
              value={form.chuongTrinhId}
              onChange={(event) => {
                const programId = event.target.value
                  ? Number(event.target.value)
                  : "";
                const program = trainingPrograms.find(
                  (item) => item.chuongTrinhId === programId,
                );
                setForm((current) => ({
                  ...current,
                  chuongTrinhId: programId,
                  tenLop: program?.tenChuongTrinh ?? "",
                }));
              }}
            >
              <option value="">
                {editingClassId === null
                  ? "Chọn chương trình"
                  : "Không gắn chương trình"}
              </option>
              {trainingPrograms
                .filter(
                  (program) =>
                    program.trangThai === "Đang áp dụng" ||
                    program.chuongTrinhId === form.chuongTrinhId,
                )
                .map((program) => (
                  <option
                    key={program.chuongTrinhId}
                    value={program.chuongTrinhId}
                  >
                    {program.maChuongTrinh} — {program.tenChuongTrinh}
                    {program.trangThai !== "Đang áp dụng"
                      ? " (Ngừng áp dụng)"
                      : ""}
                  </option>
                ))}
            </select>
            {selectedProgram && (
              <small>
                {selectedProgram.tongThoiLuong} giờ · Học phí chuẩn{" "}
                {new Intl.NumberFormat("vi-VN").format(
                  selectedProgram.hocPhiChuan,
                )}{" "}
₫
              </small>
            )}
          </label>
          <label>
            Mã lớp
            <input
              required
              value={form.maLop}
              maxLength={30}
              onChange={(event) =>
                setForm((current) => ({ ...current, maLop: event.target.value }))
              }
            />
          </label>
          <label>
            Tên lớp
            <input
              required
              value={form.tenLop}
              maxLength={150}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  tenLop: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Năm học
            <input
              required
              pattern="\d{4}-\d{4}"
              placeholder="2025-2026"
              value={form.namHoc}
              onChange={(event) =>
                setForm((current) => ({ ...current, namHoc: event.target.value }))
              }
            />
          </label>
          <label>
            Giảng viên phụ trách
            <select
              value={form.giangVienId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  giangVienId: event.target.value
                    ? Number(event.target.value)
                    : "",
                }))
              }
            >
              <option value="">Chưa phân công</option>
              {options.giangViens.map((teacher) => (
                <option key={teacher.nguoiDungId} value={teacher.nguoiDungId}>
                  {teacher.hoTen}
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
                {form.hocVienIds.length === 0
                  ? "Chọn học viên"
                  : `Đã chọn ${form.hocVienIds.length} học viên`}
                <span aria-hidden="true">▾</span>
              </summary>
              <div className="academic-student-picker academic-subject-picker">
                {options.hocViens.length === 0 ? (
                  <span className="academic-empty-options">
                    Chưa có học viên đang hoạt động.
                  </span>
                ) : (
                  <>
                    <label className="academic-student-option academic-select-all">
                      <input
                        type="checkbox"
                        checked={
                          options.hocViens.length > 0 &&
                          options.hocViens.every((student) =>
                            form.hocVienIds.includes(student.nguoiDungId),
                          )
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            hocVienIds: event.target.checked
                              ? options.hocViens.map(
                                  (student) => student.nguoiDungId,
                                )
                              : [],
                          }))
                        }
                      />
                      <span>Chọn tất cả học viên</span>
                    </label>
                    {options.hocViens.map((student) => (
                      <label
                        className="academic-student-option"
                        key={student.nguoiDungId}
                      >
                        <input
                          type="checkbox"
                          checked={form.hocVienIds.includes(student.nguoiDungId)}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              hocVienIds: event.target.checked
                                ? [...current.hocVienIds, student.nguoiDungId]
                                : current.hocVienIds.filter(
                                    (id) => id !== student.nguoiDungId,
                                  ),
                            }))
                          }
                        />
                        <span>{student.hoTen}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
            </details>
          </div>
          <label>
            Môn học
            <select
              value={
                form.monHocIds.length === 1 ? form.monHocIds[0] : ""
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  monHocIds: event.target.value
                    ? [Number(event.target.value)]
                    : [],
                }))
              }
            >
              <option value="">Chọn môn học</option>
              {options.monHocs.map((subject) => (
                <option key={subject.monHocId} value={subject.monHocId}>
                  {subject.maMonHoc} — {subject.tenMonHoc}
                </option>
              ))}
            </select>
            {form.monHocIds.length > 1 && (
              <small>
                Lớp hiện có nhiều môn. Chọn một môn để thay thế danh sách hiện
                tại khi lưu.
              </small>
            )}
          </label>
        </div>
        <div className="academic-form-actions">
          <button
            className="academic-primary-button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Đang lưu..."
              : editingClassId === null
                ? "Tạo lớp"
                : "Lưu thay đổi"}
          </button>
        </div>
        </form>
      )}

      {listOnly && (
      <section className="academic-card">
        <div className="academic-card-heading">
          <div>
            <h2>Danh sách lớp</h2>
            <p>
              {listOnly
                ? `Hiển thị ${filteredClasses.length} / ${classes.length} lớp`
                : `${classes.length} lớp trong hệ thống`}
            </p>
          </div>
        </div>
        {listOnly && (
          <div className="academic-filters">
            <label>
              Tìm kiếm lớp
              <input
                type="search"
                value={classSearch}
                onChange={(event) => setClassSearch(event.target.value)}
                placeholder="Mã/tên lớp, năm học, giảng viên, môn học..."
              />
            </label>
            <label>
              Trạng thái
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="Đang hoạt động">Đang hoạt động</option>
                <option value="Ngừng hoạt động">Ngừng hoạt động</option>
              </select>
            </label>
          </div>
        )}
        <div className="academic-table-wrap">
          <table className="academic-table">
            <thead>
              <tr>
                <th>Mã / tên lớp</th>
                <th>Năm học</th>
                <th>Giảng viên</th>
                <th>Học viên</th>
                <th>Môn học</th>
                <th>Trạng thái</th>
                {canManageRows && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManageRows ? 7 : 6}>
                    Đang tải danh sách lớp...
                  </td>
                </tr>
              ) : filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={canManageRows && !listOnly ? 7 : 6}>
                    {classes.length === 0
                      ? "Chưa có lớp học."
                      : "Không tìm thấy lớp phù hợp."}
                  </td>
                </tr>
              ) : (
                filteredClasses.map((record) => (
                  <tr key={record.lopHocId}>
                    <td>
                      <strong>{record.maLop}</strong>
                      <span className="academic-cell-subtitle">
                        {record.tenLop}
                      </span>
                      {record.maChuongTrinh && (
                        <span className="academic-cell-subtitle">
                          Chương trình: {record.maChuongTrinh}
                        </span>
                      )}
                    </td>
                    <td>{record.namHoc}</td>
                    <td>
                      {record.giangVienTen ?? "Chưa phân công"}
                      {record.canBanGiao && (
                        <span className="academic-handover-warning">
                          Cần bàn giao
                        </span>
                      )}
                    </td>
                    <td>{record.hocViens.length}</td>
                    <td>
                      {record.monHocs.length
                        ? record.monHocs
                            .map((subject) => subject.tenMonHoc)
                            .join(", ")
                        : "Chưa gán môn"}
                    </td>
                    <td>
                      <span
                        className={`academic-status ${
                          record.trangThai === "Đang hoạt động"
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {record.trangThai}
                      </span>
                    </td>
                    {canManageRows && (
                      <td className="academic-row-actions">
                        {record.trangThai === "Đang hoạt động" && (
                          <>
                            {canUpdateClasses && (
                              <button
                                className="academic-text-button"
                                type="button"
                                onClick={() => editClass(record)}
                              >
                                Sửa
                              </button>
                            )}
                            {canDeleteClasses && (
                              <button
                                className="academic-danger-button"
                                type="button"
                                onClick={() => void archiveClass(record)}
                              >
                                Ngừng
                              </button>
                            )}
                          </>
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
      )}

      {!listOnly && canCreateSubjects && (
        <form className="academic-card academic-form" onSubmit={saveSubject}>
        <div className="academic-card-heading">
          <div>
            <h2>Thêm môn học</h2>
            <p>Môn học mới sẽ xuất hiện trong danh sách để gán vào lớp.</p>
          </div>
        </div>
        <div className="academic-form-grid subject-form-grid">
          <label>
            Mã môn
            <input
              required
              maxLength={30}
              value={subjectForm.maMonHoc}
              onChange={(event) =>
                setSubjectForm((current) => ({
                  ...current,
                  maMonHoc: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Tên môn học
            <input
              required
              maxLength={150}
              value={subjectForm.tenMonHoc}
              onChange={(event) =>
                setSubjectForm((current) => ({
                  ...current,
                  tenMonHoc: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Số tín chỉ
            <input
              type="number"
              min="1"
              max="30"
              value={subjectForm.soTinChi}
              onChange={(event) =>
                setSubjectForm((current) => ({
                  ...current,
                  soTinChi: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Số buổi học
            <input
              required
              type="number"
              min="1"
              max="100"
              value={subjectForm.soBuoi}
              onChange={(event) =>
                setSubjectForm((current) => ({
                  ...current,
                  soBuoi: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Trọng số (0-1)
            <input
              required
              type="number"
              min="0.01"
              max="1"
              step="0.01"
              value={subjectForm.trongSo}
              onChange={(event) =>
                setSubjectForm((current) => ({
                  ...current,
                  trongSo: event.target.value,
                }))
              }
            />
          </label>
          <label className="academic-wide-field">
            Mô tả chuẩn đầu ra
            <textarea
              maxLength={2000}
              value={subjectForm.moTaChuanDauRa}
              onChange={(event) =>
                setSubjectForm((current) => ({
                  ...current,
                  moTaChuanDauRa: event.target.value,
                }))
              }
            />
          </label>
          <div className="academic-form-actions">
            <button
              className="academic-primary-button"
              type="submit"
              disabled={saving}
            >
              Thêm môn học
            </button>
          </div>
        </div>
        </form>
      )}
    </section>
  );
};

export default ClassManagement;
