import { useEffect, useState } from "react";
import axios from "axios";
import api from "../services/api";
import "./AdminDashboard.css";

interface DashboardUserResponse {
  pagination: {
    total: number;
  };
}

interface DashboardStudent {
  nguoiDungId: number;
  hoTen: string;
  ngayGhiDanh: string;
}

interface DashboardClass {
  lopHocId: number;
  maLop: string;
  tenLop: string;
  tenChuongTrinh: string | null;
  hocViens: DashboardStudent[];
}

interface DashboardSubject {
  monHocId: number;
}

interface AdminDashboardProps {
  userName: string;
  onUserManagement: () => void;
  onClassManagement: () => void;
  onTrainingCatalog: () => void;
}

interface Registration {
  id: string;
  studentName: string;
  classCode: string;
  className: string;
  happenedAt: Date;
}

interface ProgramDistribution {
  name: string;
  count: number;
}

const getLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const getLastSevenDays = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date;
  });
};

const getErrorMessage = (error: unknown) => {
  if (
    axios.isAxiosError<{ detail?: unknown }>(error) &&
    typeof error.response?.data?.detail === "string"
  ) {
    return error.response.data.detail;
  }
  return "Không thể tải dữ liệu trang chủ. Vui lòng thử lại.";
};

const formatCount = (count: number) =>
  new Intl.NumberFormat("vi-VN").format(count);

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  userName,
  onUserManagement,
  onClassManagement,
  onTrainingCatalog,
}) => {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [subjectCount, setSubjectCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const [usersResult, classesResult, subjectsResult] =
          await Promise.allSettled([
            api.get<DashboardUserResponse>("/users/", {
              params: { page: 1, limit: 1 },
            }),
            api.get<DashboardClass[]>("/academic/classes"),
            api.get<DashboardSubject[]>("/academic/subjects", {
              params: { include_inactive: true },
            }),
          ]);
        if (!active) return;

        if (usersResult.status === "fulfilled") {
          setUserCount(usersResult.value.data.pagination.total);
        }
        if (classesResult.status === "fulfilled") {
          setClasses(classesResult.value.data);
        }
        if (subjectsResult.status === "fulfilled") {
          setSubjectCount(subjectsResult.value.data.length);
        }

        if (
          usersResult.status === "rejected" &&
          classesResult.status === "rejected" &&
          subjectsResult.status === "rejected"
        ) {
          setError(getErrorMessage(usersResult.reason));
        }
      } catch (requestError: unknown) {
        console.error("Không thể tải dữ liệu trang chủ Admin:", requestError);
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const days = getLastSevenDays();
  const dayKeys = new Set(days.map(getLocalDateKey));
  const allRegistrations: Registration[] = classes.flatMap((classRecord) =>
    classRecord.hocViens.map((student) => ({
      id: `${classRecord.lopHocId}-${student.nguoiDungId}`,
      studentName: student.hoTen,
      classCode: classRecord.maLop,
      className: classRecord.tenLop,
      happenedAt: new Date(student.ngayGhiDanh),
    })),
  );
  const recentRegistrations = allRegistrations
    .filter(
      (registration) =>
        Number.isFinite(registration.happenedAt.getTime()) &&
        dayKeys.has(getLocalDateKey(registration.happenedAt)),
    )
    .sort((left, right) => right.happenedAt.getTime() - left.happenedAt.getTime());

  const registrationsByDay = new Map<string, number>();
  for (const registration of recentRegistrations) {
    const key = getLocalDateKey(registration.happenedAt);
    registrationsByDay.set(key, (registrationsByDay.get(key) ?? 0) + 1);
  }
  const dailyCounts = days.map(
    (day) => registrationsByDay.get(getLocalDateKey(day)) ?? 0,
  );
  const chartMax = Math.max(...dailyCounts, 1);
  const chartPoints = dailyCounts.map((count, index) => ({
    x: 14 + (index * 472) / (dailyCounts.length - 1),
    y: 100 - (count / chartMax) * 76,
  }));
  const chartPath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const chartAreaPath = `${chartPath} L 486 110 L 14 110 Z`;

  const distributionByProgram = new Map<string, number>();
  for (const classRecord of classes) {
    const programName = classRecord.tenChuongTrinh || "Chưa phân chương trình";
    distributionByProgram.set(
      programName,
      (distributionByProgram.get(programName) ?? 0) + 1,
    );
  }
  const distributions: ProgramDistribution[] = [...distributionByProgram]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count);
  const distributionTotal = distributions.reduce(
    (total, item) => total + item.count,
    0,
  );
  const palette = ["#2563eb", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4"];
  let distributionOffset = 0;
  const distributionStops = distributions.map((item, index) => {
    const start = distributionOffset;
    distributionOffset += distributionTotal
      ? (item.count / distributionTotal) * 100
      : 0;
    return `${palette[index % palette.length]} ${start}% ${distributionOffset}%`;
  });
  const donutBackground = distributionTotal
    ? `conic-gradient(${distributionStops.join(", ")})`
    : "conic-gradient(#e2e8f0 0% 100%)";

  const dateLabel = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="admin-home">
      <section className="dashboard-hero">
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-label">
            HỆ THỐNG QUẢN LÝ ĐÀO TẠO
          </div>
          <h2>
            Xin chào, <span>{userName}</span> 👋
          </h2>
          <p>
            Chào mừng bạn quay trở lại. Chúc bạn có một ngày làm việc hiệu quả!
          </p>
        </div>
        <div className="dashboard-hero-decoration" aria-hidden="true">
          <div className="hero-circle hero-circle-1"></div>
          <div className="hero-circle hero-circle-2"></div>
        </div>
        <div className="admin-home-hero-clock">
          <span>{dateLabel}</span>
          <strong>{timeLabel}</strong>
        </div>
      </section>

      {error && (
        <div className="admin-home-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => window.location.reload()}>
            Tải lại
          </button>
        </div>
      )}

      <section className="admin-home-stat-grid" aria-label="Thống kê hệ thống">
        <button
          className="admin-home-stat-card"
          type="button"
          onClick={onUserManagement}
        >
          <span className="admin-home-stat-icon blue" aria-hidden="true">♟</span>
          <span className="admin-home-stat-copy">
            <span>Người dùng</span>
            <strong>
              {loading ? "…" : error ? "—" : formatCount(userCount ?? 0)}
            </strong>
            <small>Tổng tài khoản trong hệ thống</small>
          </span>
        </button>
        <button
          className="admin-home-stat-card"
          type="button"
          onClick={onClassManagement}
        >
          <span className="admin-home-stat-icon teal" aria-hidden="true">▣</span>
          <span className="admin-home-stat-copy">
            <span>Lớp học</span>
            <strong>
              {loading ? "…" : error ? "—" : formatCount(classes.length)}
            </strong>
            <small>Tổng lớp học đã tạo</small>
          </span>
        </button>
        <button
          className="admin-home-stat-card"
          type="button"
          onClick={onTrainingCatalog}
        >
          <span className="admin-home-stat-icon violet" aria-hidden="true">▤</span>
          <span className="admin-home-stat-copy">
            <span>Môn học</span>
            <strong>
              {loading ? "…" : error ? "—" : formatCount(subjectCount ?? 0)}
            </strong>
            <small>Tổng môn học trong danh mục</small>
          </span>
        </button>
        <button
          className="admin-home-stat-card"
          type="button"
          onClick={onClassManagement}
        >
          <span className="admin-home-stat-icon orange" aria-hidden="true">♧</span>
          <span className="admin-home-stat-copy">
            <span>Ghi danh mới</span>
            <strong>
              {loading
                ? "…"
                : error
                  ? "—"
                  : formatCount(recentRegistrations.length)}
            </strong>
            <small>Trong 7 ngày gần nhất</small>
          </span>
        </button>
      </section>

      <section className="admin-home-panels">
        <article className="admin-home-panel admin-home-chart-panel">
          <header className="admin-home-panel-heading">
            <div>
              <h2>Thống kê ghi danh</h2>
              <p>Số học viên ghi danh mỗi ngày trong 7 ngày gần nhất</p>
            </div>
            <span className="admin-home-range">7 ngày gần đây</span>
          </header>
          {loading || error ? (
            <p className="admin-home-placeholder">
              {error ? "Không thể hiển thị biểu đồ." : "Đang tải số liệu…"}
            </p>
          ) : (
            <div className="admin-home-chart">
              <div className="admin-home-chart-scale" aria-hidden="true">
                <span>{chartMax}</span>
                <span>{Math.round(chartMax / 2)}</span>
                <span>0</span>
              </div>
              <svg
                className="admin-home-line-chart"
                viewBox="0 0 500 145"
                role="img"
                aria-label={`Biểu đồ ghi danh 7 ngày, tổng cộng ${recentRegistrations.length} lượt`}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="admin-home-area-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#3478f6" stopOpacity=".24" />
                    <stop offset="100%" stopColor="#3478f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[24, 62, 110].map((y) => (
                  <line
                    key={y}
                    x1="14"
                    x2="486"
                    y1={y}
                    y2={y}
                    className="admin-home-chart-gridline"
                  />
                ))}
                <path d={chartAreaPath} fill="url(#admin-home-area-fill)" />
                <path d={chartPath} className="admin-home-chart-line" />
                {chartPoints.map((point, index) => (
                  <circle
                    key={getLocalDateKey(days[index])}
                    cx={point.x}
                    cy={point.y}
                    r="3.5"
                    className="admin-home-chart-point"
                  />
                ))}
              </svg>
              <div className="admin-home-chart-dates" aria-hidden="true">
                {days.map((day) => (
                  <span key={getLocalDateKey(day)}>
                    {day.toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="admin-home-panel admin-home-distribution-panel">
          <header className="admin-home-panel-heading">
            <div>
              <h2>Phân bổ lớp theo chương trình</h2>
              <p>Số lớp thuộc từng chương trình đào tạo</p>
            </div>
          </header>
          {loading || error ? (
            <p className="admin-home-placeholder">
              {error ? "Không thể hiển thị phân bổ." : "Đang tải số liệu…"}
            </p>
          ) : (
            <div className="admin-home-distribution">
              <div
                className="admin-home-donut"
                style={{ background: donutBackground }}
                role="img"
                aria-label={`Phân bổ ${distributionTotal} lớp theo chương trình`}
              >
                <div>
                  <strong>{formatCount(distributionTotal)}</strong>
                  <span>Lớp học</span>
                </div>
              </div>
              <ul className="admin-home-legend">
                {distributions.slice(0, 5).map((item, index) => (
                  <li key={item.name}>
                    <span
                      className="admin-home-legend-dot"
                      style={{ backgroundColor: palette[index % palette.length] }}
                      aria-hidden="true"
                    />
                    <span className="admin-home-legend-name" title={item.name}>
                      {item.name}
                    </span>
                    <strong>
                      {distributionTotal
                        ? Math.round((item.count / distributionTotal) * 100)
                        : 0}%
                    </strong>
                  </li>
                ))}
                {distributions.length === 0 && (
                  <li className="admin-home-legend-empty">
                    Chưa có dữ liệu lớp học.
                  </li>
                )}
                {distributions.length > 5 && (
                  <li className="admin-home-legend-more">
                    + {distributions.length - 5} chương trình khác
                  </li>
                )}
              </ul>
            </div>
          )}
        </article>

        <article className="admin-home-panel admin-home-activity-panel">
          <header className="admin-home-panel-heading">
            <div>
              <h2>Hoạt động gần đây</h2>
              <p>Danh sách ghi danh học viên mới nhất</p>
            </div>
          </header>
          {loading || error ? (
            <p className="admin-home-placeholder">
              {error ? "Không thể hiển thị hoạt động." : "Đang tải số liệu…"}
            </p>
          ) : recentRegistrations.length > 0 ? (
            <ul className="admin-home-activity-list">
              {recentRegistrations.slice(0, 5).map((registration, index) => (
                <li key={registration.id}>
                  <span
                    className={`admin-home-activity-icon tone-${index % 4}`}
                    aria-hidden="true"
                  >
                    {registration.studentName.slice(0, 1).toLocaleUpperCase("vi-VN")}
                  </span>
                  <span className="admin-home-activity-copy">
                    <strong>{registration.studentName}</strong>
                    <span>
                      Đã ghi danh lớp {registration.classCode} · {registration.className}
                    </span>
                  </span>
                  <time dateTime={registration.happenedAt.toISOString()}>
                    {registration.happenedAt.toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-home-placeholder">
              Chưa có lượt ghi danh nào trong 7 ngày gần nhất.
            </p>
          )}
        </article>
      </section>
    </main>
  );
};

export default AdminDashboard;
