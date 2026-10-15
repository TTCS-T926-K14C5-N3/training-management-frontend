import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState(EMPTY_SUBJECT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState("Đang hoạt động");
  const [isFormOpen, setIsFormOpen] = useState(false);
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
    setEditingStatus("Đang hoạt động");
    setIsFormOpen(false);
  };

  const openCreateForm = () => {
    resetSubjectForm();
    setError("");
    setIsFormOpen(true);
  };

  const openEditForm = (subject: Subject) => {
    setEditingId(subject.monHocId);
    setEditingStatus(subject.trangThai);
    setForm({
      maMonHoc: subject.maMonHoc,
      tenMonHoc: subject.tenMonHoc,
      soBuoi: String(subject.soBuoi),
      trongSo: String(subject.trongSo),
      moTaChuanDauRa: subject.moTaChuanDauRa || "",
    });
    setError("");
    setIsFormOpen(true);
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
      trangThai: editingStatus,
    };
    try {
      if (editingId) {
        await api.put(`/academic/subjects/${editingId}`, payload);
      } else {
        await api.post("/academic/subjects", payload);
      }
      const wasEditing = editingId !== null;
      resetSubjectForm();
      setNotice(
        wasEditing ? "Đã cập nhật môn học." : "Thêm môn học thành công.",
      );
      await loadCatalog();
    } catch (requestError: unknown) {
      console.error("Không thể lưu môn học:", requestError);
      setError(errorMessage(requestError, "Không thể lưu môn học."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubjectStatus = async (subject: Subject) => {
    const isActive = subject.trangThai === "Đang hoạt động";
    const actionLabel = isActive ? "Ngừng" : "Áp dụng lại";
    if (!window.confirm(`${actionLabel} môn học ${subject.tenMonHoc}?`)) {
      return;
    }
    setError("");
    try {
      await api.post(
        `/academic/subjects/${subject.monHocId}/${
          isActive ? "archive" : "activate"
        }`,
      );
      setNotice(
        isActive
          ? `Môn học ${subject.tenMonHoc} đã ngừng hoạt động và không thể thêm mới vào chương trình.`
          : `Đã áp dụng lại môn học ${subject.tenMonHoc}; môn học có thể được thêm vào chương trình.`,
      );
      await loadCatalog();
    } catch (requestError: unknown) {
      console.error(
        `Không thể ${actionLabel.toLowerCase()} môn học:`,
        requestError,
      );
      setError(
        errorMessage(
          requestError,
          `Không thể ${actionLabel.toLowerCase()} môn học.`,
        ),
      );
    }
  };

  const handleDeleteSubject = async (subject: Subject) => {
    if (
      !window.confirm(
        `Xóa môn học ${subject.tenMonHoc} khỏi danh sách? Thao tác này không thể hoàn tác.`,
      )
    ) {
      return;
    }
    setError("");
    try {
      await api.delete(`/academic/subjects/${subject.monHocId}`);
      setNotice(`Đã xóa môn học ${subject.tenMonHoc}.`);
      await loadCatalog();
    } catch (requestError: unknown) {
      console.error("Không thể xóa môn học:", requestError);
      setError(errorMessage(requestError, "Không thể xóa môn học."));
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
            <h2>Danh sách môn học</h2>
            <p>Thông tin được dùng lại trong nhiều chương trình đào tạo.</p>
          </div>
          {canCreate && (
            <button
              type="button"
              className="academic-primary-button"
              onClick={openCreateForm}
            >
              + Thêm môn học
            </button>
          )}
        </div>
        {isFormOpen &&
          createPortal(
            <div
              className="academic-subject-modal-overlay"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !saving) {
                  resetSubjectForm();
                }
              }}
            >
              <form
                className="subject-modal-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="academic-subject-modal-title"
                onSubmit={handleSaveSubject}
              >
              <div className="subject-modal-header">
                <div>
                  <h3 id="academic-subject-modal-title">
                    {editingId ? "Cập nhật môn học" : "Thêm môn học"}
                  </h3>
                  <p>Thông tin được dùng lại trong nhiều chương trình đào tạo.</p>
                </div>
                <button
                  type="button"
                  className="subject-modal-close"
                  aria-label="Đóng biểu mẫu môn học"
                  disabled={saving}
                  onClick={resetSubjectForm}
                >
                  ×
                </button>
              </div>
              <div className="subject-modal-grid">
                <label>
                  Mã môn học *
                  <input
                    required
                    maxLength={30}
                    disabled={saving}
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
                    disabled={saving}
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
                    disabled={saving}
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
                    disabled={saving}
                    value={form.trongSo}
                    onChange={(event) =>
                      setForm({ ...form, trongSo: event.target.value })
                    }
                  />
                </label>
                <label className="subject-modal-wide-field">
                  Mô tả chuẩn đầu ra
                  <textarea
                    maxLength={1000}
                    disabled={saving}
                    value={form.moTaChuanDauRa}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        moTaChuanDauRa: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="subject-modal-actions">
                <button
                  type="button"
                  className="academic-secondary-button"
                  disabled={saving}
                  onClick={resetSubjectForm}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="academic-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Đang lưu..."
                    : editingId
                      ? "Lưu thay đổi"
                      : "Thêm môn học"}
                </button>
              </div>
              </form>
            </div>,
            document.body,
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
                            onClick={() => openEditForm(subject)}
                          >
                            Sửa
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleToggleSubjectStatus(subject)
                            }
                          >
                            {subject.trangThai === "Đang hoạt động"
                              ? "Ngừng"
                              : "Áp dụng lại"}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="academic-subject-delete"
                            onClick={() => void handleDeleteSubject(subject)}
                          >
                            Xóa
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
