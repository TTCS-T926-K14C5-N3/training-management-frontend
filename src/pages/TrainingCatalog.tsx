import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import "./AcademicManagement.css";
import "./TrainingCatalog.css";

interface ProgramOption {
  chuongTrinhId: number;
  maChuongTrinh: string;
  tenChuongTrinh: string;
}

interface Subject {
  monHocId: number;
  maMonHoc: string;
  tenMonHoc: string;
  soBuoi: number;
  trongSo: number;
  moTaChuanDauRa: string | null;
  trangThai: string;
}

interface Session {
  buoiHocId?: number;
  soThuTu: number;
  chuDe: string;
  mucTieu: string;
}

interface ProgramSubject extends Subject {
  thuTu: number;
  monTienQuyetId: number | null;
  sessions: Session[];
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
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [programId, setProgramId] = useState("");
  const [programSubjects, setProgramSubjects] = useState<ProgramSubject[]>([]);
  const [form, setForm] = useState(EMPTY_SUBJECT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sessionsFor, setSessionsFor] = useState<number | null>(null);
  const [draggingSubjectId, setDraggingSubjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchCatalog = useCallback(async () => {
    const [programResponse, subjectResponse] = await Promise.all([
        api.get<ProgramOption[]>("/academic/programs", {
          params: { include_inactive: true },
        }),
        api.get<Subject[]>("/academic/subjects", {
          params: { include_inactive: true },
        }),
      ]);
    return [programResponse.data, subjectResponse.data] as const;
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const [programData, subjectData] = await fetchCatalog();
      setPrograms(programData);
      setSubjects(subjectData);
      if (programData.length > 0) {
        setProgramId((current) =>
          current || String(programData[0].chuongTrinhId),
        );
      }
      setError("");
    } catch (requestError: unknown) {
      console.error("Không thể tải danh mục đào tạo:", requestError);
      setError(errorMessage(requestError, "Không thể tải danh mục đào tạo."));
    } finally {
      setLoading(false);
    }
  }, [fetchCatalog]);

  const loadProgramSubjects = useCallback(async (id: string) => {
    if (!id) {
      return;
    }
    try {
      const response = await api.get<ProgramSubject[]>(
        `/academic/programs/${id}/subjects`,
      );
      setProgramSubjects(response.data);
      setError("");
    } catch (requestError: unknown) {
      console.error("Không thể tải lộ trình môn học:", requestError);
      setError(errorMessage(requestError, "Không thể tải lộ trình môn học."));
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchCatalog()
      .then(([programData, subjectData]) => {
        if (!active) return;
        setPrograms(programData);
        setSubjects(subjectData);
        if (programData.length > 0) {
          setProgramId((current) =>
            current || String(programData[0].chuongTrinhId),
          );
        }
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
  }, [fetchCatalog]);

  useEffect(() => {
    if (!programId) return;
    let active = true;
    api
      .get<ProgramSubject[]>(`/academic/programs/${programId}/subjects`)
      .then((response) => {
        if (active) {
          setProgramSubjects(response.data);
          setError("");
        }
      })
      .catch((requestError: unknown) => {
        console.error("Không thể tải lộ trình môn học:", requestError);
        if (active) {
          setError(errorMessage(requestError, "Không thể tải lộ trình môn học."));
        }
      });
    return () => {
      active = false;
    };
  }, [programId]);

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
      if (programId) await loadProgramSubjects(programId);
    } catch (requestError: unknown) {
      console.error("Không thể ngừng hoạt động môn học:", requestError);
      setError(errorMessage(requestError, "Không thể ngừng hoạt động môn học."));
    }
  };

  const toggleSubject = (subject: Subject) => {
    setProgramSubjects((current) => {
      const existing = current.find((item) => item.monHocId === subject.monHocId);
      if (existing) {
        return current
          .filter((item) => item.monHocId !== subject.monHocId)
          .map((item, index) => ({ ...item, thuTu: index + 1 }));
      }
      return [
        ...current,
        {
          ...subject,
          thuTu: current.length + 1,
          monTienQuyetId: null,
          sessions: [],
        },
      ];
    });
  };

  const moveSubject = (subjectId: number, offset: -1 | 1) => {
    setProgramSubjects((current) => {
      const from = current.findIndex((item) => item.monHocId === subjectId);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const moved = [...current];
      [moved[from], moved[to]] = [moved[to], moved[from]];
      return moved.map((item, index) => ({ ...item, thuTu: index + 1 }));
    });
  };

  const reorderSubject = (sourceId: number, targetId: number) => {
    setProgramSubjects((current) => {
      const from = current.findIndex((item) => item.monHocId === sourceId);
      const to = current.findIndex((item) => item.monHocId === targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const reordered = [...current];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      return reordered.map((item, index) => ({ ...item, thuTu: index + 1 }));
    });
  };

  const saveProgramSubjects = async () => {
    if (!programId) return;
    setSaving(true);
    setError("");
    try {
      await api.put(`/academic/programs/${programId}/subjects`, {
        subjects: programSubjects.map((item, index) => ({
          monHocId: item.monHocId,
          thuTu: index + 1,
          monTienQuyetId: item.monTienQuyetId,
        })),
      });
      setNotice("Lưu lộ trình chương trình thành công.");
      await loadProgramSubjects(programId);
    } catch (requestError: unknown) {
      console.error("Không thể lưu lộ trình chương trình:", requestError);
      setError(errorMessage(requestError, "Không thể lưu lộ trình chương trình."));
    } finally {
      setSaving(false);
    }
  };

  const updateSession = (
    subjectId: number,
    index: number,
    key: "chuDe" | "mucTieu",
    value: string,
  ) => {
    setProgramSubjects((current) =>
      current.map((item) =>
        item.monHocId !== subjectId
          ? item
          : {
              ...item,
              sessions: item.sessions.map((session, sessionIndex) =>
                sessionIndex === index ? { ...session, [key]: value } : session,
              ),
            },
      ),
    );
  };

  const saveSessions = async (subject: ProgramSubject) => {
    if (!programId) return;
    setSaving(true);
    setError("");
    try {
      await api.put(
        `/academic/programs/${programId}/subjects/${subject.monHocId}/sessions`,
        {
          sessions: subject.sessions.map((session, index) => ({
            soThuTu: index + 1,
            chuDe: session.chuDe,
            mucTieu: session.mucTieu,
          })),
        },
      );
      setNotice(`Đã lưu buổi học của ${subject.tenMonHoc}.`);
      await loadProgramSubjects(programId);
    } catch (requestError: unknown) {
      console.error("Không thể lưu buổi học:", requestError);
      setError(errorMessage(requestError, "Không thể lưu danh sách buổi học."));
    } finally {
      setSaving(false);
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
                      {canDelete && subject.trangThai === "Đang hoạt động" && (
                        <button
                          type="button"
                          onClick={() => void handleArchiveSubject(subject)}
                        >
                          Ngừng
                        </button>
                      )}
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

      <section className="academic-card">
        <div className="academic-card-heading">
          <div>
            <h2>Thành phần chương trình</h2>
            <p>Chọn môn, thứ tự học và môn tiên quyết trước khi lưu.</p>
          </div>
          <label className="academic-program-select">
            Chương trình
            <select
              value={programId}
              onChange={(event) => setProgramId(event.target.value)}
            >
              {programs.map((program) => (
                <option
                  key={program.chuongTrinhId}
                  value={program.chuongTrinhId}
                >
                  {program.maChuongTrinh} — {program.tenChuongTrinh}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="academic-program-subject-grid">
          <div>
            <h3>Môn có thể thêm</h3>
            {subjects.map((subject) => {
              const selected = programSubjects.some(
                (item) => item.monHocId === subject.monHocId,
              );
              return (
                <label className="academic-subject-choice" key={subject.monHocId}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={
                      !canUpdate ||
                      (subject.trangThai !== "Đang hoạt động" && !selected)
                    }
                    onChange={() => toggleSubject(subject)}
                  />
                  <span>
                    <strong>{subject.maMonHoc}</strong> {subject.tenMonHoc}
                  </span>
                </label>
              );
            })}
          </div>
          <div>
            <h3>Lộ trình học</h3>
            {programSubjects.map((item, index) => (
              <article
                className={`academic-program-subject ${
                  draggingSubjectId === item.monHocId ? "is-dragging" : ""
                }`}
                key={item.monHocId}
                draggable={canUpdate}
                onDragStart={() => setDraggingSubjectId(item.monHocId)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggingSubjectId !== null) {
                    reorderSubject(draggingSubjectId, item.monHocId);
                  }
                  setDraggingSubjectId(null);
                }}
                onDragEnd={() => setDraggingSubjectId(null)}
              >
                <div className="academic-program-subject-heading">
                  <strong>
                    {index + 1}. {item.tenMonHoc}
                  </strong>
                  <span className="academic-inline-actions">
                    <button
                      type="button"
                      disabled={!canUpdate || index === 0}
                      onClick={() => moveSubject(item.monHocId, -1)}
                      aria-label={`Chuyển ${item.tenMonHoc} lên`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={!canUpdate || index === programSubjects.length - 1}
                      onClick={() => moveSubject(item.monHocId, 1)}
                      aria-label={`Chuyển ${item.tenMonHoc} xuống`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProgramSubjects((current) =>
                          current.map((candidate) =>
                            candidate.monHocId === item.monHocId
                              ? {
                                  ...candidate,
                                  sessions:
                                    sessionsFor === item.monHocId
                                      ? candidate.sessions
                                      : Array.from(
                                          { length: candidate.soBuoi },
                                          (_, sessionIndex) =>
                                            candidate.sessions[sessionIndex] ?? {
                                              soThuTu: sessionIndex + 1,
                                              chuDe: "",
                                              mucTieu: "",
                                            },
                                        ),
                                }
                              : candidate,
                          ),
                        );
                        setSessionsFor(
                          sessionsFor === item.monHocId ? null : item.monHocId,
                        );
                      }}
                    >
                      Buổi học ({item.sessions.length}/{item.soBuoi})
                    </button>
                  </span>
                </div>
                <label className="academic-prerequisite">
                  Môn tiên quyết
                  <select
                    value={item.monTienQuyetId ?? ""}
                    disabled={!canUpdate}
                    onChange={(event) =>
                      setProgramSubjects((current) =>
                        current.map((subject) =>
                          subject.monHocId === item.monHocId
                            ? {
                                ...subject,
                                monTienQuyetId: event.target.value
                                  ? Number(event.target.value)
                                  : null,
                              }
                            : subject,
                        ),
                      )
                    }
                  >
                    <option value="">Không yêu cầu</option>
                    {programSubjects
                      .filter(
                        (subject) =>
                          subject.monHocId !== item.monHocId &&
                          subject.thuTu < item.thuTu,
                      )
                      .map((subject) => (
                        <option key={subject.monHocId} value={subject.monHocId}>
                          {subject.tenMonHoc}
                        </option>
                      ))}
                  </select>
                </label>
                {sessionsFor === item.monHocId && (
                  <div className="academic-session-editor">
                    {Array.from({ length: item.soBuoi }, (_, sessionIndex) => {
                      const session = item.sessions[sessionIndex] ?? {
                        soThuTu: sessionIndex + 1,
                        chuDe: "",
                        mucTieu: "",
                      };
                      return (
                        <div className="academic-session-row" key={sessionIndex}>
                          <strong>Buổi {sessionIndex + 1}</strong>
                          <input
                            aria-label={`Chủ đề buổi ${sessionIndex + 1}`}
                            placeholder="Chủ đề"
                            value={session.chuDe}
                            disabled={!canUpdate}
                            onChange={(event) => {
                              updateSession(
                                item.monHocId,
                                sessionIndex,
                                "chuDe",
                                event.target.value,
                              );
                            }}
                          />
                          <textarea
                            aria-label={`Mục tiêu buổi ${sessionIndex + 1}`}
                            placeholder="Mục tiêu buổi học"
                            value={session.mucTieu}
                            disabled={!canUpdate}
                            onChange={(event) => {
                              updateSession(
                                item.monHocId,
                                sessionIndex,
                                "mucTieu",
                                event.target.value,
                              );
                            }}
                          />
                        </div>
                      );
                    })}
                    {canUpdate && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveSessions(item)}
                      >
                        Lưu buổi học
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
            {programSubjects.length === 0 && (
              <p className="academic-muted">Chưa có môn nào trong chương trình.</p>
            )}
          </div>
        </div>
        {canUpdate && (
          <div className="academic-form-actions">
            <button type="button" disabled={saving || !programId} onClick={() => void saveProgramSubjects()}>
              {saving ? "Đang lưu..." : "Lưu lộ trình chương trình"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default TrainingCatalog;
