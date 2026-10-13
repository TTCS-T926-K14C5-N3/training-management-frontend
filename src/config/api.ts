const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_URL =
  import.meta.env.DEV
    ? "/api"
    : configuredApiUrl ||
      `http://${window.location.hostname || "localhost"}:8000`;
