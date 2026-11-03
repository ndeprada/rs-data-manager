// Motivo de ausencia por defecto (03/11/2026, Nacho: «a los jugadores con una lesión activa, en cuanto se les pone que no
// asisten, que el motivo aparezca directamente como lesión»). No marca nada por su cuenta: solo rellena el motivo cuando el
// entrenador pone «No» y aún no hay motivo. Lesión activa = una lesión sin alta (Injury.status ≠ "alta") o la ficha del
// jugador en «lesionado». Sin importaciones de la app: se prueba en Node.

export function hasActiveInjury(player, injuries = []) {
  if (!player) return false;
  if (player.status === "lesionado") return true;
  return injuries.some((i) => i && i.player_id === player.id && i.status !== "alta");
}

// Motivo con el que guardar una ausencia: el que ya haya (o el elegido) y, si no hay ninguno, «lesion» si está lesionado
export function absenceReasonFor(player, { current = null, injuries = [] } = {}) {
  if (current) return current;
  return hasActiveInjury(player, injuries) ? "lesion" : null;
}
