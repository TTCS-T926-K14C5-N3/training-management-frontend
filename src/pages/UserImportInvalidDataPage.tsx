import React from "react";

interface InvalidImportRow {
  row: number;
  hoTen: string;
  email: string;
  vaiTro: string | null;
  errors: string[];
  outcome?: string;
}

interface InvalidImportHistoryState {
  userImportInvalidData?: {
    title: string;
    rows: InvalidImportRow[];
  };
}

const UserImportInvalidDataPage: React.FC = () => {
  const invalidData = (
    window.history.state as InvalidImportHistoryState | null
  )?.userImportInvalidData;

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.history.replaceState({}, "", "/quan-ly-nguoi-dung");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <main
      style={{
        minHeight: "100%",
        padding: "32px",
        color: "#172033",
        background: "#fff",
      }}
    >
      <button
        type="button"
        onClick={goBack}
        style={{
          marginBottom: "20px",
          padding: "10px 14px",
          border: "1px solid #d1d5db",
          borderRadius: "6px",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        ← Quay lại
      </button>
      <h1 style={{ margin: "0 0 8px", fontSize: "24px" }}>
        {invalidData?.title ?? "Dữ liệu không hợp lệ"}
      </h1>
      <p style={{ margin: "0 0 20px", color: "#64748b" }}>
        {invalidData
          ? `${invalidData.rows.length} dòng cần kiểm tra.`
          : "Không tìm thấy dữ liệu chi tiết. Vui lòng quay lại và mở danh sách từ kết quả import."}
      </p>

      {invalidData && invalidData.rows.length > 0 && (
        <div style={{ overflowX: "auto", border: "1px solid #fecaca", borderRadius: "8px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr style={{ background: "#fef2f2" }}>
                <th style={cellStyle}>Dòng</th>
                <th style={cellStyle}>Họ tên</th>
                <th style={cellStyle}>Email</th>
                <th style={cellStyle}>Vai trò</th>
                {invalidData.rows.some((item) => item.outcome) && (
                  <th style={cellStyle}>Kết quả</th>
                )}
                <th style={cellStyle}>Lỗi</th>
              </tr>
            </thead>
            <tbody>
              {invalidData.rows.map((item, index) => (
                <tr key={`${item.row}-${item.outcome ?? "invalid"}-${index}`}>
                  <td style={cellStyle}>{item.row}</td>
                  <td style={cellStyle}>{item.hoTen || "-"}</td>
                  <td style={cellStyle}>{item.email || "-"}</td>
                  <td style={cellStyle}>{item.vaiTro || "-"}</td>
                  {invalidData.rows.some((row) => row.outcome) && (
                    <td style={cellStyle}>{item.outcome || "-"}</td>
                  )}
                  <td style={{ ...cellStyle, color: "#dc2626" }}>
                    {item.errors.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
};

const cellStyle: React.CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid #e5e7eb",
  textAlign: "left",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

export default UserImportInvalidDataPage;
