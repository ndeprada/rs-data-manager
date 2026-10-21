import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Loader2, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useT } from "@/i18n";

// Limpieza de duplicados: muestra qué se va a unir o borrar y lo aplica con un botón, guardando antes una copia de seguridad.
export default function DuplicatesTab() {
  const t = useT();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["dupes_preview"], queryFn: () => base44.club.dupesPreview(), staleTime: 0, gcTime: 0 });

  const nothing = data && !data.players.length && !data.stats.deleted && !data.convocatorias.deleted;

  const apply = async () => {
    setConfirm(false); setBusy(true); setError("");
    try {
      const r = await base44.club.dupesApply();
      setDone(r);
      qc.invalidateQueries(); // pantallas de jugadores, partidos y estadísticas
      refetch();
    } catch (e) { setError(e.message || t("No se pudo completar la limpieza")); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 shadow-sm p-4 space-y-3" style={{ borderRadius: "4px" }}>
        <div className="flex items-start gap-3">
          <Copy className="w-5 h-5 mt-0.5" style={{ color: "var(--granate)" }} />
          <div className="text-sm text-gray-600 space-y-1">
            <p className="font-bold text-gray-900">{t("Limpiar duplicados")}</p>
            <p>{t("Une las fichas de jugador repetidas (un jugador de otro equipo que salió en un acta y se creó de nuevo) y quita las estadísticas y convocatorias repetidas de un mismo partido. Lo que se haya escrito a mano (minutos, notas, valoraciones) se conserva.")}</p>
          </div>
        </div>

        {isLoading && <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t("Buscando duplicados…")}</p>}
        {isError && <p className="text-sm text-red-600">{t("No se pudo comprobar. Vuelve a intentarlo.")}</p>}

        {data && (
          <div className="space-y-3 text-sm">
            {data.players.length > 0 && (
              <div>
                <p className="font-bold text-gray-900">{t("Jugadores que se unirán ({length})", { length: data.players.length })}</p>
                <ul className="mt-1 divide-y divide-gray-100 border border-gray-100 rounded">
                  {data.players.map((p) => (
                    <li key={p.drop.id} className="px-3 py-2 text-xs">
                      <span className="font-bold text-gray-900">{p.name}</span>
                      <span className="text-gray-500"> {t("· se queda su ficha de {team} y se borra la copia de {team2}. Sus partidos con {team3} pasan a la ficha original y cuentan en {team4}.", { team: p.keep.team, team2: p.drop.team, team3: p.drop.team, team4: p.drop.team })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.stats.deleted > 0 && (
              <p><span className="font-bold text-gray-900">{t("Estadísticas repetidas:")}</span> {data.stats.matches === 1 ? t("{deleted} filas en {matches} partido (se funden en una sola con todos los datos).", { deleted: data.stats.deleted, matches: data.stats.matches }) : t("{deleted} filas en {matches} partidos (se funden en una sola con todos los datos).", { deleted: data.stats.deleted, matches: data.stats.matches })}</p>
            )}
            {data.convocatorias.deleted > 0 && (
              <p><span className="font-bold text-gray-900">{t("Convocatorias repetidas:")}</span> {data.convocatorias.matches.length === 1 ? t("{deleted} en {length} partido (se queda la última editada).", { deleted: data.convocatorias.deleted, length: 1 }) : t("{deleted} en {length} partidos (se queda la última editada).", { deleted: data.convocatorias.deleted, length: data.convocatorias.matches.length })}</p>
            )}
            {data.convocatorias.skipped.length > 0 && (
              <div className="text-xs text-gray-500">
                <p className="font-bold text-gray-700">{t("Se dejan sin tocar por ahora ({length}):", { length: data.convocatorias.skipped.length })}</p>
                <ul className="list-disc ml-5">{data.convocatorias.skipped.map((s) => <li key={s.event}>{t("{event}: las dos convocatorias tienen jugadores distintos.", { event: s.event })}</li>)}</ul>
              </div>
            )}
            {data.conflicts.length > 0 && (
              <p className="text-xs text-gray-500">{t("En {length} filas había dos valores distintos escritos; se conserva el más reciente.", { length: data.conflicts.length })}</p>
            )}
            {nothing && !done && <p className="text-gray-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> {t("No hay duplicados que limpiar.")}</p>}
          </div>
        )}

        {!nothing && data && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button variant="club" onClick={() => setConfirm(true)} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />} {t("Limpiar ahora")}
            </Button>
            <span className="text-xs text-gray-400">{t("Antes se guarda una copia de seguridad de todos los datos.")}</span>
          </div>
        )}

        {done && (
          <p className="text-xs font-semibold text-green-700">
            {done.players.length === 1 ? t("Hecho: {n} jugador unido, {stats} estadísticas y {conv} convocatorias repetidas quitadas. La copia de seguridad está en la pestaña Copias.", { n: 1, stats: done.stats.deleted, conv: done.convocatorias.deleted }) : t("Hecho: {n} jugadores unidos, {stats} estadísticas y {conv} convocatorias repetidas quitadas. La copia de seguridad está en la pestaña Copias.", { n: done.players.length, stats: done.stats.deleted, conv: done.convocatorias.deleted })}
          </p>
        )}
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Limpiar los duplicados?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Se guardará una copia de seguridad y después se unirán los jugadores repetidos y se borrarán las estadísticas y convocatorias repetidas que se muestran arriba.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={apply}>{t("Sí, limpiar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
