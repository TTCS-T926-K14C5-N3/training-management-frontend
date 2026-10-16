import React, { useEffect, useRef, useState } from "react";
import "./App.css";

import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import AppStatusPage from "./components/AppStatusPage";

import UsersPage from "./pages/UsersPage";
import UserImportInvalidDataPage from "./pages/UserImportInvalidDataPage";

import GradeManagement from "./pages/GradeManagement";
import ClassManagement from "./pages/ClassManagement";
import PermissionsManagement from "./pages/PermissionsManagement";
import TrainingPrograms from "./pages/TrainingPrograms";
import AdmissionsInquiry from "./pages/AdmissionsInquiry";
import TrainingCatalog from "./pages/TrainingCatalog";
import AdmissionsLeads from "./pages/AdmissionsLeads";
import AdminDashboard from "./pages/AdminDashboard";
import ScheduleManagement from "./pages/ScheduleManagement";


import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import Profile from "./pages/Profile";

import api, {
  expireSession,
  getTokenExpiresAt,
  refreshAccessToken,
} from "./services/api";
import { getAvatarPath } from "./utils/avatar";

// ===========================================================
// TYPES
// ===========================================================

interface VaiTro {
  vaiTroId: number;
  tenVaiTro: string;
}

interface Quyen {
  quyenId: number;
  maQuyen: string;
  tenQuyen: string;
}

interface User {
  nguoiDungId: number;
  hoTen: string;
  email: string;
  anhDaiDien: string | null;
  vaiTro: VaiTro[];
  quyen: Quyen[];
  token: string;
  expiresAt: number;
  yeuCauDoiMatKhau?: boolean;
}

interface ExpiredSessionDraft {
  path: string;
  fields: Array<{
    tag: string;
    value: string;
    checked?: boolean;
    selectedValues?: string[];
  }>;
}

type DraftableField =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement;

const getDraftableFields = (): DraftableField[] =>
  Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select",
    ),
  ).filter((field) => {
    if (field.disabled) {
      return false;
    }

    if (field instanceof HTMLInputElement) {
      return !["password", "hidden", "file", "button", "submit", "reset"].includes(
        field.type,
      );
    }

    return true;
  });

const saveExpiredSessionDraft = (path: string) => {
  try {
    const fields = getDraftableFields().map((field) => {
      if (field instanceof HTMLInputElement) {
        return {
          tag: "input",
          value: field.value,
          ...(field.type === "checkbox" || field.type === "radio"
            ? { checked: field.checked }
            : {}),
        };
      }

      if (field instanceof HTMLSelectElement) {
        return {
          tag: "select",
          value: field.value,
          ...(field.multiple
            ? {
                selectedValues: Array.from(
                  field.selectedOptions,
                  (option) => option.value,
                ),
              }
            : {}),
        };
      }

      return { tag: "textarea", value: field.value };
    });

    sessionStorage.setItem(
      "expiredSessionDraft",
      JSON.stringify({ path, fields } satisfies ExpiredSessionDraft),
    );
    sessionStorage.setItem("expiredSessionPath", path);
  } catch (error) {
    console.error("Không thể lưu bản nháp trước khi phiên hết hạn:", error);
  }
};

const restoreExpiredSessionDraft = (path: string) => {
  const storedDraft = sessionStorage.getItem("expiredSessionDraft");

  if (!storedDraft) {
    return;
  }

  try {
    const draft = JSON.parse(storedDraft) as ExpiredSessionDraft;

    if (draft.path !== path) {
      return;
    }

    const fields = getDraftableFields();

    draft.fields.forEach((savedField, index) => {
      const field = fields[index];

      if (!field) {
        return;
      }

      if (
        field instanceof HTMLInputElement &&
        savedField.tag === "input" &&
        (field.type === "checkbox" || field.type === "radio") &&
        savedField.checked !== undefined
      ) {
        const checkedSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "checked",
        )?.set;
        checkedSetter?.call(field, savedField.checked);
        field.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      if (field instanceof HTMLSelectElement && savedField.tag === "select") {
        if (field.multiple && savedField.selectedValues) {
          Array.from(field.options).forEach((option) => {
            option.selected = savedField.selectedValues?.includes(option.value) ?? false;
          });
        } else {
          field.value = savedField.value;
        }

        field.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      if (
        (field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement) &&
        savedField.tag === (field instanceof HTMLInputElement ? "input" : "textarea")
      ) {
        const prototype = Object.getPrototypeOf(field);
        const valueSetter = Object.getOwnPropertyDescriptor(
          prototype,
          "value",
        )?.set;
        valueSetter?.call(field, savedField.value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    sessionStorage.removeItem("expiredSessionDraft");
    sessionStorage.removeItem("expiredSessionPath");
  } catch (error) {
    console.error("Không thể khôi phục bản nháp phiên đăng nhập:", error);
    sessionStorage.removeItem("expiredSessionDraft");
    sessionStorage.removeItem("expiredSessionPath");
  }
};

// ===========================================================
// KIỂM TRA QUYỀN
// ===========================================================

function hasPermission(user: User | null, maQuyen: string): boolean {
  if (!user) return false;

  if (isAdminUser(user)) return true;

  return user.quyen.some((quyen) => quyen.maQuyen === maQuyen);
}

const ROUTE_ACCESS_RULES: Record<
  string,
  { allOf: string[]; anyOf?: string[] }
> = {
  "/danh-muc-dao-tao": { allOf: ["CURRICULUM_VIEW"] },
  "/quan-ly-lead": { allOf: ["LEAD_VIEW"] },
  "/quan-ly-nguoi-dung": { allOf: ["USER_VIEW"] },
  "/du-lieu-import-khong-hop-le": { allOf: ["USER_CREATE"] },
  "/phan-quyen": { allOf: ["ROLE_VIEW", "ROLE_UPDATE"] },
  "/quan-ly-vai-tro": { allOf: ["ROLE_VIEW", "ROLE_UPDATE"] },
  "/quan-ly-diem": { allOf: ["GRADE_VIEW"] },
  "/quan-ly-lop": { allOf: ["CLASS_VIEW", "QUAN_LY_LOP"] },
  "/danh-sach-lop": { allOf: ["CLASS_VIEW"] },
  "/quan-ly-chuong-trinh": {
    allOf: ["CLASS_VIEW"],
    anyOf: ["CLASS_CREATE", "CLASS_UPDATE", "CLASS_DELETE"],
  },
  "/quan-ly-hoc-phi": { allOf: ["QUAN_LY_HOC_PHI"] },
  "/quan-ly-lich-hoc": { allOf: ["SCHEDULE_VIEW"] },
};

function hasRouteAccess(path: string, user: User | null): boolean {
  if (isAdminUser(user)) return true;

  const rule = ROUTE_ACCESS_RULES[path];
  if (!rule) return true;

  return (
    rule.allOf.every((permission) => hasPermission(user, permission)) &&
    (!rule.anyOf ||
      rule.anyOf.some((permission) => hasPermission(user, permission)))
  );
}

function hasAnyPermission(user: User | null, permissionCodes: string[]): boolean {
  return permissionCodes.some((permissionCode) =>
    hasPermission(user, permissionCode),
  );
}

// ===========================================================
// KIỂM TRA ADMIN
// ===========================================================

function isAdminUser(user: User | null): boolean {
  if (!user) return false;

  return user.vaiTro.some((role) => {
    const roleName = role.tenVaiTro.trim().toLowerCase();

    return (
      roleName === "admin" ||
      roleName === "quản trị hệ thống" ||
      roleName === "quản trị viên hệ thống" ||
      role.vaiTroId === 8
    );
  });
}

// ===========================================================
// KÍCH HOẠT TÀI KHOẢN
// ===========================================================

function ActivateAccountPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );

  const [message, setMessage] = useState("Đang kích hoạt tài khoản...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const token = params.get("token");

    if (!token) {
      setStatus("error");

      setMessage("Liên kết kích hoạt không hợp lệ hoặc đã bị thiếu token.");

      return;
    }

    const activateAccount = async () => {
      try {
        const response = await api.post("/activate-account", {
          token,
        });

        setStatus("success");

        setMessage(response.data?.message || "Kích hoạt tài khoản thành công.");
      } catch (error: any) {
        console.error("Lỗi kích hoạt tài khoản:", error);

        const detail =
          error.response?.data?.detail ||
          "Không thể kích hoạt tài khoản. Liên kết có thể đã hết hạn hoặc đã được sử dụng.";

        setStatus("error");

        setMessage(detail);
      }
    };

    activateAccount();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f6fb",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "500px",
          background: "#ffffff",
          borderRadius: "20px",
          padding: "40px 32px",
          textAlign: "center",
          boxShadow: "0 15px 40px rgba(0, 0, 0, 0.12)",
        }}
      >
        <div
          style={{
            fontSize: "56px",
            marginBottom: "20px",
          }}
        >
          {status === "loading" ? "⏳" : status === "success" ? "✅" : "❌"}
        </div>

        <h1
          style={{
            marginBottom: "12px",
            color:
              status === "success"
                ? "#16a34a"
                : status === "error"
                  ? "#dc2626"
                  : "#1d4ed8",
          }}
        >
          {status === "loading"
            ? "Đang kích hoạt tài khoản"
            : status === "success"
              ? "Kích hoạt thành công"
              : "Kích hoạt thất bại"}
        </h1>

        <p
          style={{
            color: "#555",
            lineHeight: 1.6,
            marginBottom: "28px",
          }}
        >
          {message}
        </p>

        {status === "loading" && (
          <p
            style={{
              color: "#777",
              fontSize: "14px",
            }}
          >
            Vui lòng chờ trong giây lát...
          </p>
        )}

        {status === "success" && (
          <button
            type="button"
            onClick={() => {
              window.location.replace("/");
            }}
            style={{
              width: "100%",
              padding: "13px 20px",
              border: "none",
              borderRadius: "10px",
              background: "#2563eb",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đi đến trang đăng nhập
          </button>
        )}

        {status === "error" && (
          <button
            type="button"
            onClick={() => {
              window.location.replace("/");
            }}
            style={{
              width: "100%",
              padding: "13px 20px",
              border: "none",
              borderRadius: "10px",
              background: "#2563eb",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Quay lại trang đăng nhập
          </button>
        )}
      </div>
    </div>
  );
}

// ===========================================================
// APP
// ===========================================================

function App() {
  // =========================================================
  // PATH HIỆN TẠI
  // =========================================================

  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // =========================================================
  // THEO DÕI THAY ĐỔI URL
  // =========================================================

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // =========================================================
  // HÀM ĐIỀU HƯỚNG
  // =========================================================

  const navigate = (path: string) => {
    if (window.location.pathname === path) {
      setCurrentPath(path);

      return;
    }

    window.history.pushState({}, "", path);

    setCurrentPath(path);
  };

  // =========================================================
  // USER HIỆN TẠI
  // =========================================================

  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
      return null;
    }

    try {
      const parsedUser = JSON.parse(savedUser);
      const tokenExpiresAt = parsedUser.token
        ? getTokenExpiresAt(parsedUser.token)
        : null;

      if (
        (tokenExpiresAt && Date.now() >= tokenExpiresAt) ||
        (!tokenExpiresAt &&
          parsedUser.expiresAt &&
          Date.now() >= parsedUser.expiresAt)
      ) {
        sessionStorage.setItem("expiredSessionEmail", parsedUser.email || "");
        localStorage.removeItem("user");

        return null;
      }

      return {
        nguoiDungId: parsedUser.nguoiDungId,
        hoTen: parsedUser.hoTen,
        email: parsedUser.email,
        anhDaiDien: getAvatarPath(parsedUser),
        vaiTro: Array.isArray(parsedUser.vaiTro) ? parsedUser.vaiTro : [],
        quyen: Array.isArray(parsedUser.quyen) ? parsedUser.quyen : [],
        token: parsedUser.token || "",
        yeuCauDoiMatKhau: parsedUser.yeuCauDoiMatKhau === true,
        expiresAt: tokenExpiresAt ?? parsedUser.expiresAt ?? 0,
      };
    } catch (error) {
      console.error("Không thể đọc thông tin đăng nhập:", error);

      localStorage.removeItem("user");

      return null;
    }
  });

  // =========================================================
  // LOGIN STATE
  // =========================================================

  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState(() => {
    return sessionStorage.getItem("expiredSessionEmail") ?? "";
  });

  const [password, setPassword] = useState("");

  const [loginErrors, setLoginErrors] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState(() => {
    return sessionStorage.getItem("expiredSessionEmail") !== null
      ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      : "";
  });

  const [messageType, setMessageType] = useState<"success" | "error" | "">(
    () =>
      sessionStorage.getItem("expiredSessionEmail") !== null ? "error" : "",
  );

  const [loading, setLoading] = useState(false);

  const loginRequestInProgress = useRef(false);

  const clearExpiredSessionNotice = () => {
    sessionStorage.removeItem("expiredSessionEmail");
    if (message === "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.") {
      setMessage("");
      setMessageType("");
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem("expiredSessionEmail") !== null) {
      sessionStorage.removeItem("expiredSessionEmail");
      window.history.replaceState({}, "", "/");
    }

    const handleSessionExpired = (event: Event) => {
      if (!user || loginRequestInProgress.current) {
        return;
      }

      const detail = (event as CustomEvent<{ email?: string }>).detail;

      saveExpiredSessionDraft(window.location.pathname);
      sessionStorage.setItem("expiredSessionEmail", detail?.email || "");
      setUser(null);
      setCurrentPath("/");
      window.history.replaceState({}, "", "/");

      if (detail?.email) {
        setEmail(detail.email);
      }

      setPassword("");
      setMessage("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      setMessageType("error");
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (user && event.key === "user" && event.newValue === null) {
        window.dispatchEvent(
          new CustomEvent("session-expired", {
            detail: { email: user?.email },
          }),
        );
      }
    };

    window.addEventListener("session-expired", handleSessionExpired);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("session-expired", handleSessionExpired);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const draftPath = sessionStorage.getItem("expiredSessionPath");

    if (!draftPath || draftPath !== currentPath) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      restoreExpiredSessionDraft(currentPath);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [currentPath, user]);

  useEffect(() => {
    if (!user?.token) {
      return;
    }

    let lastActivityAt = 0;
    let refreshInProgress = false;

    const markActive = () => {
      lastActivityAt = Date.now();
    };

    const activityEvents = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
    ] as const;

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActive, { passive: true });
    });

    const checkSession = async () => {
      const storedUser = localStorage.getItem("user");

      if (!storedUser || refreshInProgress) {
        return;
      }

      try {
        const currentUser = JSON.parse(storedUser);
        const expiresAt =
          getTokenExpiresAt(currentUser.token) ?? currentUser.expiresAt;

        if (!expiresAt) {
          return;
        }

        currentUser.expiresAt = expiresAt;
        localStorage.setItem("user", JSON.stringify(currentUser));

        if (Date.now() >= expiresAt) {
          expireSession(currentUser.token);
          return;
        }

        if (
          Date.now() - lastActivityAt > 60 * 1000 ||
          expiresAt - Date.now() > 2 * 60 * 1000
        ) {
          return;
        }

        refreshInProgress = true;

        const refreshedToken = await refreshAccessToken();

        if (refreshedToken) {
          const refreshedUser = JSON.parse(
            localStorage.getItem("user") || "null",
          );

          if (
            refreshedUser?.token === refreshedToken &&
            refreshedUser.nguoiDungId === currentUser.nguoiDungId
          ) {
            setUser((current) =>
              current && current.token === currentUser.token
                ? {
                    ...current,
                    token: refreshedToken,
                    expiresAt: refreshedUser.expiresAt,
                  }
                : current,
            );
          }
        }
      } catch (error) {
        console.error("Không thể kiểm tra/gia hạn phiên đăng nhập:", error);
      } finally {
        refreshInProgress = false;
      }
    };

    const interval = window.setInterval(checkSession, 15 * 1000);
    void checkSession();

    return () => {
      window.clearInterval(interval);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActive);
      });
    };
  }, [user?.token]);

  // =========================================================
  // KHÓA NÚT LOGIN 15 PHÚT
  // =========================================================

  const [loginLockedUntil, setLoginLockedUntil] = useState<number | null>(null);

  const [lockRemaining, setLockRemaining] = useState(0);

  // =========================================================
  // KIỂM TRA EMAIL ĐANG BỊ KHÓA
  // =========================================================

  const checkLoginLock = (emailValue: string) => {
    const normalizedEmail = emailValue.trim().toLowerCase();

    if (!normalizedEmail) {
      setLoginLockedUntil(null);

      setLockRemaining(0);

      return;
    }

    const storageKey = `loginLockedUntil:${normalizedEmail}`;

    const savedLock = localStorage.getItem(storageKey);

    if (!savedLock) {
      setLoginLockedUntil(null);

      setLockRemaining(0);

      return;
    }

    const lockUntil = Number(savedLock);

    if (!Number.isFinite(lockUntil)) {
      localStorage.removeItem(storageKey);

      setLoginLockedUntil(null);

      setLockRemaining(0);

      return;
    }

    if (Date.now() >= lockUntil) {
      localStorage.removeItem(storageKey);

      setLoginLockedUntil(null);

      setLockRemaining(0);

      return;
    }

    setLoginLockedUntil(lockUntil);

    setLockRemaining(Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000)));
  };

  // =========================================================
  // KIỂM TRA KHÓA KHI EMAIL THAY ĐỔI
  // =========================================================

  useEffect(() => {
    checkLoginLock(email);
  }, [email]);

  // =========================================================
  // ĐẾM NGƯỢC
  // =========================================================

  useEffect(() => {
    if (!loginLockedUntil) {
      setLockRemaining(0);

      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(
        0,
        Math.ceil((loginLockedUntil - Date.now()) / 1000),
      );

      setLockRemaining(remaining);

      if (remaining <= 0) {
        const normalizedEmail = email.trim().toLowerCase();

        if (normalizedEmail) {
          localStorage.removeItem(`loginLockedUntil:${normalizedEmail}`);
        }

        setLoginLockedUntil(null);

        setLockRemaining(0);
      }
    };

    updateRemaining();

    const timer = window.setInterval(updateRemaining, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loginLockedUntil, email]);

  // =========================================================
  // FORMAT THỜI GIAN
  // =========================================================

  const formatLockRemaining = () => {
    const minutes = Math.floor(lockRemaining / 60);

    const seconds = lockRemaining % 60;

    return `${String(minutes).padStart(
      2,
      "0",
    )}:${String(seconds).padStart(2, "0")}`;
  };

  // =========================================================
  // ĐĂNG NHẬP
  // =========================================================

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      loading ||
      loginRequestInProgress.current ||
      loginLockedUntil !== null
    ) {
      return;
    }

    sessionStorage.removeItem("expiredSessionEmail");
    setMessage("");

    setMessageType("");

    const newErrors = {
      email: "",
      password: "",
    };

    if (!email.trim()) {
      newErrors.email = "Vui lòng nhập email";
    }

    if (!password.trim()) {
      newErrors.password = "Vui lòng nhập mật khẩu";
    }

    setLoginErrors(newErrors);

    if (newErrors.email || newErrors.password) {
      return;
    }

    try {
      loginRequestInProgress.current = true;
      setLoading(true);

      const response = await api.post("/login", {
        email: email.trim(),
        password,
      });

      const data = response.data;

      if (!data.access_token) {
        setMessage("Đăng nhập thành công nhưng không nhận được access token");

        setMessageType("error");

        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      localStorage.removeItem(`loginLockedUntil:${normalizedEmail}`);

      setLoginLockedUntil(null);

      setLockRemaining(0);

      const u = data.user || {};
      const rawRoles = Array.isArray(data.vaiTro)
        ? data.vaiTro
        : Array.isArray(u.roles)
          ? u.roles.map((r: any) => ({
              vaiTroId: r.VaiTroId ?? r.vaiTroId,
              tenVaiTro: r.TenVaiTro ?? r.tenVaiTro,
            }))
          : [];
      const vaiTro: VaiTro[] = rawRoles;

      const rawQuyen = Array.isArray(data.quyen)
        ? data.quyen
        : Array.isArray(u.permissions)
          ? u.permissions.map((p: any, idx: number) =>
              typeof p === "string"
                ? { quyenId: idx + 1, maQuyen: p, tenQuyen: p }
                : {
                    quyenId: p.QuyenId ?? p.quyenId ?? idx + 1,
                    maQuyen: p.MaQuyen ?? p.maQuyen,
                    tenQuyen: p.TenQuyen ?? p.tenQuyen,
                  },
            )
          : [];
      const quyen: Quyen[] = rawQuyen;

      const loggedInUser: User = {
        nguoiDungId: data.nguoiDungId ?? u.NguoiDungId ?? u.nguoiDungId,
        hoTen: data.hoTen ?? u.HoTen ?? u.hoTen ?? "",
        email: data.email ?? u.Email ?? u.email ?? email.trim(),
        anhDaiDien: getAvatarPath(data) || getAvatarPath(u),
        vaiTro,
        quyen,
        token: data.access_token,

        yeuCauDoiMatKhau:
          data.yeuCauDoiMatKhau === true || u.yeuCauDoiMatKhau === true,
        expiresAt:
          getTokenExpiresAt(data.access_token) ?? Date.now() + 30 * 60 * 1000,
      };

      localStorage.setItem("user", JSON.stringify(loggedInUser));

      setMessage(data.message || "Đăng nhập thành công");

      setMessageType("success");

      setUser(loggedInUser);
      sessionStorage.removeItem("expiredSessionEmail");

      if (data.yeuCauDoiMatKhau === true) {
        window.history.replaceState({}, "", "/change-password");

        setCurrentPath("/change-password");

        return;
      }

      const resumePath = sessionStorage.getItem("expiredSessionPath");
      const destination = resumePath || "/";

      window.history.replaceState({}, "", destination);
      setCurrentPath(destination);
    } catch (error: any) {
      console.error("Lỗi đăng nhập:", error);

      const status = error.response?.status;
      const responseDetail: unknown = error.response?.data?.detail;
      const detail =
        typeof responseDetail === "string"
          ? responseDetail
          : Array.isArray(responseDetail)
            ? responseDetail
                .map((item) =>
                  typeof item?.msg === "string" ? item.msg : "",
                )
                .filter(Boolean)
                .join(". ")
            : "";

      const loginErrorMessage =
        detail ||
        (error.response
          ? `Máy chủ từ chối đăng nhập (HTTP ${status ?? "không rõ"}).`
          : "Không thể kết nối máy chủ đăng nhập. Vui lòng kiểm tra kết nối backend và thử lại.");

      if (status === 423) {
        const normalizedEmail = email.trim().toLowerCase();
        const storageKey = `loginLockedUntil:${normalizedEmail}`;

        if (loginErrorMessage.toLowerCase().includes("khóa tạm thời")) {
          const lockUntil = Date.now() + 15 * 60 * 1000;

          localStorage.setItem(storageKey, String(lockUntil));
          setLoginLockedUntil(lockUntil);
          setLockRemaining(15 * 60);
          setMessage(
            "Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau khoảng 15 phút.",
          );
        } else {
          localStorage.removeItem(storageKey);
          setLoginLockedUntil(null);
          setLockRemaining(0);
          setMessage(loginErrorMessage);
        }

        setMessageType("error");

        return;
      }

      setMessage(loginErrorMessage);

      setMessageType("error");
    } finally {
      loginRequestInProgress.current = false;
      setLoading(false);
    }
  };

  // =========================================================
  // ĐIỀU HƯỚNG CẤU HÌNH QUYỀN
  // =========================================================

  const handleRoleManagement = () => {
    if (
      !hasPermission(user, "ROLE_VIEW") ||
      !hasPermission(user, "ROLE_UPDATE")
    ) {
      navigate("/");

      return;
    }

    navigate("/phan-quyen");
  };

  // =========================================================
  // ĐIỀU HƯỚNG TRANG CHỦ
  // =========================================================

  const handleHome = () => {
    navigate("/");
  };

  // =========================================================
  // ĐIỀU HƯỚNG QUẢN LÝ NGƯỜI DÙNG
  // =========================================================

  const handleUserManagement = () => {
    if (!hasPermission(user, "USER_VIEW")) {
      navigate("/");

      return;
    }

    navigate("/quan-ly-nguoi-dung");
  };

  const handleGradeManagement = () => {
    if (!hasPermission(user, "GRADE_VIEW")) {
      navigate("/");
      return;
    }

    navigate("/quan-ly-diem");
  };

  const handleStudentInformation = () => {
    if (
      !hasPermission(user, "USER_VIEW") ||
      !hasPermission(user, "GRADE_VIEW")
    ) {
      navigate("/");
      return;
    }
    navigate("/thong-tin-hoc-vien");
  };

  const handleClassHistory = () => {
    if (
      !hasPermission(user, "USER_VIEW") ||
      !hasPermission(user, "GRADE_VIEW")
    ) {
      navigate("/");
      return;
    }
    navigate("/lich-su-lop-hoc");
  };

  const handleClassManagement = () => {
    if (
      !hasPermission(user, "CLASS_VIEW") ||
      !hasPermission(user, "QUAN_LY_LOP")
    ) {
      navigate("/");

      return;
    }

    navigate("/quan-ly-lop");
  };

  const handleTrainingPrograms = () => {
    if (
      !hasPermission(user, "CLASS_VIEW") ||
      !hasAnyPermission(user, [
        "CLASS_CREATE",
        "CLASS_UPDATE",
        "CLASS_DELETE",
      ])
    ) {
      navigate("/");
      return;
    }
    navigate("/quan-ly-chuong-trinh");
  };

  const handleTrainingCatalog = () => {
    if (!isAdminUser(user) && !hasPermission(user, "CURRICULUM_VIEW")) {
      navigate("/");
      return;
    }
    navigate("/danh-muc-dao-tao");
  };

  const handleScheduleManagement = () => {
    if (!isAdminUser(user) && !hasPermission(user, "SCHEDULE_VIEW")) {
      navigate("/");
      return;
    }
    navigate("/quan-ly-lich-hoc");
  };

  const handleAdmissionsLeads = () => {
    if (!isAdminUser(user) && !hasPermission(user, "LEAD_VIEW")) {
      navigate("/");
      return;
    }
    navigate("/quan-ly-lead");
  };

  // =========================================================
  // ĐIỀU HƯỚNG HỒ SƠ CÁ NHÂN
  // =========================================================

  const handleProfile = () => {
    navigate("/ho-so-ca-nhan");
  };

  // =========================================================
  // ĐIỀU HƯỚNG ĐỔI MẬT KHẨU
  // =========================================================

  const handleChangePassword = () => {
    navigate("/change-password");
  };

  // =========================================================
  // CẬP NHẬT USER SAU KHI SỬA HỒ SƠ
  // =========================================================

  const handleProfileUpdated = (updatedProfile: {
    nguoiDungId: number;
    hoTen: string;
    email: string;
    anhDaiDien?: string | null;
  }) => {
    if (!user) return;

    const updatedUser: User = {
      ...user,
      nguoiDungId: updatedProfile.nguoiDungId,
      hoTen: updatedProfile.hoTen,
      email: updatedProfile.email,
      anhDaiDien: updatedProfile.anhDaiDien ?? user.anhDaiDien,
    };

    setUser(updatedUser);

    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  // =========================================================
  // ĐĂNG XUẤT
  // =========================================================

  const handleLogout = async () => {
    try {
      if (user?.token) {
        await api.post("/logout");
      }
    } catch (error: any) {
      console.error("Lỗi đăng xuất:", error);

      if (error.response?.status === 401) {
        expireSession(user?.token);
        return;
      }

      window.alert(
        "Không thể xác nhận đăng xuất với máy chủ. Phiên vẫn được giữ để bạn có thể thử lại.",
      );
      return;
    }

    localStorage.removeItem("user");
    setUser(null);
    setEmail("");
    setPassword("");
    setMessage("");
    setMessageType("");
    setLoginErrors({
      email: "",
      password: "",
    });
    setShowPassword(false);
    setLoginLockedUntil(null);
    setLockRemaining(0);
    window.history.replaceState({}, "", "/");
    setCurrentPath("/");
  };

  // =========================================================
  // KÍCH HOẠT TÀI KHOẢN
  // =========================================================

  if (currentPath === "/activate-account") {
    return <ActivateAccountPage />;
  }

  // =========================================================
  // RESET PASSWORD
  // =========================================================

  if (currentPath === "/reset-password") {
    return <ResetPassword />;
  }

  if (currentPath === "/dang-ky-tu-van") {
    return <AdmissionsInquiry />;
  }

  // =========================================================
  // QUÊN MẬT KHẨU
  // =========================================================

  if (!user && isForgotPassword) {
    return <ForgotPassword />;
  }

  // =========================================================
  // CHƯA ĐĂNG NHẬP
  // =========================================================

  if (!user) {
    const isLoginDisabled = loading || loginLockedUntil !== null;

    return (
      <div className="login-page">
        <div className="login-container">
          <section className="login-form-section">
            <div className="brand">
              <div className="brand-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" fill="none">
                  <path d="m5 18 19-9 19 9-19 9-19-9Z" fill="currentColor" />
                  <path d="M13 22v9c6 6 16 6 22 0v-9l-11 5-11-5Z" fill="currentColor" opacity=".86" />
                  <path d="M42 19v11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="42" cy="33" r="2.5" fill="#ffd166" />
                </svg>
              </div>
              <div className="brand-copy">
                <h1>
                  Hệ thống quản lý
                  <span>đào tạo</span>
                </h1>
                <p>Đồng hành cùng nhà trường trong hành trình chuyển đổi số giáo dục</p>
              </div>
            </div>

            <p className="subtitle">Đăng nhập để tiếp tục sử dụng hệ thống</p>

            {message && (
              <div
                className={
                  messageType === "success"
                    ? "message success-message"
                    : "message api-error-message"
                }
              >
                {message}
              </div>
            )}

            <form className="login-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email</label>

                <div className="input-wrapper">
                  <span className="input-icon">✉️</span>

                  <input
                    aria-label="Email"
                    type="email"
                    placeholder="Nhập địa chỉ email của bạn..."
                    value={email}
                    onChange={(e) => {
                      const newEmail = e.target.value;

                      clearExpiredSessionNotice();
                      setEmail(newEmail);

                      setLoginErrors({
                        ...loginErrors,
                        email: "",
                      });

                      checkLoginLock(newEmail);
                    }}
                  />
                </div>

                {loginErrors.email && (
                  <p className="error-message">{loginErrors.email}</p>
                )}
              </div>

              <div className="form-group">
                <label>Mật khẩu</label>

                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>

                  <input
                    aria-label="Mật khẩu"
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu của bạn..."
                    value={password}
                    onChange={(e) => {
                      clearExpiredSessionNotice();
                      setPassword(e.target.value);

                      setLoginErrors({
                        ...loginErrors,
                        password: "",
                      });
                    }}
                  />

                  <button
                    type="button"
                    className="show-password"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>

                {loginErrors.password && (
                  <p className="error-message">{loginErrors.password}</p>
                )}
              </div>

              <div className="login-options">
                <label className="remember">
                  <input type="checkbox" />

                  <span>Ghi nhớ đăng nhập</span>
                </label>

                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();

                    setIsForgotPassword(true);
                  }}
                >
                  Quên mật khẩu?
                </a>
              </div>

              <div className="login-registration">
                <span>Hoặc đăng ký tài khoản</span>
                <a href="/dang-ky-tu-van">
                  Đăng ký tư vấn tuyển sinh <span aria-hidden="true">›</span>
                </a>
              </div>

              <button
                type="submit"
                className="login-button"
                disabled={isLoginDisabled}
                style={{
                  opacity: isLoginDisabled ? 0.55 : 1,
                  cursor: isLoginDisabled ? "not-allowed" : "pointer",
                }}
              >
                <span>→</span>

                {loading
                  ? "Đang đăng nhập..."
                  : loginLockedUntil !== null
                    ? `Đăng nhập lại sau ${formatLockRemaining()}`
                    : "Đăng nhập"}
              </button>
            </form>
          </section>

          <section className="information-section">
            <div className="overlay"></div>
            <svg
              className="login-education-visual"
              viewBox="0 0 360 420"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="cap-gradient" x1="76" y1="174" x2="282" y2="251" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#56E7FF" />
                  <stop offset="1" stopColor="#887CFF" />
                </linearGradient>
                <linearGradient id="book-gradient" x1="110" y1="252" x2="276" y2="331" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#22BFF7" />
                  <stop offset="1" stopColor="#647BFF" />
                </linearGradient>
                <filter id="visual-glow" x="0" y="0" width="360" height="420" filterUnits="userSpaceOnUse">
                  <feGaussianBlur stdDeviation="10" />
                </filter>
              </defs>
              <ellipse cx="194" cy="296" rx="133" ry="25" fill="#22D3EE" opacity=".35" filter="url(#visual-glow)" />
              <path d="M55 299c38-63 222-81 269-21 38 48-75 79-171 81-88 2-138-21-98-60Z" stroke="#26D7FF" strokeWidth="2" opacity=".8" />
              <path d="m110 252 107-43 97 39-108 45-96-41Z" fill="url(#book-gradient)" stroke="#8BE8FF" strokeWidth="2" />
              <path d="m124 279 92 38 83-34v19l-83 39-92-40v-22Z" fill="#234DAE" stroke="#65CFFF" strokeWidth="2" />
              <path d="m124 302 92 39 83-38v18l-83 39-92-39v-19Z" fill="#193E94" stroke="#64BFFF" strokeWidth="2" />
              <path d="m78 174 109-42 103 43-108 46-104-47Z" fill="url(#cap-gradient)" stroke="#B2F3FF" strokeWidth="3" />
              <path d="m111 193 71 31 69-29v28c-38 29-101 30-140 0v-30Z" fill="#3971E8" stroke="#8DDFFF" strokeWidth="2" />
              <path d="M289 176v76" stroke="#8BE8FF" strokeWidth="3" />
              <circle cx="289" cy="255" r="6" fill="#F8D977" />
              <rect x="218" y="38" width="93" height="76" rx="12" fill="#4E8EFF" fillOpacity=".2" stroke="#58CFFF" />
              <path d="M238 97V79m17 18V66m17 31V57m17 40V47" stroke="#8DE6FF" strokeWidth="7" strokeLinecap="round" />
              <rect x="240" y="322" width="84" height="64" rx="10" fill="#5A8FFF" fillOpacity=".2" stroke="#76CFFF" />
              <path d="M258 343h47M258 356h31M258 369h39" stroke="#9DEBFF" strokeWidth="4" strokeLinecap="round" />
              <circle cx="298" cy="365" r="16" fill="#2249A0" stroke="#91E5FF" strokeWidth="2" />
              <path d="M298 355v11l7 4" stroke="#B5F4FF" strokeWidth="2" strokeLinecap="round" />
              <circle cx="58" cy="93" r="3" fill="#55E6FF" />
              <circle cx="175" cy="24" r="2.5" fill="#55E6FF" />
              <circle cx="333" cy="145" r="3" fill="#A4A9FF" />
              <path d="m58 93 68 32m49-101 43 35m115 86-22-31" stroke="#55C9FF" strokeOpacity=".3" />
            </svg>

            <div className="information-content">
              <h2>
                Quản lý đào tạo
                <br />
                <span>thông minh hơn</span>
              </h2>

              <p className="description">
                Hỗ trợ quản lý sinh viên, giảng viên, khóa học và các hoạt động
                đào tạo một cách dễ dàng, nhanh chóng và chính xác.
              </p>

              <div className="features">
                <Feature
                  icon="🎓"
                  title="Quản lý khóa học"
                  description="Tổ chức và quản lý các chương trình đào tạo"
                />

                <Feature
                  icon="👥"
                  title="Quản lý sinh viên"
                  description="Theo dõi thông tin và quá trình học tập"
                />

                <Feature
                  icon="📅"
                  title="Quản lý lịch học"
                  description="Sắp xếp thời khóa biểu linh hoạt"
                />

                <Feature
                  icon="📊"
                  title="Thống kê - Báo cáo"
                  description="Cung cấp báo cáo chi tiết, trực quan"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // =========================================================
  // TÀI KHOẢN BẮT BUỘC ĐỔI MẬT KHẨU
  // =========================================================

  if (user.yeuCauDoiMatKhau === true && currentPath !== "/change-password") {
    window.history.replaceState({}, "", "/change-password");

    return <ChangePassword />;
  }

  // =========================================================
  // ROLE NAME
  // =========================================================

  const roleName =
    user.vaiTro && user.vaiTro.length > 0
      ? user.vaiTro.map((role) => role.tenVaiTro).join(", ")
      : "Chưa có vai trò";
  const currentPermissions = user.quyen.map((permission) => permission.maQuyen);
  const isAdmin = isAdminUser(user);
  const effectivePermissions = isAdmin
    ? [
        ...new Set([
          ...currentPermissions,
          "CURRICULUM_VIEW",
          "CURRICULUM_CREATE",
          "CURRICULUM_UPDATE",
          "CURRICULUM_DELETE",
          "LEAD_VIEW",
          "LEAD_CREATE",
          "LEAD_UPDATE",
          "LEAD_DELETE",
          "LEAD_ASSIGN",
          "SCHEDULE_VIEW",
          "SCHEDULE_CREATE",
          "SCHEDULE_UPDATE",
        ]),
      ]
    : currentPermissions;

  if (!hasRouteAccess(currentPath, user)) {
    return <AppStatusPage status="forbidden" />;
  }

  // =========================================================
  // HỒ SƠ CÁ NHÂN
  // =========================================================

  if (currentPath === "/ho-so-ca-nhan") {
    return (
      <ProtectedRoute>
        {isAdminUser(user) ? (
          <AdminLayout
            userName={user.hoTen}
            roleName={roleName}
            avatarUrl={user.anhDaiDien}
            isAdmin
            permissions={currentPermissions}
            onLogout={handleLogout}
            onRoleManagement={handleRoleManagement}
            onHome={handleHome}
            onUserManagement={handleUserManagement}
            onGradeManagement={handleGradeManagement}
            onStudentInformation={handleStudentInformation}
            onClassHistory={handleClassHistory}
            onClassManagement={handleClassManagement}
            onTrainingPrograms={handleTrainingPrograms}
            onTrainingCatalog={handleTrainingCatalog}
            onAdmissionsLeads={handleAdmissionsLeads}
            onScheduleManagement={handleScheduleManagement}
            onChangePassword={handleChangePassword}
            onProfile={handleProfile}
          >
            <Profile
              user={user}
              onBack={handleHome}
              onProfileUpdated={handleProfileUpdated}
            />
          </AdminLayout>
        ) : (
          <MainLayout
            userName={user.hoTen}
            roleName={roleName}
            avatarUrl={user.anhDaiDien}
            permissions={currentPermissions}
            onLogout={handleLogout}
            onHome={handleHome}
            onGradeManagement={handleGradeManagement}
            onStudentInformation={handleStudentInformation}
            onClassHistory={handleClassHistory}
            onClassManagement={handleClassManagement}
            onTrainingPrograms={handleTrainingPrograms}
            onTrainingCatalog={handleTrainingCatalog}
            onAdmissionsLeads={handleAdmissionsLeads}
            onProfile={handleProfile}
            onChangePassword={handleChangePassword}
          >
            <Profile
              user={user}
              onBack={handleHome}
              onProfileUpdated={handleProfileUpdated}
            />
          </MainLayout>
        )}
      </ProtectedRoute>
    );
  }

  // =========================================================
  // ĐỔI MẬT KHẨU
  // =========================================================

  if (currentPath === "/change-password") {
    return (
      <ProtectedRoute>
        {isAdminUser(user) ? (
          <AdminLayout
            userName={user.hoTen}
            roleName={roleName}
            avatarUrl={user.anhDaiDien}
            isAdmin
            permissions={currentPermissions}
            onLogout={handleLogout}
            onRoleManagement={handleRoleManagement}
            onHome={handleHome}
            onUserManagement={handleUserManagement}
            onGradeManagement={handleGradeManagement}
            onStudentInformation={handleStudentInformation}
            onClassHistory={handleClassHistory}
            onClassManagement={handleClassManagement}
            onTrainingPrograms={handleTrainingPrograms}
            onTrainingCatalog={handleTrainingCatalog}
            onAdmissionsLeads={handleAdmissionsLeads}
            onScheduleManagement={handleScheduleManagement}
            onChangePassword={handleChangePassword}
            onProfile={handleProfile}
          >
            <ChangePassword />
          </AdminLayout>
        ) : (
          <MainLayout
            userName={user.hoTen}
            roleName={roleName}
            avatarUrl={user.anhDaiDien}
            permissions={currentPermissions}
            onLogout={handleLogout}
            onHome={handleHome}
            onGradeManagement={handleGradeManagement}
            onStudentInformation={handleStudentInformation}
            onClassHistory={handleClassHistory}
            onClassManagement={handleClassManagement}
            onTrainingPrograms={handleTrainingPrograms}
            onTrainingCatalog={handleTrainingCatalog}
            onAdmissionsLeads={handleAdmissionsLeads}
            onProfile={handleProfile}
            onChangePassword={handleChangePassword}
          >
            <ChangePassword />
          </MainLayout>
        )}
      </ProtectedRoute>
    );
  }

  // =========================================================
  // ADMIN
  // =========================================================

  const renderAcademicLayout = (children: React.ReactNode) =>
    isAdmin ? (
      <AdminLayout
        userName={user.hoTen}
        roleName={roleName}
        avatarUrl={user.anhDaiDien}
        isAdmin={isAdmin}
        permissions={currentPermissions}
        onLogout={handleLogout}
        onRoleManagement={handleRoleManagement}
        onHome={handleHome}
        onUserManagement={handleUserManagement}
        onGradeManagement={handleGradeManagement}
        onStudentInformation={handleStudentInformation}
        onClassHistory={handleClassHistory}
        onClassManagement={handleClassManagement}
        onTrainingPrograms={handleTrainingPrograms}
        onTrainingCatalog={handleTrainingCatalog}
        onAdmissionsLeads={handleAdmissionsLeads}
        onChangePassword={handleChangePassword}
        onProfile={handleProfile}
      >
        {children}
      </AdminLayout>
    ) : (
      <MainLayout
        userName={user.hoTen}
        roleName={roleName}
        avatarUrl={user.anhDaiDien}
        permissions={currentPermissions}
        onLogout={handleLogout}
        onHome={handleHome}
        onGradeManagement={handleGradeManagement}
        onStudentInformation={handleStudentInformation}
        onClassHistory={handleClassHistory}
        onClassManagement={handleClassManagement}
        onTrainingPrograms={handleTrainingPrograms}
        onTrainingCatalog={handleTrainingCatalog}
        onAdmissionsLeads={handleAdmissionsLeads}
        onProfile={handleProfile}
        onChangePassword={handleChangePassword}
      >
        {children}
      </MainLayout>
    );

  const renderAdminLayout = (children: React.ReactNode) => (
    <AdminLayout
      userName={user.hoTen}
      roleName={roleName}
      avatarUrl={user.anhDaiDien}
      isAdmin={isAdmin}
      permissions={currentPermissions}
      onLogout={handleLogout}
      onRoleManagement={handleRoleManagement}
      onHome={handleHome}
      onUserManagement={handleUserManagement}
      onGradeManagement={handleGradeManagement}
      onStudentInformation={handleStudentInformation}
      onClassHistory={handleClassHistory}
      onClassManagement={handleClassManagement}
      onTrainingPrograms={handleTrainingPrograms}
      onTrainingCatalog={handleTrainingCatalog}
      onAdmissionsLeads={handleAdmissionsLeads}
      onScheduleManagement={handleScheduleManagement}
      onChangePassword={handleChangePassword}
      onProfile={handleProfile}
    >
      {children}
    </AdminLayout>
  );

  if (currentPath === "/danh-muc-dao-tao") {
    if (!isAdmin && !hasPermission(user, "CURRICULUM_VIEW")) {
      return <AppStatusPage status="forbidden" />;
    }
    return renderAcademicLayout(
      <ProtectedRoute requiredPermission="CURRICULUM_VIEW">
        <TrainingCatalog permissions={effectivePermissions} />
      </ProtectedRoute>,
    );
  }

  if (currentPath === "/quan-ly-lead") {
    if (!isAdmin && !hasPermission(user, "LEAD_VIEW")) {
      return <AppStatusPage status="forbidden" />;
    }
    const isTrainingManager = user.vaiTro.some(
      (role) =>
        role.vaiTroId === 7 ||
        role.tenVaiTro.trim().toLowerCase() === "quản lý đào tạo",
    );
    return renderAcademicLayout(
      <ProtectedRoute requiredPermission="LEAD_VIEW">
        <AdmissionsLeads
          permissions={effectivePermissions}
          isTrainingManager={isTrainingManager || isAdmin}
        />
      </ProtectedRoute>,
    );
  }

  // =========================================================
  // QUẢN LÝ NGƯỜI DÙNG
  // =========================================================

  if (currentPath === "/quan-ly-nguoi-dung") {
    if (!hasPermission(user, "USER_VIEW")) {
      return <AppStatusPage status="forbidden" />;
    }

    return renderAdminLayout(
      <ProtectedRoute requiredPermission="USER_VIEW">
        <UsersPage />
      </ProtectedRoute>,
    );
  }

  if (currentPath === "/du-lieu-import-khong-hop-le") {
    if (!hasPermission(user, "USER_CREATE")) {
      return <AppStatusPage status="forbidden" />;
    }

    return renderAdminLayout(
      <ProtectedRoute requiredPermission="USER_CREATE">
        <UserImportInvalidDataPage />
      </ProtectedRoute>,
    );
  }

  // =========================================================
  // CẤU HÌNH QUYỀN
  // =========================================================

  if (currentPath === "/phan-quyen" || currentPath === "/quan-ly-vai-tro") {
    if (
      !hasPermission(user, "ROLE_VIEW") ||
      !hasPermission(user, "ROLE_UPDATE")
    ) {
      return <AppStatusPage status="forbidden" />;
    }

    return renderAdminLayout(
      <ProtectedRoute
        requiredPermission="ROLE_VIEW"
        requiredAnyPermission={["ROLE_UPDATE"]}
      >

        <PermissionsManagement />
      </ProtectedRoute>,
    );
  }

  if (currentPath === "/quan-ly-diem") {
    return renderAcademicLayout(
      <ProtectedRoute requiredPermission="GRADE_VIEW">
        <GradeManagement permissions={currentPermissions} />
      </ProtectedRoute>
    );
  }

  if (currentPath === "/quan-ly-lich-hoc") {
    if (!hasPermission(user, "SCHEDULE_VIEW")) {
      return <AppStatusPage status="forbidden" />;
    }
    return renderAdminLayout(
      <ProtectedRoute requiredPermission="SCHEDULE_VIEW">
        <ScheduleManagement permissions={effectivePermissions} />
      </ProtectedRoute>,
    );
  }

  if (
    currentPath === "/thong-tin-hoc-vien" ||
    currentPath === "/lich-su-lop-hoc"
  ) {
    const profileSection =
      currentPath === "/thong-tin-hoc-vien" ? "information" : "history";
    return renderAcademicLayout(
      <ProtectedRoute requiredPermission="USER_VIEW">
        <ProtectedRoute requiredPermission="GRADE_VIEW">
          <UsersPage key={profileSection} profileSection={profileSection} />
        </ProtectedRoute>
      </ProtectedRoute>,
    );
  }

  if (currentPath === "/quan-ly-lop") {
    return renderAcademicLayout(
      <ProtectedRoute
        requiredPermission="CLASS_VIEW"
        requiredAnyPermission={["QUAN_LY_LOP"]}
      >
        <ClassManagement permissions={currentPermissions} />
      </ProtectedRoute>,
    );
  }

  if (currentPath === "/danh-sach-lop") {
    return renderAcademicLayout(
      <ProtectedRoute requiredPermission="CLASS_VIEW">
        <ClassManagement permissions={currentPermissions} listOnly />
      </ProtectedRoute>,
    );
  }

  if (currentPath === "/quan-ly-chuong-trinh") {
    return renderAcademicLayout(
      <ProtectedRoute
        requiredPermission="CLASS_VIEW"
        requiredAnyPermission={["CLASS_CREATE", "CLASS_UPDATE", "CLASS_DELETE"]}
      >
        <TrainingPrograms permissions={currentPermissions} />
      </ProtectedRoute>,
    );
  }

  // =========================================================
  // QUYỀN THEO PATH
  // =========================================================

  if (
    currentPath === "/quan-ly-hoc-phi" &&
    !hasPermission(user, "QUAN_LY_HOC_PHI")
  ) {
    return <AppStatusPage status="forbidden" />;
  }

  if (currentPath !== "/") {
    return renderAcademicLayout(<AppStatusPage status="not-found" />);
  }



  // =========================================================
  // ADMIN DASHBOARD
  // =========================================================

  if (isAdmin) {
    return (
      <ProtectedRoute>
        <AdminLayout
          userName={user.hoTen}
          roleName={roleName}
          avatarUrl={user.anhDaiDien}
          isAdmin={isAdmin}
          permissions={user.quyen.map((q) => q.maQuyen)}
          onLogout={handleLogout}
          onRoleManagement={handleRoleManagement}
          onHome={handleHome}
          onUserManagement={handleUserManagement}
          onGradeManagement={handleGradeManagement}
          onStudentInformation={handleStudentInformation}
          onClassHistory={handleClassHistory}
          onClassManagement={handleClassManagement}
          onTrainingPrograms={handleTrainingPrograms}

          onTrainingCatalog={handleTrainingCatalog}
          onAdmissionsLeads={handleAdmissionsLeads}

          onChangePassword={handleChangePassword}
          onProfile={handleProfile}
        >
          <AdminDashboard
            userName={user.hoTen}
            onUserManagement={handleUserManagement}
            onClassManagement={handleClassManagement}
            onTrainingCatalog={handleTrainingCatalog}
          />
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  // =========================================================
  // USER THƯỜNG
  // =========================================================

  return (
    <ProtectedRoute>
      <MainLayout
        userName={user.hoTen}
        roleName={roleName}
        avatarUrl={user.anhDaiDien}
        permissions={currentPermissions}
        onLogout={handleLogout}
        onHome={handleHome}
        onGradeManagement={handleGradeManagement}
        onStudentInformation={handleStudentInformation}
        onClassHistory={handleClassHistory}
        onClassManagement={handleClassManagement}
        onTrainingPrograms={handleTrainingPrograms}
        onTrainingCatalog={handleTrainingCatalog}
        onAdmissionsLeads={handleAdmissionsLeads}
        onProfile={handleProfile}
        onChangePassword={handleChangePassword}
      >
        <div className="user-dashboard">
          {/* =================================================
              WELCOME BANNER
          ================================================= */}

          <section className="dashboard-hero">
            <div className="dashboard-hero-content">
              <div className="dashboard-hero-label">
                HỆ THỐNG QUẢN LÝ ĐÀO TẠO
              </div>

              <h2>
                Xin chào, <span>{user.hoTen}</span> 👋
              </h2>

              <p>
                Chào mừng bạn quay trở lại. Chúc bạn có một ngày làm việc hiệu
                quả!
              </p>

            </div>

            <div className="dashboard-hero-decoration">
              <div className="hero-circle hero-circle-1"></div>

              <div className="hero-circle hero-circle-2"></div>

              <DashboardDateTime />
            </div>
          </section>

          {/* =================================================
              STAT CARDS
          ================================================= */}

          <section className="dashboard-stat-grid">
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon blue">👤</div>

              <div className="dashboard-stat-content">
                <span>Tài khoản</span>

                <strong>Hoạt động</strong>

                <small>Trạng thái hiện tại</small>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon purple">🛡️</div>

              <div className="dashboard-stat-content">
                <span>Vai trò</span>

                <strong>{user.vaiTro.length}</strong>

                <small>Vai trò được cấp</small>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon green">🔐</div>

              <div className="dashboard-stat-content">
                <span>Quyền truy cập</span>

                <strong>{user.quyen.length}</strong>

                <small>Quyền được cấp</small>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon orange">🟢</div>

              <div className="dashboard-stat-content">
                <span>Phiên đăng nhập</span>

                <strong>Đang hoạt động</strong>

                <small>Bảo mật JWT</small>
              </div>
            </div>
          </section>

          {/* =================================================
              THÔNG TIN HỆ THỐNG
          ================================================= */}

          <section className="dashboard-bottom-grid">
            <div className="dashboard-info-card">
              <div className="info-card-icon">🎓</div>

              <div>
                <span>EDUMANAGE</span>

                <h3>Hệ thống quản lý đào tạo</h3>

                <p>
                  Quản lý thông tin đào tạo, người dùng, lớp học và các hoạt
                  động học tập một cách hiệu quả và chính xác.
                </p>
              </div>
            </div>

            <div className="dashboard-info-card system-card">
              <div className="system-status-dot"></div>

              <div>
                <span>TRẠNG THÁI HỆ THỐNG</span>

                <h3>Hệ thống đang hoạt động</h3>

                <p>Các dịch vụ chính đang hoạt động bình thường.</p>
              </div>

              <div className="system-online">● Online</div>
            </div>
          </section>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}

// ===========================================================
// FEATURE COMPONENT
// ===========================================================

interface FeatureProps {
  icon: string;
  title: string;
  description: string;
}

function Feature({ icon, title, description }: FeatureProps) {
  return (
    <div className="feature">
      <div className="feature-icon">
        <span className="feature-icon-glyph">{icon}</span>
      </div>

      <div>
        <h3>{title}</h3>

        <p>{description}</p>
      </div>
    </div>
  );
}

function DashboardDateTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const time = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const date = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <div className="dashboard-date-time" aria-label={`Hôm nay ${date}, ${time}`}>
      <span className="dashboard-date-time-label">Thời gian hiện tại</span>
      <strong className="dashboard-clock">{time}</strong>
      <span className="dashboard-date">{date}</span>
    </div>
  );
}

export default App;
