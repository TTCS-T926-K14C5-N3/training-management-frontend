export async function getApiErrorMessage(
  response: Response
): Promise<string> {
  if (response.status === 401) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }

  if (response.status === 403) {
    try {
      const data = await response.json();

      if (data?.detail) {
        return data.detail;
      }
    } catch {
      // Bỏ qua lỗi đọc JSON
    }

    return "Bạn không có quyền thực hiện chức năng này.";
  }

  if (response.status === 404) {
    return "Không tìm thấy dữ liệu hoặc chức năng yêu cầu.";
  }

  if (response.status >= 500) {
    return "Hệ thống đang gặp lỗi. Vui lòng thử lại sau.";
  }

  try {
    const data = await response.json();

    if (data?.detail) {
      return data.detail;
    }
  } catch {
    // Bỏ qua lỗi đọc JSON
  }

  return "Đã xảy ra lỗi. Vui lòng thử lại.";
}