// Resumen ejecutivo del informe de club, redactado a partir de los datos (sin IA).
// Cada frase sale de cifras reales; si un dato no existe, simplemente no se menciona.
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function buildExecutiveSummary(teams, scopeLabel) {
  if (!teams?.length) return "No hay datos para este informe.";
  const sum = (k) => teams.reduce((a, t) => a + (t[k] || 0), 0);
  const players = sum("playerCount");
  const injured = sum("injuredPlayers");
  const goals = sum("totalGoals");
  const assists = sum("totalAssists");

  const intro = `${scopeLabel}: ${plural(teams.length, "equipo", "equipos")} y ${plural(players, "jugador", "jugadores")}` +
    `${injured ? ` (${plural(injured, "lesionado", "lesionados")})` : ""}. ` +
    `Los jugadores suman ${plural(goals, "gol", "goles")} y ${plural(assists, "asistencia", "asistencias")} en partidos de liga cerrados.`;

  const perTeam = teams.map((t) => {
    const bits = [`${plural(t.playerCount, "jugador", "jugadores")}`];
    if (t.totalGoals) bits.push(plural(t.totalGoals, "gol", "goles"));
    if (t.attendanceRate !== null && t.attendanceRate !== undefined) bits.push(`asistencia a entrenos ${t.attendanceRate}%`);
    if (t.avgRating) bits.push(`valoración media ${t.avgRating}/10`);
    let line = `• ${t.name}: ${bits.join(", ")}.`;
    if (t.topScorers?.length) line += ` Máximos goleadores: ${t.topScorers.map((s) => `${s.name} (${s.goals})`).join(", ")}.`;
    return line;
  });

  const attention = [];
  teams.forEach((t) => {
    if (t.attendanceRate !== null && t.attendanceRate !== undefined && t.attendanceRate < 70) attention.push(`${t.name}: asistencia a entrenos baja (${t.attendanceRate}%)`);
    if ((t.injuredPlayers || 0) >= 3) attention.push(`${t.name}: ${t.injuredPlayers} jugadores lesionados`);
    if ((t.totalRed || 0) >= 2) attention.push(`${t.name}: ${t.totalRed} tarjetas rojas`);
  });
  const tail = attention.length ? `\n\nPuntos de atención:\n${attention.map((a) => `• ${a}`).join("\n")}` : "";

  return `${intro}\n\n${perTeam.join("\n")}${tail}`;
}
