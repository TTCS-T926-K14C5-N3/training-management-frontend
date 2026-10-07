import { fetchWithAuth } from "./apiClient";

export const forgotPassword = async (email: string) => {
  return await fetchWithAuth("/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
};

export const resetPassword = async (token: string, new_password: string) => {
  return await fetchWithAuth("/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password }),
  });
};
