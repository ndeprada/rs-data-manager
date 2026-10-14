import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Usuarios que se han registrado y esperan aprobación (solo se consulta para coordinadores).
export function usePendingUsers(enabled) {
  const { data = [] } = useQuery({
    queryKey: ["pending-users"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!enabled,
    refetchInterval: 60000,
    select: (users) => users.filter((u) => u.access_status === "pending"),
  });
  return data;
}
