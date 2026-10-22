import { useEffect, useState } from "react";
import SearchableSelect from "../components/SearchableSelect";
import type { FormEvent } from "react";
import axios from "axios";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import "./Admissions.css";

interface ProgramOption {
  chuongTrinhId: number;
  tenChuongTrinh: string;
}

const AdmissionsInquiry = () => {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [form, setForm] = useState({
    hoTen: "",
    soDienThoai: "",
    email: "",
    chuongTrinhId: "",
    website: "",
  });
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<ProgramOption[]>("/admissions/program-options")
      .then((response) => {
        if (active) setPrograms(response.data);
      })
      .catch((requestError: unknown) => {
        console.error("Không thể tải danh sách chương trình tư vấn:", requestError);
        if (active) {
          setError("Không thể tải danh sách chương trình. Vui lòng thử lại sau.");
        }
      })
      .finally(() => {
        if (active) setLoadingPrograms(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await api.post("/admissions/public/leads", {
        hoTen: form.hoTen,
        soDienThoai: form.soDienThoai,
        email: form.email || null,
        chuongTrinhId: form.chuongTrinhId
          ? Number(form.chuongTrinhId)
          : null,
        nguon: "Website",
        website: form.website,
      });
      setSubmitted(true);
    } catch (requestError: unknown) {
      console.error("Không thể gửi yêu cầu tư vấn:", requestError);
      if (
        axios.isAxiosError<{ detail?: unknown }>(requestError) &&
        typeof requestError.response?.data?.detail === "string"
      ) {
        setError(requestError.response.data.detail);
      } else if (
        axios.isAxiosError<{ detail?: Array<{ msg?: string }> }>(requestError) &&
        Array.isArray(requestError.response?.data?.detail)
      ) {
        const msgs = requestError.response.data.detail
          .map((d) => d.msg)
          .filter(Boolean);
        setError(msgs.join(", ") || "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.");
      } else {
        setError("Gửi yêu cầu chưa thành công. Vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const returnToLogin = () => {
    window.history.replaceState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <main className="admissions-public">
      <section className="admissions-public-card">
        <div className="admissions-public-brand">EduManage</div>
        {submitted ? (
          <div className="admissions-confirmation" role="status">
            <span className="admissions-confirmation-icon" aria-hidden="true">
              ✓
            </span>
            <h1>Cảm ơn bạn đã quan tâm!</h1>
            <p>
              Trung tâm đã nhận được thông tin. Tư vấn viên sẽ liên hệ với bạn
              trong thời gian sớm nhất.
            </p>
          </div>
        ) : (
          <>
            <p className="admissions-eyebrow">TƯ VẤN TUYỂN SINH</p>
            <h1>Để lại thông tin, chúng tôi sẽ liên hệ tư vấn</h1>
            <p className="admissions-intro">
              Chọn chương trình bạn quan tâm và cung cấp số điện thoại để được
              hỗ trợ lộ trình học phù hợp.
            </p>
            <form className="admissions-form" onSubmit={handleSubmit}>
              <label>
                Họ và tên *
                <input
                  required
                  maxLength={100}
                  value={form.hoTen}
                  onChange={(event) =>
                    setForm({ ...form, hoTen: event.target.value })
                  }
                  autoComplete="name"
                />
              </label>
              <label>
                Số điện thoại *
                <input
                  required
                  type="tel"
                  maxLength={20}
                  value={form.soDienThoai}
                  onChange={(event) =>
                    setForm({ ...form, soDienThoai: event.target.value })
                  }
                  autoComplete="tel"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  maxLength={255}
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  autoComplete="email"
                />
              </label>
              <label>
                Chương trình quan tâm *
                <SearchableSelect
                  required
                  value={form.chuongTrinhId}
                  onChange={(event) =>
                    setForm({ ...form, chuongTrinhId: event.target.value })
                  }
                  disabled={loadingPrograms}
                >
                  <option value="">-- Chọn chương trình quan tâm * --</option>
                  {programs.map((program) => (
                    <option
                      key={program.chuongTrinhId}
                      value={program.chuongTrinhId}
                    >
                      {program.tenChuongTrinh}
                    </option>
                  ))}
                </SearchableSelect>
              </label>
              <label className="admissions-honeypot" aria-hidden="true">
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(event) =>
                    setForm({ ...form, website: event.target.value })
                  }
                />
              </label>
              {error && (
                <p className="admissions-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" disabled={submitting}>
                {submitting ? "Đang gửi..." : "Đăng ký tư vấn"}
              </button>
              <small>Thông tin của bạn chỉ được dùng để liên hệ tư vấn.</small>
            </form>
          </>
        )}
      </section>
      {submitted && (
        <ToastNotification
          type="success"
          text="Đăng ký tư vấn thành công. Trung tâm sẽ liên hệ với bạn trong thời gian sớm nhất."
          durationMs={3000}
          onClose={returnToLogin}
        />
      )}
    </main>
  );
};

export default AdmissionsInquiry;
