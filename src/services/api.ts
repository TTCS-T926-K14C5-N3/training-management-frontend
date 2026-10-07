import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const SESSION_EXPIRED_EVENT = "session-expired";

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

export const getTokenExpiresAt = (token: string): number | null => {
  try {
    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      "=",
    );
    const binaryPayload = atob(paddedBase64);
    const payloadBytes = Uint8Array.from(binaryPayload, (character) =>
      character.charCodeAt(0),
    );
    const decodedPayload = JSON.parse(
      new TextDecoder().decode(payloadBytes),
    );

    return typeof decodedPayload.exp === "number"
      ? decodedPayload.exp * 1000
      : null;
  } catch {
    return null;
  }
};

export const expireSession = () => {
  const user = getStoredUser();
  localStorage.removeItem("user");
  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRED_EVENT, {
      detail: { email: user?.email },
    }),
  );
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
    expiresAt:
      getTokenExpiresAt(newToken) ?? Date.now() + 30 * 60 * 1000,
  };

  localStorage.setItem("user", JSON.stringify(updatedUser));
};

// ===========================================================
// REFRESH ACCESS TOKEN
// ===========================================================

let refreshFailureStatus: number | null = null;

const performRefreshAccessToken = async (): Promise<string | null> => {
  const user = getStoredUser();

  if (!user?.token) {
    return null;
  }

  refreshFailureStatus = null;

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
    refreshFailureStatus = axios.isAxiosError(error)
      ? error.response?.status ?? null
      : null;
    console.error("❌ Không thể refresh access token:", error);

    if (refreshFailureStatus === 401) {
      expireSession();
    }

    return null;
  }
};

let refreshInProgress: Promise<string | null> | null = null;

export const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshInProgress) {
    refreshInProgress = performRefreshAccessToken().finally(() => {
      refreshInProgress = null;
    });
  }

  return refreshInProgress;
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

    const expiresAt =
      getTokenExpiresAt(user.token) ?? user.expiresAt;

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

        if (refreshFailureStatus !== 401) {
          console.warn("Không thể refresh phiên; giữ phiên hiện tại để thử lại.");
        }
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

      return Promise.reject(error);
    }

    // =======================================================
    // 403 - KHÔNG CÓ QUYỀN
    // =======================================================

    if (status === 403) {
      console.warn("403 - Không có quyền:", url);
    }

    return Promise.reject(error);
  },
);

export default api;
