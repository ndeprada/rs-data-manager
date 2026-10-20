import { useEffect, useSyncExternalStore } from 'react';
import { useTeamAccess } from './TeamAccessContext';

// Equipo seleccionado compartido por TODAS las instancias del hook (cabecera, tablas, etc.),
// para que al cambiar de equipo en el selector se actualice toda la pantalla.
let current = '';
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getSnapshot = () => current;
const setCurrent = (id) => {
  if (id === current) return;
  current = id;
  listeners.forEach((fn) => fn());
};

/**
 * Hook for determining the "current working team" across Mi Equipo pages.
 * - Coaches with ONE team: auto-selects their only team
 * - Coaches with MULTIPLE teams: reads from localStorage, can switch
 * - Coordinators/Admins: reads from localStorage, can be changed via selectTeam()
 */
export function useSelectedTeam() {
  const { isCoordinator: coordinator, teamId, teamIds, coachTeamIds, perms } = useTeamAccess();
  const selectedTeamId = useSyncExternalStore(subscribe, getSnapshot);

  // Quien ve a todos los jugadores (coordinación, entrenador de porteros, psicología, fisio…) puede mirar cualquier equipo.
  // Para las pantallas de Mi Equipo cuenta como coordinación: solo cambia qué equipos puede elegir.
  const isCoordinator = coordinator || !!perms?.allTeams;

  // A coach with multiple teams also needs to be able to switch
  const isMultiTeamCoach = !isCoordinator && teamIds && teamIds.length > 1;
  const canSwitch = isCoordinator || isMultiTeamCoach;

  useEffect(() => {
    if (!isCoordinator && !isMultiTeamCoach && teamId) {
      // Single-team coach: always use their team
      setCurrent(teamId);
    } else if (canSwitch && !current) {
      // Coordinator or multi-team coach: restore from localStorage (solo la primera vez)
      let stored = null;
      try { stored = localStorage.getItem('rs_selected_team'); } catch { /* sin almacenamiento */ }
      if (stored) {
        setCurrent(stored);
      } else if (isCoordinator && coachTeamIds && coachTeamIds.length > 0) {
        // Coordinación que además entrena: por defecto, su equipo
        setCurrent(coachTeamIds[0]);
      } else if (!isCoordinator && teamIds && teamIds.length > 0) {
        // Default to first team for multi-team coach
        setCurrent(teamIds[0]);
        try { localStorage.setItem('rs_selected_team', teamIds[0]); } catch { /* sin almacenamiento */ }
      }
    }
  }, [isCoordinator, teamId, teamIds?.join(',')]);

  const selectTeam = (id) => {
    setCurrent(id);
    if (canSwitch) { try { localStorage.setItem('rs_selected_team', id); } catch { /* sin almacenamiento */ } }
  };

  return { selectedTeamId, selectTeam, isCoordinator, canSwitch, teamIds };
}
