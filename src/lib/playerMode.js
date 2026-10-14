import { useAuth } from "@/lib/AuthContext";

// Usuario con cuenta de jugador (no admin): acceso de solo lectura a sus datos.
export function usePlayerMode() {
  const { user } = useAuth();
  return !!user && user.role !== "admin" && user.app_role === "jugador";
}
