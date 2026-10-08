import React, { useRef, useState } from "react";
import api from "../services/api";

interface ValidUser {
  row: number;
  hoTen: string;
  email: string;
  vaiTroId: number;
  vaiTro: string;
  trangThai: string;
  errors: string[];
}

interface InvalidUser {
  row: number;
  hoTen: string;
  email: string;
  vaiTroId: number | null;
  vaiTro: string | null;
  trangThai: string;
  errors: string[];
}

interface PreviewResponse {
  message: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  canImport: boolean;
  validData: ValidUser[];
  invalidData: InvalidUser[];
}

interface ImportResponse extends PreviewResponse {
  createdRows: number;
  failedRows: number;
  createdUsers: Array<{
    row: number;
    nguoiDungId: number;
    hoTen: string;
    email: string;
    vaiTroId: number;
    vaiTro: string;
  }>;
  failedData: InvalidUser[];
}

interface UserImportModalProps {
  onClose: () => void;
  onImported: (createdRows: number, failedRows: number) => void | Promise<void>;
}

const UserImportModal: React.FC<UserImportModalProps> = ({
  onClose,
  onImported,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    setError("");
    setSuccess("");
    setPreview(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setSelectedFile(null);
      setError("Chỉ hỗ trợ file Excel có định dạng .xlsx.");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    setSelectedFile(file);
  };

  const handleDownloadTemplate = async () => {
    try {
      setLoadingTemplate(true);
      setError("");

      const response = await api.get("/users/import/template", {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "user_import_template.xlsx";

      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Không thể tải file Excel mẫu.");
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      setError("Vui lòng chọn file Excel trước.");
      return;
    }

    try {
      setLoadingPreview(true);
      setError("");
      setSuccess("");
      setPreview(null);

      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await api.post<PreviewResponse>(
        "/users/import/preview",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      setPreview(response.data);
    } catch (err: any) {
      console.error(err);

      const detail = err?.response?.data?.detail;

      setError(
        typeof detail === "string" ? detail : "Không thể kiểm tra file Excel.",
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError("Vui lòng chọn file Excel.");
      return;
    }

    if (!preview) {
      setError("Vui lòng kiểm tra file trước khi import.");
      return;
    }

    if (!preview.canImport) {
      setError("Không có dữ liệu hợp lệ để import.");
      return;
    }

    try {
      setLoadingImport(true);
      setError("");
      setSuccess("");

      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await api.post<ImportResponse>(
        "/users/import",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const result = response.data;

      if (result.createdRows === 0) {
        setError(
          result.failedRows > 0
            ? `Không tạo được tài khoản nào. Có ${result.failedRows} dòng bị lỗi.`
            : "File không có tài khoản nào được tạo.",
        );
        return;
      }

      if (result.failedRows > 0) {
        setSuccess(
          `Đã tạo ${result.createdRows} tài khoản. Có ${result.failedRows} dòng tạo tài khoản thất bại.`,
        );
      } else {
        setSuccess(`Import thành công ${result.createdRows} tài khoản.`);
      }

      await onImported(result.createdRows, result.failedRows);
    } catch (err: any) {
      console.error(err);

      const detail = err?.response?.data?.detail;

      setError(
        typeof detail === "string" ? detail : "Không thể import file Excel.",
      );
    } finally {
      setLoadingImport(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#fff",
          width: "100%",
          maxWidth: "1000px",
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "22px",
              }}
            >
              Import người dùng từ Excel
            </h2>

            <p
              style={{
                marginTop: "6px",
                marginBottom: 0,
                color: "#666",
                fontSize: "14px",
              }}
            >
              Tải file mẫu, điền thông tin người dùng rồi tải lên để kiểm tra.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "24px",
              cursor: "pointer",
              color: "#666",
            }}
          >
            ×
          </button>
        </div>

        {/* DOWNLOAD TEMPLATE */}

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "16px",
            background: "#f9fafb",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: "6px",
            }}
          >
            Bước 1: Tải file Excel mẫu
          </div>

          <div
            style={{
              color: "#666",
              fontSize: "14px",
              marginBottom: "12px",
            }}
          >
            File cần có 3 cột: Họ tên, Email, Vai trò.
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={loadingTemplate}
            style={{
              padding: "9px 14px",
              border: "1px solid #2563eb",
              borderRadius: "6px",
              background: "#fff",
              color: "#2563eb",
              cursor: loadingTemplate ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loadingTemplate ? "Đang tải..." : "Tải Excel mẫu"}
          </button>
        </div>

        {/* SELECT FILE */}

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: "6px",
            }}
          >
            Bước 2: Chọn file Excel
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleSelectFile}
          />

          {selectedFile && (
            <div
              style={{
                marginTop: "10px",
                fontSize: "14px",
                color: "#374151",
              }}
            >
              File đã chọn: <strong>{selectedFile.name}</strong>
            </div>
          )}
        </div>

        {/* ERROR */}

        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              padding: "10px 12px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div
            style={{
              background: "#f0fdf4",
              color: "#15803d",
              border: "1px solid #bbf7d0",
              borderRadius: "6px",
              padding: "10px 12px",
              marginBottom: "16px",
            }}
          >
            {success}
          </div>
        )}

        {/* PREVIEW BUTTON */}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "20px",
          }}
        >
          <button
            type="button"
            onClick={handlePreview}
            disabled={!selectedFile || loadingPreview}
            style={{
              padding: "10px 18px",
              border: "none",
              borderRadius: "6px",
              background:
                !selectedFile || loadingPreview ? "#9ca3af" : "#2563eb",
              color: "#fff",
              cursor:
                !selectedFile || loadingPreview ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loadingPreview ? "Đang kiểm tra..." : "Kiểm tra file"}
          </button>
        </div>

        {/* PREVIEW RESULT */}

        {preview && (
          <div>
            <h3
              style={{
                marginBottom: "12px",
              }}
            >
              Kết quả kiểm tra
            </h3>

            {/* SUMMARY */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  padding: "14px",
                  background: "#f3f4f6",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    color: "#666",
                    fontSize: "13px",
                  }}
                >
                  Tổng số dòng
                </div>

                <strong
                  style={{
                    fontSize: "22px",
                  }}
                >
                  {preview.totalRows}
                </strong>
              </div>

              <div
                style={{
                  padding: "14px",
                  background: "#f0fdf4",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    color: "#666",
                    fontSize: "13px",
                  }}
                >
                  Hợp lệ
                </div>

                <strong
                  style={{
                    fontSize: "22px",
                    color: "#15803d",
                  }}
                >
                  {preview.validRows}
                </strong>
              </div>

              <div
                style={{
                  padding: "14px",
                  background: "#fef2f2",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    color: "#666",
                    fontSize: "13px",
                  }}
                >
                  Không hợp lệ
                </div>

                <strong
                  style={{
                    fontSize: "22px",
                    color: "#dc2626",
                  }}
                >
                  {preview.invalidRows}
                </strong>
              </div>
            </div>

            {/* VALID DATA */}

            {preview.validData.length > 0 && (
              <div
                style={{
                  marginBottom: "20px",
                }}
              >
                <h4>Dữ liệu hợp lệ</h4>

                <div
                  style={{
                    overflowX: "auto",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "14px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "#f9fafb",
                        }}
                      >
                        <th style={thStyle}>Dòng</th>
                        <th style={thStyle}>Họ tên</th>
                        <th style={thStyle}>Email</th>
                        <th style={thStyle}>Vai trò</th>
                        <th style={thStyle}>Trạng thái</th>
                      </tr>
                    </thead>

                    <tbody>
                      {preview.validData.map((item) => (
                        <tr key={item.row}>
                          <td style={tdStyle}>{item.row}</td>

                          <td style={tdStyle}>{item.hoTen}</td>

                          <td style={tdStyle}>{item.email}</td>

                          <td style={tdStyle}>{item.vaiTro}</td>

                          <td
                            style={{
                              ...tdStyle,
                              color: "#15803d",
                              fontWeight: 600,
                            }}
                          >
                            Hợp lệ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* INVALID DATA */}

            {preview.invalidData.length > 0 && (
              <div
                style={{
                  marginBottom: "20px",
                }}
              >
                <h4>Dữ liệu không hợp lệ</h4>

                <div
                  style={{
                    overflowX: "auto",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "14px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "#fef2f2",
                        }}
                      >
                        <th style={thStyle}>Dòng</th>
                        <th style={thStyle}>Họ tên</th>
                        <th style={thStyle}>Email</th>
                        <th style={thStyle}>Vai trò</th>
                        <th style={thStyle}>Lỗi</th>
                      </tr>
                    </thead>

                    <tbody>
                      {preview.invalidData.map((item) => (
                        <tr key={item.row}>
                          <td style={tdStyle}>{item.row}</td>

                          <td style={tdStyle}>{item.hoTen || "-"}</td>

                          <td style={tdStyle}>{item.email || "-"}</td>

                          <td style={tdStyle}>{item.vaiTro || "-"}</td>

                          <td
                            style={{
                              ...tdStyle,
                              color: "#dc2626",
                            }}
                          >
                            {item.errors.join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FOOTER */}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 18px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleImport}
            disabled={!preview || !preview.canImport || loadingImport}
            style={{
              padding: "10px 18px",
              border: "none",
              borderRadius: "6px",
              background:
                !preview || !preview.canImport || loadingImport
                  ? "#9ca3af"
                  : "#16a34a",
              color: "#fff",
              cursor:
                !preview || !preview.canImport || loadingImport
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 600,
            }}
          >
            {loadingImport ? "Đang import..." : "Import dữ liệu"}
          </button>
        </div>
      </div>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "top",
};

export default UserImportModal;
