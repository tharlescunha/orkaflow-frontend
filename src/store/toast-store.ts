import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastState = {
  toasts: ToastItem[];
  push: (type: ToastType, message: string) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;
const DEDUPE_WINDOW_MS = 10_000;
const recent = new Map<string, number>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (type, message) => {
    const key = `${type}:${message}`;
    const now = Date.now();
    const last = recent.get(key);

    // evita spam: mesma mensagem dentro de 10s e ignorada
    if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return;
    recent.set(key, now);

    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts.slice(-4), { id, type, message }] }));

    const ttl = type === "error" ? 12_000 : 5_000;
    setTimeout(() => get().dismiss(id), ttl);
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (message: string) => useToastStore.getState().push("success", message),
  error: (message: string) => useToastStore.getState().push("error", message),
  info: (message: string) => useToastStore.getState().push("info", message),
};
