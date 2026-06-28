export interface User {
  id: string;
  github_id: number;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
}

interface ApiError {
  detail: string;
}

function getBaseUrl(): string {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_API_URL || "";
}

export async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: "Request failed",
    }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getMe(): Promise<User> {
  return fetchApi<User>("/api/auth/me");
}

export async function logout(): Promise<void> {
  await fetchApi<{ detail: string }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function refreshTokens(): Promise<{
  detail: string;
  access_token_expires_in: number;
}> {
  return fetchApi("/api/auth/refresh", {
    method: "POST",
  });
}
