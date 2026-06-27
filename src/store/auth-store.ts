import { create } from "zustand";
import type { User } from "../types/auth";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setTokens: (data: { accessToken: string; refreshToken: string }) => void;
  setUser: (user: User | null) => void;
  setAuth: (data: {
    accessToken: string;
    refreshToken: string;
    user: User;
  }) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem("access_token"),
  refreshToken: localStorage.getItem("refresh_token"),
  user: localStorage.getItem("auth_user")
    ? JSON.parse(localStorage.getItem("auth_user") as string)
    : null,

  setTokens: ({ accessToken, refreshToken }) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    set({ accessToken, refreshToken });
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem("auth_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("auth_user");
    }

    set({ user });
  },

  setAuth: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    localStorage.setItem("auth_user", JSON.stringify(user));

    set({ accessToken, refreshToken, user });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("auth_user");

    set({
      accessToken: null,
      refreshToken: null,
      user: null,
    });
  },
}));
