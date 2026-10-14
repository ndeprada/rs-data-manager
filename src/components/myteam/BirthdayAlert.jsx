import React from "react";
import { Cake } from "lucide-react";
import { Link } from "react-router-dom";
import { playerFullName } from "@/lib/playerName";

// Cumpleaños de la plantilla: hoy (destacado) y próximos 7 días.
export default function BirthdayAlert({ players }) {
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
  const when = (x) => x.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const years = (x) => (x.age ? `${x.age} años` : "");
  return (
    <div className="space-y-1.5">
      {todayList.length > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 border border-orange-200 bg-orange-50" style={{ borderRadius: "6px", borderLeft: "4px solid var(--naranja)" }}>
          <Cake className="w-5 h-5 shrink-0" style={{ color: "var(--naranja)" }} />
          <p className="text-sm font-bold text-orange-900">
            ¡Hoy cumple años {todayList.map((x, i) => (
              <span key={x.p.id}>{i > 0 && (i === todayList.length - 1 ? " y " : ", ")}<Link to={`/PlayerProfile?id=${x.p.id}`} className="underline">{playerFullName(x.p)}</Link>{years(x) && ` (${years(x)})`}</span>
            ))}!
          </p>
        </div>
      )}
      {soon.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200" style={{ borderRadius: "6px" }}>
          <Cake className="w-4 h-4 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-600">
            <span className="font-bold uppercase tracking-wider text-[10px] text-gray-400 mr-2" style={{ fontFamily: "var(--font-display)" }}>Próximos cumpleaños</span>
            {soon.map((x, i) => (
              <span key={x.p.id}>{i > 0 && " · "}<Link to={`/PlayerProfile?id=${x.p.id}`} className="font-semibold text-gray-800 hover:underline">{playerFullName(x.p)}</Link> <span className="text-gray-500">· {years(x) && `${years(x)} · `}{when(x)}</span></span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
