import React from "react";

interface ProfileProps {
  user: {
    nguoiDungId: number;
    hoTen: string;
    email: string;
    vaiTro: {
      vaiTroId: number;
      tenVaiTro: string;
    }[];
  };
  onBack: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onBack }) => {
  const roleName =
    user.vaiTro.length > 0
      ? user.vaiTro.map((role) => role.tenVaiTro).join(", ")
      : "Chưa có vai trò";

  return (
    <div
      style={{
        minHeight: "100%",
        padding: "30px",
        background: "#f3f6fb",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            marginBottom: "25px",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              border: "none",
              background: "#fff",
              borderRadius: "10px",
              padding: "10px 15px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            ← Quay lại
          </button>

          <div>
            <h1 style={{ margin: 0 }}>Hồ sơ cá nhân</h1>

            <p
              style={{
                margin: "5px 0 0",
                color: "#6b7280",
              }}
            >
              Xem thông tin tài khoản cá nhân
            </p>
          </div>
        </div>

        {/* PROFILE CARD */}
        <div
          style={{
            background: "#fff",
            borderRadius: "18px",
            padding: "30px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
          }}
        >
          {/* AVATAR */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              paddingBottom: "25px",
              borderBottom: "1px solid #e5e7eb",
              marginBottom: "25px",
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "#2563eb",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
                fontWeight: 700,
              }}
            >
              {user.hoTen.charAt(0).toUpperCase()}
            </div>

            <div>
              <h2 style={{ margin: 0 }}>{user.hoTen}</h2>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#6b7280",
                }}
              >
                {roleName}
              </p>
            </div>
          </div>

          {/* INFORMATION */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
            }}
          >
            <div>
              <label style={labelStyle}>Họ và tên</label>

              <div style={valueStyle}>{user.hoTen}</div>
            </div>

            <div>
              <label style={labelStyle}>Email</label>

              <div style={valueStyle}>{user.email}</div>
            </div>

            <div>
              <label style={labelStyle}>Mã người dùng</label>

              <div style={valueStyle}>{user.nguoiDungId}</div>
            </div>

            <div>
              <label style={labelStyle}>Vai trò</label>

              <div style={valueStyle}>{roleName}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "#6b7280",
  marginBottom: "8px",
};

const valueStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  padding: "12px 14px",
  color: "#111827",
  fontWeight: 500,
};

export default Profile;
