"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recarrega os pedidos a cada 20 segundos enquanto a aba estiver visível. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
