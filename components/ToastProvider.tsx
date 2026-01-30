"use client";

import { addToast } from "@heroui/toast";

type ToastType = "success" | "error" | "warning" | "info";

const colorMap: Record<
  ToastType,
  "success" | "danger" | "warning" | "primary"
> = {
  success: "success",
  error: "danger",
  warning: "warning",
  info: "primary",
};

const titleMap: Record<ToastType, string> = {
  success: "Berhasil",
  error: "Error",
  warning: "Peringatan",
  info: "Info",
};

export function showToast(type: ToastType, message: string) {
  addToast({
    title: titleMap[type],
    description: message,
    color: colorMap[type],
    timeout: 3000,
  });
}

// Hook wrapper for compatibility
export function useToast() {
  return { showToast };
}
