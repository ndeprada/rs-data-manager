import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import PushToggle from "@/components/avisos/PushToggle";
import Inbox from "@/components/avisos/Inbox";
import Composer from "@/components/avisos/Composer";

import { PageTitle } from "@/components/common/PageHeader";
import TabBar from "@/components/common/TabBar";
import { useT, useDateLocale, msg } from "@/i18n";
const SENDER_ROLES = ["director", "director_deportivo", "coordinador_general", "coordinador_f7", "coordinador_f11", "entrenador"];

function History() {
  const t = useT();
  const locale = useDateLocale();
  const { data = [] } = useQuery({ queryKey: ["noticeHistory"], queryFn: () => base44.club.history() });
  if (data.length === 0) return <p className="text-sm text-gray-400 text-center py-8">{t("Aún no se ha enviado ningún aviso.")}</p>;
  return (
    <div className="space-y-2">
      {data.map((n) => (
        <div key={n.id} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-bold text-sm text-gray-900">{n.title}</p>
            <p className="text-[10px] text-gray-400 shrink-0">{format(new Date(n.created_date), "d MMM · HH:mm", { locale })}</p>
          </div>
          <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{n.body}</p>
          <p className="text-[10px] text-gray-400 mt-2">
            {n.sender_name} · {n.audience_label} · {n.recipients === 1 ? t("{n} destinatario", { n: 1 }) : t("{n} destinatarios", { n: n.recipients })} · {n.sent === 1 ? t("{n} aviso entregado al móvil", { n: 1 }) : t("{n} avisos entregados al móvil", { n: n.sent })}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function Avisos() {
  const t = useT();
  const { user } = useAuth();
  const canSend = user?.role === "admin" || SENDER_ROLES.includes(user?.app_role);
  const [tab, setTab] = useState("recibidos");
  const tabs = canSend ? [["recibidos", msg("Recibidos")], ["enviar", msg("Enviar")], ["historial", msg("Historial")]] : [["recibidos", msg("Recibidos")]];

  return (
    <div className="space-y-4 max-w-2xl">
      <PageTitle kicker={t("Comunicación")} title={t("Avisos")} subtitle={<>{canSend ? t("Envía avisos al móvil de equipos (jugadores, familias y cuerpo técnico) o de una persona concreta") : t("Los avisos que te envía el club")}</>} />
      <PushToggle />
      {tabs.length > 1 && (
        <TabBar value={tab} onChange={setTab} items={tabs.map(([k, l]) => ({ value: k, label: t(l) }))} />
      )}
      {tab === "recibidos" && <Inbox />}
      {tab === "enviar" && canSend && <Composer onSent={() => setTab("historial")} />}
      {tab === "historial" && canSend && <History />}
    </div>
  );
}
