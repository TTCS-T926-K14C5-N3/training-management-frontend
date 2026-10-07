import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import api from "../services/api";
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
  giangVienId: number | null;
  giangVienTen: string | null;
  trangThai: string;
  hocVienIds: number[];
  hocViens: UserOption[];
  monHocIds: number[];
  monHocs: SubjectOption[];
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
  giangVienId: number | "";
  hocVienIds: number[];
  monHocIds: number[];
}

interface ClassManagementProps {
  permissions: string[];
}

const EMPTY_FORM: ClassForm = {
  maLop: "",
  tenLop: "",
  namHoc: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
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

const ClassManagement: React.FC<ClassManagementProps> = ({ permissions }) => {
  const canUpdateClasses = permissions.includes("CLASS_UPDATE");
  const canCreateClasses = permissions.includes("CLASS_CREATE");
  const canDeleteClasses = permissions.includes("CLASS_DELETE");
  const canCreateSubjects = permissions.includes("CLASS_CREATE");
  const canManageRows = canUpdateClasses || canDeleteClasses;
  const [classes, setClasses] = useState<ClassRecord[]>([]);
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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
        if (active) {
          setClasses(classResponse.data);
          if (optionsResponse) setOptions(optionsResponse.data);
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
  }, [canUpdateClasses]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingClassId(null);
    setSuccessMessage("");
    setErrorMessage("");
  };

  const saveClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");
      const payload = {
        ...form,
        giangVienId: form.giangVienId === "" ? null : form.giangVienId,
      };
      if (editingClassId === null) {
        await api.post("/academic/classes", payload);
        setSuccessMessage("Đã tạo lớp học.");
      } else {
        await api.put(`/academic/classes/${editingClassId}`, payload);
        setSuccessMessage("Đã cập nhật lớp học.");
      }
      resetForm();
      setSuccessMessage(
        editingClassId === null ? "Đã tạo lớp học." : "Đã cập nhật lớp học.",
      );
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
      });
      setSubjectForm({ maMonHoc: "", tenMonHoc: "", soTinChi: "" });
      setSuccessMessage("Đã thêm môn học.");
      await loadData();
    } catch (error: unknown) {
      console.error("Không thể thêm môn học:", error);
      setErrorMessage(responseError(error, "Không thể thêm môn học."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="academic-page">
      <header className="academic-page-header">
        <div>
          <span className="academic-eyebrow">ĐÀO TẠO</span>
          <h1>{canUpdateClasses ? "Quản lý lớp" : "Xem lớp"}</h1>
          <p>
            {canUpdateClasses
              ? "Tổ chức lớp, phân công giảng viên, môn học và danh sách học viên."
              : "Danh sách lớp được phân công hoặc ghi danh cùng thông tin môn học."}
          </p>
        </div>
        {canCreateClasses && canUpdateClasses && editingClassId === null && (
          <button
            className="academic-primary-button"
            type="button"
            onClick={() => {
              resetForm();
              setForm(EMPTY_FORM);
            }}
          >
            + Tạo lớp
          </button>
        )}
      </header>

      {(errorMessage || successMessage) && (
        <div
          className={`academic-alert ${errorMessage ? "error" : "success"}`}
          role={errorMessage ? "alert" : "status"}
        >
          {errorMessage || successMessage}
        </div>
      )}

      {canUpdateClasses && (
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
              maxLength={100}
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
                  {teacher.hoTen} — {teacher.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            Học viên
            <select
              multiple
              value={form.hocVienIds.map(String)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  hocVienIds: Array.from(
                    event.currentTarget.selectedOptions,
                    (option) => Number(option.value),
                  ),
                }))
              }
            >
              {options.hocViens.map((student) => (
                <option key={student.nguoiDungId} value={student.nguoiDungId}>
                  {student.hoTen} — {student.email}
                </option>
              ))}
            </select>
            <small>Giữ Ctrl (Windows) để chọn nhiều học viên.</small>
          </label>
          <label>
            Môn học
            <select
              multiple
              value={form.monHocIds.map(String)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  monHocIds: Array.from(
                    event.currentTarget.selectedOptions,
                    (option) => Number(option.value),
                  ),
                }))
              }
            >
              {options.monHocs.map((subject) => (
                <option key={subject.monHocId} value={subject.monHocId}>
                  {subject.maMonHoc} — {subject.tenMonHoc}
                </option>
              ))}
            </select>
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

      <section className="academic-card">
        <div className="academic-card-heading">
          <div>
            <h2>Danh sách lớp</h2>
            <p>{classes.length} lớp trong hệ thống</p>
          </div>
        </div>
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
              ) : classes.length === 0 ? (
                <tr>
                  <td colSpan={canManageRows ? 7 : 6}>Chưa có lớp học.</td>
                </tr>
              ) : (
                classes.map((record) => (
                  <tr key={record.lopHocId}>
                    <td>
                      <strong>{record.maLop}</strong>
                      <span className="academic-cell-subtitle">
                        {record.tenLop}
                      </span>
                    </td>
                    <td>{record.namHoc}</td>
                    <td>{record.giangVienTen ?? "Chưa phân công"}</td>
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

      {canCreateSubjects && (
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
