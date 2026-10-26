import React from "react";
import { ArrowRightLeft, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DOT, PASS_TAG } from "./squadPlanUi";

// «Pases del club»: vista de solo lectura con todos los pases entre equipos de la temporada (cuadro de dónde a dónde + lista por pareja de equipos).
// Los datos salen de `buildPassSummary` (`src/lib/squadPlan.js`). Tocar un jugador abre su ventana en el plan del equipo al que va (ahí se cambia o se cancela).

function Matrix({ summary }) {
  const { teams, matrix } = summary;
  const origins = teams.filter((t) => matrix[t.id]);
  const dests = teams.filter((t) => origins.some((o) => matrix[o.id][t.id]));
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200" data-testid="passes-matrix">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
            <th className="text-left font-bold px-2 py-1.5 whitespace-nowrap">Sale de ↓ · Va a →</th>
            {dests.map((t) => <th key={t.id} className="font-bold px-2 py-1.5 text-center min-w-[72px]">{t.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {origins.map((o) => (
            <tr key={o.id} className="border-t border-gray-100">
              <td className="px-2 py-1.5 font-semibold text-gray-900 whitespace-nowrap">{o.name}</td>
              {dests.map((t) => {
                const n = matrix[o.id][t.id] || 0;
                return <td key={t.id} className={`px-2 py-1.5 text-center tabular-nums ${n ? "font-extrabold text-teal-700" : "text-gray-300"}`} data-testid={`passes-cell-${o.id}-${t.id}`}>{n || "·"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClubPassesDialog({ summary, loading, season, onClose, onOpen, onPdf, pdfBusy }) {
  const { total, teams, groups } = summary;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="plan-passes-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-teal-600" /> Pases del club · {season}</DialogTitle>
          <DialogDescription>
            {loading ? "Cargando…" : total === 0 ? "Todavía no hay pases esta temporada." : `${total} pase${total === 1 ? "" : "s"} entre ${teams.length} equipos.`} Solo cambian en el plan, no en la ficha del jugador. Toca un jugador para verlo en el plan del equipo al que va (ahí se cambia o se cancela).
          </DialogDescription>
        </DialogHeader>
        {!loading && total === 0 && (
          <p className="text-sm text-gray-500 py-4 text-center" data-testid="passes-empty">Se crean desde la ventana de un jugador (campo «Equipo»), con «Traer de otro equipo» o con «Pasar el equipo entero».</p>
        )}
        {!loading && total > 0 && (
          <div className="space-y-4">
            <Matrix summary={summary} />
            <div className="space-y-3" data-testid="passes-groups">
              {groups.map((g) => (
                <section key={`${g.from.id}>${g.to.id}`} data-testid={`passes-group-${g.from.id}-${g.to.id}`}>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-1">
                    {g.from.name} <span className="text-teal-600">→</span> {g.to.name}
                    <span className={`ml-1 rounded-full px-2 text-[11px] font-bold leading-5 ${PASS_TAG}`}>{g.rows.length}</span>
                  </h3>
                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                    {g.rows.map((r) => (
                      <button key={r.key} type="button" onClick={() => onOpen(r)} data-testid={`passrow-${r.key}`}
                        className="w-full flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2.5 py-1.5 text-left text-sm hover:bg-gray-50">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[r.status]}`} />
                        <span className="font-semibold text-gray-900 min-w-0 break-words">{r.name}</span>
                        {r.year && <span className="text-xs text-gray-400 tabular-nums">{r.year}</span>}
                        <span className="text-xs text-gray-500">{r.placeLabel}</span>
                        <span className={`text-[10px] font-bold uppercase ${r.status === "duda" ? "text-amber-600" : "text-emerald-600"}`}>{r.status === "duda" ? "Duda" : "Seguro"}</span>
                        {r.note && <span className="basis-full sm:basis-auto sm:ml-auto text-xs text-gray-500 break-words sm:max-w-[45%] sm:text-right">{r.note}</span>}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onPdf} disabled={loading || pdfBusy} data-testid="passes-pdf">
            <FileDown className="w-4 h-4 mr-1.5" /> {pdfBusy ? "Creando…" : "PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
