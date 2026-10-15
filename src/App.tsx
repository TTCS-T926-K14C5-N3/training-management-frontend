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
};

function hasRouteAccess(path: string, user: User | null): boolean {
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
    if (!hasPermission(user, "CURRICULUM_VIEW")) {
      navigate("/");
      return;
    }
    navigate("/danh-muc-dao-tao");
  };

  const handleAdmissionsLeads = () => {
    if (!hasPermission(user, "LEAD_VIEW")) {
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
              <div className="brand-icon">🎓</div>

              <h1>
                Hệ thống quản lý <span>đào tạo</span>
              </h1>
            </div>

            <p className="subtitle">
              Đăng nhập để truy cập và quản lý các chức năng của hệ thống
            </p>

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
                    type="email"
                    placeholder="Nhập email"
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
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu"
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

              <p className="admissions-login-link">
                Muốn tìm hiểu chương trình học?{" "}
                <a href="/dang-ky-tu-van">Đăng ký tư vấn tuyển sinh</a>
              </p>

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

            <div className="information-content">
              <h2>
                Quản lý đào tạo
                <br />
                hiệu quả hơn
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
            onClassManagement={handleClassManagement}
            onTrainingPrograms={handleTrainingPrograms}
            onTrainingCatalog={handleTrainingCatalog}
            onAdmissionsLeads={handleAdmissionsLeads}
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
            onClassManagement={handleClassManagement}
            onTrainingPrograms={handleTrainingPrograms}
            onTrainingCatalog={handleTrainingCatalog}
            onAdmissionsLeads={handleAdmissionsLeads}
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

  const isAdmin = isAdminUser(user);
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
      onClassManagement={handleClassManagement}
      onTrainingPrograms={handleTrainingPrograms}
      onTrainingCatalog={handleTrainingCatalog}
      onAdmissionsLeads={handleAdmissionsLeads}
      onChangePassword={handleChangePassword}
      onProfile={handleProfile}
    >
      {children}
    </AdminLayout>
  );

  if (currentPath === "/danh-muc-dao-tao") {
    if (!hasPermission(user, "CURRICULUM_VIEW")) {
      return <AppStatusPage status="forbidden" />;
    }
    return renderAcademicLayout(
      <ProtectedRoute requiredPermission="CURRICULUM_VIEW">
        <TrainingCatalog permissions={currentPermissions} />
      </ProtectedRoute>,
    );
  }

  if (currentPath === "/quan-ly-lead") {
    if (!hasPermission(user, "LEAD_VIEW")) {
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
          permissions={currentPermissions}
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
          onClassManagement={handleClassManagement}
          onTrainingPrograms={handleTrainingPrograms}

          onTrainingCatalog={handleTrainingCatalog}
          onAdmissionsLeads={handleAdmissionsLeads}

          onChangePassword={handleChangePassword}
          onProfile={handleProfile}
        >
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

              <div className="dashboard-hero-info">
                <div>
                  <span className="hero-info-label">Tài khoản</span>

                  <strong>{user.email}</strong>
                </div>

                <div>
                  <span className="hero-info-label">Vai trò</span>

                  <strong>{roleName}</strong>
                </div>
              </div>
            </div>

            <div className="dashboard-hero-decoration">
              <div className="hero-circle hero-circle-1"></div>

              <div className="hero-circle hero-circle-2"></div>

              <div className="hero-graduation">🎓</div>
            </div>
          </section>

          <div className="admin-stat-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-icon blue">👥</div>

              <div>
                <span>Người dùng</span>

                <strong>--</strong>

                <small>Dữ liệu hệ thống</small>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon purple">🛡️</div>

              <div>
                <span>Vai trò</span>

                <strong>{user.vaiTro.length}</strong>

                <small>Vai trò hiện tại</small>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon green">🔐</div>

              <div>
                <span>Quyền</span>

                <strong>{user.quyen.length}</strong>

                <small>Quyền được cấp</small>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon orange">⚙️</div>

              <div>
                <span>Trạng thái</span>

                <strong>Hoạt động</strong>

                <small>Tài khoản hiện tại</small>
              </div>
            </div>
          </div>

          <div className="admin-dashboard-grid">
            <div
              className="admin-panel"
              style={{
                gridColumn: "1 / -1",
              }}
            >
              <div className="admin-panel-header">
                <div>
                  <h3>Hoạt động gần đây</h3>

                  <p>Thông tin hoạt động của hệ thống</p>
                </div>
              </div>

              <div className="admin-activity">
                <div className="admin-activity-item">
                  <div className="activity-icon blue">🔑</div>

                  <div>
                    <strong>Đăng nhập hệ thống</strong>

                    <span>{user.hoTen} đã đăng nhập</span>

                    <small>Vừa mới đây</small>
                  </div>
                </div>

                <div className="admin-activity-item">
                  <div className="activity-icon green">👤</div>

                  <div>
                    <strong>Tài khoản đang hoạt động</strong>

                    <span>Tài khoản đang ở trạng thái hoạt động</span>

                    <small>Hiện tại</small>
                  </div>
                </div>

                <div className="admin-activity-item">
                  <div className="activity-icon purple">🛡️</div>

                  <div>
                    <strong>Phân quyền</strong>

                    <span>{user.quyen.length} quyền được cấp</span>

                    <small>Hiện tại</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

              <div className="dashboard-hero-info">
                <div>
                  <span className="hero-info-label">Tài khoản</span>

                  <strong>{user.email}</strong>
                </div>

                <div>
                  <span className="hero-info-label">Vai trò</span>

                  <strong>{roleName}</strong>
                </div>
              </div>
            </div>

            <div className="dashboard-hero-decoration">
              <div className="hero-circle hero-circle-1"></div>

              <div className="hero-circle hero-circle-2"></div>

              <div className="hero-graduation">🎓</div>
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
      <div className="feature-icon">{icon}</div>

      <div>
        <h3>{title}</h3>

        <p>{description}</p>
      </div>
    </div>
  );
}

export default App;
