import React, { useState } from 'react';
import axios from 'axios';
// (Tuỳ chọn: Nếu bạn dùng react-router-dom, bỏ comment dòng dưới để dùng chuyển hướng)
// import { useNavigate } from 'react-router-dom';

const ChangePassword = () => {
  // 1. Khai báo các state để lưu dữ liệu người dùng nhập vào
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // State dùng để hiển thị lỗi, loading, và thông báo thành công
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // const navigate = useNavigate(); // Nếu muốn chuyển hướng sau khi thành công

  // 2. Hàm xử lý khi người dùng bấm nút "Đổi mật khẩu"
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Ngăn trình duyệt tự động load lại trang
    setError('');       // Xóa thông báo lỗi cũ
    setSuccessMsg('');  // Xóa thông báo thành công cũ

    // Kiểm tra tính hợp lệ cơ bản
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng điền đầy đủ tất cả các trường.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và Xác nhận mật khẩu không khớp!');
      return;
    }

    // Bắt đầu quá trình gọi API
    setIsLoading(true);

    try {
      // Lấy Token (JWT) từ nơi bạn lưu trữ (ví dụ: localStorage, session, cookie...)
      // Lưu ý: Đoạn này phải khớp với cách bạn lưu token lúc đăng nhập ở file App.tsx
      const storedUser = localStorage.getItem('user');
      let token = '';
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        // Tuỳ thuộc vào backend trả về token dưới tên gì (vd: token, accessToken...)
        token = parsedUser.token || ''; 
      }

     if (!token) {
        setError('Bạn chưa đăng nhập hoặc phiên đã hết hạn.');
        setIsLoading(false);
        return;
      } 

      // 3. Gọi API xuống Backend bằng Axios
      const response = await axios.post(
        'http://127.0.0.1:8000/change-password', // Thay thế bằng API thật của nhóm bạn
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Nếu Backend trả về thành công
      setSuccessMsg('Đổi mật khẩu thành công!');
      // Có thể dùng navigate('/dashboard') để chuyển trang tại đây

    } catch (err: any) {
      // 4. Xử lý lỗi trả về từ Backend (Mật khẩu cũ sai, lỗi server...)
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Đã xảy ra lỗi khi kết nối tới máy chủ. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false); // Kết thúc quá trình loading
    }
  };

  // 3. Phần giao diện hiển thị (HTML/JSX)
  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Đổi mật khẩu</h2>
      
      {/* Khung hiển thị thông báo lỗi (nếu có) */}
      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
      
      {/* Khung hiển thị thông báo thành công */}
      {successMsg && <div style={{ color: 'green', marginBottom: '15px', fontWeight: 'bold' }}>{successMsg}</div>}

      <form onSubmit={handleSubmit}>
        {/* Trường: Mật khẩu hiện tại */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Mật khẩu hiện tại:</label>
          <input 
            type="password" 
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            disabled={isLoading}
          />
        </div>

        {/* Trường: Mật khẩu mới */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Mật khẩu mới:</label>
          <input 
            type="password" 
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            disabled={isLoading}
          />
        </div>

        {/* Trường: Xác nhận mật khẩu mới */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Xác nhận mật khẩu mới:</label>
          <input 
            type="password" 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            disabled={isLoading}
          />
        </div>

        {/* Nút xác nhận */}
        <button 
          type="submit" 
          disabled={isLoading}
          style={{ width: '100%', padding: '10px', backgroundColor: isLoading ? '#6c757d' : '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
          {isLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
        </button>
      </form>
    </div>
  );
};

export default ChangePassword;