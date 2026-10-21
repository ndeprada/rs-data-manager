import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Clock, Download, Minus, Printer } from "lucide-react";
import { ageOf, sortStaffRows } from "@/lib/staffList";
import { teamRoleLabel } from "@/lib/staffRoles";
import { downloadCsv, exportFileName, printHtml, staffPrintHtml, toCsv } from "@/lib/staffExport";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import { useT, msg } from "@/i18n";

const ACCESS = {
  approved: { icon: Check, text: msg("Con acceso"), cls: "text-green-600" },
  pending: { icon: Clock, text: msg("Pendiente de aprobar"), cls: "text-yellow-600" },
};
const EXPORT_HEADER = ["Nombre", "Edad", "Rol", "Equipos que entrena", "Teléfono", "Email", "Acceso a la app"];

/**
 * Lista del personal: una fila por persona, ordenable por nombre, edad, rol y equipo.
 * rows: [{ key, url, name, initials, photo_url, isAdmin, roleLabel, birth_date, teams: [{ id, name, rank, role }], phone, email, access }]
 */
export default function StaffTable({ rows, onOpen, filterLabel = "Todos los equipos" }) {
  const t = useT();
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const toggle = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const prepared = rows.map((r) => ({
    ...r,
    age: ageOf(r.birth_date)?.age ?? null,
    teamRank: r.teams.length ? r.teams[0].rank : null,
  }));
  const sorted = sortStaffRows(prepared, sort.key, sort.dir);

  // Lo que se exporta es lo que se ve: mismo filtro de equipo y mismo orden
  const exportData = sorted.map((r) => [
    r.name,
    r.age ?? "",
    r.roleEs ?? r.roleLabel,
    r.teams.map((t) => (t.role ? `${t.name} (${teamRoleLabel(t.role)})` : t.name)).join("; "),
    r.phone || "",
    r.email || "",
    ACCESS[r.access]?.text || "Sin acceso",
  ]);
  const exportExcel = () => downloadCsv(exportFileName("personal-racing-sarria"), toCsv(EXPORT_HEADER, exportData));
  const exportPrint = () => printHtml(staffPrintHtml({
    header: EXPORT_HEADER, rows: exportData, title: "Personal", subtitle: `Racing Sarrià · ${filterLabel}`, // la hoja impresa y el Excel van siempre en español
    logoUrl: CLUB_LOGO_URL, origin: window.location.origin,
  }));

  const Th = ({ k, children, className = "" }) => {
    const on = sort.key === k;
    const Icon = !on ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
    return (
      <th className={`px-3 py-2.5 text-left ${className}`} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggle(k)}
          className={`inline-flex items-center gap-1 font-bold text-xs uppercase tracking-wider ${on ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}
          style={{ fontFamily: "var(--font-display)" }}>
          {children}<Icon className={`w-3 h-3 ${on ? "" : "opacity-40"}`} />
        </button>
      </th>
    );
  };
  const plainTh = "px-3 py-2.5 text-left font-bold text-xs uppercase tracking-wider text-gray-500";

  const toolBtn = "inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 bg-white rounded-full px-3 py-1.5 transition-colors";

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <button type="button" onClick={exportExcel} className={toolBtn} title={t("Descarga un archivo que se abre con Excel")}><Download className="w-3.5 h-3.5" /> {t("Excel")}</button>
        <button type="button" onClick={exportPrint} className={toolBtn}><Printer className="w-3.5 h-3.5" /> {t("Imprimir")}</button>
      </div>
    <div className="bg-white border border-gray-200 overflow-hidden" style={{ borderRadius: "4px" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <Th k="name">{t("Nombre")}</Th>
              <Th k="age" className="hidden sm:table-cell">{t("Edad")}</Th>
              <Th k="role" className="hidden sm:table-cell">{t("Rol")}</Th>
              <Th k="team">{t("Equipos que entrena")}</Th>
              <th className={`${plainTh} hidden md:table-cell`} style={{ fontFamily: "var(--font-display)" }}>{t("Teléfono")}</th>
              <th className={`${plainTh} hidden lg:table-cell`} style={{ fontFamily: "var(--font-display)" }}>{t("Email")}</th>
              <th className={`${plainTh} hidden md:table-cell`} style={{ fontFamily: "var(--font-display)" }}>{t("App")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((r) => {
              const access = ACCESS[r.access];
              const AccessIcon = access?.icon || Minus;
              const born = ageOf(r.birth_date);
              return (
                <tr key={r.key} tabIndex={0} onClick={() => onOpen(r.url)}
                  onKeyDown={(e) => { if (e.key === "Enter") onOpen(r.url); }}
                  className="hover:bg-gray-50 transition-colors cursor-pointer align-top focus:outline-none focus:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {r.photo_url ? (
                        <img src={r.photo_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0"
                          style={{ background: r.isAdmin ? "var(--naranja)" : "var(--granate)", fontFamily: "var(--font-display)" }}>
                          {r.initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{r.name}</p>
                        {/* En el móvil el rol va bajo el nombre para dejar sitio a los equipos */}
                        <p className="sm:hidden text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--naranja)", fontFamily: "var(--font-display)" }}>{r.roleLabel}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell whitespace-nowrap text-gray-700">
                    {born ? <span title={t("Nacido en {year}", { year: born.year })}>{born.age}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap hidden sm:table-cell">
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--naranja)", fontFamily: "var(--font-display)" }}>{r.roleLabel}</span>
                  </td>
                  <td className="px-3 py-2">
                    {r.teams.length === 0 ? <span className="text-gray-300">—</span> : (
                      <div className="flex flex-wrap gap-1">
                        {r.teams.map((tm) => (
                          <span key={tm.id} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 sm:whitespace-nowrap">
                            {tm.name}{tm.role ? <span className="text-gray-400"> · {t(teamRoleLabel(tm.role))}</span> : null}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell whitespace-nowrap">
                    {r.phone ? <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} className="text-gray-700 hover:underline">{r.phone}</a> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    {r.email ? <a href={`mailto:${r.email}`} onClick={(e) => e.stopPropagation()} className="text-gray-700 hover:underline break-all">{r.email}</a> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <span title={access ? t(access.text) : t("Sin acceso a la app")} className={`inline-flex ${access?.cls || "text-gray-300"}`}><AccessIcon className="w-4 h-4" /></span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
