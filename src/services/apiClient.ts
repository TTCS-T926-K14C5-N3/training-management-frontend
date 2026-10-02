const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Cấu trúc response lỗi chuẩn hóa
export interface ApiErrorResponse {
  statusCode: number;
  message: string;
}

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("accessToken");

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // 1. Chuẩn hóa lỗi 401: Chưa xác thực / Token hết hạn
    if (response.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      // Tùy chọn: Chuyển hướng về trang đăng nhập hoặc phát sự kiện
      window.location.reload(); 
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
    }

    // 2. Chuẩn hóa lỗi 403: Không có quyền truy cập
    if (response.status === 403) {
      throw new Error("Bạn không có quyền truy cập vào chức năng này!");
    }

    // 3. Chuẩn hóa các lỗi khác (400, 404, 500...)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || errorData.message || "Đã xảy ra lỗi hệ thống!";
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error: any) {
    throw error;
  }
};