import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useDateLocale, useT } from "@/i18n";
import { FCF_STATUS_KEY, fetchFcfStatus, validDate } from "@/lib/fcfAutoSync";

/** Una línea con la última sincronización con la FCF: cuándo fue, si fue sola o a mano y si salió bien. */
export default function FcfSyncLine() {
  const t = useT();
  const locale = useDateLocale();
  const { data: s } = useQuery({
    queryKey: FCF_STATUS_KEY,
    queryFn: fetchFcfStatus,
    staleTime: 60_000,
    retry: false,
    refetchInterval: (q) => (q.state.data?.state === "running" ? 15_000 : false),
  });
  // El «hace 2 horas» se va actualizando mientras la pantalla sigue abierta
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 60_000); return () => clearInterval(id); }, []);
  if (!s) return null;

  // Recién terminada: «ahora mismo» (y no «hace 0 segundos»); también si el reloj del móvil va unos segundos adelantado
  const ago = (d) => (Date.now() - d.getTime() < 45_000 ? t("ahora mismo") : formatDistanceToNowStrict(d, { addSuffix: true, locale }));
  const exact = (d) => format(d, "d MMM yyyy, HH:mm", { locale });
  const how = (src) => (src === "manual" ? t("manual") : t("automática"));
  const at = validDate(s.at);
  const lastOk = validDate(s.last_ok_at);

  let Icon = Clock, tone = "text-gray-500", text, title;
  if (s.state === "running") {
    Icon = Loader2; text = t("Sincronizando con la FCF…");
  } else if (s.state === "ok" && at) {
    Icon = CheckCircle2; tone = "text-gray-500";
    text = t("Última sincronización con la FCF: {when} · {source}", { when: ago(at), source: how(s.source) });
    if (s.warnings > 0) text += " · " + t("Avisos: {n}", { n: s.warnings });
    title = exact(at);
  } else if (s.state === "failed" && at) {
    Icon = AlertTriangle; tone = "text-amber-700";
    text = lastOk
      ? t("Falló la última sincronización con la FCF ({when}, {source}). Última correcta: {lastOk}", { when: ago(at), source: how(s.source), lastOk: ago(lastOk) })
      : t("Falló la última sincronización con la FCF ({when}, {source}). Aún no consta ninguna correcta", { when: ago(at), source: how(s.source) });
    title = [exact(at), s.error].filter(Boolean).join(" · ");
  } else {
    text = t("Última sincronización con la FCF: todavía no consta");
  }

  return (
    <p className={`flex items-center gap-1.5 text-xs ${tone} -mt-2`} title={title} data-testid="fcf-sync-line">
      <Icon className={`w-3.5 h-3.5 shrink-0 ${s.state === "running" ? "animate-spin" : ""}`} aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
