import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

// =========================================================
// 1. CHỐT CHẶN GỬI ĐI (Tự động gắn Token vào API)
// =========================================================
api.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    } catch (e) {
      console.error("Lỗi đọc token:", e);
    }
  }
  return config;
});

// =========================================================
// 2. CHỐT CHẶN PHẢN HỒI (Xử lý lỗi 401 / 403 theo Task)
// =========================================================
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const status = error.response.status;
      
      // Lấy URL của API vừa gọi để kiểm tra
      const url = error.config.url;

      // Logic xử lý 401 -> Trang đăng nhập (TRỪ API /login)
      if (status === 401 && !url.includes('/login')) {
        alert("Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập.");
        localStorage.removeItem('user'); 
        window.location.href = '/';      
      } 
      // Logic xử lý 403 -> Trang không có quyền
      else if (status === 403) {
        alert("Bạn không có quyền thực hiện thao tác này!");
      }
    }
    return Promise.reject(error);
  }
);

export default api;