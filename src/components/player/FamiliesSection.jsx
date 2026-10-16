import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Trash2, Plus, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { RELATIONS, relLabel } from "@/components/avisos/PlayerPicker";

// Familiares vinculados a un jugador. El admin gestiona todo; el propio jugador solo puede aceptar/rechazar solicitudes.
export default function FamiliesSection({ playerId }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(null);
  const [rel, setRel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const { data: links = [] } = useQuery({ queryKey: ["playerLinks", playerId], queryFn: () => base44.club.playerLinks(playerId), enabled: !!playerId });
  const { data: users = [] } = useQuery({
    queryKey: ["users"], queryFn: () => base44.entities.User.list(), enabled: isAdmin && adding,
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["playerLinks", playerId] }); qc.invalidateQueries({ queryKey: ["pendingLinks"] }); };
  const decide = async (id, d) => { await base44.club.decideLink(id, d).catch(() => {}); refresh(); };

  const linkedIds = new Set(links.map((l) => l.user_id));
  const candidates = q.trim().length < 2 ? [] : users.filter((u) =>
    u.role !== "admin" && (!u.app_role || u.app_role === "familiar") && !linkedIds.has(u.id) &&
    `${u.full_name || ""} ${u.email || ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6);

  const create = async () => {
    setBusy(true); setErr("");
    try { await base44.club.createLink(pick.id, playerId, rel); setAdding(false); setPick(null); setQ(""); setRel(""); refresh(); qc.invalidateQueries({ queryKey: ["users"] }); }
    catch (e) { setErr(e.data?.error === "user_has_other_role" ? "Esa persona ya tiene otra función en la app." : "No se pudo vincular."); }
    setBusy(false);
  };

  if (!isAdmin && links.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black uppercase tracking-widest text-gray-500" style={{ fontFamily: "var(--font-display)" }}>Familiares vinculados</p>
        {isAdmin && !adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-bold" style={{ color: "var(--granate)" }}><Plus className="w-3.5 h-3.5" />Vincular</button>
        )}
      </div>
      {links.length === 0 && <p className="text-xs text-gray-400">Todavía no hay familiares vinculados.</p>}
      <div className="space-y-2">
        {links.map((l) => (
          <div key={l.id} className="flex items-center gap-3 border border-gray-100 rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{l.name || l.email}</p>
              <p className="text-[11px] text-gray-400 truncate">{relLabel(l.relationship)}{l.email ? ` · ${l.email}` : ""}{l.phone ? ` · ${l.phone}` : ""}</p>
            </div>
            {l.status === "pending" ? (
              <>
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600"><Clock className="w-3 h-3" />Pendiente</span>
                <button onClick={() => decide(l.id, "approve")} title="Aceptar" className="p-1.5 rounded text-green-600 hover:bg-green-50"><Check className="w-4 h-4" /></button>
                <button onClick={() => decide(l.id, "reject")} title="Rechazar" className="p-1.5 rounded text-red-500 hover:bg-red-50"><X className="w-4 h-4" /></button>
              </>
            ) : isAdmin ? (
              <button onClick={() => { if (window.confirm("¿Quitar este vínculo?")) decide(l.id, "remove"); }} title="Quitar" className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
            ) : null}
          </div>
        ))}
      </div>

      {isAdmin && adding && (
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
          {pick ? (
            <div className="flex items-center justify-between text-sm"><span className="font-semibold">{pick.full_name || pick.email}</span><button onClick={() => setPick(null)} className="text-xs text-gray-400">Cambiar</button></div>
          ) : (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por nombre o email de un usuario registrado"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
              {candidates.map((u) => (
                <button key={u.id} onClick={() => setPick(u)} className="w-full text-left px-3 py-1.5 rounded hover:bg-gray-50 text-sm">
                  {u.full_name || "Sin nombre"} <span className="text-[11px] text-gray-400">{u.email}</span>
                </button>
              ))}
              {q.trim().length >= 2 && candidates.length === 0 && <p className="text-[11px] text-gray-400">Sin resultados. La persona debe registrarse primero en la app.</p>}
            </>
          )}
          <div className="flex flex-wrap gap-1.5">
            {RELATIONS.map((r) => (
              <button key={r.v} onClick={() => setRel(r.v)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${rel === r.v ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200"}`} style={rel === r.v ? { background: "var(--granate)" } : undefined}>{r.l}</button>
            ))}
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button disabled={!pick || !rel || busy} onClick={create} className="flex-1 py-2 rounded-full text-white text-xs font-bold uppercase tracking-wider disabled:opacity-40" style={{ background: "var(--granate)" }}>{busy ? "..." : "Vincular"}</button>
            <button onClick={() => { setAdding(false); setPick(null); setQ(""); setRel(""); }} className="px-4 py-2 rounded-full border border-gray-200 text-xs text-gray-500">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
