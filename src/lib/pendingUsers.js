import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { POLL } from "@/lib/query-client";

// Cuántos usuarios se han registrado y esperan aprobación (solo para coordinadores).
// Antes se bajaba la lista entera de usuarios cada minuto; ahora el servidor da solo el número, cada 5 min y al volver a la app.
export function usePendingUsersCount(enabled) {
  const { data } = useQuery({
    queryKey: ["pending-users"],
    queryFn: () => base44.club.pendingCount(),
    enabled: !!enabled,
    refetchInterval: POLL.slow,
    refetchOnWindowFocus: true,
  });
  return data?.n || 0;
}
