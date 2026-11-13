import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { POLL } from "@/lib/query-client";

// Avisos sin leer (número del menú). Cada 5 min y al volver a la app.
export function useUnreadNotices(enabled = true) {
  const { data } = useQuery({
    queryKey: ["notice-unread"],
    queryFn: () => base44.club.unreadCount(),
    enabled: !!enabled,
    refetchInterval: POLL.slow,
    refetchOnWindowFocus: true,
  });
  return data?.n || 0;
}

// Marca avisos como leídos y refresca la bandeja y el número del menú
export function useMarkRead() {
  const qc = useQueryClient();
  return async (ids) => {
    if (!ids?.length) return;
    qc.setQueryData(["inbox"], (old) => (Array.isArray(old) ? old.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)) : old));
    try { await base44.club.noticeRead(ids); } catch { /* se volverá a intentar al abrirlo otra vez */ }
    qc.invalidateQueries({ queryKey: ["notice-unread"] });
  };
}

// Al tocar un aviso en el móvil se abre su dirección con ?aviso=<id>: se marca como leído y se quita de la dirección.
export function NoticeOpenWatcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const markRead = useMarkRead();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("aviso");
    if (!id) return;
    params.delete("aviso");
    const rest = params.toString();
    navigate({ pathname: location.pathname, search: rest ? `?${rest}` : "", hash: location.hash }, { replace: true });
    markRead([id]);
  }, [location.search]);
  return null;
}
