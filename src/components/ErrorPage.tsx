
import React from "react";
import "./ErrorPage.css";

interface ErrorPageProps {
  code?: number;
  message?: string;
}

export default function ErrorPage({
  code = 404,
  message = "Trang bạn tìm kiếm không tồn tại hoặc đã bị xóa.",
}: ErrorPageProps) {
  return (
    <div className="error-page">
      <div className="error-content">
        <div className="error-code">{code}</div>
        <h1>Oops! Không tìm thấy trang</h1>
        <p>{message}</p>

        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          ← Quay về trang chủ
        </button>
      </div>
    </div>
  );
}
