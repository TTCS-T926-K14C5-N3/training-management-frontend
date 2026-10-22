import React, { useCallback, useEffect, useMemo, useState } from "react";
import SearchableSelect from "../components/SearchableSelect";
import api from "../services/api";
import "./AcademicManagement.css";

interface ClassRecord {
  lopHocId: number;
  maLop: string;
  tenLop: string;
  namHoc: string;
  giangVienId: number | null;
  giangVienTen: string | null;
  canBanGiao: boolean;
  trangThai: string;
  hocVienIds: number[];
  monHocIds: number[];
  chuongTrinhId: number | null;
}

interface ClassForm {
  maLop: string;
  tenLop: string;
  namHoc: string;
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

interface GradeClassOption {
  lopHocId: number;
  maLop: string;
  tenLop: string;
  hocViens: Array<{ nguoiDungId: number; hoTen: string; email: string }>;
  monHocs: Array<{ monHocId: number; maMonHoc: string; tenMonHoc: string }>;
}

interface GradeOptionsResponse {
  classes: GradeClassOption[];
}

interface GradeForm {
  lopHocId: string;
  hocVienId: string;
  monHocId: string;
  hocKy: string;
  namHoc: string;
  diemQuaTrinh: string;
  diemGiuaKy: string;
  diemCuoiKy: string;
}

const emptyGradeForm: GradeForm = {
  lopHocId: "",
  hocVienId: "",
  monHocId: "",
  hocKy: "1",
  namHoc: "",
  diemQuaTrinh: "",
  diemGiuaKy: "",
  diemCuoiKy: "",
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = error.response;
    if (
      typeof response === "object" &&
      response !== null &&
      "data" in response
    ) {
      const data = response.data;
      if (
        typeof data === "object" &&
        data !== null &&
        "detail" in data &&
        typeof data.detail === "string"
      ) {
        return data.detail;
      }
    }
  }
  return fallback;
}

function AcademicPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="academic-page-header">
      <div>
        <div className="academic-breadcrumb">Quản lý <span>/</span> {title}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ClassManagementPage() {
  const storedUser = JSON.parse(localStorage.getItem("user") || "null");
  const permissions: string[] = Array.isArray(storedUser?.quyen)
    ? storedUser.quyen.map((permission: { maQuyen: string }) => permission.maQuyen)
    : [];
  const isAdmin = Array.isArray(storedUser?.vaiTro) && storedUser.vaiTro.some(
    (role: { tenVaiTro?: string; vaiTroId?: number }) =>
      role.vaiTroId === 8 ||
      role.tenVaiTro?.trim().toLowerCase() === "admin" ||
      role.tenVaiTro?.trim().toLowerCase() === "quản trị hệ thống",
  );
  const canCreate = isAdmin || permissions.includes("CLASS_CREATE");
  const canUpdate = isAdmin || permissions.includes("CLASS_UPDATE");
  const canDelete = isAdmin || permissions.includes("CLASS_DELETE");

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRecord | null>(null);
  const [form, setForm] = useState<ClassForm>({
    maLop: "",
    tenLop: "",
    namHoc: "",
  });

  const loadClasses = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get<ClassRecord[]>("/academic/classes", {
        params: { include_inactive: includeInactive },
      });
      setClasses(response.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Không thể tải danh sách lớp."));
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const openForm = (record?: ClassRecord) => {
    setEditingClass(record ?? null);
    setForm({
      maLop: record?.maLop ?? "",
      tenLop: record?.tenLop ?? "",
      namHoc: record?.namHoc ?? "",
    });
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditingClass(null);
  };

  const saveClass = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const payload = {
        maLop: form.maLop.trim(),
        tenLop: form.tenLop.trim(),
        namHoc: form.namHoc.trim(),
        chuongTrinhId: editingClass?.chuongTrinhId ?? null,
        giangVienId: editingClass?.giangVienId ?? null,
        hocVienIds: editingClass?.hocVienIds ?? [],
        monHocIds: editingClass?.monHocIds ?? [],
      };
      if (editingClass) {
        await api.put(`/academic/classes/${editingClass.lopHocId}`, payload);
      } else {
        await api.post("/academic/classes", payload);
      }
      setShowForm(false);
      setEditingClass(null);
      await loadClasses();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Không thể lưu thông tin lớp."));
    } finally {
      setSaving(false);
    }
  };

  const archiveClass = async (record: ClassRecord) => {
    if (!window.confirm(`Ngừng hoạt động lớp ${record.maLop}?`)) return;
    try {
      setError("");
      await api.delete(`/academic/classes/${record.lopHocId}`);
      await loadClasses();
    } catch (archiveError) {
      setError(getErrorMessage(archiveError, "Không thể lưu trữ lớp."));
    }
  };

  return (
    <div className="academic-page">
      <AcademicPageHeader
        title="Quản lý lớp"
        description="Tạo, cập nhật và theo dõi trạng thái các lớp học."
        action={canCreate && (
          <button className="academic-primary-button" onClick={() => openForm()}>
            + Tạo lớp
          </button>
        )}
      />

      {error && <div className="academic-alert academic-alert-error" role="alert">{error}</div>}

      <div className="academic-toolbar">
        <label className="academic-check">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Hiển thị lớp đã ngừng hoạt động
        </label>
        <button className="academic-secondary-button" onClick={() => void loadClasses()}>
          Làm mới
        </button>
      </div>

      <div className="academic-table-card">
        {loading ? (
          <div className="academic-state">Đang tải danh sách lớp...</div>
        ) : classes.length === 0 ? (
          <div className="academic-state">Chưa có lớp học phù hợp.</div>
        ) : (
          <div className="academic-table-scroll">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Mã lớp</th>
                  <th>Tên lớp</th>
                  <th>Năm học</th>
                  <th>Giảng viên</th>
                  <th>Sĩ số</th>
                  <th>Trạng thái</th>
                  {(canUpdate || canDelete) && <th>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {classes.map((record) => (
                  <tr key={record.lopHocId}>
                    <td><strong>{record.maLop}</strong></td>
                    <td>{record.tenLop}</td>
                    <td>{record.namHoc}</td>
                    <td>{record.giangVienTen || "Chưa phân công"}</td>
                    <td>{record.hocVienIds.length}</td>
                    <td>
                      <span className={`academic-status ${record.trangThai === "Đang hoạt động" ? "academic-status-active" : "academic-status-inactive"}`}>
                        {record.trangThai}
                      </span>
                    </td>
                    {(canUpdate || canDelete) && (
                      <td>
                        <div className="academic-actions">
                          {canUpdate && record.trangThai === "Đang hoạt động" && (
                            <button className="academic-link-button" onClick={() => openForm(record)}>
                              Sửa
                            </button>
                          )}
                          {canDelete && record.trangThai === "Đang hoạt động" && (
                            <button className="academic-danger-button" onClick={() => void archiveClass(record)}>
                              Ngừng hoạt động
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="academic-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm();
        }}>
          <form className="academic-modal" onSubmit={saveClass}>
            <div className="academic-modal-heading">
              <div>
                <h3>{editingClass ? "Cập nhật lớp học" : "Tạo lớp học"}</h3>
                <p>Nhập mã lớp, tên lớp và năm học theo định dạng YYYY-YYYY.</p>
              </div>
              <button type="button" className="academic-modal-close" onClick={closeForm} disabled={saving}>×</button>
            </div>
            {error && <div className="academic-alert academic-alert-error" role="alert">{error}</div>}
            <label className="academic-field">
              Mã lớp
              <input
                required
                maxLength={30}
                value={form.maLop}
                onChange={(event) => setForm({ ...form, maLop: event.target.value })}
                disabled={saving}
              />
            </label>
            <label className="academic-field">
              Tên lớp
              <input
                required
                maxLength={150}
                value={form.tenLop}
                onChange={(event) => setForm({ ...form, tenLop: event.target.value })}
                disabled={saving}
              />
            </label>
            <label className="academic-field">
              Năm học
              <input
                required
                minLength={9}
                maxLength={9}
                pattern="[0-9]{4}-[0-9]{4}"
                placeholder="2026-2027"
                value={form.namHoc}
                onChange={(event) => setForm({ ...form, namHoc: event.target.value })}
                disabled={saving}
              />
            </label>
            <div className="academic-modal-actions">
              <button type="button" className="academic-secondary-button" onClick={closeForm} disabled={saving}>Hủy</button>
              <button className="academic-primary-button" type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu lớp"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function GradeManagementPage() {
  const storedUser = JSON.parse(localStorage.getItem("user") || "null");
  const permissions: string[] = Array.isArray(storedUser?.quyen)
    ? storedUser.quyen.map((permission: { maQuyen: string }) => permission.maQuyen)
    : [];
  const isAdmin = Array.isArray(storedUser?.vaiTro) && storedUser.vaiTro.some(
    (role: { tenVaiTro?: string; vaiTroId?: number }) =>
      role.vaiTroId === 8 ||
      role.tenVaiTro?.trim().toLowerCase() === "admin" ||
      role.tenVaiTro?.trim().toLowerCase() === "quản trị hệ thống",
  );
  const canCreate = isAdmin || permissions.includes("GRADE_CREATE");
  const canUpdate = isAdmin || permissions.includes("GRADE_UPDATE");
  const canDelete = isAdmin || permissions.includes("GRADE_DELETE");

  const [options, setOptions] = useState<GradeOptionsResponse>({ classes: [] });
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeRecord | null>(null);
  const [form, setForm] = useState<GradeForm>(emptyGradeForm);
  const [filterClassId, setFilterClassId] = useState("");

  const selectedClass = options.classes.find(
    (classOption) => String(classOption.lopHocId) === form.lopHocId,
  );
  const availableSubjects = selectedClass?.monHocs ?? [];
  const availableStudents = selectedClass?.hocViens ?? [];
  const allSubjects = useMemo(() => {
    const subjectMap = new Map<number, GradeClassOption["monHocs"][number]>();
    options.classes.forEach((classOption) => {
      classOption.monHocs.forEach((subject) => subjectMap.set(subject.monHocId, subject));
    });
    return [...subjectMap.values()];
  }, [options.classes]);

  const loadOptions = useCallback(async () => {
    try {
      const response = await api.get<GradeOptionsResponse>("/academic/grade-options");
      setOptions(response.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Không thể tải danh sách lớp, môn học và học viên."));
    }
  }, []);

  const loadGrades = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get<GradeRecord[]>("/academic/grades", {
        params: {
          lopHocId: filterClassId || undefined,
        },
      });
      setGrades(response.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Không thể tải bảng điểm."));
    } finally {
      setLoading(false);
    }
  }, [filterClassId]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadGrades();
  }, [loadGrades]);

  const openForm = (record?: GradeRecord) => {
    setEditingGrade(record ?? null);
    setForm(record ? {
      lopHocId: String(record.lopHocId),
      hocVienId: String(record.hocVienId),
      monHocId: String(record.monHocId),
      hocKy: String(record.hocKy),
      namHoc: record.namHoc,
      diemQuaTrinh: record.diemQuaTrinh === null ? "" : String(record.diemQuaTrinh),
      diemGiuaKy: record.diemGiuaKy === null ? "" : String(record.diemGiuaKy),
      diemCuoiKy: record.diemCuoiKy === null ? "" : String(record.diemCuoiKy),
    } : emptyGradeForm);
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditingGrade(null);
  };

  const saveGrade = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const numberOrNull = (value: string) => value === "" ? null : Number(value);
      const payload = {
        lopHocId: Number(form.lopHocId),
        hocVienId: Number(form.hocVienId),
        monHocId: Number(form.monHocId),
        hocKy: Number(form.hocKy),
        namHoc: form.namHoc.trim(),
        diemQuaTrinh: numberOrNull(form.diemQuaTrinh),
        diemGiuaKy: numberOrNull(form.diemGiuaKy),
        diemCuoiKy: numberOrNull(form.diemCuoiKy),
      };
      if (editingGrade) {
        await api.put(`/academic/grades/${editingGrade.diemId}`, payload);
      } else {
        await api.post("/academic/grades", payload);
      }
      setShowForm(false);
      setEditingGrade(null);
      await loadGrades();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Không thể lưu bảng điểm."));
    } finally {
      setSaving(false);
    }
  };

  const deleteGrade = async (record: GradeRecord) => {
    if (!window.confirm(`Xóa bảng điểm của ${record.hocVienTen} môn ${record.tenMonHoc}?`)) return;
    try {
      setError("");
      await api.delete(`/academic/grades/${record.diemId}`);
      await loadGrades();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Không thể xóa bảng điểm."));
    }
  };

  return (
    <div className="academic-page">
      <AcademicPageHeader
        title="Quản lý điểm"
        description="Tra cứu, nhập và cập nhật điểm học tập theo lớp, môn và học kỳ."
        action={canCreate && (
          <button className="academic-primary-button" onClick={() => openForm()}>
            + Nhập điểm
          </button>
        )}
      />

      {error && <div className="academic-alert academic-alert-error" role="alert">{error}</div>}

      <div className="academic-toolbar">
        <label className="academic-filter-field">
          Lớp học
          <SearchableSelect value={filterClassId} onChange={(event) => setFilterClassId(event.target.value)}>
            <option value="">Tất cả lớp</option>
            {options.classes.map((classOption) => (
              <option key={classOption.lopHocId} value={classOption.lopHocId}>
                {classOption.maLop} — {classOption.tenLop}
              </option>
            ))}
          </SearchableSelect>
        </label>
        <button className="academic-secondary-button" onClick={() => void loadGrades()}>
          Làm mới
        </button>
      </div>

      <div className="academic-table-card">
        {loading ? (
          <div className="academic-state">Đang tải bảng điểm...</div>
        ) : grades.length === 0 ? (
          <div className="academic-state">Chưa có dữ liệu điểm phù hợp.</div>
        ) : (
          <div className="academic-table-scroll">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Lớp</th>
                  <th>Môn học</th>
                  <th>Học kỳ</th>
                  <th>Năm học</th>
                  <th>Quá trình</th>
                  <th>Giữa kỳ</th>
                  <th>Cuối kỳ</th>
                  {(canUpdate || canDelete) && <th>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {grades.map((record) => (
                  <tr key={record.diemId}>
                    <td><strong>{record.hocVienTen}</strong></td>
                    <td>{record.maLop}</td>
                    <td>{record.maMonHoc} — {record.tenMonHoc}</td>
                    <td>{record.hocKy}</td>
                    <td>{record.namHoc}</td>
                    <td>{record.diemQuaTrinh ?? "—"}</td>
                    <td>{record.diemGiuaKy ?? "—"}</td>
                    <td>{record.diemCuoiKy ?? "—"}</td>
                    {(canUpdate || canDelete) && (
                      <td>
                        <div className="academic-actions">
                          {canUpdate && (
                            <button className="academic-link-button" onClick={() => openForm(record)}>
                              Sửa điểm
                            </button>
                          )}
                          {canDelete && (
                            <button className="academic-danger-button" onClick={() => void deleteGrade(record)}>
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="academic-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm();
        }}>
          <form className="academic-modal" onSubmit={saveGrade}>
            <div className="academic-modal-heading">
              <div>
                <h3>{editingGrade ? "Cập nhật điểm" : "Nhập điểm"}</h3>
                <p>Điểm số nằm trong khoảng 0–10; có thể để trống nếu chưa có điểm.</p>
              </div>
              <button type="button" className="academic-modal-close" onClick={closeForm} disabled={saving}>×</button>
            </div>
            {error && <div className="academic-alert academic-alert-error" role="alert">{error}</div>}
            <label className="academic-field">
              Lớp học
              <SearchableSelect
                required
                value={form.lopHocId}
                disabled={saving || Boolean(editingGrade)}
                onChange={(event) => setForm({
                  ...form,
                  lopHocId: event.target.value,
                  hocVienId: "",
                  monHocId: "",
                })}
              >
                <option value="">Chọn lớp</option>
                {options.classes.map((classOption) => (
                  <option key={classOption.lopHocId} value={classOption.lopHocId}>
                    {classOption.maLop} — {classOption.tenLop}
                  </option>
                ))}
              </SearchableSelect>
            </label>
            <label className="academic-field">
              Học viên
              <SearchableSelect required value={form.hocVienId} disabled={saving || Boolean(editingGrade)} onChange={(event) => setForm({ ...form, hocVienId: event.target.value })}>
                <option value="">Chọn học viên</option>
                {availableStudents.map((student) => (
                  <option key={student.nguoiDungId} value={student.nguoiDungId}>{student.hoTen} ({student.email})</option>
                ))}
              </SearchableSelect>
            </label>
            <label className="academic-field">
              Môn học
              <SearchableSelect required value={form.monHocId} disabled={saving || Boolean(editingGrade)} onChange={(event) => setForm({ ...form, monHocId: event.target.value })}>
                <option value="">Chọn môn học</option>
                {availableSubjects.map((subject) => (
                  <option key={subject.monHocId} value={subject.monHocId}>{subject.maMonHoc} — {subject.tenMonHoc}</option>
                ))}
              </SearchableSelect>
            </label>
            <div className="academic-form-grid">
              <label className="academic-field">
                Học kỳ
                <SearchableSelect required value={form.hocKy} disabled={saving || Boolean(editingGrade)} onChange={(event) => setForm({ ...form, hocKy: event.target.value })}>
                  <option value="1">Học kỳ 1</option>
                  <option value="2">Học kỳ 2</option>
                  <option value="3">Học kỳ 3</option>
                </SearchableSelect>
              </label>
              <label className="academic-field">
                Năm học
                <input
                  required
                  minLength={9}
                  maxLength={9}
                  pattern="[0-9]{4}-[0-9]{4}"
                  placeholder="2026-2027"
                  value={form.namHoc}
                  disabled={saving || Boolean(editingGrade)}
                  onChange={(event) => setForm({ ...form, namHoc: event.target.value })}
                />
              </label>
            </div>
            <div className="academic-form-grid">
              {([
                ["diemQuaTrinh", "Điểm quá trình"],
                ["diemGiuaKy", "Điểm giữa kỳ"],
                ["diemCuoiKy", "Điểm cuối kỳ"],
              ] as const).map(([field, label]) => (
                <label className="academic-field" key={field}>
                  {label}
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    value={form[field]}
                    disabled={saving}
                    onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                  />
                </label>
              ))}
            </div>
            {allSubjects.length === 0 && options.classes.length > 0 && (
              <p className="academic-form-note">Các lớp được phân quyền chưa có môn học để nhập điểm.</p>
            )}
            <div className="academic-modal-actions">
              <button type="button" className="academic-secondary-button" onClick={closeForm} disabled={saving}>Hủy</button>
              <button className="academic-primary-button" type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu điểm"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
