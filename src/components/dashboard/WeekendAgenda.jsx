import React, { useEffect, useRef, useState } from "react";
import EventWeather from "@/components/EventWeather";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, addDays, parseISO, startOfDay } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import { Download, ChevronLeft, ChevronRight, Edit2, Check, X, Home, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { CLUB_LOGO_URL_WHITE } from "@/lib/clubConfig";
import { isCancelled, cancelText } from "@/lib/eventCancel";
import { useT, useDateLocale, msg } from "@/i18n";
import { C as clubColor, F as clubFont, BRAND } from "@/lib/brand";
import StepSquares from "@/components/match/StepSquares";
import { matchSteps } from "@/lib/matchSteps";
import { minPlayersOf } from "@/lib/matchFormat";
import { agendaMeta, kitInfo, kitText, kitSwatch, KIT_COLORS, KIT_SIZES, sortAgenda, homeGroups, fitScale } from "@/lib/weekendAgenda";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const ORDER_KEY = "rs_agenda_order";

const KIT_OPTS = [
  { value: "primera", label: msg("1ª equipación") },
  { value: "segunda", label: msg("2ª equipación") },
  { value: "tercera", label: msg("3ª equipación") },
];

function getWeekendDates(referenceDate) {
  // [sábado, domingo] del fin de semana que contiene la fecha o el siguiente
  const day = referenceDate.getDay(); // 0=Dom, 6=Sáb
  const sat = day === 0 ? addDays(referenceDate, -1) : day === 6 ? referenceDate : addDays(referenceDate, 6 - day);
  return [startOfDay(sat), startOfDay(addDays(sat, 1))];
}

const readOrder = () => { try { return localStorage.getItem(ORDER_KEY) === "equipo" ? "equipo" : "hora"; } catch { return "hora"; } };
const handleOf = (url) => { const m = String(url || "").match(/instagram\.com\/([^/?#]+)/i); return m ? `@${m[1]}` : ""; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function KitChip({ meta, small }) {
  const k = kitInfo(meta);
  if (!k) return <span className="text-gray-300">—</span>;
  const sw = kitSwatch(k.color);
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded ${small ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5"} ${k.kit === "primera" ? "bg-gray-100 text-gray-700" : k.kit === "segunda" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
      {sw && <span className="inline-block rounded-full" style={{ width: 9, height: 9, background: sw, border: "1px solid rgba(0,0,0,.25)" }} />}
      {kitText(meta)}
    </span>
  );
}

// ─── Hoja para compartir (A4, siempre en español): agenda completa o solo los partidos en casa ───
const PAGE_W = 794, PAGE_H = 1123, PAD = 34;

function SheetKit({ meta }) {
  const k = kitInfo(meta);
  if (!k) return <span style={{ color: "#B9AEAF" }}>—</span>;
  const sw = kitSwatch(k.color);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700, color: "#3B2A2D", whiteSpace: "nowrap" }}>
      {sw && <span style={{ width: 10, height: 10, borderRadius: 99, background: sw, border: "1px solid rgba(0,0,0,.3)", display: "inline-block" }} />}
      {kitText(meta)}
    </span>
  );
}

function AgendaSheet({ mode, label, matches, homes, getTeam, fieldName, innerRef }) {
  const th = { textAlign: "left", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "#7A6B6D", fontWeight: 700, padding: "0 8px 5px" };
  const td = { padding: "6px 8px", borderTop: "1px solid #EEE5E4", verticalAlign: "middle" };
  const dayTitle = (d) => cap(format(parseISO(d), "EEEE d 'de' MMMM", { locale: esLocale }));
  const days = [];
  for (const ev of matches) { const d = String(ev.date).slice(0, 10); let g = days.find((x) => x.day === d); if (!g) days.push((g = { day: d, items: [] })); g.items.push(ev); }
  if (mode === "hora") days.sort((a, b) => (a.day < b.day ? -1 : 1));
  const social = handleOf(BRAND.social?.instagram);
  const web = String(BRAND.web || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

  const Rival = ({ ev }) => (
    <span>
      <span style={isCancelled(ev) ? { textDecoration: "line-through", color: "#9A8C8E" } : null}>{ev.opponent || "—"}</span>
      {isCancelled(ev) && <b style={{ color: "#B91C1C", marginLeft: 6, fontSize: 10 }}>{cancelText(ev).toUpperCase()}</b>}
    </span>
  );
  const DayHead = ({ children, sub }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "14px 0 6px", borderBottom: `2px solid ${clubColor.accent}`, paddingBottom: 3 }}>
      <span style={{ fontFamily: clubFont.title, fontSize: 21, color: clubColor.primary, textTransform: "uppercase", letterSpacing: ".02em" }}>{children}</span>
      {sub && <span style={{ fontSize: 11, color: "#7A6B6D", fontWeight: 600 }}>{sub}</span>}
    </div>
  );

  return (
    <div ref={innerRef} style={{ width: PAGE_W - 2 * PAD, fontFamily: clubFont.body, color: "#1E1416", transformOrigin: "top left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: clubColor.primary, borderRadius: 12, padding: "14px 20px" }}>
        <img src={CLUB_LOGO_URL_WHITE} alt="" style={{ width: 52, height: 52, objectFit: "contain" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(255,255,255,.75)", fontWeight: 700 }}>{BRAND.clubName}</div>
          <div style={{ fontFamily: clubFont.title, fontSize: 32, lineHeight: 1.05, color: "#fff", textTransform: "uppercase" }}>{mode === "casa" ? "Partidos en casa" : "Agenda del fin de semana"}</div>
        </div>
        <div style={{ fontFamily: clubFont.title, fontSize: 19, color: clubColor.accent, textTransform: "uppercase", textAlign: "right" }}>{label}</div>
      </div>

      {mode === "casa" ? (
        homes.length === 0 ? <p style={{ marginTop: 24, color: "#7A6B6D" }}>Sin partidos en casa este fin de semana.</p> : homes.map((g) => (
          <div key={g.field}>
            {g.days.map((d) => (
              <div key={d.day}>
                <DayHead sub={`${g.field} · ${d.items.length} ${d.items.length === 1 ? "partido" : "partidos"}`}>{dayTitle(d.day)}</DayHead>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
                  <colgroup>{[58, 180, 210, 88, 190].map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                  <thead><tr>{["Hora", "Equipo", "Rival", "Vestuario", "Equipación"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {d.items.map((ev) => { const meta = agendaMeta(ev); return (
                      <tr key={ev.id}>
                        <td style={{ ...td, width: 58, fontFamily: clubFont.title, fontSize: 17, color: clubColor.primary }}>{format(parseISO(ev.date), "HH:mm")}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{getTeam(ev.team_id)?.name || "—"}</td>
                        <td style={td}><Rival ev={ev} /></td>
                        <td style={{ ...td, fontWeight: 700, width: 80 }}>{meta.locker || <span style={{ color: "#B9AEAF" }}>—</span>}</td>
                        <td style={{ ...td, width: 170 }}><SheetKit meta={meta} /></td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ))
      ) : (
        matches.length === 0 ? <p style={{ marginTop: 24, color: "#7A6B6D" }}>Sin partidos este fin de semana.</p> : (mode === "hora" ? days : [{ day: null, items: matches }]).map((d) => (
          <div key={d.day || "all"}>
            {d.day && <DayHead sub={`${d.items.length} ${d.items.length === 1 ? "partido" : "partidos"}`}>{dayTitle(d.day)}</DayHead>}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: d.day ? 0 : 14, tableLayout: "fixed" }}>
              <colgroup>{(d.day ? [52, 128, 140, 58, 138, 42, 168] : [36, 48, 120, 128, 58, 120, 42, 174]).map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              <thead><tr>{[!d.day && "Día", "Hora", "Equipo", "Rival", "", "Campo", "Vest.", "Equipación"].filter((h) => h !== false).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {d.items.map((ev) => { const meta = agendaMeta(ev); const home = ev.is_home !== false; return (
                  <tr key={ev.id}>
                    {!d.day && <td style={{ ...td, fontWeight: 700, width: 40 }}>{new Date(ev.date).getDay() === 6 ? "Sáb" : "Dom"}</td>}
                    <td style={{ ...td, width: 54, fontFamily: clubFont.title, fontSize: 16, color: clubColor.primary }}>{format(parseISO(ev.date), "HH:mm")}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{getTeam(ev.team_id)?.name || "—"}</td>
                    <td style={td}><Rival ev={ev} /></td>
                    <td style={{ ...td, width: 58 }}><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: home ? "#DCFCE7" : "#F1ECEC", color: home ? "#15803D" : "#6B5E60" }}>{home ? "CASA" : "FUERA"}</span></td>
                    <td style={{ ...td, color: "#4A3D3F" }}>{fieldName(ev) || "—"}</td>
                    <td style={{ ...td, fontWeight: 700, width: 46 }}>{home && meta.locker ? meta.locker : <span style={{ color: "#B9AEAF" }}>—</span>}</td>
                    <td style={{ ...td, width: 150 }}><SheetKit meta={meta} /></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        ))
      )}

      {(web || social) && (
        <div style={{ marginTop: 18, textAlign: "center", fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: clubColor.primary }}>{[web, social].filter(Boolean).join("   ·   ")}</div>
      )}
    </div>
  );
}

export default function WeekendAgenda({ events = [], teams = [], fields = [], convocs = null }) {
  const t = useT();
  const dfl = useDateLocale();
  const qc = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [order, setOrderState] = useState(readOrder);
  const [editing, setEditing] = useState({}); // eventId -> { locker, kit, kit_color, kit_size }
  const [saving, setSaving] = useState({});
  const [exportOpen, setExportOpen] = useState(false);
  const [exportWhat, setExportWhat] = useState("todo"); // todo | casa
  const [exporting, setExporting] = useState(null); // { what, format }
  const pageRef = useRef(null);
  const innerRef = useRef(null);

  const setOrder = (o) => { setOrderState(o); try { localStorage.setItem(ORDER_KEY, o); } catch { /* sin almacenamiento */ } };

  const baseDate = addDays(new Date(), weekOffset * 7);
  const [sat, sun] = getWeekendDates(baseDate);
  const weekendLabel = (() => {
    const m1 = format(sat, "MMMM", { locale: dfl }), m2 = format(sun, "MMMM", { locale: dfl });
    if (m1 === m2) return `${format(sat, "d")}-${format(sun, "d")} ${m1} ${format(sat, "yyyy")}`;
    return `${format(sat, "d")} ${m1} - ${format(sun, "d")} ${m2} ${format(sun, "yyyy")}`;
  })();
  // La hoja va siempre en español
  const sheetLabel = (() => {
    const m1 = format(sat, "MMMM", { locale: esLocale }), m2 = format(sun, "MMMM", { locale: esLocale });
    return m1 === m2 ? `${format(sat, "d")}-${format(sun, "d")} ${m1}` : `${format(sat, "d")} ${m1} - ${format(sun, "d")} ${m2}`;
  })();

  const inWeekend = events.filter((e) => {
    if (!MATCH_TYPES.includes(e.type) || !e.date) return false;
    const d = startOfDay(parseISO(e.date));
    return d >= sat && d <= sun;
  });
  const weekendMatches = sortAgenda(inWeekend, order, teams.map((x) => x.id));
  const chrono = sortAgenda(inWeekend, "hora");

  const getTeam = (id) => teams.find((x) => x.id === id);
  const getField = (id) => fields.find((f) => f.id === id);
  const fieldName = (ev) => getField(ev.field_id)?.name || ev.location || "";
  const homes = homeGroups(chrono, fieldName);

  // Pasos C · P de cada partido (14/11/2026, Nacho: «no quiero que al generar el pdf salga esa parte»): solo en pantalla,
  // nunca en la hoja que se comparte. Plan leído ligero por partido (alineación y sistema).
  const showSteps = Array.isArray(convocs);
  const planQs = useQueries({
    queries: (showSteps ? inWeekend : []).map((ev) => ({
      queryKey: ["match-plan-lite", ev.id],
      queryFn: () => base44.entities.MatchPlan.pick(["event_id", "lineup", "formation"], { event_id: ev.id }),
      staleTime: 60_000,
    })),
  });
  const planOf = Object.fromEntries((showSteps ? inWeekend : []).map((ev, i) => [ev.id, planQs[i]?.data?.[0] || null]));
  const stepsOf = (ev) => matchSteps({ event: ev, conv: convocs.find((c) => c.event_id === ev.id), plan: planOf[ev.id], minPlayers: minPlayersOf(ev, getTeam(ev.team_id)) });

  const startEdit = (event) => {
    const meta = agendaMeta(event);
    setEditing((prev) => ({ ...prev, [event.id]: { locker: meta.locker || "", kit: meta.kit || "", kit_color: meta.kit_color || "", kit_size: meta.kit_size || "" } }));
  };
  const cancelEdit = (id) => setEditing((prev) => { const n = { ...prev }; delete n[id]; return n; });
  const patchEdit = (id, patch) => setEditing((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const saveEdit = async (event) => {
    const data = editing[event.id];
    setSaving((prev) => ({ ...prev, [event.id]: true }));
    try {
      await base44.entities.Event.update(event.id, { agenda_meta: { ...agendaMeta(event), ...data } });
      qc.invalidateQueries({ queryKey: ["events"] });
      cancelEdit(event.id);
      toast({ title: t("Guardado") });
    } catch {
      toast({ title: t("No se ha podido guardar"), variant: "destructive" });
    } finally {
      setSaving((prev) => { const n = { ...prev }; delete n[event.id]; return n; });
    }
  };

  // Exportar: la hoja se monta fuera de la vista, se encoge si no cabe en un A4 y se fotografía
  useEffect(() => {
    if (!exporting) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [{ toCanvas }] = await Promise.all([import("html-to-image")]);
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const page = pageRef.current, inner = innerRef.current;
        if (!page || !inner || cancelled) return;
        await Promise.all([...page.querySelectorAll("img")].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
        const avail = PAGE_H - 2 * PAD;
        const s = fitScale(inner.scrollHeight, avail);
        inner.style.transform = s < 1 ? `scale(${s})` : "";
        inner.style.width = `${(PAGE_W - 2 * PAD) / s}px`;
        await new Promise((r) => requestAnimationFrame(r));
        const filter = (n) => !(n.tagName === "IMG" && !(n.complete && n.naturalWidth > 0));
        const canvas = await toCanvas(page, { pixelRatio: 3, backgroundColor: "#ffffff", cacheBust: false, filter });
        if (cancelled) return;
        const base = `${exporting.what === "casa" ? "partidos-en-casa" : "agenda"}-${format(sat, "yyyy-MM-dd")}`;
        if (exporting.format === "png") {
          const a = document.createElement("a");
          a.href = canvas.toDataURL("image/png");
          a.download = `${base}.png`;
          a.click();
        } else {
          const { jsPDF } = await import("jspdf");
          const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297, undefined, "FAST");
          pdf.save(`${base}.pdf`);
        }
      } catch {
        toast({ title: t("No se ha podido preparar el archivo"), variant: "destructive" });
      } finally {
        if (!cancelled) setExporting(null);
      }
    })();
    return () => { cancelled = true; };
  }, [exporting]);

  const doExport = (fmt) => { setExportOpen(false); setExporting({ what: exportWhat, format: fmt }); };

  const seg = (on) => `px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${on ? "bg-white text-gray-900" : "text-white/70 hover:text-white"}`;

  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm" data-testid="weekend-agenda">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 rounded-t-sm" style={{ background: "var(--granate)" }}>
        <h2 className="font-black text-white text-sm uppercase tracking-wider on-dark" style={{ fontFamily: "var(--font-display)" }}>
          {t("Agenda Semanal")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded p-0.5 bg-white/10" data-testid="agenda-order">
            <button className={seg(order === "hora")} onClick={() => setOrder("hora")} data-testid="agenda-order-hora">{t("Por hora")}</button>
            <button className={seg(order === "equipo")} onClick={() => setOrder("equipo")} data-testid="agenda-order-equipo">{t("Por equipo")}</button>
          </div>
          <button onClick={() => setWeekOffset((w) => w - 1)} className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors" aria-label={t("Anterior")}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white text-xs font-bold uppercase tracking-wide" style={{ fontFamily: "var(--font-display)", minWidth: 150, textAlign: "center" }}>{weekendLabel}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors" aria-label={t("Siguiente")}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setExportOpen((o) => !o)}
              disabled={!!exporting}
              data-testid="agenda-export"
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-60"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <Download className="w-3.5 h-3.5" /> {exporting ? t("Preparando…") : t("Compartir")}
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 w-64 bg-white border border-gray-200 rounded-md shadow-lg p-3 text-gray-800" data-testid="agenda-export-menu">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">{t("Qué incluir")}</p>
                <div className="flex gap-1 mb-3">
                  {[["todo", t("Toda la agenda")], ["casa", t("Partidos en casa")]].map(([k, l]) => (
                    <button key={k} onClick={() => setExportWhat(k)} data-testid={`agenda-export-${k}`}
                      className={`flex-1 px-2 py-1 rounded text-xs font-bold border ${exportWhat === k ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                      style={exportWhat === k ? { background: "var(--granate)" } : null}>{l}</button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => doExport("pdf")} data-testid="agenda-pdf" className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-bold text-white" style={{ background: "var(--granate)" }}>
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                  <button onClick={() => doExport("png")} data-testid="agenda-png" className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50">
                    <ImageIcon className="w-3.5 h-3.5" /> {t("Imagen")}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-2 leading-snug">{t("Una sola hoja, lista para enviar a los entrenadores o publicar en redes.")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla */}
      {weekendMatches.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">{t("Sin partidos este fin de semana")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {[t("Día"), t("Hora"), t("Equipo"), t("Rival"), t("Loc/Vis"), t("Campo"), t("Vestuario"), t("Equipación"), showSteps && t("Conv. · Prep.")].filter(Boolean).map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wider text-gray-500 text-[10px] whitespace-nowrap" style={{ fontFamily: "var(--font-display)" }}>{h}</th>
                ))}
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {weekendMatches.map((ev, i) => {
                const team = getTeam(ev.team_id);
                const meta = agendaMeta(ev);
                const isHome = ev.is_home !== false;
                const isSat = new Date(ev.date).getDay() === 6;
                const isEditing = !!editing[ev.id];
                const ed = editing[ev.id] || {};
                const prev = weekendMatches[i - 1];
                const newDay = order === "hora" && prev && String(prev.date).slice(0, 10) !== String(ev.date).slice(0, 10);
                return (
                  <tr key={ev.id} className={`hover:bg-gray-50 transition-colors ${newDay ? "border-t-2 border-t-gray-300" : ""}`} data-testid={`agenda-row-${ev.id}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isSat ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>{isSat ? t("Sáb") : t("Dom")}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-bold text-gray-900">{format(parseISO(ev.date), "HH:mm")}</span>
                      <EventWeather event={ev} rain size="md" className="ml-2 align-middle" />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-bold text-gray-900 text-xs" style={{ fontFamily: "var(--font-display)" }}>{team?.name || "—"}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                      <span className={isCancelled(ev) ? "line-through text-gray-400" : ""}>{ev.opponent || <span className="text-gray-300">—</span>}</span>
                      {isCancelled(ev) && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-300">{cancelText(ev, t)}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isHome
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">{t("Local")}</span>
                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-500">{t("Visitante")}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fieldName(ev) || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isHome ? (
                        isEditing ? (
                          <Input value={ed.locker} onChange={(e) => patchEdit(ev.id, { locker: e.target.value })} placeholder={t("Ej: V1")} className="h-6 w-16 text-xs px-1.5" data-testid="agenda-locker" />
                        ) : (
                          <span className={`font-bold text-sm ${meta.locker ? "text-gray-900" : "text-gray-300"}`} style={{ fontFamily: "var(--font-display)" }}>{meta.locker || "—"}</span>
                        )
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center gap-1" data-testid="agenda-kit-edit">
                          <Select value={ed.kit || "primera"} onValueChange={(v) => v && patchEdit(ev.id, { kit: v === "primera" ? "" : v })}>
                            <SelectTrigger className="h-6 text-xs w-[118px] px-1.5" data-testid="agenda-kit"><SelectValue placeholder={t("Equipación")} /></SelectTrigger>
                            <SelectContent>{KIT_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input list="agenda-kit-colors" value={ed.kit_color} onChange={(e) => patchEdit(ev.id, { kit_color: e.target.value })} placeholder={t("Color")} className="h-6 w-20 text-xs px-1.5" data-testid="agenda-kit-color" />
                          <Input list="agenda-kit-sizes" value={ed.kit_size} onChange={(e) => patchEdit(ev.id, { kit_size: e.target.value })} placeholder={t("Talla")} className="h-6 w-14 text-xs px-1.5" data-testid="agenda-kit-size" />
                        </div>
                      ) : <KitChip meta={meta} />}
                    </td>
                    {showSteps && (
                      <td className="px-3 py-2 whitespace-nowrap" title={t("Solo en pantalla: no sale en el PDF ni en la imagen")}>
                        {isCancelled(ev) ? <span className="text-gray-300">—</span>
                          : <StepSquares steps={stepsOf(ev)} eventId={ev.id} teamId={ev.team_id} only={["convocatoria", "tactica"]} testId={`agenda-steps-${ev.id}`} />}
                      </td>
                    )}
                    <td className="px-2 py-2 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(ev)} disabled={saving[ev.id]} className="p-1 rounded hover:bg-green-50 text-green-600" data-testid="agenda-save" aria-label={t("Guardar")}><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => cancelEdit(ev.id)} className="p-1 rounded hover:bg-red-50 text-red-400" aria-label={t("Cancelar")}><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(ev)} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500" data-testid="agenda-edit" aria-label={t("Editar")}><Edit2 className="w-3.5 h-3.5" /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="agenda-kit-colors">{KIT_COLORS.map(([k]) => <option key={k} value={cap(k)} />)}</datalist>
          <datalist id="agenda-kit-sizes">{KIT_SIZES.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
      )}

      {/* Partidos en casa, por campo y día */}
      {homes.length > 0 && (
        <div className="border-t border-gray-200 px-4 py-3" data-testid="agenda-home">
          {homes.map((g) => (
            <div key={g.field} className="mb-3 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4" style={{ color: "var(--granate)" }} />
                <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}><span style={{ color: "var(--granate)" }}>{t("Partidos en {campo}", { campo: g.field })}</span></h3>
                <span className="text-[11px] text-gray-500">{g.count}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {g.days.map((d) => (
                  <div key={d.day} className="rounded border border-gray-200" data-testid={`agenda-home-${d.day}`}>
                    <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-600">{cap(format(parseISO(d.day), "EEEE d", { locale: dfl }))}</div>
                    <ul className="divide-y divide-gray-100">
                      {d.items.map((ev) => { const meta = agendaMeta(ev); return (
                        <li key={ev.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                          <span className="font-bold tabular-nums w-10 text-gray-900">{format(parseISO(ev.date), "HH:mm")}</span>
                          <span className="font-bold text-gray-900 truncate" style={{ fontFamily: "var(--font-display)" }}>{getTeam(ev.team_id)?.name || "—"}</span>
                          <span className={`truncate ${isCancelled(ev) ? "line-through text-gray-400" : "text-gray-600"}`}>{ev.opponent ? `vs ${ev.opponent}` : ""}</span>
                          <span className="ml-auto flex items-center gap-1.5 shrink-0">
                            {meta.locker && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{meta.locker}</span>}
                            {kitInfo(meta) && <KitChip meta={meta} small />}
                          </span>
                        </li>
                      ); })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hoja para exportar (fuera de la vista) */}
      {exporting && (
        <div className="rs-nodark" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }} aria-hidden>
          <div ref={pageRef} style={{ width: PAGE_W, height: PAGE_H, padding: PAD, background: "#fff", overflow: "hidden", boxSizing: "border-box" }}>
            <AgendaSheet mode={exporting.what === "casa" ? "casa" : order} label={sheetLabel} matches={exporting.what === "casa" ? chrono : weekendMatches} homes={homes} getTeam={getTeam} fieldName={fieldName} innerRef={innerRef} />
          </div>
        </div>
      )}
    </div>
  );
}
