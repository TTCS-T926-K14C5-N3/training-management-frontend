import axios from 'axios';

// Thiết lập cấu hình gọi API mặc định 
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000', // Sửa lại nếu Backend chạy ở cổng khác
    timeout: 10000,
});

// CHỐT CHẶN PHẢN HỒI (SCRUM-16: Xử lý phiên đăng nhập)
api.interceptors.response.use(
    (response: any) => {
        // API thành công (Mã 2xx), trả về dữ liệu bình thường
        return response;
    }, // <--- Lỗi của bạn có thể do thiếu dấu phẩy rất quan trọng ở dòng này
    (error: any) => {
        // 1. Phát hiện phiên hết hạn: Kiểm tra mã lỗi 401 Unauthorized
        if (error.response && error.response.status === 401) {
            
            // 2. Hiển thị thông báo
            alert("Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.");

            // 3. Xóa chìa khóa (Token) đã hết hạn để chặn quyền truy cập
            localStorage.removeItem('token');
            
            // 4. Điều hướng về màn hình Đăng nhập
            window.location.href = '/login'; 
        }
        
        // Trả lỗi về để ứng dụng không bị treo
        return Promise.reject(error);
    }
);

export default api;