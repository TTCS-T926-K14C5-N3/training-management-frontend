interface ErrorPageProps {
  code: 401 | 403 | 404;
  title: string;
  message: string;
  actionText: string;
  onAction: () => void;
}

function ErrorPage({
  code,
  title,
  message,
  actionText,
  onAction,
}: ErrorPageProps) {
  return (
    <div className="error-page">
      <div className="error-content">
        <div className="error-code">{code}</div>

        <h1>{title}</h1>

        <p>{message}</p>

        <button type="button" onClick={onAction}>
          ← {actionText}
        </button>
      </div>
    </div>
  );
}

export default ErrorPage;