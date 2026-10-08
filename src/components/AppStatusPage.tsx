import "./AppStatusPage.css";

export type AppStatus = "forbidden" | "not-found";

interface AppStatusPageProps {
  status: AppStatus;
}

const STATUS_CONTENT: Record<
  AppStatus,
  { code: string; title: string; message: string }
> = {
  forbidden: {
    code: "403",
    title: "Bạn chưa có quyền truy cập",
    message:
      "Tài khoản hiện tại chưa được cấp quyền sử dụng chức năng này. Hãy quay lại trang trước hoặc liên hệ quản trị viên để được hỗ trợ.",
  },
  "not-found": {
    code: "404",
    title: "Không tìm thấy trang",
    message:
      "Đường dẫn có thể đã thay đổi hoặc không tồn tại. Hãy quay lại trang trước hoặc về trang chủ để tiếp tục.",
  },
};

const navigateHome = () => {
  window.history.replaceState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const AppStatusPage: React.FC<AppStatusPageProps> = ({ status }) => {
  const content = STATUS_CONTENT[status];

  return (
    <section className="app-status-page" role="alert">
      <div className="app-status-card">
        <span className="app-status-code">{content.code}</span>
        <h1>{content.title}</h1>
        <p>{content.message}</p>
        <div className="app-status-actions">
          <button
            className="app-status-primary"
            type="button"
            onClick={navigateHome}
          >
            Về trang chủ
          </button>
          <button
            className="app-status-secondary"
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                navigateHome();
              }
            }}
          >
            Quay lại trang trước
          </button>
        </div>
      </div>
    </section>
  );
};

export default AppStatusPage;
