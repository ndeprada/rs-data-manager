import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, startOfWeek, endOfWeek, addDays, isWithinInterval, parseISO, nextSaturday, nextSunday, isSaturday, isSunday, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Download, ChevronLeft, ChevronRight, Home, MapPin, Clock, Edit2, Check, X, Shirt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { CLUB_LOGO_URL_WHITE } from "@/lib/clubConfig";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

// Metadatos extra por evento (vestuario + equipación) → guardados en el Event como notes o usamos un campo extra
// Los almacenamos localmente en estado y al guardar hacemos update del evento

const KIT_OPTS = [
  { value: "primera", label: "1ª (granate)" },
  { value: "segunda", label: "2ª (granate alt)" },
  { value: "tercera", label: "3ª (verde)" },
];

function getWeekendDates(referenceDate) {
  // Returns [saturday, sunday] of the weekend containing or after referenceDate
  const day = referenceDate.getDay(); // 0=Sun, 6=Sat
  let sat;
  if (day === 0) {
    // Sunday → previous saturday
    sat = addDays(referenceDate, -1);
  } else if (day === 6) {
    sat = referenceDate;
  } else {
    // Mon-Fri → next saturday
    const daysToSat = 6 - day;
    sat = addDays(referenceDate, daysToSat);
  }
  const sun = addDays(sat, 1);
  return [startOfDay(sat), startOfDay(sun)];
}

export default function WeekendAgenda({ events = [], teams = [], fields = [] }) {
  const qc = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [editing, setEditing] = useState({}); // eventId -> { locker, kit, kit_size }
  const [saving, setSaving] = useState({});
  const printRef = useRef(null);

  // Reference weekend
  const baseDate = addDays(new Date(), weekOffset * 7);
  const [sat, sun] = getWeekendDates(baseDate);

  const weekendLabel = (() => {
    const satStr = format(sat, "d", { locale: es });
    const sunStr = format(sun, "d", { locale: es });
    const monthStr = format(sat, "MMMM", { locale: es });
    const monthSunStr = format(sun, "MMMM", { locale: es });
    const year = format(sat, "yyyy");
    if (monthStr === monthSunStr) return `${satStr}-${sunStr} de ${monthStr} ${year}`;
    return `${satStr} de ${monthStr} - ${sunStr} de ${monthSunStr} ${year}`;
  })();

  // Filter weekend matches
  const weekendMatches = events
    .filter(e => {
      if (!MATCH_TYPES.includes(e.type)) return false;
      const d = startOfDay(parseISO(e.date));
      return d >= sat && d <= sun;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const getTeam = (id) => teams.find(t => t.id === id);
  const getField = (id) => fields.find(f => f.id === id);

  // Parse extra agenda data stored in event (we store in a JSON comment in notes or use a dedicated field)
  // We store agenda metadata as JSON in event.agenda_meta (or we use local state + persist on update)
  const getAgendaMeta = (event) => {
    try {
      if (event.agenda_meta) return typeof event.agenda_meta === "string" ? JSON.parse(event.agenda_meta) : event.agenda_meta;
    } catch {}
    return {};
  };

  const startEdit = (event) => {
    const meta = getAgendaMeta(event);
    setEditing(prev => ({
      ...prev,
      [event.id]: { locker: meta.locker || "", kit: meta.kit || "", kit_size: meta.kit_size || "" }
    }));
  };

  const cancelEdit = (eventId) => {
    setEditing(prev => { const n = { ...prev }; delete n[eventId]; return n; });
  };

  const saveEdit = async (event) => {
    const data = editing[event.id];
    setSaving(prev => ({ ...prev, [event.id]: true }));
    await base44.entities.Event.update(event.id, { agenda_meta: data });
    qc.invalidateQueries({ queryKey: ["events"] });
    setSaving(prev => { const n = { ...prev }; delete n[event.id]; return n; });
    setEditing(prev => { const n = { ...prev }; delete n[event.id]; return n; });
    toast({ title: "Guardado" });
  };

  const handlePrint = () => {
    const printContents = printRef.current?.innerHTML;
    if (!printContents) return;

    const win = window.open("", "_blank");
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Agenda Semanal – ${weekendLabel}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=IBM+Plex+Sans+Condensed:wght@400;500;600&display=swap');
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:'IBM Plex Sans Condensed',sans-serif; color:#1a1a1a; background:#fff; padding:24px; }
          .print-root { max-width:800px; margin:0 auto; }
          .header { display:flex; align-items:center; gap:16px; margin-bottom:24px; padding-bottom:16px; border-bottom: 3px solid #8B1A2B; }
          .header-logo { width:60px; height:60px; background:#8B1A2B; border-radius:8px; display:flex; align-items:center; justify-content:center; padding:8px; }
          .header-logo img { width:100%; height:100%; object-fit:contain; filter:brightness(10); }
          .header-text h1 { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:24px; text-transform:uppercase; letter-spacing:0.05em; color:#8B1A2B; }
          .header-text p { font-family:'Barlow Condensed',sans-serif; font-size:14px; color:#666; text-transform:uppercase; letter-spacing:0.1em; }
          table { width:100%; border-collapse:collapse; font-size:12px; }
          thead tr { background:#8B1A2B; color:white; }
          thead th { padding:8px 10px; text-align:left; font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.1em; }
          tbody tr { border-bottom:1px solid #e5e7eb; }
          tbody tr:nth-child(even) { background:#fdf2f4; }
          tbody td { padding:8px 10px; vertical-align:middle; }
          .team-name { font-weight:600; font-size:13px; }
          .day-badge { display:inline-block; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; text-transform:uppercase; }
          .sat { background:#fef3c7; color:#92400e; }
          .sun { background:#ede9fe; color:#5b21b6; }
          .home-badge { display:inline-block; padding:1px 6px; border-radius:4px; background:#dcfce7; color:#15803d; font-size:10px; font-weight:600; }
          .away-badge { display:inline-block; padding:1px 6px; border-radius:4px; background:#f3f4f6; color:#6b7280; font-size:10px; font-weight:600; }
          .kit-badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; }
          .kit-segunda { background:#fef3c7; color:#92400e; }
          .kit-tercera { background:#dcfce7; color:#166534; }
          .footer { margin-top:24px; text-align:center; font-size:10px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:12px; }
          @media print { body { padding:12px; } }
        </style>
      </head>
      <body>
        <div class="print-root">
          ${printContents}
        </div>
      </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 400);
  };

  // Build printable HTML
  const buildPrintHTML = () => {
    const rows = weekendMatches.map(ev => {
      const team = getTeam(ev.team_id);
      const field = getField(ev.field_id);
      const meta = getAgendaMeta(ev);
      const day = new Date(ev.date).getDay();
      const isSat = day === 6;
      const isHome = ev.is_home !== false;

      const dayBadge = isSat
        ? `<span class="day-badge sat">Sábado</span>`
        : `<span class="day-badge sun">Domingo</span>`;
      const locBadge = isHome
        ? `<span class="home-badge">Local</span>`
        : `<span class="away-badge">Visitante</span>`;

      let kitCell = "—";
      if (isHome && meta.kit) {
        const kitLabel = meta.kit === "segunda" ? "2ª Equipación" : "3ª Equipación";
        const kitClass = meta.kit === "segunda" ? "kit-segunda" : "kit-tercera";
        kitCell = `<span class="kit-badge ${kitClass}">${kitLabel}${meta.kit_size ? " · " + meta.kit_size : ""}</span>`;
      }

      return `
        <tr>
          <td>${dayBadge}</td>
          <td class="team-name">${team?.name || "—"}</td>
          <td>${ev.opponent || "—"}</td>
          <td><strong>${format(parseISO(ev.date), "HH:mm")}</strong></td>
          <td>${locBadge}</td>
          <td>${field?.name || ev.location || "—"}</td>
          <td>${isHome && meta.locker ? `<strong>${meta.locker}</strong>` : "—"}</td>
          <td>${kitCell}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="header">
        <div class="header-logo">
          <img src="${CLUB_LOGO_URL_WHITE}" alt="Club"/>
        </div>
        <div class="header-text">
          <h1>Agenda Semanal</h1>
          <p>${weekendLabel.charAt(0).toUpperCase() + weekendLabel.slice(1)}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Día</th>
            <th>Equipo</th>
            <th>Rival</th>
            <th>Hora</th>
            <th>Loc/Vis</th>
            <th>Campo</th>
            <th>Vestuario</th>
            <th>Equipación</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#9ca3af;">Sin partidos este fin de semana</td></tr>'}
        </tbody>
      </table>
      <div class="footer">Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })} · RS Data Manager</div>
    `;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100" style={{ background: "var(--granate)" }}>
        <div className="flex items-center gap-2">
          <h2 className="font-black text-white text-sm uppercase tracking-wider on-dark" style={{ fontFamily: "var(--font-display)" }}>
            Agenda Semanal
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white text-xs font-bold uppercase tracking-wide" style={{ fontFamily: "var(--font-display)", minWidth: 160, textAlign: "center" }}>
            {weekendLabel}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const printHTML = buildPrintHTML();
              const win = window.open("", "_blank");
              win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Agenda – ${weekendLabel}</title><style>
                @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=IBM+Plex+Sans+Condensed:wght@400;500;600&display=swap');
                *{margin:0;padding:0;box-sizing:border-box;}
                body{font-family:'IBM Plex Sans Condensed',sans-serif;color:#1a1a1a;background:#fff;padding:24px;}
                .header{display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #8B1A2B;}
                .header-logo{width:60px;height:60px;background:#8B1A2B;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:8px;}
                .header-logo img{width:100%;height:100%;object-fit:contain;filter:brightness(10);}
                .header-text h1{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:24px;text-transform:uppercase;letter-spacing:0.05em;color:#8B1A2B;}
                .header-text p{font-family:'Barlow Condensed',sans-serif;font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.1em;}
                table{width:100%;border-collapse:collapse;font-size:12px;}
                thead tr{background:#8B1A2B;color:white;}
                thead th{padding:8px 10px;text-align:left;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;}
                tbody tr{border-bottom:1px solid #e5e7eb;}
                tbody tr:nth-child(even){background:#fdf2f4;}
                tbody td{padding:8px 10px;vertical-align:middle;}
                .team-name{font-weight:600;font-size:13px;}
                .day-badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;text-transform:uppercase;}
                .sat{background:#fef3c7;color:#92400e;}
                .sun{background:#ede9fe;color:#5b21b6;}
                .home-badge{display:inline-block;padding:1px 6px;border-radius:4px;background:#dcfce7;color:#15803d;font-size:10px;font-weight:600;}
                .away-badge{display:inline-block;padding:1px 6px;border-radius:4px;background:#f3f4f6;color:#6b7280;font-size:10px;font-weight:600;}
                .kit-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;}
                .kit-segunda{background:#fef3c7;color:#92400e;}
                .kit-tercera{background:#dcfce7;color:#166534;}
                .footer{margin-top:24px;text-align:center;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;}
              </style></head><body>${printHTML}</body></html>`);
              win.document.close();
              setTimeout(() => { win.focus(); win.print(); win.close(); }, 400);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Table */}
      {weekendMatches.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          Sin partidos este fin de semana
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Día", "Equipo", "Rival", "Hora", "Loc/Vis", "Campo", "Vestuario", "Equipación"].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wider text-gray-500 text-[10px] whitespace-nowrap" style={{ fontFamily: "var(--font-display)" }}>
                    {h}
                  </th>
                ))}
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {weekendMatches.map(ev => {
                const team = getTeam(ev.team_id);
                const field = getField(ev.field_id);
                const meta = getAgendaMeta(ev);
                const isHome = ev.is_home !== false;
                const day = new Date(ev.date).getDay();
                const isSat = day === 6;
                const isEditing = !!editing[ev.id];
                const ed = editing[ev.id] || {};

                return (
                  <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                    {/* Day */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isSat ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>
                        {isSat ? "Sáb" : "Dom"}
                      </span>
                    </td>
                    {/* Team */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-bold text-gray-900 text-xs" style={{ fontFamily: "var(--font-display)" }}>{team?.name || "—"}</span>
                    </td>
                    {/* Rival */}
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{ev.opponent || <span className="text-gray-300">—</span>}</td>
                    {/* Hour */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-bold text-gray-900">{format(parseISO(ev.date), "HH:mm")}</span>
                    </td>
                    {/* Home/Away */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isHome
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">Local</span>
                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-500">Visitante</span>
                      }
                    </td>
                    {/* Field */}
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {field?.name || ev.location || <span className="text-gray-300">—</span>}
                    </td>
                    {/* Locker */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isHome ? (
                        isEditing ? (
                          <Input
                            value={ed.locker}
                            onChange={e => setEditing(prev => ({ ...prev, [ev.id]: { ...prev[ev.id], locker: e.target.value } }))}
                            placeholder="Ej: V1"
                            className="h-6 w-16 text-xs px-1.5"
                          />
                        ) : (
                          <span className={`font-bold text-sm ${meta.locker ? "text-gray-900" : "text-gray-300"}`} style={{ fontFamily: "var(--font-display)" }}>
                            {meta.locker || "—"}
                          </span>
                        )
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Kit */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isHome ? (
                        isEditing ? (
                          <div className="flex items-center gap-1">
                                            <Select value={ed.kit || "primera"} onValueChange={v => setEditing(prev => ({ ...prev, [ev.id]: { ...prev[ev.id], kit: v === "primera" ? "" : v } }))}>
                              <SelectTrigger className="h-6 text-xs w-32 px-1.5"><SelectValue placeholder="Equipación" /></SelectTrigger>
                              <SelectContent>
                                {KIT_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {ed.kit && ed.kit !== "primera" && (
                              <Input
                                value={ed.kit_size}
                                onChange={e => setEditing(prev => ({ ...prev, [ev.id]: { ...prev[ev.id], kit_size: e.target.value } }))}
                                placeholder="Talla"
                                className="h-6 w-16 text-xs px-1.5"
                              />
                            )}
                          </div>
                        ) : (
                          meta.kit ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${meta.kit === "segunda" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                              {meta.kit === "segunda" ? "2ª" : "3ª"}{meta.kit_size ? ` · ${meta.kit_size}` : ""}
                            </span>
                          ) : <span className="text-gray-300">—</span>
                        )
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Edit actions */}
                    <td className="px-2 py-2 whitespace-nowrap">
                      {isHome && (
                        isEditing ? (
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(ev)} disabled={saving[ev.id]} className="p-1 rounded hover:bg-green-50 text-green-600">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => cancelEdit(ev.id)} className="p-1 rounded hover:bg-red-50 text-red-400">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(ev)} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}