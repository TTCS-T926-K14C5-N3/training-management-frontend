# Frontend EduManage

## Yêu cầu

- Node.js 20.19+ hoặc 22.12+
- Backend và SQL Server đang chạy, đồng thời có thể truy cập từ máy này.

## Cài đặt và chạy trên máy hiện tại

```powershell
npm ci
npm run dev
```

Mở `http://localhost:5173` trên trình duyệt.

## Cho các máy khác trong cùng mạng LAN truy cập frontend

Trên máy chủ, chạy backend với địa chỉ bind `0.0.0.0` (xem README backend),
sau đó chạy frontend:

```powershell
npm ci
npm run dev:network
```

Dùng lệnh `ipconfig` để tìm địa chỉ IPv4 của máy chủ. Các máy khác trong cùng
mạng cần mở `http://<ip-máy-chủ>:5173`, không dùng `localhost`. Ví dụ:
`http://192.168.1.20:5173`.

Trong file `.env` của backend, thêm đúng địa chỉ frontend vào `CORS_ORIGINS`,
ví dụ `http://192.168.1.20:5173`, đồng thời đặt `FRONTEND_URL` thành địa chỉ
này để các liên kết trong email có thể được máy khác truy cập.

Nếu backend chạy trên máy khác với frontend, sao chép `.env.example` thành
`.env` ở frontend và đặt `VITE_API_URL=http://<ip-backend>:8000` trước khi
chạy hoặc build. Mặc định, địa chỉ API lấy hostname được dùng để mở frontend;
cách này phù hợp khi frontend và backend chạy trên cùng máy chủ.

Cho phép cổng TCP 5173 và 8000 qua Windows Firewall trên máy chủ, chỉ áp dụng
cho mạng Private. Máy chạy backend cũng cần kết nối được đến SQL Server đã
được cấu hình trong file `.env` của backend.

## Build production

```powershell
npm ci
npm run build
```

Khi triển khai production, đặt `VITE_API_URL` thành địa chỉ backend sẽ dùng
trong môi trường triển khai trước khi build, sau đó phục vụ thư mục `dist`
bằng web server. Không mở Vite development server ra Internet công cộng.
