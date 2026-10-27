// Planificación → Scouting → Base de datos FCF (pedido por Nacho el 27/10/2026).
// Jugadores leídos de las actas de la FCF: buscar, filtrar por competición y grupo y abrir su trayectoria.
// Solo dirección, coordinación y administración (el servidor lo exige en api/club.js).
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Database, UserPlus, Check, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { fcfDisplayName, fcfNameParts, titleCase, shortComp } from "@/lib/fcfNames";

const FONT_DISPLAY = { fontFamily: "var(--font-display)" };
const ALL = "__all";
const PAGE = 50;

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

const fmtDate = (d) => (d ? new Date(d).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

function Year({ value }) {
  if (!value) return <span className="text-gray-300" title="Año pendiente de deducir (juveniles: con la temporada anterior)">—</span>;
  return <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-md bg-[#F3ECEB] text-[#36000D]" title="Estimado por la competición">{value}</span>;
}

export default function FcfDatabase() {
  const [q, setQ] = useState("");
  const [season, setSeason] = useState(null);
  const [competition, setCompetition] = useState(ALL);
  const [grp, setGrp] = useState(ALL);
  const [sort, setSort] = useState("tit");
  const [pages, setPages] = useState(1);
  const [openId, setOpenId] = useState(null);
  const dq = useDebounced(q);

  const { data: meta, isLoading: metaLoading, error: metaError } = useQuery({ queryKey: ["fcf-meta"], queryFn: () => base44.club.fcfMeta(), staleTime: 60_000 });
  const curSeason = season || meta?.seasons?.[0] || "2026-2027";
  const comps = useMemo(() => {
    const m = new Map();
    for (const c of meta?.competitions || []) {
      if (c.season !== curSeason) continue;
      const e = m.get(c.competition) || { name: c.competition, groups: [], actas: 0 };
      e.groups.push(c.grp); e.actas += c.actas; m.set(c.competition, e);
    }
    return [...m.values()];
  }, [meta, curSeason]);
  const groups = comps.find((c) => c.name === competition)?.groups || [];

  // Al cambiar un filtro se vuelve a la primera página
  useEffect(() => { setPages(1); }, [dq, curSeason, competition, grp, sort]);

  const filters = {
    season: curSeason, sort, q: dq.trim().length >= 2 ? dq.trim() : undefined,
    competition: competition === ALL ? undefined : competition,
    grp: grp === ALL ? undefined : grp,
    limit: PAGE * pages,
  };
  const { data, isFetching } = useQuery({
    queryKey: ["fcf-search", filters],
    queryFn: () => base44.club.fcfSearch(filters),
    enabled: !!meta,
    keepPreviousData: true,
    placeholderData: (prev) => prev,
  });
  const rows = data?.rows || [];
  const total = data?.total || 0;

  if (metaError) {
    return <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">No se ha podido abrir la base de datos FCF.</div>;
  }

  return (
    <div className="space-y-4" data-testid="fcf-db">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Database className="w-4 h-4 text-[var(--granate)]" />
          {metaLoading ? "Cargando…" : (
            <span>
              <strong className="text-gray-900">{(meta?.players || 0).toLocaleString("es-ES")}</strong> jugadores ·{" "}
              <strong className="text-gray-900">{(meta?.actas || 0).toLocaleString("es-ES")}</strong> actas · última lectura {fmtDate(meta?.last_import)}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">Fuente: actas FCF (solo lectura) · uso interno</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1.4fr)_repeat(4,minmax(140px,1fr))]">
        <label className="relative block">
          <span className="sr-only">Buscar jugador</span>
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o apellidos" className="pl-9" data-testid="fcf-q" />
        </label>
        <Select value={curSeason} onValueChange={(v) => { setSeason(v); setCompetition(ALL); setGrp(ALL); }}>
          <SelectTrigger aria-label="Temporada"><SelectValue /></SelectTrigger>
          <SelectContent>{(meta?.seasons?.length ? meta.seasons : [curSeason]).map((s) => <SelectItem key={s} value={s}>{s.replace("-20", "-")}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={competition} onValueChange={(v) => { setCompetition(v); setGrp(ALL); }}>
          <SelectTrigger aria-label="Competición"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las competiciones</SelectItem>
            {comps.map((c) => <SelectItem key={c.name} value={c.name}>{titleCase(c.name)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={grp} onValueChange={setGrp} disabled={competition === ALL}>
          <SelectTrigger aria-label="Grupo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los grupos</SelectItem>
            {groups.map((g) => <SelectItem key={g} value={g}>{titleCase(g)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger aria-label="Ordenar"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tit">Más veces titular</SelectItem>
            <SelectItem value="goals">Más goles</SelectItem>
            <SelectItem value="pj">Más partidos</SelectItem>
            <SelectItem value="name">Por apellido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-base font-bold" style={FONT_DISPLAY}>
            {total.toLocaleString("es-ES")} jugadores
          </h2>
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm" data-testid="fcf-table">
            <thead>
              <tr className="bg-[#FBF8F8] border-y border-gray-200 text-[11px] uppercase tracking-wide text-gray-500">
                <th scope="col" className="text-left font-semibold px-4 py-2">Jugador</th>
                <th scope="col" className="font-semibold px-2 py-2">Año</th>
                <th scope="col" className="text-left font-semibold px-2 py-2">Equipo · competición</th>
                <th scope="col" className="font-semibold px-2 py-2">PJ</th>
                <th scope="col" className="font-semibold px-2 py-2">Titular</th>
                <th scope="col" className="font-semibold px-2 py-2">Suplente</th>
                <th scope="col" className="font-semibold px-2 py-2">Goles</th>
                <th scope="col" className="font-semibold px-2 py-2" title="Amarillas">TA</th>
                <th scope="col" className="font-semibold px-2 py-2 pr-4" title="Rojas (directas o por doble amarilla)">TR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.player_id} className="border-b border-gray-100 hover:bg-[#FBF8F8]">
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => setOpenId(r.player_id)} className="font-semibold text-gray-900 hover:text-[var(--granate)] text-left" data-testid={`fcf-row-${r.player_id}`}>
                      {fcfDisplayName(r.name)}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center"><Year value={r.birth_year} /></td>
                  <td className="px-2 py-2">
                    <span className="block font-medium text-gray-800 leading-tight">{titleCase(r.team)}</span>
                    <span className="block text-xs text-gray-500">{shortComp(r.competition)} · {titleCase(r.grp)}</span>
                  </td>
                  <td className="px-2 py-2 text-center font-semibold tabular-nums">{r.pj}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{r.tit}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{r.sup}</td>
                  <td className="px-2 py-2 text-center font-bold tabular-nums text-[var(--granate)]">{r.goals}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{r.yellow || ""}</td>
                  <td className="px-2 py-2 pr-4 text-center tabular-nums">{r.reds || ""}</td>
                </tr>
              ))}
              {!rows.length && !isFetching && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">{meta?.actas ? "Ningún jugador con estos filtros" : "Todavía no hay datos de la FCF"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length < total && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Mostrando {rows.length} de {total.toLocaleString("es-ES")}</span>
            <Button variant="outline" size="sm" onClick={() => setPages((p) => p + 1)} disabled={isFetching}>Cargar más</Button>
          </div>
        )}
        <p className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
          PJ = partidos en acta (titular + suplente). Las actas de fútbol base no registran cambios, por eso no hay minutos. El año se estima por la competición (S15 = nacidos en 2012 en 2026-27); en juveniles se deducirá con la temporada anterior.
        </p>
      </div>

      <FcfPlayerDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-black leading-none tabular-nums" style={{ ...FONT_DISPLAY, color: accent ? "var(--granate)" : undefined }}>{value}</span>
      <span className="text-[11px] text-gray-500 mt-1">{label}</span>
    </div>
  );
}

function FcfPlayerDialog({ id, onClose }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: p, isLoading } = useQuery({ queryKey: ["fcf-player", id], queryFn: () => base44.club.fcfPlayer(id), enabled: !!id });
  const { data: existing = [] } = useQuery({
    queryKey: ["scouted-by-fcf", id],
    queryFn: () => base44.entities.ScoutedPlayer.filter({ fcf_id: String(id) }),
    enabled: !!id,
  });
  const add = useMutation({
    mutationFn: async () => {
      const { first_name, last_name } = fcfNameParts(p.name);
      const cur = p.seasons[0];
      return base44.entities.ScoutedPlayer.create({
        first_name, last_name, fcf_id: String(p.id),
        current_club: cur ? titleCase(cur.team) : "",
        category: cur ? shortComp(cur.competition) : "",
        birth_year: p.birth_year || null,
        decision: "seguir_viendo", contact_status: "no_contactado", source: "fcf",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scouted-by-fcf", id] });
      qc.invalidateQueries({ queryKey: ["scouted_players"] });
      toast({ title: "Añadido a Jugadores observados", description: "Con decisión B · Seguir viendo" });
    },
    onError: () => toast({ title: "No se ha podido añadir", variant: "destructive" }),
  });

  const tot = (p?.seasons || []).reduce((t, s) => ({ pj: t.pj + s.pj, tit: t.tit + s.tit, sup: t.sup + s.sup, goals: t.goals + s.goals, yellow: t.yellow + s.yellow + s.second_yellow, red: t.red + s.red + s.second_yellow }), { pj: 0, tit: 0, sup: 0, goals: 0, yellow: 0, red: 0 });
  const already = existing.length > 0;

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="fcf-player">
        <DialogHeader>
          <DialogTitle className="text-2xl" style={FONT_DISPLAY}>{p ? fcfDisplayName(p.name) : "Jugador"}</DialogTitle>
          <DialogDescription>
            {p ? <>ID FCF {p.id} · {p.birth_year ? <>nacido en <strong>{p.birth_year}</strong> (estimado)</> : "año pendiente de deducir"}</> : " "}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !p ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl bg-[#36000D] text-white p-4 grid grid-cols-3 sm:grid-cols-6 gap-3">
              <Stat label="Partidos" value={tot.pj} />
              <Stat label="Titular" value={tot.tit} />
              <Stat label="Suplente" value={tot.sup} />
              <div className="flex flex-col"><span className="text-2xl font-black leading-none tabular-nums text-[#FF6E00]" style={FONT_DISPLAY}>{tot.goals}</span><span className="text-[11px] mt-1 opacity-80">Goles</span></div>
              <Stat label="Amarillas" value={tot.yellow} />
              <Stat label="Rojas" value={tot.red} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {already ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg"><Check className="w-4 h-4" /> Ya está en Jugadores observados</span>
              ) : (
                <Button onClick={() => add.mutate()} disabled={add.isPending} style={{ background: "var(--granate)" }} className="text-white" data-testid="fcf-add">
                  <UserPlus className="w-4 h-4 mr-1.5" /> Añadir a Jugadores observados
                </Button>
              )}
            </div>

            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2" style={FONT_DISPLAY}>Trayectoria</h3>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="bg-[#FBF8F8] text-[11px] uppercase tracking-wide text-gray-500">
                      <th className="text-left px-3 py-2 font-semibold">Temporada</th>
                      <th className="text-left px-2 py-2 font-semibold">Equipo · competición</th>
                      <th className="px-2 py-2 font-semibold">PJ</th>
                      <th className="px-2 py-2 font-semibold">Tit.</th>
                      <th className="px-2 py-2 font-semibold">Sup.</th>
                      <th className="px-2 py-2 font-semibold">Goles</th>
                      <th className="px-2 py-2 font-semibold">TA</th>
                      <th className="px-2 py-2 pr-3 font-semibold">TR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.seasons.map((s, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-semibold whitespace-nowrap">{s.season.replace("-20", "-")}</td>
                        <td className="px-2 py-2"><span className="block font-medium">{titleCase(s.team)}</span><span className="block text-xs text-gray-500">{shortComp(s.competition)} · {titleCase(s.grp)}</span></td>
                        <td className="px-2 py-2 text-center font-bold tabular-nums">{s.pj}</td>
                        <td className="px-2 py-2 text-center tabular-nums">{s.tit}</td>
                        <td className="px-2 py-2 text-center tabular-nums">{s.sup}</td>
                        <td className="px-2 py-2 text-center font-bold tabular-nums text-[var(--granate)]">{s.goals}</td>
                        <td className="px-2 py-2 text-center tabular-nums">{s.yellow + s.second_yellow || ""}</td>
                        <td className="px-2 py-2 pr-3 text-center tabular-nums">{s.red + s.second_yellow || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-1">Solo las temporadas y competiciones ya leídas de la FCF.</p>
            </section>

            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2" style={FONT_DISPLAY}>Partidos</h3>
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {p.matches.map((m) => {
                  const rival = m.team === m.home ? m.away : m.home;
                  return (
                    <li key={m.acta} className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="w-20 text-gray-500 tabular-nums">{m.match_date || "—"}</span>
                      <span className="text-xs text-gray-400 w-10">J{m.jornada ?? "?"}</span>
                      <span className="flex-1 min-w-[180px]">vs {titleCase(rival)}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.starter ? "bg-[#73000A] text-white" : "bg-[#FFE7D6] text-[#8A3A00]"}`}>{m.starter ? "Titular" : "Suplente"}</span>
                      {m.goals > 0 && <span className="text-xs font-bold text-[var(--granate)]">{m.goals} {m.goals === 1 ? "gol" : "goles"}</span>}
                      {m.yellow > 0 && <span className="inline-block w-2.5 h-3.5 rounded-[2px] bg-yellow-400" title="Amarilla" />}
                      {m.second_yellow > 0 && <span className="text-xs text-red-600" title="Doble amarilla">2A</span>}
                      {m.red > 0 && <span className="inline-block w-2.5 h-3.5 rounded-[2px] bg-red-600" title="Roja" />}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
