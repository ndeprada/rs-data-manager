import React, { createContext, useContext } from "react";
import { useAuth } from "@/lib/AuthContext";

const TeamAccessContext = createContext();

const COORDINATOR_ROLES = ["coordinador_general", "coordinador_f7", "coordinador_f11"];
const STAFF_ROLES = ["preparador_fisico", "entrenador_porteros", "psicologo", "fisioterapeuta"];

export const TeamAccessProvider = ({ children }) => {
  const { user } = useAuth();

  const appRole = user?.app_role || null;
  const teamId = user?.team_id || null;
  const teamIds = user?.team_ids || (teamId ? [teamId] : []);

  // Rol secundario (ej: coordinador que también entrena)
  const secondaryRole = user?.secondary_role || null;
  const secondaryTeamIds = user?.secondary_team_ids || [];

  const isAdmin = user?.role === "admin";
  const isCoordinator = isAdmin || COORDINATOR_ROLES.includes(appRole);
  const isCoordinatorGeneral = isAdmin || appRole === "coordinador_general";

  // Staff técnico: acceso a perfiles de jugadores de todos los equipos
  const isStaffTecnico = STAFF_ROLES.includes(appRole);

  // También es entrenador si su rol principal es entrenador O tiene un rol secundario de entrenador
  const isAlsoCoach = appRole === "entrenador" || secondaryRole === "entrenador";

  // Equipos como entrenador: principales si rol=entrenador, secundarios si rol secundario=entrenador
  const coachTeamIds = appRole === "entrenador" ? teamIds : secondaryTeamIds;

  const coordType = appRole;

  const teamFilter = isCoordinator ? null : (teamIds.length > 0 ? teamIds : null);

  return (
    <TeamAccessContext.Provider value={{
      appRole,
      coordType,
      teamId,
      teamIds,
      teamFilter,
      isCoordinator,
      isCoordinatorGeneral,
      secondaryRole,
      secondaryTeamIds,
      isAlsoCoach,
      coachTeamIds,
      isStaffTecnico,
    }}>
      {children}
    </TeamAccessContext.Provider>
  );
};

export const useTeamAccess = () => {
  const ctx = useContext(TeamAccessContext);
  if (!ctx) throw new Error("useTeamAccess must be used within TeamAccessProvider");
  return ctx;
};