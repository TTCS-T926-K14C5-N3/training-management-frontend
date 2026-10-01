import { getApiErrorMessage } from "../utils/apiError";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const testPermission = async (
  token: string
) => {
  const response = await fetch(
    `${API_URL}/test-permission`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const message = await getApiErrorMessage(response);

    throw new Error(message);
  }

  return response.json();
};