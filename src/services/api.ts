import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_URL,
});

// ===========================================================
// LẤY USER TỪ LOCAL STORAGE
// ===========================================================

const getStoredUser = () => {
  const userStr = localStorage.getItem("user");

  if (!userStr) {
    return null;
  }

  try {
    return JSON.parse(userStr);
  } catch (error) {
    console.error("Lỗi đọc thông tin user:", error);
    return null;
  }
};

// ===========================================================
// LƯU TOKEN MỚI SAU KHI REFRESH
// ===========================================================

const saveRefreshedToken = (newToken: string) => {
  const user = getStoredUser();

  if (!user) {
    return;
  }

  const updatedUser = {
    ...user,
    token: newToken,

    // Token backend có thời hạn 30 phút
    expiresAt: Date.now() + 30 * 60 * 1000,
  };

  localStorage.setItem("user", JSON.stringify(updatedUser));
};

// ===========================================================
// REFRESH ACCESS TOKEN
// ===========================================================

const refreshAccessToken = async (): Promise<string | null> => {
  const user = getStoredUser();

  if (!user?.token) {
    return null;
  }

  try {
    // Dùng axios trực tiếp, KHÔNG dùng api.post()
    // để tránh interceptor gọi lại chính /refresh.
    const response = await axios.post(
      `${API_URL}/refresh`,
      {},
      {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      },
    );

    const newToken = response.data?.access_token;

    if (!newToken) {
      console.error("API refresh không trả về access_token.");
      return null;
    }

    saveRefreshedToken(newToken);

    console.log("✅ Access token đã được tự động gia hạn.");

    return newToken;
  } catch (error) {
    console.error("❌ Không thể refresh access token:", error);
    return null;
  }
};

// ===========================================================
// REQUEST INTERCEPTOR
// ===========================================================

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const user = getStoredUser();

    if (!user?.token) {
      return config;
    }

    const url = config.url || "";

    // Không refresh khi chính request đang gọi /refresh
    if (url.includes("/refresh")) {
      config.headers.Authorization = `Bearer ${user.token}`;
      return config;
    }

    // Không xử lý refresh cho login
    if (url.includes("/login")) {
      return config;
    }

    // =======================================================
    // KIỂM TRA TOKEN SẮP HẾT HẠN
    // =======================================================

    const expiresAt = user.expiresAt;

    if (expiresAt) {
      const now = Date.now();

      // Refresh trước khi hết hạn 2 phút
      const TWO_MINUTES = 2 * 60 * 1000;

      if (expiresAt - now <= TWO_MINUTES) {
        console.log("⏳ Access token sắp hết hạn → đang refresh...");

        const newToken = await refreshAccessToken();

        if (newToken) {
          config.headers.Authorization = `Bearer ${newToken}`;
          return config;
        }

        console.warn("⚠️ Refresh thất bại, tiếp tục dùng token cũ.");
      }
    }

    // =======================================================
    // TOKEN HIỆN TẠI
    // =======================================================

    config.headers.Authorization = `Bearer ${user.token}`;

    return config;
  },

  (error) => {
    return Promise.reject(error);
  },
);

// ===========================================================
// RESPONSE INTERCEPTOR
// ===========================================================

api.interceptors.response.use(
  (response) => {
    return response;
  },

  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & {
          _retry?: boolean;
        })
      | undefined;

    if (!error.response || !originalRequest) {
      return Promise.reject(error);
    }

    const status = error.response.status;
    const url = originalRequest.url || "";

    // =======================================================
    // 401 - THỬ REFRESH TOKEN
    // =======================================================

    if (
      status === 401 &&
      !url.includes("/login") &&
      !url.includes("/refresh") &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      console.log("🔄 API trả 401 → thử refresh access token...");

      const newToken = await refreshAccessToken();

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        console.log("✅ Refresh thành công → gửi lại request.");

        return api(originalRequest);
      }

      // Refresh thất bại
      localStorage.removeItem("user");

      alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");

      window.location.replace("/");

      return Promise.reject(error);
    }

    // =======================================================
    // 403 - KHÔNG CÓ QUYỀN
    // =======================================================

    if (status === 403) {
      const currentPath = window.location.pathname;

      const adminPaths = ["/quan-ly-vai-tro", "/quan-ly-nguoi-dung"];

      if (adminPaths.includes(currentPath)) {
        window.location.replace("/");
      } else {
        console.warn("403 - Không có quyền:", url);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
