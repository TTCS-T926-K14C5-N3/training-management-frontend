import { useCallback, useEffect, useState } from "react";
import SearchableSelect from "../components/SearchableSelect";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import ProgramComposition from "../components/ProgramComposition";
import "./AcademicManagement.css";
import "./TrainingPrograms.css";

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

interface TrainingProgramForm {
  maChuongTrinh: string;
  tenChuongTrinh: string;
  moTa: string;
  tongThoiLuong: string;
  hocPhiChuan: string;
  trangThai: string;
}

interface TrainingProgramsProps {
  permissions: string[];
}

const EMPTY_FORM: TrainingProgramForm = {
  maChuongTrinh: "",
  tenChuongTrinh: "",
  moTa: "",
  tongThoiLuong: "",
  hocPhiChuan: "",
  trangThai: "Đang áp dụng",
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

const TrainingPrograms: React.FC<TrainingProgramsProps> = ({ permissions }) => {
  const canCreate = permissions.includes("CLASS_CREATE");
  const canUpdate = permissions.includes("CLASS_UPDATE");
  const canDelete = permissions.includes("CLASS_DELETE");
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPrograms = useCallback(async () => {
    try {
      const response = await api.get<TrainingProgram[]>("/academic/programs");
      setPrograms(response.data);
      setError("");
    } catch (requestError: unknown) {
      console.error("Không thể tải danh mục chương trình:", requestError);
      setError(
        responseError(
          requestError,
          "Không thể tải danh mục chương trình đào tạo.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initialLoad = async () => {
      try {
        const response = await api.get<TrainingProgram[]>("/academic/programs");
        if (active) {
          setPrograms(response.data);
          setError("");
        }
      } catch (requestError: unknown) {
        console.error("Không thể tải danh mục chương trình:", requestError);
        if (active) {
          setError(
            responseError(
              requestError,
              "Không thể tải danh mục chương trình đào tạo.",
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
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setIsFormOpen(false);
  };

  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setIsFormOpen(true);
  };

  const saveProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        maChuongTrinh: form.maChuongTrinh.trim(),
        tenChuongTrinh: form.tenChuongTrinh.trim(),
        moTa: form.moTa.trim() || null,
        tongThoiLuong: Number(form.tongThoiLuong),
        hocPhiChuan: Number(form.hocPhiChuan),
        trangThai: form.trangThai,
      };
      if (editingId === null) {
        await api.post("/academic/programs", payload);
        setNotice("Thêm chương trình thành công.");
      } else {
        await api.put(`/academic/programs/${editingId}`, payload);
        setNotice("Đã cập nhật chương trình đào tạo.");
      }
      resetForm();
      await loadPrograms();
    } catch (requestError: unknown) {
      console.error("Không thể lưu chương trình đào tạo:", requestError);
      setError(
        responseError(requestError, "Không thể lưu chương trình đào tạo."),
      );
    } finally {
      setSaving(false);
    }
  };

  const editProgram = (program: TrainingProgram) => {
    setForm({
      maChuongTrinh: program.maChuongTrinh,
      tenChuongTrinh: program.tenChuongTrinh,
      moTa: program.moTa ?? "",
      tongThoiLuong: String(program.tongThoiLuong),
      hocPhiChuan: String(program.hocPhiChuan),
      trangThai: program.trangThai,
    });
    setEditingId(program.chuongTrinhId);
    setError("");
    setIsFormOpen(true);
  };

  const toggleProgramStatus = async (program: TrainingProgram) => {
    const nextStatus =
      program.trangThai === "Đang áp dụng" ? "Ngừng áp dụng" : "Đang áp dụng";
    if (
      !window.confirm(
        `${nextStatus} chương trình ${program.maChuongTrinh} — ${program.tenChuongTrinh}?`,
      )
    ) {
      return;
    }
    setError("");
    setNotice("");
    try {
      await api.put(`/academic/programs/${program.chuongTrinhId}`, {
        maChuongTrinh: program.maChuongTrinh,
        tenChuongTrinh: program.tenChuongTrinh,
        moTa: program.moTa,
        tongThoiLuong: program.tongThoiLuong,
        hocPhiChuan: program.hocPhiChuan,
        trangThai: nextStatus,
      });
      setNotice(`Đã ${nextStatus.toLowerCase()} chương trình.`);
      await loadPrograms();
    } catch (requestError: unknown) {
      console.error("Không thể cập nhật trạng thái chương trình:", requestError);
      setError(
        responseError(
          requestError,
          "Không thể cập nhật trạng thái chương trình.",
        ),
      );
    }
  };

  const deleteProgram = async (program: TrainingProgram) => {
    if (program.soLop > 0) {
      setError(
        "Chương trình đã được gắn với lớp học nên không thể xóa; hãy ngừng áp dụng chương trình.",
      );
      return;
    }
    if (
      !window.confirm(
        `Xóa chương trình ${program.maChuongTrinh} — ${program.tenChuongTrinh}?`,
      )
    ) {
      return;
    }
    setError("");
    setNotice("");
    try {
      await api.delete(`/academic/programs/${program.chuongTrinhId}`);
      setNotice("Đã xóa chương trình đào tạo.");
      await loadPrograms();
    } catch (requestError: unknown) {
      console.error("Không thể xóa chương trình đào tạo:", requestError);
      setError(
        responseError(requestError, "Không thể xóa chương trình đào tạo."),
      );
    }
  };

  return (
    <section className="academic-page">
      {(error || notice) && (
        <ToastNotification
          type={error ? "error" : "success"}
          text={error || notice}
          durationMs={3000}
          onClose={() => {
            setError("");
            setNotice("");
          }}
        />
      )}

      <header className="academic-page-banner">
        <div className="academic-banner-content">
          <div className="academic-banner-label">
            <span aria-hidden="true">🎓</span>
            ĐÀO TẠO
          </div>
          <h1>Chương trình đào tạo</h1>
          <p>Quản lý chương trình, thời lượng và học phí chuẩn.</p>
        </div>
        <div className="academic-banner-stat">
          <strong>{programs.length}</strong>
          <span>Chương trình</span>
        </div>
      </header>

      <section className="academic-card">
        <div className="academic-card-heading">
          <div>
            <h2>Danh mục chương trình đào tạo</h2>
            <p>
              Chương trình đã gắn với lớp được giữ lại để bảo toàn lịch sử;
              hãy ngừng áp dụng thay vì xóa.
            </p>
          </div>
          {canCreate && (
            <button
              className="academic-primary-button"
              type="button"
              onClick={openCreateForm}
            >
              + Thêm chương trình
            </button>
          )}
          {editingId !== null && (
            <button
              className="academic-secondary-button"
              type="button"
              onClick={resetForm}
            >
              Hủy chỉnh sửa
            </button>
          )}
        </div>

        {isFormOpen &&
          createPortal(
            <div
              className="training-program-modal-overlay"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !saving) {
                  resetForm();
                }
              }}
            >
              <form
                className="training-program-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="training-program-modal-title"
                onSubmit={saveProgram}
              >
                <div className="training-program-modal-header">
                  <div>
                    <h3 id="training-program-modal-title">
                      {editingId === null
                        ? "Thêm chương trình"
                        : "Cập nhật chương trình"}
                    </h3>
                    <p>
                      Nhập thông tin chương trình đào tạo và học phí chuẩn.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="training-program-modal-close"
                    aria-label="Đóng biểu mẫu chương trình"
                    disabled={saving}
                    onClick={resetForm}
                  >
                    ×
                  </button>
                </div>
                <div className="academic-form-grid">
              <label>
                Mã chương trình
                <input
                  required
                  maxLength={30}
                  disabled={saving}
                  value={form.maChuongTrinh}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      maChuongTrinh: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Tên chương trình
                <input
                  required
                  maxLength={150}
                  disabled={saving}
                  value={form.tenChuongTrinh}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tenChuongTrinh: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Tổng thời lượng (giờ)
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  disabled={saving}
                  value={form.tongThoiLuong}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tongThoiLuong: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Học phí chuẩn (₫)
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={saving}
                  value={form.hocPhiChuan}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      hocPhiChuan: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Trạng thái
                <SearchableSelect
                  disabled={saving}
                  value={form.trangThai}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      trangThai: event.target.value,
                    }))
                  }
                >
                  <option value="Đang áp dụng">Đang áp dụng</option>
                  <option value="Ngừng áp dụng">Ngừng áp dụng</option>
                </SearchableSelect>
              </label>
              <label className="academic-program-description">
                Mô tả
                <textarea
                  rows={3}
                  maxLength={1000}
                  disabled={saving}
                  value={form.moTa}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      moTa: event.target.value,
                    }))
                  }
                />
              </label>
                </div>
                <div className="training-program-modal-actions">
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
                      (editingId === null ? !canCreate : !canUpdate)
                    }
                  >
                    {saving
                      ? "Đang lưu..."
                      : editingId === null
                        ? "Thêm chương trình"
                        : "Lưu chương trình"}
                  </button>
                </div>
              </form>
            </div>,
            document.body,
          )}

        <div className="academic-table-wrap" style={{ marginTop: 20 }}>
          <table className="academic-table">
            <thead>
              <tr>
                <th>Mã chương trình</th>
                <th>Tên chương trình / mô tả</th>
                <th>Thời lượng</th>
                <th>Học phí chuẩn</th>
                <th>Số lớp</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>Đang tải chương trình...</td>
                </tr>
              ) : programs.length === 0 ? (
                <tr>
                  <td colSpan={7}>Chưa có chương trình đào tạo.</td>
                </tr>
              ) : (
                programs.map((program) => (
                  <tr key={program.chuongTrinhId}>
                    <td>{program.maChuongTrinh}</td>
                    <td>
                      <strong>{program.tenChuongTrinh}</strong>
                      {program.moTa && (
                        <span className="academic-cell-subtitle">
                          {program.moTa}
                        </span>
                      )}
                    </td>
                    <td>{program.tongThoiLuong} giờ</td>
                    <td>
                      {new Intl.NumberFormat("vi-VN").format(
                        program.hocPhiChuan,
                      )}{" "}
                      ₫
                    </td>
                    <td>{program.soLop}</td>
                    <td>
                      <span
                        className={`academic-status ${
                          program.trangThai === "Đang áp dụng"
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {program.trangThai}
                      </span>
                    </td>
                    <td className="academic-row-actions">
                      {canUpdate && (
                        <>
                          <button
                            className="academic-text-button"
                            type="button"
                            onClick={() => editProgram(program)}
                          >
                            Sửa
                          </button>
                          <button
                            className={
                              program.trangThai === "Đang áp dụng"
                                ? "academic-danger-button"
                                : "academic-primary-button"
                            }
                            type="button"
                            onClick={() => void toggleProgramStatus(program)}
                          >
                            {program.trangThai === "Đang áp dụng"
                              ? "Ngừng áp dụng"
                              : "Áp dụng lại"}
                          </button>
                        </>
                      )}
                      {canDelete && program.soLop === 0 && (
                        <button
                          className="academic-danger-button"
                          type="button"
                          onClick={() => void deleteProgram(program)}
                        >
                          Xóa
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      {permissions.includes("CURRICULUM_VIEW") && (
        <ProgramComposition permissions={permissions} />
      )}
    </section>
  );
};

export default TrainingPrograms;
