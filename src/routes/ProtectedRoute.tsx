import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const user = localStorage.getItem("user");

  if (!user) {
    window.location.href = "/";
    return null;
  }

  return <>{children}</>;
}

export default ProtectedRoute;