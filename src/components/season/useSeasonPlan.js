import { useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Plan de traspasos de fin de temporada: { [playerId]: { to: <teamId> | "baja" | "stay" } }.
// Se guarda en la base de datos en cada cambio (entidad SeasonPlan), así no se pierde nada y lo puede seguir cualquier coordinador.
export function useSeasonPlan(season) {
  const qc = useQueryClient();
  const key = ["season_plan", season];
  const { data: plan = null, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => (await base44.entities.SeasonPlan.filter({ season }))[0] || null,
  });
  const movesRef = useRef({});
  movesRef.current = plan?.moves || {};
  const idRef = useRef(null);
  idRef.current = plan?.id || idRef.current;
  const chain = useRef(Promise.resolve());
  const [saving, setSaving] = useState(0);
  const [error, setError] = useState("");

  // Aplica un cambio: set = { ids: [...], to } o clear = ids. Se ve al instante y se guarda en orden.
  const change = useCallback((ids, to) => {
    const next = { ...movesRef.current };
    ids.forEach((id) => { if (to) next[id] = { to }; else delete next[id]; });
    movesRef.current = next;
    qc.setQueryData(key, (old) => ({ ...(old || { season }), moves: next }));
    setSaving((n) => n + 1);
    setError("");
    chain.current = chain.current.then(async () => {
      try {
        const saved = idRef.current
          ? await base44.entities.SeasonPlan.update(idRef.current, { moves: next })
          : await base44.entities.SeasonPlan.create({ season, moves: next });
        idRef.current = saved?.id || idRef.current;
        qc.setQueryData(key, (old) => ({ ...(old || {}), id: idRef.current, season, moves: movesRef.current }));
      } catch {
        setError("No se pudo guardar el último cambio. Vuelve a intentarlo.");
        qc.invalidateQueries({ queryKey: key });
      } finally {
        setSaving((n) => n - 1);
      }
    });
  }, [qc, season]);

  return {
    moves: plan?.moves || {},
    isLoading,
    saving: saving > 0,
    error,
    setDestination: (ids, to) => change(ids, to),
    clear: (ids) => change(ids, null),
  };
}
