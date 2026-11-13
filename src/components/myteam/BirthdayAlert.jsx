import React from "react";
import { Cake } from "lucide-react";
import { Link } from "react-router-dom";
import { playerFullName } from "@/lib/playerName";
import { useT, useLocaleTag } from "@/i18n";

// Cumpleaños de la plantilla: hoy (destacado) y próximos 7 días.
export default function BirthdayAlert({ players }) {
  const t = useT();
  const tag = useLocaleTag();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const list = [];
  players.forEach((p) => {
    if (!p.birth_date || p.status === "baja") return;
    const [by, m, d] = String(p.birth_date).slice(0, 10).split("-").map(Number);
    if (!m || !d) return;
    let next = new Date(today.getFullYear(), m - 1, d);
    if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
    const days = Math.round((next - today) / 86400000);
    if (days <= 7) list.push({ p, days, date: next, age: by ? next.getFullYear() - by : null });
  });
  if (!list.length) return null;
  list.sort((a, b) => a.days - b.days);
  const todayList = list.filter((x) => x.days === 0);
  const soon = list.filter((x) => x.days > 0);
  const when = (x) => x.date.toLocaleDateString(tag, { weekday: "long", day: "numeric", month: "long" });
  const years = (x) => (x.age ? t("{n} años", { n: x.age }) : "");
  const short = (x) => x.date.toLocaleDateString(tag, { weekday: "short" });
  const isToday = todayList.length > 0;
  const shown = isToday ? todayList : soon;
  // Tarjeta del mismo tamaño que los pendientes de Mi equipo (diseño rs2)
  return (
    <div className="rs2-card flex items-center" style={{ flex: "1 1 260px", gap: 10, padding: "8px 12px", borderRadius: 10, minWidth: 0, ...(isToday ? { background: "#FFF7ED", borderColor: "#FAD7B5" } : {}) }} data-testid="team-birthdays">
      <Cake className="w-4 h-4 shrink-0" style={{ color: isToday ? "var(--naranja)" : "#4A3D3F" }} aria-hidden="true" />
      <span className="rs2-display tabular-nums" style={{ fontSize: 22, lineHeight: 1, color: isToday ? "var(--naranja)" : "#4A3D3F" }}>{list.length}</span>
      <p style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.25, color: "#4A3D3F" }}>
        <span style={{ fontWeight: 700 }}>{isToday ? t("¡Hoy cumple años") : t("Cumpleaños esta semana")}</span>{" · "}
        {shown.map((x, i) => (
          <span key={x.p.id}>{i > 0 && ", "}<Link to={`/PlayerProfile?id=${x.p.id}`} className="hover:underline" style={{ fontWeight: 600 }} title={[years(x), when(x)].filter(Boolean).join(" · ")}>{playerFullName(x.p)}</Link>{!isToday && <span style={{ color: "#6B5E60" }}> ({short(x)})</span>}</span>
        ))}
        {isToday && soon.length > 0 && <span style={{ color: "#6B5E60" }}> · {t("y {n} más esta semana", { n: soon.length })}</span>}
      </p>
    </div>
  );
}
