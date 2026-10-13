import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import "./AcademicManagement.css";
import "./TrainingCatalog.css";

interface Subject {
  monHocId: number;
  maMonHoc: string;
  tenMonHoc: string;
  soBuoi: number;
  trongSo: number;
  moTaChuanDauRa: string | null;
  trangThai: string;
  daApDung: boolean;
}

interface TrainingCatalogProps {
  permissions: string[];
}

const EMPTY_SUBJECT = {
  maMonHoc: "",
  tenMonHoc: "",
  soBuoi: "",
  trongSo: "1",
  moTaChuanDauRa: "",
};

const errorMessage = (error: unknown, fallback: string): string => {
  if (
    axios.isAxiosError<{ detail?: unknown }>(error) &&
    typeof error.response?.data?.detail === "string"
  ) {
    return error.response.data.detail;
  }
  return fallback;
};

const TrainingCatalog: React.FC<TrainingCatalogProps> = ({ permissions }) => {
  const canCreate = permissions.includes("CURRICULUM_CREATE");
  const canUpdate = permissions.includes("CURRICULUM_UPDATE");
  const canDelete = permissions.includes("CURRICULUM_DELETE");
  const canManage = canCreate || canUpdate || canDelete;
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState(EMPTY_SUBJECT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadCatalog = useCallback(async () => {
    try {
      const response = await api.get<Subject[]>("/academic/subjects", {
        params: { include_inactive: true },
      });
      setSubjects(response.data);
      setError("");
    } catch (requestError: unknown) {
      console.error("Không thể tải danh mục đào tạo:", requestError);
      setError(errorMessage(requestError, "Không thể tải danh mục đào tạo."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api
      .get<Subject[]>("/academic/subjects", {
        params: { include_inactive: true },
      })
      .then((response) => {
        if (!active) return;
        setSubjects(response.data);
        setError("");
      })
      .catch((requestError: unknown) => {
        console.error("Không thể tải danh mục đào tạo:", requestError);
        if (active) {
          setError(
            errorMessage(requestError, "Không thể tải danh mục đào tạo."),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const resetSubjectForm = () => {
    setForm(EMPTY_SUBJECT);
    setEditingId(null);
  };

  const handleSaveSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      ...form,
      soBuoi: Number(form.soBuoi),
      trongSo: Number(form.trongSo),
      moTaChuanDauRa: form.moTaChuanDauRa || null,
      trangThai: "Đang hoạt động",
    };
    try {
      if (editingId) {
        await api.put(`/academic/subjects/${editingId}`, payload);
      } else {
        await api.post("/academic/subjects", payload);
      }
      resetSubjectForm();
      setNotice(editingId ? "Đã cập nhật môn học." : "Đã thêm môn học.");
      await loadCatalog();
    } catch (requestError: unknown) {
      console.error("Không thể lưu môn học:", requestError);
      setError(errorMessage(requestError, "Không thể lưu môn học."));
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveSubject = async (subject: Subject) => {
    if (!window.confirm(`Ngừng hoạt động môn học ${subject.tenMonHoc}?`)) return;
    setError("");
    try {
      await api.delete(`/academic/subjects/${subject.monHocId}`);
      setNotice("Đã ngừng hoạt động môn học.");
      await loadCatalog();
    } catch (requestError: unknown) {
      console.error("Không thể ngừng hoạt động môn học:", requestError);
      setError(errorMessage(requestError, "Không thể ngừng hoạt động môn học."));
    }
  };

  if (loading) {
    return <div className="academic-page">Đang tải danh mục đào tạo...</div>;
  }

  return (
    <div className="academic-page">
      {(notice || error) && (
        <ToastNotification
          type={notice ? "success" : "error"}
          text={notice || error}
          durationMs={3000}
          onClose={() => {
            setNotice("");
            setError("");
          }}
        />
      )}
      <header className="academic-page-banner">
        <div className="academic-banner-content">
          <div className="academic-banner-label">QUẢN LÝ ĐÀO TẠO</div>
          <h1>Danh mục môn học & lộ trình</h1>
          <p>Dùng lại môn học, sắp xếp lộ trình và khai báo từng buổi học.</p>
        </div>
        <div className="academic-banner-stat">
          <strong>{subjects.length}</strong>
          <span>Môn học</span>
        </div>
      </header>

      <section className="academic-card">
        <div className="academic-card-heading">
          <div>
            <h2>{editingId ? "Cập nhật môn học" : "Khai báo môn học"}</h2>
            <p>Thông tin được dùng lại trong nhiều chương trình đào tạo.</p>
          </div>
        </div>
        {canManage && (
          <form className="academic-form-grid" onSubmit={handleSaveSubject}>
            <label>
              Mã môn học *
              <input
                required
                maxLength={30}
                value={form.maMonHoc}
                onChange={(event) =>
                  setForm({ ...form, maMonHoc: event.target.value })
                }
              />
            </label>
            <label>
              Tên môn học *
              <input
                required
                maxLength={150}
                value={form.tenMonHoc}
                onChange={(event) =>
                  setForm({ ...form, tenMonHoc: event.target.value })
                }
              />
            </label>
            <label>
              Số buổi *
              <input
                required
                type="number"
                min="1"
                value={form.soBuoi}
                onChange={(event) =>
                  setForm({ ...form, soBuoi: event.target.value })
                }
              />
            </label>
            <label>
              Trọng số *
              <input
                required
                type="number"
                min="0.01"
                max="1"
                step="0.01"
                value={form.trongSo}
                onChange={(event) =>
                  setForm({ ...form, trongSo: event.target.value })
                }
              />
            </label>
            <label className="academic-wide-field">
              Mô tả chuẩn đầu ra
              <textarea
                maxLength={2000}
                value={form.moTaChuanDauRa}
                onChange={(event) =>
                  setForm({ ...form, moTaChuanDauRa: event.target.value })
                }
              />
            </label>
            <div className="academic-form-actions">
              <button type="submit" disabled={saving || (!editingId && !canCreate)}>
                {saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Thêm môn học"}
              </button>
              {editingId && (
                <button type="button" onClick={resetSubjectForm}>
                  Hủy sửa
                </button>
              )}
            </div>
          </form>
        )}
        <div className="academic-table-wrap">
          <table className="academic-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên môn học</th>
                <th>Buổi</th>
                <th>Trọng số</th>
                <th>Trạng thái</th>
                {(canUpdate || canDelete) && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject.monHocId}>
                  <td>{subject.maMonHoc}</td>
                  <td>
                    <strong>{subject.tenMonHoc}</strong>
                    {subject.moTaChuanDauRa && (
                      <small className="academic-muted">
                        {subject.moTaChuanDauRa}
                      </small>
                    )}
                  </td>
                  <td>{subject.soBuoi}</td>
                  <td>{subject.trongSo}</td>
                  <td>{subject.trangThai}</td>
                  {(canUpdate || canDelete) && (
                    <td>
                      <div className="academic-subject-actions">
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(subject.monHocId);
                              setForm({
                                maMonHoc: subject.maMonHoc,
                                tenMonHoc: subject.tenMonHoc,
                                soBuoi: String(subject.soBuoi),
                                trongSo: String(subject.trongSo),
                                moTaChuanDauRa: subject.moTaChuanDauRa || "",
                              });
                            }}
                          >
                            Sửa
                          </button>
                        )}
                        {canDelete &&
                          subject.trangThai === "Đang hoạt động" && (
                            <button
                              type="button"
                              onClick={() => void handleArchiveSubject(subject)}
                              disabled={subject.daApDung}
                              title={
                                subject.daApDung
                                  ? "Môn học đang được áp dụng trong chương trình đào tạo hoặc lớp học nên không thể ngừng hoạt động."
                                  : undefined
                              }
                            >
                              Ngừng
                            </button>
                          )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={6}>Chưa có môn học nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
};

export default TrainingCatalog;
