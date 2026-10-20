import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Clock, Minus } from "lucide-react";
import { ageOf, sortStaffRows } from "@/lib/staffList";
import { teamRoleLabel } from "@/lib/staffRoles";

const ACCESS = {
  approved: { icon: Check, text: "Con acceso", cls: "text-green-600" },
  pending: { icon: Clock, text: "Pendiente de aprobar", cls: "text-yellow-600" },
};

/**
 * Lista del personal: una fila por persona, ordenable por nombre, edad, rol y equipo.
 * rows: [{ key, url, name, initials, photo_url, isAdmin, roleLabel, birth_date, teams: [{ id, name, rank, role }], phone, email, access }]
 */
export default function StaffTable({ rows, onOpen }) {
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const toggle = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const prepared = rows.map((r) => ({
    ...r,
    age: ageOf(r.birth_date)?.age ?? null,
    teamRank: r.teams.length ? r.teams[0].rank : null,
  }));
  const sorted = sortStaffRows(prepared, sort.key, sort.dir);

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

  return (
    <div className="bg-white border border-gray-200 overflow-hidden" style={{ borderRadius: "4px" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <Th k="name">Nombre</Th>
              <Th k="age" className="hidden sm:table-cell">Edad</Th>
              <Th k="role" className="hidden sm:table-cell">Rol</Th>
              <Th k="team">Equipos que entrena</Th>
              <th className={`${plainTh} hidden md:table-cell`} style={{ fontFamily: "var(--font-display)" }}>Teléfono</th>
              <th className={`${plainTh} hidden lg:table-cell`} style={{ fontFamily: "var(--font-display)" }}>Email</th>
              <th className={`${plainTh} hidden md:table-cell`} style={{ fontFamily: "var(--font-display)" }}>App</th>
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
                    {born ? <span title={`Nacido en ${born.year}`}>{born.age}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap hidden sm:table-cell">
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--naranja)", fontFamily: "var(--font-display)" }}>{r.roleLabel}</span>
                  </td>
                  <td className="px-3 py-2">
                    {r.teams.length === 0 ? <span className="text-gray-300">—</span> : (
                      <div className="flex flex-wrap gap-1">
                        {r.teams.map((t) => (
                          <span key={t.id} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 sm:whitespace-nowrap">
                            {t.name}{t.role ? <span className="text-gray-400"> · {teamRoleLabel(t.role)}</span> : null}
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
                    <span title={access?.text || "Sin acceso a la app"} className={`inline-flex ${access?.cls || "text-gray-300"}`}><AccessIcon className="w-4 h-4" /></span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
