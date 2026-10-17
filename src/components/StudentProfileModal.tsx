import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import api from "../services/api";

interface StudentSummary {
  nguoiDungId: number;
  hoTen: string;
  email: string;
  soDienThoai?: string | null;
}

interface StudentProfileClass {
  lopHocId: number;
  maLop: string;
  tenLop: string;
  namHoc: string;
  trangThai: string;
  tenChuongTrinh: string | null;
  ngayKhaiGiang: string;
  ngayGhiDanh?: string | null;
}

interface StudentGrade {
  diemId: number;
  maLop: string;
  tenLop: string;
  maMonHoc: string;
  tenMonHoc: string;
  hocKy: number;
  namHoc: string;
  diemQuaTrinh: number | null;
  diemGiuaKy: number | null;
  diemCuoiKy: number | null;
}

interface StudentProfile {
  hocVien: {
    nguoiDungId: number;
    maHocVien: string | null;
    hoTen: string;
    email: string;
    soDienThoai: string | null;
    ngaySinh: string | null;
    diaChi: string | null;
    trangThai: string;
    trinhDoDauVao: string | null;
    ghiChu: string | null;
    ngayNhapHoc: string | null;
  };
  lopHocs: StudentProfileClass[];
  thaoTacs: Array<{
    actionId: number;
    loaiThaoTac: "BaoLuu" | "ChuyenLop" | "ThoiHoc";
    ngayHieuLuc: string;
    lyDo: string;
    maLop: string;
    maLopDich: string | null;
    nguoiThucHien: string | null;
    ngayTao: string;
  }>;
  diems: StudentGrade[];
}

interface ProfileForm {
  hoTen: string;
  email: string;
  soDienThoai: string;
  ngaySinh: string;
  diaChi: string;
  trinhDoDauVao: string;
  ghiChu: string;
}

interface StudentProfileModalProps {
  student: StudentSummary;
  canEdit: boolean;
  section?: "information" | "history";
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm: ProfileForm = {
  hoTen: "",
  email: "",
  soDienThoai: "",
  ngaySinh: "",
  diaChi: "",
  trinhDoDauVao: "",
  ghiChu: "",
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("vi-VN");
};

const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  student,
  canEdit,
  section,
  onClose,
  onSaved,
}) => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const response = await api.get<StudentProfile>(
        `/academic/students/${student.nguoiDungId}`,
      );
      setProfile(response.data);
      const details = response.data.hocVien;
      setForm({
        hoTen: details.hoTen,
        email: details.email,
        soDienThoai: details.soDienThoai ?? "",
        ngaySinh: details.ngaySinh?.slice(0, 10) ?? "",
        diaChi: details.diaChi ?? "",
        trinhDoDauVao: details.trinhDoDauVao ?? "",
        ghiChu: details.ghiChu ?? "",
      });
    } catch (loadError: unknown) {
      console.error("Không thể tải hồ sơ học viên:", loadError);
      setError(
        axios.isAxiosError<{ detail?: unknown }>(loadError) &&
          typeof loadError.response?.data?.detail === "string"
          ? loadError.response.data.detail
          : "Không thể tải hồ sơ học viên.",
      );
    }
  }, [student.nguoiDungId]);

  // Loading the selected student's profile is an intentional async effect.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void loadProfile();
  }, [loadProfile]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/academic/students/${student.nguoiDungId}`, {
        hoTen: form.hoTen.trim(),
        email: form.email.trim(),
        soDienThoai: form.soDienThoai.trim() || null,
        ngaySinh: form.ngaySinh || null,
        diaChi: form.diaChi.trim() || null,
        trinhDoDauVao: form.trinhDoDauVao.trim() || null,
        ghiChu: form.ghiChu.trim() || null,
      });
      setSuccess("Đã cập nhật hồ sơ học viên.");
      setIsEditing(false);
      await loadProfile();
      onSaved();
    } catch (saveError: unknown) {
      console.error("Không thể cập nhật hồ sơ học viên:", saveError);
      setError(
        axios.isAxiosError<{ detail?: unknown }>(saveError) &&
          typeof saveError.response?.data?.detail === "string"
          ? saveError.response.data.detail
          : "Không thể cập nhật hồ sơ học viên.",
      );
    } finally {
      setSaving(false);
    }
  };

  const activeClasses =
    profile?.lopHocs.filter((item) =>
      ["Chuẩn bị", "Đang học", "Đang hoạt động"].includes(item.trangThai),
    ) ?? [];
  const previousClasses =
    profile?.lopHocs.filter(
      (item) =>
        !["Chuẩn bị", "Đang học", "Đang hoạt động"].includes(item.trangThai),
    ) ?? [];

  const updateForm = (key: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div
      className="users-modal-overlay student-profile-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="users-modal student-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-profile-title"
      >
        <header className="users-modal-header student-profile-header">
          <div>
            <span className="student-profile-eyebrow">
              {section === "information"
                ? "THÔNG TIN HỌC VIÊN"
                : section === "history"
                  ? "LỊCH SỬ LỚP HỌC"
                  : "HỒ SƠ HỌC TẬP"}
            </span>
            <h2 id="student-profile-title">{student.hoTen}</h2>
            <p>
              {profile?.hocVien.maHocVien ?? `ID ${student.nguoiDungId}`} ·{" "}
              {profile?.hocVien.email ?? student.email}
            </p>
          </div>
          <button
            type="button"
            className="users-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng hồ sơ"
          >
            ×
          </button>
        </header>

        {error && (
          <div className="student-profile-message error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="student-profile-message success" role="status">
            {success}
          </div>
        )}

        {!profile && !error ? (
          <div className="student-profile-loading">Đang tải hồ sơ học viên...</div>
        ) : profile ? (
          <>
            {section !== "information" && (
              <div className="student-profile-summary">
                <div>
                  <span>Trạng thái</span>
                  <strong>{profile.hocVien.trangThai}</strong>
                </div>
                <div>
                  <span>Ngày nhập học</span>
                  <strong>{formatDate(profile.hocVien.ngayNhapHoc)}</strong>
                </div>
                <div>
                  <span>Lớp đang học</span>
                  <strong>{activeClasses.length}</strong>
                </div>
                <div>
                  <span>Lớp đã học</span>
                  <strong>{previousClasses.length}</strong>
                </div>
              </div>
            )}

            <section className="student-enrollment-history">
              <div className="student-profile-section-heading">
                <div>
                  <h3>Lịch sử xử lý ghi danh</h3>
                  <p>Bảo lưu, chuyển lớp và thôi học được lưu cùng lý do và ngày hiệu lực.</p>
                </div>
              </div>
              {profile.thaoTacs.length ? (
                <div className="student-enrollment-history-list">
                  {profile.thaoTacs.map((action) => (
                    <article key={action.actionId}>
                      <div>
                        <strong>
                          {action.loaiThaoTac === "BaoLuu"
                            ? "Bảo lưu"
                            : action.loaiThaoTac === "ChuyenLop"
                              ? "Chuyển lớp"
                              : "Thôi học"}
                        </strong>
                        <span>
                          {formatDate(action.ngayHieuLuc)} · {action.maLop}
                          {action.maLopDich ? ` → ${action.maLopDich}` : ""}
                        </span>
                      </div>
                      <p>{action.lyDo}</p>
                      <small>
                        {action.nguoiThucHien ?? "Không rõ người thực hiện"}
                        {action.ngayTao ? ` · ${formatDate(action.ngayTao)}` : ""}
                      </small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="student-profile-empty">Chưa có quyết định xử lý ghi danh.</p>
              )}
            </section>

            {section !== "history" && (
              <>
            <div className="student-profile-section-heading">
              <div>
                <h3>Thông tin cá nhân</h3>
                <p>Thông tin liên hệ, trình độ đầu vào và ghi chú hồ sơ.</p>
              </div>
              {canEdit && !isEditing && (
                <button
                  type="button"
                  className="users-cancel-button student-profile-edit"
                  onClick={() => {
                    setError("");
                    setSuccess("");
                    setIsEditing(true);
                  }}
                >
                  Chỉnh sửa
                </button>
              )}
            </div>

            <form onSubmit={saveProfile}>
              <div className="student-profile-fields">
                <label>
                  Họ và tên
                  <input
                    required
                    maxLength={100}
                    value={form.hoTen}
                    disabled={!isEditing || saving}
                    onChange={(event) => updateForm("hoTen", event.target.value)}
                  />
                </label>
                <label>
                  Email
                  <input
                    required
                    type="email"
                    maxLength={254}
                    value={form.email}
                    disabled={!isEditing || saving}
                    onChange={(event) => updateForm("email", event.target.value)}
                  />
                </label>
                <label>
                  Số điện thoại
                  <input
                    type="tel"
                    maxLength={20}
                    value={form.soDienThoai}
                    disabled={!isEditing || saving}
                    onChange={(event) =>
                      updateForm("soDienThoai", event.target.value)
                    }
                  />
                </label>
                <label>
                  Ngày sinh
                  <input
                    type="date"
                    value={form.ngaySinh}
                    disabled={!isEditing || saving}
                    onChange={(event) => updateForm("ngaySinh", event.target.value)}
                  />
                </label>
                <label>
                  Địa chỉ
                  <input
                    maxLength={255}
                    value={form.diaChi}
                    disabled={!isEditing || saving}
                    onChange={(event) => updateForm("diaChi", event.target.value)}
                  />
                </label>
                <label>
                  Trình độ đầu vào
                  <input
                    maxLength={150}
                    value={form.trinhDoDauVao}
                    disabled={!isEditing || saving}
                    placeholder="Ví dụ: Tốt nghiệp THPT"
                    onChange={(event) =>
                      updateForm("trinhDoDauVao", event.target.value)
                    }
                  />
                </label>
                <label className="student-profile-notes">
                  Ghi chú hồ sơ
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={form.ghiChu}
                    disabled={!isEditing || saving}
                    placeholder="Ghi chú phục vụ quá trình học tập hoặc cấp lại bảng điểm"
                    onChange={(event) => updateForm("ghiChu", event.target.value)}
                  />
                </label>
              </div>

              {isEditing && (
                <div className="users-modal-actions student-profile-form-actions">
                  <button
                    type="button"
                    className="users-cancel-button"
                    disabled={saving}
                    onClick={() => {
                      setIsEditing(false);
                      setError("");
                      setForm({
                        hoTen: profile.hocVien.hoTen,
                        email: profile.hocVien.email,
                        soDienThoai: profile.hocVien.soDienThoai ?? "",
                        ngaySinh: profile.hocVien.ngaySinh?.slice(0, 10) ?? "",
                        diaChi: profile.hocVien.diaChi ?? "",
                        trinhDoDauVao: profile.hocVien.trinhDoDauVao ?? "",
                        ghiChu: profile.hocVien.ghiChu ?? "",
                      });
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="users-submit-button"
                    disabled={saving}
                  >
                    {saving ? "Đang lưu..." : "Lưu hồ sơ"}
                  </button>
                </div>
              )}
            </form>
              </>
            )}

            {section !== "information" && (
              <section className="student-profile-history">
              <h3>Lịch sử lớp học và bảng điểm</h3>
              <div className="student-profile-class-columns">
                <div className="student-profile-class-group">
                  <h4>Lớp đang học</h4>
                  {activeClasses.length ? (
                    activeClasses.map((item) => (
                      <article
                        className="student-profile-class-card"
                        key={item.lopHocId}
                      >
                        <strong>{item.maLop} · {item.tenLop}</strong>
                        <span>{item.tenChuongTrinh ?? "Chưa gắn chương trình"}</span>
                        <small>
                          {item.namHoc} · {item.trangThai} · Ghi danh{" "}
                          {formatDate(item.ngayGhiDanh)}
                        </small>
                      </article>
                    ))
                  ) : (
                    <p className="student-profile-empty">Hiện không có lớp đang học.</p>
                  )}
                </div>
                <div className="student-profile-class-group">
                  <h4>Lịch sử lớp học</h4>
                  {previousClasses.length ? (
                    previousClasses.map((item) => (
                      <article
                        className="student-profile-class-card"
                        key={item.lopHocId}
                      >
                        <strong>{item.maLop} · {item.tenLop}</strong>
                        <span>{item.tenChuongTrinh ?? "Chưa gắn chương trình"}</span>
                        <small>
                          {item.namHoc} · {item.trangThai} · Ghi danh{" "}
                          {formatDate(item.ngayGhiDanh)}
                        </small>
                      </article>
                    ))
                  ) : (
                    <p className="student-profile-empty">Chưa có lớp đã kết thúc.</p>
                  )}
                </div>
              </div>
              <div className="student-profile-transcript">
                <div className="student-profile-section-heading">
                  <div>
                    <h3>Bảng điểm</h3>
                    <p>
                      {profile.diems.length} kết quả môn học trong hồ sơ, phục vụ
                      tra cứu và cấp lại bảng điểm.
                    </p>
                  </div>
                </div>
                {profile.diems.length ? (
                  <div className="student-profile-table-wrap">
                    <table className="student-profile-table">
                      <thead>
                        <tr>
                          <th>Lớp / năm học</th>
                          <th>Môn học</th>
                          <th>Học kỳ</th>
                          <th>Quá trình</th>
                          <th>Giữa kỳ</th>
                          <th>Cuối kỳ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.diems.map((grade) => (
                          <tr key={grade.diemId}>
                            <td>{grade.maLop} · {grade.namHoc}</td>
                            <td>{grade.maMonHoc} · {grade.tenMonHoc}</td>
                            <td>{grade.hocKy}</td>
                            <td>{grade.diemQuaTrinh ?? "—"}</td>
                            <td>{grade.diemGiuaKy ?? "—"}</td>
                            <td>{grade.diemCuoiKy ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="student-profile-empty">Chưa có điểm được ghi nhận.</p>
                )}
              </div>
              </section>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
};

export default StudentProfileModal;
