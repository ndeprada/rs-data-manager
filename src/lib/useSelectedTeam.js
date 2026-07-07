import { useState, useEffect } from 'react';
import { useTeamAccess } from './TeamAccessContext';

/**
 * Hook for determining the "current working team" across Mi Equipo pages.
 * - Coaches with ONE team: auto-selects their only team
 * - Coaches with MULTIPLE teams: reads from localStorage, can switch
 * - Coordinators/Admins: reads from localStorage, can be changed via selectTeam()
 */
export function useSelectedTeam() {
  const { isCoordinator, teamId, teamIds } = useTeamAccess();
  const [selectedTeamId, setSelectedTeamId] = useState('');

  // A coach with multiple teams also needs to be able to switch
  const isMultiTeamCoach = !isCoordinator && teamIds && teamIds.length > 1;
  const canSwitch = isCoordinator || isMultiTeamCoach;

  useEffect(() => {
    if (!isCoordinator && !isMultiTeamCoach && teamId) {
      // Single-team coach: always use their team
      setSelectedTeamId(teamId);
    } else if (canSwitch) {
      // Coordinator or multi-team coach: restore from localStorage
      const stored = localStorage.getItem('rs_selected_team');
      if (stored) {
        setSelectedTeamId(stored);
      } else if (!isCoordinator && teamIds && teamIds.length > 0) {
        // Default to first team for multi-team coach
        setSelectedTeamId(teamIds[0]);
        localStorage.setItem('rs_selected_team', teamIds[0]);
      }
    }
  }, [isCoordinator, teamId, teamIds?.join(',')]);

  const selectTeam = (id) => {
    setSelectedTeamId(id);
    if (canSwitch) localStorage.setItem('rs_selected_team', id);
  };

  return { selectedTeamId, selectTeam, isCoordinator, canSwitch, teamIds };
}