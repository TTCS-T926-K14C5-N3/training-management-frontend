import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "./ToastNotification";
import "../pages/TrainingCatalog.css";

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

interface ProgramCompositionProps {
  permissions: string[];
}

const errorMessage = (error: unknown, fallback: string): string => {
  if (
    axios.isAxiosError<{ detail?: unknown }>(error) &&
    typeof error.response?.data?.detail === "string"
  ) {
    return error.response.data.detail;
  }
  return fallback;
};

const ProgramComposition: React.FC<ProgramCompositionProps> = ({
  permissions,
}) => {
  const canUpdate = permissions.includes("CURRICULUM_UPDATE");
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [programId, setProgramId] = useState("");
  const [programSubjects, setProgramSubjects] = useState<ProgramSubject[]>([]);
  const [draggingSubjectId, setDraggingSubjectId] = useState<number | null>(
    null,
  );
  const [sessionsFor, setSessionsFor] = useState<number | null>(null);
  const [cloneSourceSubjectId, setCloneSourceSubjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProgramSubjects = useCallback(async (id: string) => {
    if (!id) return;
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
    Promise.all([
      api.get<ProgramOption[]>("/academic/programs", {
        params: { include_inactive: true },
      }),
      api.get<Subject[]>("/academic/subjects", {
        params: { include_inactive: true },
      }),
    ])
      .then(([programResponse, subjectResponse]) => {
        if (!active) return;
        setPrograms(programResponse.data);
        setSubjects(subjectResponse.data);
      })
      .catch((requestError: unknown) => {
        console.error("Không thể tải thành phần chương trình:", requestError);
        if (active) {
          setError(
            errorMessage(
              requestError,
              "Không thể tải thành phần chương trình.",
            ),
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

  useEffect(() => {
    if (!programId) {
      return;
    }
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
      const currentProgram = programs.find(
        (program) => String(program.chuongTrinhId) === String(programId),
      );
      await api.put(`/academic/programs/${programId}/subjects`, {
        subjects: programSubjects.map((item, index) => ({
          monHocId: item.monHocId,
          thuTu: index + 1,
          monTienQuyetId: item.monTienQuyetId,
        })),
      });
      setNotice(
        currentProgram
          ? `Đã lưu lộ trình cho chương trình "${currentProgram.tenChuongTrinh}".`
          : "Đã lưu lộ trình chương trình thành công.",
      );
      setProgramId("");
      setProgramSubjects([]);
      setSessionsFor(null);
      setCloneSourceSubjectId("");
    } catch (requestError: unknown) {
      console.error("Không thể lưu lộ trình chương trình:", requestError);
      setError(
        errorMessage(requestError, "Không thể lưu lộ trình chương trình."),
      );
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

  const addSession = (subjectId: number) => {
    setProgramSubjects((current) =>
      current.map((item) =>
        item.monHocId !== subjectId || item.sessions.length >= item.soBuoi
          ? item
          : {
              ...item,
              sessions: [
                ...item.sessions,
                {
                  soThuTu: item.sessions.length + 1,
                  chuDe: "",
                  mucTieu: "",
                },
              ],
            },
      ),
    );
  };

  const removeSession = (subjectId: number, indexToRemove: number) => {
    setProgramSubjects((current) =>
      current.map((item) =>
        item.monHocId !== subjectId
          ? item
          : {
              ...item,
              sessions: item.sessions
                .filter((_, index) => index !== indexToRemove)
                .map((session, index) => ({
                  ...session,
                  soThuTu: index + 1,
                })),
            },
      ),
    );
  };

  const saveSessions = async (subject: ProgramSubject) => {
    if (!programId) return;
    if (subject.sessions.some((session) => !session.chuDe.trim())) {
      setError("Vui lòng nhập chủ đề cho từng buổi học trước khi lưu.");
      return;
    }
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

  const handleCloneSessions = async (targetSubject: ProgramSubject) => {
    if (!programId || !cloneSourceSubjectId) return;
    if (
      targetSubject.sessions.length > 0 &&
      !window.confirm(
        `Sao chép lộ trình sẽ thay thế ${targetSubject.sessions.length} buổi hiện có của môn "${targetSubject.tenMonHoc}". Bạn có muốn tiếp tục không?`,
      )
    ) {
      return;
    }
    const sourceSubject = programSubjects.find(
      (subject) => subject.monHocId === Number(cloneSourceSubjectId),
    );
    const sourceSubjectName = sourceSubject
      ? sourceSubject.tenMonHoc
      : "môn nguồn";
    setCloning(true);
    setError("");
    setNotice("");
    try {
      await api.post(
        `/academic/programs/${programId}/subjects/${targetSubject.monHocId}/sessions/clone`,
        { sourceSubjectId: Number(cloneSourceSubjectId) },
      );
      setNotice(`Đã nhân bản danh sách buổi học từ môn "${sourceSubjectName}".`);
      await loadProgramSubjects(programId);
      setCloneSourceSubjectId("");
    } catch (requestError: unknown) {
      console.error("Không thể nhân bản buổi học:", requestError);
      setError(
        errorMessage(requestError, "Không thể nhân bản danh sách buổi học."),
      );
    } finally {
      setCloning(false);
    }
  };

  if (loading) {
    return (
      <section className="academic-card">Đang tải thành phần chương trình...</section>
    );
  }

  return (
    <section className="academic-card">
      {(notice || error) && (
        <ToastNotification
          type={error ? "error" : "success"}
          text={error || notice}
          durationMs={3000}
          onClose={() => {
            setNotice("");
            setError("");
          }}
        />
      )}
      <div className="academic-card-heading">
        <div>
          <h2>Thành phần chương trình</h2>
          <p>Chọn môn, thứ tự học và môn tiên quyết trước khi lưu.</p>
        </div>
        <label className="academic-program-select">
          Chương trình
          <select
            value={programId}
            onChange={(event) => {
              setProgramId(event.target.value);
              setProgramSubjects([]);
              setSessionsFor(null);
              setCloneSourceSubjectId("");
            }}
          >
            <option value="">-- Chọn chương trình đào tạo --</option>
            {programs.map((program) => (
              <option key={program.chuongTrinhId} value={program.chuongTrinhId}>
                {program.maChuongTrinh} — {program.tenChuongTrinh}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="academic-program-subject-grid">
        <div>
          <h3>Môn có thể thêm</h3>
          {!programId ? (
            <p className="academic-muted">
              Vui lòng chọn một chương trình đào tạo ở trên để bắt đầu thêm môn
              học.
            </p>
          ) : (
            subjects
              .filter(
                (subject) =>
                  subject.trangThai === "Đang hoạt động" ||
                  programSubjects.some(
                    (item) => item.monHocId === subject.monHocId,
                  ),
              )
              .map((subject) => {
                const selected = programSubjects.some(
                  (item) => item.monHocId === subject.monHocId,
                );
                return (
                  <label
                    className="academic-subject-choice"
                    key={subject.monHocId}
                  >
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
                      {subject.trangThai !== "Đang hoạt động" &&
                        " (Đã ngừng hoạt động)"}
                    </span>
                  </label>
                );
              })
          )}
        </div>
        <div>
          <h3>Lộ trình học</h3>
          {!programId ? (
            <p className="academic-muted">
              Vui lòng chọn chương trình đào tạo để xem hoặc thiết lập lộ trình.
            </p>
          ) : (
            programSubjects.map((item, index) => (
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
                      disabled={
                        !canUpdate || index === programSubjects.length - 1
                      }
                      onClick={() => moveSubject(item.monHocId, 1)}
                      aria-label={`Chuyển ${item.tenMonHoc} xuống`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={
                        sessionsFor === item.monHocId
                          ? "academic-session-toggle is-open"
                          : "academic-session-toggle"
                      }
                      onClick={() => {
                        setSessionsFor(
                          sessionsFor === item.monHocId ? null : item.monHocId,
                        );
                      }}
                    >
                      {sessionsFor === item.monHocId
                        ? "Ẩn nội dung buổi học"
                        : "Khai báo buổi học"}
                      <span className="academic-session-count">
                        {
                          item.sessions.filter((session) =>
                            session.chuDe.trim(),
                          ).length
                        }
                        /{item.soBuoi}
                      </span>
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
                    <div className="academic-session-summary">
                      <div>
                        <strong>Nội dung từng buổi</strong>
                        <span>
                          Tối đa {item.soBuoi} buổi. Mỗi buổi cần có chủ đề;
                          mục tiêu là tùy chọn.
                        </span>
                      </div>
                      <span
                        className={`academic-session-progress ${
                          item.sessions.length === item.soBuoi ? "is-full" : ""
                        }`}
                      >
                        {item.sessions.length} / {item.soBuoi} buổi
                      </span>
                    </div>
                    {canUpdate && (
                      <div className="academic-clone-session-bar">
                        <div className="academic-clone-description">
                          <strong className="academic-clone-label">
                            Dùng lộ trình có sẵn
                          </strong>
                          <span>
                            Sao chép nội dung buổi học từ một môn khác trong
                            chương trình này.
                          </span>
                        </div>
                        <div className="academic-clone-controls">
                          <select
                            className="academic-clone-select"
                            value={cloneSourceSubjectId}
                            onChange={(event) =>
                              setCloneSourceSubjectId(event.target.value)
                            }
                            disabled={saving || cloning}
                            aria-label="Chọn môn để sao chép buổi học"
                          >
                            <option value="">-- Chọn môn nguồn --</option>
                            {programSubjects
                              .filter(
                                (subject) => subject.monHocId !== item.monHocId,
                              )
                              .map((subject) => (
                                <option
                                  key={subject.monHocId}
                                  value={subject.monHocId}
                                  disabled={
                                    !subject.sessions.some((session) =>
                                      session.chuDe?.trim(),
                                    )
                                  }
                                >
                                  {subject.tenMonHoc} (
                                  {
                                    subject.sessions.filter((session) =>
                                      session.chuDe?.trim(),
                                    ).length
                                  }
                                  /{subject.soBuoi})
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            className="academic-clone-button"
                            disabled={
                              saving || cloning || !cloneSourceSubjectId
                            }
                            onClick={() => void handleCloneSessions(item)}
                          >
                            {cloning ? "Đang sao chép..." : "Sao chép"}
                          </button>
                        </div>
                      </div>
                    )}
                    {item.sessions.length > 0 ? (
                      <div className="academic-session-list">
                        {item.sessions.map((session, sessionIndex) => (
                          <article
                            className={`academic-session-card ${
                              session.chuDe.trim()
                                ? "is-complete"
                                : "needs-topic"
                            }`}
                            key={session.buoiHocId ?? sessionIndex}
                          >
                            <div className="academic-session-card-heading">
                              <div className="academic-session-number">
                                {sessionIndex + 1}
                              </div>
                              <div className="academic-session-card-title">
                                <strong>Buổi {sessionIndex + 1}</strong>
                                <span>
                                  {session.chuDe.trim()
                                    ? "Đã có chủ đề"
                                    : "Chưa nhập chủ đề"}
                                </span>
                              </div>
                              {canUpdate && (
                                <button
                                  type="button"
                                  className="academic-session-remove"
                                  disabled={saving}
                                  onClick={() =>
                                    removeSession(item.monHocId, sessionIndex)
                                  }
                                  aria-label={`Xóa buổi ${sessionIndex + 1}`}
                                >
                                  Xóa
                                </button>
                              )}
                            </div>
                            <div className="academic-session-fields">
                              <label>
                                Chủ đề{" "}
                                <span className="academic-required">*</span>
                                <input
                                  aria-label={`Chủ đề buổi ${sessionIndex + 1}`}
                                  placeholder="Ví dụ: Giới thiệu về cơ sở dữ liệu"
                                  value={session.chuDe}
                                  disabled={!canUpdate || saving}
                                  onChange={(event) =>
                                    updateSession(
                                      item.monHocId,
                                      sessionIndex,
                                      "chuDe",
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              <label>
                                Mục tiêu buổi học
                                <textarea
                                  aria-label={`Mục tiêu buổi ${sessionIndex + 1}`}
                                  placeholder="Sau buổi học, học viên có thể..."
                                  value={session.mucTieu}
                                  disabled={!canUpdate || saving}
                                  onChange={(event) =>
                                    updateSession(
                                      item.monHocId,
                                      sessionIndex,
                                      "mucTieu",
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="academic-session-empty">
                        <strong>Chưa khai báo buổi học</strong>
                        <span>
                          Thêm nội dung theo từng buổi để giảng viên biết cần
                          dạy chủ đề và mục tiêu nào.
                        </span>
                      </div>
                    )}
                    {canUpdate && (
                      <div className="academic-session-footer">
                        <button
                          type="button"
                          className="academic-session-add"
                          disabled={
                            saving || item.sessions.length >= item.soBuoi
                          }
                          onClick={() => addSession(item.monHocId)}
                        >
                          + Thêm buổi học
                        </button>
                        <button
                          type="button"
                          className="academic-session-save"
                          disabled={
                            saving ||
                            item.sessions.some(
                              (session) => !session.chuDe.trim(),
                            )
                          }
                          onClick={() => void saveSessions(item)}
                        >
                          {saving
                            ? "Đang lưu..."
                            : "Lưu nội dung buổi học"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
          {programId && programSubjects.length === 0 && (
            <p className="academic-muted">Chưa có môn nào trong chương trình.</p>
          )}
        </div>
      </div>
      {canUpdate && (
        <div className="academic-form-actions">
          <button
            type="button"
            disabled={saving || !programId}
            onClick={() => void saveProgramSubjects()}
          >
            {saving ? "Đang lưu..." : "Lưu lộ trình chương trình"}
          </button>
          {programId && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setProgramId("");
                setProgramSubjects([]);
                setSessionsFor(null);
                setCloneSourceSubjectId("");
              }}
            >
              Hủy / Chọn chương trình khác
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default ProgramComposition;
