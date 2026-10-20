import { useEffect, useState } from "react";
import api from "../services/api";
import ToastNotification from "../components/ToastNotification";
import "./ScheduleAttendancePage.css";

type ScheduleAttendanceStatus =
  | "Có mặt"
  | "Đi muộn"
  | "Vắng có phép"
  | "Vắng không phép";

interface ScheduleAttendanceRecord {
  hocVienId: number;
  hoTen: string;
  email: string;
  trangThai: ScheduleAttendanceStatus | null;
}

interface ScheduleAttendance {
  lichHocId: number;
  maBuoiHoc: string;
  maLop: string;
  tenLop: string;
  ngayHoc: string;
  gioBatDau: string;
  gioKetThuc: string;
  records: ScheduleAttendanceRecord[];
  coTheCapNhat: boolean;
}

interface ScheduleAttendancePageProps {
  scheduleId: number;
}

const attendanceStatuses: Array<{
  value: ScheduleAttendanceStatus;
  label: string;
}> = [
  { value: "Có mặt", label: "Có mặt" },
  { value: "Đi muộn", label: "Đi muộn" },
  { value: "Vắng có phép", label: "Vắng có phép" },
  { value: "Vắng không phép", label: "Vắng không phép" },
];

const messageFromError = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as { response?: { data?: { detail?: unknown } } }
    ).response;
    if (typeof response?.data?.detail === "string") {
      return response.data.detail;
    }
  }
  return error instanceof Error
    ? error.message
    : "Không thể hoàn tất yêu cầu điểm danh.";
};

const navigateToScheduleList = () => {
  window.history.pushState({}, "", "/quan-ly-lich-hoc");
  window.dispatchEvent(new PopStateEvent("popstate"));
};

function ScheduleAttendancePage({ scheduleId }: ScheduleAttendancePageProps) {
  const [attendance, setAttendance] = useState<ScheduleAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    api
      .get<ScheduleAttendance>(`/academic/schedules/${scheduleId}/attendance`)
      .then((response) => {
        if (active) setAttendance(response.data);
      })
      .catch((requestError: unknown) => {
        console.error("Không thể tải điểm danh buổi học:", requestError);
        if (active) setError(messageFromError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [scheduleId]);

  const updateStatus = (
    studentId: number,
    status: ScheduleAttendanceStatus | null,
  ) => {
    setAttendance((current) =>
      current
        ? {
            ...current,
            records: current.records.map((record) =>
              record.hocVienId === studentId
                ? { ...record, trangThai: status }
                : record,
            ),
          }
        : current,
    );
  };

  const markAllPresent = () => {
    setAttendance((current) =>
      current
        ? {
            ...current,
            records: current.records.map((record) => ({
              ...record,
              trangThai: "Có mặt",
            })),
          }
        : current,
    );
  };

  const saveAttendance = async () => {
    if (!attendance || saving || !attendance.coTheCapNhat) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await api.put<ScheduleAttendance>(
        `/academic/schedules/${scheduleId}/attendance`,
        {
          records: attendance.records.map(({ hocVienId, trangThai }) => ({
            hocVienId,
            trangThai,
          })),
        },
      );
      setAttendance(response.data);
      setNotice("Đã lưu điểm danh buổi học.");
    } catch (requestError: unknown) {
      console.error("Không thể lưu điểm danh buổi học:", requestError);
      setError(messageFromError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const completedCount =
    attendance?.records.filter((record) => record.trangThai !== null).length ??
    0;
  const totalCount = attendance?.records.length ?? 0;
  const attendanceComplete = totalCount > 0 && completedCount === totalCount;
  const allPresent =
    totalCount > 0 &&
    attendance?.records.every((record) => record.trangThai === "Có mặt");

  return (
    <main className="attendance-page schedule-attendance-page">
      {(error || notice) && (
        <ToastNotification
          type={error ? "error" : "success"}
          text={error || notice}
          onClose={() => {
            setError("");
            setNotice("");
          }}
        />
      )}

      <header className="attendance-hero">
        <div>
          <span className="attendance-kicker">QUẢN LÝ ĐÀO TẠO</span>
          <h1>Điểm danh buổi học</h1>
          <p>
            Ghi nhận tình trạng tham dự của học viên cho từng buổi học.
          </p>
        </div>
        <button
          type="button"
          className="attendance-button attendance-light"
          onClick={navigateToScheduleList}
        >
          Quay lại lịch học
        </button>
      </header>

      {loading ? (
        <section className="attendance-panel" role="status">
          Đang tải danh sách học viên...
        </section>
      ) : error && !attendance ? (
        <section className="attendance-panel" role="alert">
          <p className="schedule-attendance-error">{error}</p>
          <button
            type="button"
            className="attendance-button secondary"
            onClick={navigateToScheduleList}
          >
            Quay lại lịch học
          </button>
        </section>
      ) : attendance ? (
        <>
          <section className="attendance-panel schedule-attendance-summary">
            <div>
              <span>Buổi học</span>
              <strong>{attendance.maBuoiHoc}</strong>
            </div>
            <div>
              <span>Lớp</span>
              <strong>
                {attendance.maLop} · {attendance.tenLop}
              </strong>
            </div>
            <div>
              <span>Ngày, giờ</span>
              <strong>
                {new Date(`${attendance.ngayHoc}T00:00:00`).toLocaleDateString(
                  "vi-VN",
                )}{" "}
                · {attendance.gioBatDau}–{attendance.gioKetThuc}
              </strong>
            </div>
            <div>
              <span>Đã điểm danh</span>
              <strong>
                {completedCount}/{totalCount} học viên
              </strong>
            </div>
          </section>

          <section className="attendance-panel">
            <div className="attendance-section-heading">
              <div>
                <h2>Danh sách học viên</h2>
                <p className="schedule-attendance-help">
                  Chọn trạng thái cho từng học viên, sau đó lưu điểm danh.
                </p>
              </div>
              <div className="schedule-attendance-heading-actions">
                {attendance.coTheCapNhat && (
                  <button
                    type="button"
                    className="attendance-button secondary"
                    onClick={markAllPresent}
                    disabled={saving || totalCount === 0}
                  >
                    Đánh dấu tất cả có mặt
                  </button>
                )}
                {attendanceComplete && (
                  <span className="schedule-attendance-done">
                    {allPresent
                      ? "Tất cả đã có mặt"
                      : "Đã điểm danh đầy đủ"}
                  </span>
                )}
              </div>
            </div>

            {totalCount === 0 ? (
              <p className="schedule-attendance-empty">
                Lớp chưa có học viên ghi danh.
              </p>
            ) : (
              <div className="schedule-attendance-list">
                {attendance.records.map((record) => (
                  <label
                    className="schedule-attendance-student"
                    key={record.hocVienId}
                  >
                    <span className="schedule-attendance-student-info">
                      <strong>{record.hoTen}</strong>
                      <small>{record.email}</small>
                    </span>
                    <select
                      value={record.trangThai ?? ""}
                      disabled={
                        saving || !attendance.coTheCapNhat
                      }
                      onChange={(event) =>
                        updateStatus(
                          record.hocVienId,
                          (event.target.value ||
                            null) as ScheduleAttendanceStatus | null,
                        )
                      }
                    >
                      <option value="">Chưa điểm danh</option>
                      {attendanceStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}

            <div className="schedule-attendance-footer">
              <span>
                {attendance.coTheCapNhat
                  ? attendanceComplete
                    ? "Tất cả học viên đã được điểm danh."
                    : "Hãy hoàn tất trạng thái của tất cả học viên."
                  : "Bạn chỉ có quyền xem điểm danh buổi học này."}
              </span>
              {attendance.coTheCapNhat && (
                <button
                  type="button"
                  className="attendance-button primary"
                  onClick={() => void saveAttendance()}
                  disabled={saving || totalCount === 0}
                >
                  {saving ? "Đang lưu..." : "Lưu điểm danh"}
                </button>
              )}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

export default ScheduleAttendancePage;
