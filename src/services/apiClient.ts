const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("accessToken");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // 1. Xử lý lỗi 401: Chưa xác thực / Token hết hạn
    if (response.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      window.location.href = "/login"; // Điều hướng về trang Đăng nhập
      throw new Error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!");
    }

    // 2. Xử lý lỗi 403: Không có quyền truy cập
    if (response.status === 403) {
      throw new Error("Bạn không có quyền truy cập vào tài nguyên này (403 Forbidden)!");
    }

    // 3. Xử lý lỗi 404: Không tìm thấy đường dẫn / dữ liệu
    if (response.status === 404) {
      throw new Error("Không tìm thấy dữ liệu hoặc đường dẫn yêu cầu (404 Not Found)!");
    }

    // 4. Xử lý các lỗi khác (400, 500...)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || errorData.message || `Lỗi hệ thống (${response.status})!`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error: any) {
    throw error;
  }
};
(window as any).fetchWithAuth = fetchWithAuth;