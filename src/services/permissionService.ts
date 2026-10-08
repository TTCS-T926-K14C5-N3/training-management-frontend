import { getApiErrorMessage } from "../utils/apiError";
import { API_URL } from "../config/api";

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