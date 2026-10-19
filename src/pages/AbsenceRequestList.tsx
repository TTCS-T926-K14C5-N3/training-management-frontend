import "./AbsenceRequestList.css";

interface AbsenceRequestListProps {
  navigate: (path: string) => void;
}

function AbsenceRequestList({ navigate }: AbsenceRequestListProps) {
  return (
    <main className="absence-list-page">
      <header className="absence-list-hero">
        <div>
          <span className="absence-list-eyebrow">HỌC TẬP CÁ NHÂN</span>
          <h1>Theo dõi đơn xin phép</h1>
          <p>
            Xem trạng thái xử lý và thông tin các đơn xin phép vắng học của bạn.
          </p>
        </div>
        <span className="absence-list-hero-icon" aria-hidden="true">▤</span>
      </header>

      <section className="absence-list-unavailable" role="status">
        <span className="absence-list-status-icon" aria-hidden="true">!</span>
        <div className="absence-list-unavailable-content">
          <h2>Backend chưa hỗ trợ tra cứu đơn xin phép</h2>
          <p>
            Hệ thống hiện chưa có API hoặc dữ liệu lưu trữ đơn xin phép. Vì vậy,
            danh sách, trạng thái duyệt và kết quả xử lý chưa thể tải. Đây không
            phải là danh sách trống; chúng tôi không hiển thị dữ liệu mẫu hoặc
            trạng thái tự suy diễn.
          </p>
          <button
            className="absence-list-create-button"
            type="button"
            onClick={() => navigate("/don-xin-phep")}
          >
            Mở biểu mẫu xin phép
          </button>
        </div>
      </section>
    </main>
  );
}

export default AbsenceRequestList;
