import React, { useEffect, useRef, useState } from "react";
import api from "../services/api";
import AvatarImage from "../components/AvatarImage";
import ToastNotification from "../components/ToastNotification";
import { getAvatarPath, processAvatar } from "../utils/avatar";
import "./Profile.css";

interface VaiTro {
  vaiTroId: number;
  tenVaiTro: string;
}

interface ProfileUser {
  nguoiDungId: number;
  hoTen: string;
  email: string;
  vaiTro: VaiTro[];
}

interface ProfileData {
  nguoiDungId: number;
  hoTen: string;
  email: string;
  soDienThoai: string | null;
  ngaySinh: string | null;
  diaChi: string | null;
  anhDaiDien: string | null;
}

interface ProfileProps {
  user: ProfileUser;
  onBack: () => void;
  onProfileUpdated?: (updatedProfile: {
    nguoiDungId: number;
    hoTen: string;
    email: string;
    anhDaiDien?: string | null;
  }) => void;
}

const Profile: React.FC<ProfileProps> = ({
  user,
  onBack,
  onProfileUpdated,
}) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const [isEditing, setIsEditing] = useState(false);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    hoTen: "",
    soDienThoai: "",
    ngaySinh: "",
    diaChi: "",
  });

  // =========================================================
  // LẤY HỒ SƠ HIỆN TẠI
  // =========================================================

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/me");

      const data = response.data;

      const profileData: ProfileData = {
        nguoiDungId: data.nguoiDungId,
        hoTen: data.hoTen || "",
        email: data.email || "",
        soDienThoai: data.soDienThoai || null,
        ngaySinh: data.ngaySinh || null,
        diaChi: data.diaChi || null,
        anhDaiDien: getAvatarPath(data),
      };

      setProfile(profileData);

      setForm({
        hoTen: profileData.hoTen,
        soDienThoai: profileData.soDienThoai || "",
        ngaySinh: profileData.ngaySinh || "",
        diaChi: profileData.diaChi || "",
      });
    } catch (err: any) {
      console.error("Lỗi lấy hồ sơ:", err);

      setError(
        err.response?.data?.detail || "Không thể tải thông tin hồ sơ cá nhân.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // =========================================================
  // VAI TRÒ
  // =========================================================

  const roleName =
    user.vaiTro.length > 0
      ? user.vaiTro.map((role) => role.tenVaiTro).join(", ")
      : "Chưa có vai trò";

  // =========================================================
  // BẮT ĐẦU SỬA
  // =========================================================

  const handleEdit = () => {
    if (!profile) return;

    setForm({
      hoTen: profile.hoTen,
      soDienThoai: profile.soDienThoai || "",
      ngaySinh: profile.ngaySinh || "",
      diaChi: profile.diaChi || "",
    });

    setError("");

    setSuccess("");

    setIsEditing(true);
  };

  // =========================================================
  // HỦY SỬA
  // =========================================================

  const handleCancelEdit = () => {
    if (!profile) return;

    setForm({
      hoTen: profile.hoTen,
      soDienThoai: profile.soDienThoai || "",
      ngaySinh: profile.ngaySinh || "",
      diaChi: profile.diaChi || "",
    });

    setError("");

    setSuccess("");

    setIsEditing(false);
  };

  // =========================================================
  // CẬP NHẬT FORM
  // =========================================================

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");

    setSuccess("");
  };

  // =========================================================
  // CẬP NHẬT HỒ SƠ
  // =========================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentProfile = profile;
    if (!currentProfile) {
      setError("Không tìm thấy thông tin hồ sơ.");
      return;
    }

    if (!form.hoTen.trim()) {
      setError("Họ tên không được để trống.");

      return;
    }

    if (form.soDienThoai.trim()) {
      const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

      if (!phoneRegex.test(form.soDienThoai.trim())) {
        setError("Số điện thoại Việt Nam không hợp lệ.");

        return;
      }
    }

    try {
      setSaving(true);

      setError("");

      setSuccess("");

      const response = await api.put("/me", {
        ho_ten: form.hoTen.trim(),
        so_dien_thoai: form.soDienThoai.trim() || null,
        ngay_sinh: form.ngaySinh || null,
        dia_chi: form.diaChi.trim() || null,
      });

      const data = response.data?.data;

      if (!data) {
        throw new Error("API không trả về dữ liệu hồ sơ.");
      }

      const updatedProfile: ProfileData = {
        nguoiDungId: data.nguoiDungId,
        hoTen: data.hoTen || "",
        email: data.email || "",
        soDienThoai: data.soDienThoai || null,
        ngaySinh: data.ngaySinh || null,
        diaChi: data.diaChi || null,
        anhDaiDien: getAvatarPath(data) || currentProfile.anhDaiDien,
      };

      setProfile(updatedProfile);

      setForm({
        hoTen: updatedProfile.hoTen,
        soDienThoai: updatedProfile.soDienThoai || "",
        ngaySinh: updatedProfile.ngaySinh || "",
        diaChi: updatedProfile.diaChi || "",
      });

      setSuccess(response.data?.message || "Cập nhật hồ sơ thành công.");

      setIsEditing(false);

      if (onProfileUpdated) {
        onProfileUpdated({
          nguoiDungId: updatedProfile.nguoiDungId,
          hoTen: updatedProfile.hoTen,
          email: updatedProfile.email,
          anhDaiDien: updatedProfile.anhDaiDien,
        });
      }
    } catch (err: any) {
      console.error("Lỗi cập nhật hồ sơ:", err);

      const detail =
        err.response?.data?.detail ||
        err.message ||
        "Không thể cập nhật hồ sơ.";

      setError(detail);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelection = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    const currentProfile = profile;
    if (!file || !currentProfile) {
      return;
    }

    const validType = ["image/jpeg", "image/png"].includes(file.type);
    if (!validType) {
      setError("Vui lòng chọn ảnh JPG hoặc PNG.");
      setSuccess("");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Ảnh đại diện không được vượt quá 2 MB.");
      setSuccess("");
      return;
    }

    try {
      setUploadingAvatar(true);
      setError("");
      setSuccess("");

      const processed = await processAvatar(file);
      const formData = new FormData();
      formData.append("file", processed.avatar);

      const response = await api.put("/me/avatar", formData);

      const responseData = response.data?.data ?? response.data;
      let avatarPath = getAvatarPath(responseData);

      if (!avatarPath) {
        const profileResponse = await api.get("/me");
        avatarPath = getAvatarPath(profileResponse.data);
      }

      avatarPath =
        avatarPath || `/users/${currentProfile.nguoiDungId}/avatar`;

      const updatedProfile = { ...currentProfile, anhDaiDien: avatarPath };
      setProfile(updatedProfile);
      setSuccess("Cập nhật ảnh đại diện thành công.");
      onProfileUpdated?.({
        nguoiDungId: updatedProfile.nguoiDungId,
        hoTen: updatedProfile.hoTen,
        email: updatedProfile.email,
        anhDaiDien: avatarPath,
      });
    } catch (err: any) {
      console.error("Lỗi cập nhật ảnh đại diện:", err);
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Không thể cập nhật ảnh đại diện.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-loading">
            <div className="profile-loading-icon">⏳</div>

            <h2>Đang tải hồ sơ</h2>

            <p>Vui lòng chờ trong giây lát...</p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // ERROR KHÔNG CÓ PROFILE
  // =========================================================

  if (!profile) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-error-card">
            <div className="profile-error-icon">!</div>

            <h2>Không thể tải hồ sơ</h2>

            <p>{error || "Đã xảy ra lỗi không xác định."}</p>

            <button
              type="button"
              className="profile-primary-button"
              onClick={loadProfile}
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // AVATAR
  // =========================================================

  const avatarLetter = profile.hoTen.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* =====================================================
            HEADER
        ===================================================== */}

        <section className="dashboard-hero profile-hero">
          <div className="dashboard-hero-content">
            <div className="dashboard-hero-label">TÀI KHOẢN CÁ NHÂN</div>

            <h2>Hồ sơ cá nhân</h2>

            <p>Xem và quản lý thông tin cá nhân của bạn.</p>
          </div>

          {!isEditing && (
            <button
              type="button"
              className="profile-edit-button"
              onClick={handleEdit}
            >
              ✎<span>Sửa hồ sơ</span>
            </button>
          )}
        </section>

        {/* =====================================================
            PROFILE CARD
        ===================================================== */}

        <div className="profile-card">
          {/* ===================================================
              PROFILE SUMMARY
          =================================================== */}

          <div className="profile-summary">
            <div className="profile-avatar">
              <AvatarImage
                source={profile.anhDaiDien}
                userId={profile.nguoiDungId}
                fallback={avatarLetter}
                alt={`Ảnh đại diện của ${profile.hoTen}`}
              />
            </div>

            <div className="profile-summary-content">
              <h2>{profile.hoTen}</h2>

              <p>{profile.email}</p>

              <div className="profile-role-badge">🛡️ {roleName}</div>
              <div className="profile-avatar-actions">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                  onChange={handleAvatarSelection}
                  hidden
                />
                <button
                  type="button"
                  className="profile-avatar-button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? "Đang tải ảnh..." : "Tải ảnh đại diện"}
                </button>
                <span>JPG/PNG, tối đa 2 MB. Ảnh sẽ được cắt vuông tự động.</span>
              </div>
            </div>
          </div>

          {/* ===================================================
              MESSAGE
          =================================================== */}

          {success && (
            <ToastNotification
              type="success"
              text={success}
              onClose={() => setSuccess("")}
            />
          )}

          {error && (
            <div className="profile-message profile-message-error">
              <span>!</span>

              <span>{error}</span>
            </div>
          )}

          {/* ===================================================
              FORM
          =================================================== */}

          <form onSubmit={handleSubmit}>
            <div className="profile-section-title">
              <div className="profile-section-icon">👤</div>

              <div>
                <h3>Thông tin cá nhân</h3>

                <p>
                  {isEditing
                    ? "Cập nhật thông tin cá nhân của bạn."
                    : "Thông tin tài khoản hiện tại."}
                </p>
              </div>
            </div>

            <div className="profile-form-grid">
              {/* HỌ TÊN */}

              <div className="profile-field">
                <label htmlFor="hoTen">Họ và tên</label>

                <input
                  id="hoTen"
                  name="hoTen"
                  type="text"
                  value={form.hoTen}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Nhập họ và tên"
                />
              </div>

              {/* EMAIL */}

              <div className="profile-field">
                <label htmlFor="email">Email</label>

                <input id="email" type="email" value={profile.email} disabled />

                <span className="profile-field-note">
                  Email không thể thay đổi.
                </span>
              </div>

              {/* SỐ ĐIỆN THOẠI */}

              <div className="profile-field">
                <label htmlFor="soDienThoai">Số điện thoại</label>

                <input
                  id="soDienThoai"
                  name="soDienThoai"
                  type="tel"
                  value={form.soDienThoai}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Ví dụ: 0912345678"
                />
              </div>

              {/* NGÀY SINH */}

              <div className="profile-field">
                <label htmlFor="ngaySinh">Ngày sinh</label>

                <input
                  id="ngaySinh"
                  name="ngaySinh"
                  type="date"
                  value={form.ngaySinh}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>

              {/* MÃ NGƯỜI DÙNG */}

              <div className="profile-field">
                <label htmlFor="nguoiDungId">Mã người dùng</label>

                <input
                  id="nguoiDungId"
                  type="text"
                  value={profile.nguoiDungId}
                  disabled
                />

                <span className="profile-field-note">
                  Mã người dùng do hệ thống quản lý.
                </span>
              </div>

              {/* VAI TRÒ */}

              <div className="profile-field">
                <label htmlFor="vaiTro">Vai trò</label>

                <input id="vaiTro" type="text" value={roleName} disabled />

                <span className="profile-field-note">
                  Vai trò chỉ có quản trị viên mới có thể thay đổi.
                </span>
              </div>

              {/* ĐỊA CHỈ */}

              <div className="profile-field profile-field-full">
                <label htmlFor="diaChi">Địa chỉ</label>

                <textarea
                  id="diaChi"
                  name="diaChi"
                  value={form.diaChi}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Nhập địa chỉ của bạn"
                  rows={4}
                />
              </div>
            </div>

            {/* =================================================
                ACTION BUTTONS
            ================================================= */}

            {isEditing && (
              <div className="profile-form-actions">
                <button
                  type="button"
                  className="profile-cancel-button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  className="profile-save-button"
                  disabled={saving}
                >
                  {saving ? "Đang cập nhật..." : "✓ Cập nhật"}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* =====================================================
            QUAY LẠI TRANG CHỦ
        ===================================================== */}

        <div className="profile-back-section">
          <button
            type="button"
            className="profile-back-button"
            onClick={onBack}
          >
            ← Quay lại trang chủ
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
