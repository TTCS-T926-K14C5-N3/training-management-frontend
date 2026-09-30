import React, { useState } from 'react';

const ChangePassword = () => {
  // 1. Khai báo các state để lưu dữ liệu người dùng nhập vào
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // State dùng để hiển thị lỗi (ví dụ: mật khẩu không khớp)
  const [error, setError] = useState('');

  // 2. Hàm xử lý khi người dùng bấm nút "Đổi mật khẩu"
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Ngăn trình duyệt tự động load lại trang
    setError(''); // Xóa lỗi cũ trước khi kiểm tra mới

    // Kiểm tra tính hợp lệ cơ bản
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng điền đầy đủ tất cả các trường.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và Xác nhận mật khẩu không khớp!');
      return;
    }

    // Nếu mọi thứ hợp lệ, ở đây sau này bạn sẽ gọi API gửi dữ liệu xuống Backend
    alert('Dữ liệu hợp lệ! Sẵn sàng gửi lên máy chủ: ' + newPassword);
  };

  // 3. Phần giao diện hiển thị (HTML/JSX)
  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Đổi mật khẩu</h2>
      
      {/* Khung hiển thị thông báo lỗi (nếu có) */}
      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Trường: Mật khẩu hiện tại */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Mật khẩu hiện tại:</label>
          <input 
            type="password" 
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
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
          />
        </div>

        {/* Nút xác nhận */}
        <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Đổi mật khẩu
        </button>
      </form>
    </div>
  );
};

export default ChangePassword;