import React from 'react';

interface ErrorPageProps {
  code: 401 | 403 | 404;
  message?: string;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ code, message }) => {
  // Cấu hình thông báo mặc định theo từng mã lỗi chuẩn hóa
  const defaultMessages = {
    401: "Bạn chưa đăng nhập hoặc phiên đã hết hạn.",
    403: "Bạn không có quyền truy cập trang này.",
    404: "Trang bạn tìm kiếm không tồn tại."
  };

  const displayMessage = message || defaultMessages[code];

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', 
      justifyContent: 'center', height: '100vh', backgroundColor: '#f8f9fa' 
    }}>
      <div style={{ 
        border: '2px dashed #ced4da', 
        padding: '50px 80px', 
        textAlign: 'center', 
        backgroundColor: '#ffffff',
        borderRadius: '8px'
      }}>
        <h1 style={{ fontSize: '64px', margin: '0 0 10px 0', color: '#343a40' }}>
          {code}
        </h1>
        <p style={{ fontSize: '18px', color: '#6c757d', marginBottom: '30px' }}>
          {displayMessage}
        </p>
        <button 
          onClick={() => window.history.back()} // Dùng JS thuần của trình duyệt
          style={{ 
            padding: '10px 24px', 
            fontSize: '16px', 
            cursor: 'pointer', 
            backgroundColor: '#e9ecef', 
            color: '#495057', 
            border: '1px solid #ced4da', 
            borderRadius: '4px',
            fontWeight: '500'
          }}
        >
          [ Quay lại ]
        </button>
      </div>
    </div>
  );
};

export default ErrorPage;