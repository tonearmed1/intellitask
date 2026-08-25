import { api } from "@/lib/api";

export interface LoginResponse {
  username: string;
  csrfToken: string;
}

export const authService = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>("/api/auth/login", { username, password }),
  logout: () => api.post<{ ok: true }>("/api/auth/logout"),
  me: () => api.get<{ username: string | null }>("/api/auth/me"),
};
