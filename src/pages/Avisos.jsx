import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Page, RS } from "@/components/rs2/kit";
import PushToggle from "@/components/avisos/PushToggle";
import Inbox from "@/components/avisos/Inbox";
import NoticeForm from "@/components/avisos/NoticeForm";
import SentList from "@/components/avisos/SentList";
import { useUnreadNotices } from "@/lib/noticeReads";
import { READ_COLORS } from "@/lib/noticeUi";
import { useT } from "@/i18n";

const SENDER_ROLES = ["director", "director_deportivo", "coordinador_general", "coordinador_f7", "coordinador_f11", "entrenador"];
const COORD_ROLES = SENDER_ROLES.slice(0, 5);

function TabPill({ on, onClick, children, testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      style={{ border: `1px solid ${on ? RS.granate : RS.line}`, background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink2, borderRadius: 999, padding: "5px 13px", fontSize: 13, fontWeight: on ? 700 : 500 }}>
      {children}
    </button>
  );
}

export default function Avisos() {
  const t = useT();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const canSend = user?.role === "admin" || SENDER_ROLES.includes(user?.app_role);
  const coord = user?.role === "admin" || COORD_ROLES.includes(user?.app_role);
  const [params, setParams] = useSearchParams();
  const tab = canSend && params.get("tab") !== "recibidos" ? "enviar" : "recibidos";
  const setTab = (v) => setParams(v === "recibidos" ? { tab: "recibidos" } : {}, { replace: true });
  const unread = useUnreadNotices();
  const { data: hist } = useQuery({ queryKey: ["noticeHistory"], queryFn: () => base44.club.history(), enabled: canSend, refetchOnWindowFocus: true });
  const { data: coverage } = useQuery({ queryKey: ["push-coverage"], queryFn: () => base44.club.pushCoverage(), enabled: canSend, staleTime: 15 * 60_000 });
  const items = hist?.items || [];
  const stats = hist?.stats;

  const readColor = stats?.read_pct == null ? RS.granateDark : READ_COLORS[stats.read_pct >= 80 ? "ok" : stats.read_pct >= 50 ? "warn" : "bad"];
  const kpis = canSend ? [
    { k: "week", n: stats?.week ?? "–", label: t("enviados esta semana"), sub: stats?.week_urgent ? t("{n} urgentes", { n: stats.week_urgent }) : stats?.scheduled ? t("{n} programados", { n: stats.scheduled }) : null },
    { k: "read", n: stats?.read_pct == null ? "–" : `${stats.read_pct} %`, color: readColor, label: t("leídos de media"), sub: t("de los enviados en 30 días") },
    { k: "nopush", n: coverage ? coverage.without_push : "–", color: "#B45309", label: t("sin avisos activados"), sub: t("personas · lo ven al abrir la app") },
    { k: "unread", n: unread, color: unread ? "#B91C1C" : RS.granateDark, label: t("recibidos sin leer"), sub: t("tus avisos") },
  ] : [];

  return (
    <Page testId="avisos">
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: isMobile ? "12px 10px 24px" : "18px 22px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="flex flex-wrap items-end" style={{ gap: "8px 22px" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".16em", color: RS.muted, textTransform: "uppercase" }}>{t("Comunicación")}</div>
            <h1 style={{ margin: "2px 0 0", lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: isMobile ? 30 : 36, color: RS.granate }}>{t("AVISOS")}</span></h1>
          </div>
          {canSend && (
            <div className="flex" style={{ gap: 6, paddingBottom: 2 }}>
              <TabPill on={tab === "enviar"} onClick={() => setTab("enviar")} testId="avisos-tab-enviar">{t("Enviar y enviados")}</TabPill>
              <TabPill on={tab === "recibidos"} onClick={() => setTab("recibidos")} testId="avisos-tab-recibidos">{t("Recibidos")}{unread > 0 ? ` · ${unread}` : ""}</TabPill>
            </div>
          )}
        </div>

        <PushToggle />

        {tab === "enviar" && (
          <>
            <div className="flex flex-wrap" style={{ gap: 8 }} data-testid="avisos-kpis">
              {kpis.map((k) => (
                <button type="button" key={k.k} data-testid={`avisos-kpi-${k.k}`} onClick={k.k === "unread" ? () => setTab("recibidos") : undefined}
                  style={{ flex: isMobile ? "1 1 140px" : "1 1 200px", display: "flex", alignItems: "baseline", gap: 8, padding: "8px 12px", background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 10, textAlign: "left", cursor: k.k === "unread" ? "pointer" : "default" }}>
                  <span className="rs2-display tabular-nums" style={{ fontSize: 24, color: k.color || RS.granateDark, whiteSpace: "nowrap" }}>{k.n}</span>
                  <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.15 }}>{k.label}{k.sub && <span style={{ display: "block", fontSize: 11, color: RS.muted }}>{k.sub}</span>}</span>
                </button>
              ))}
            </div>
            <div className="grid lg:grid-cols-2 items-start" style={{ gap: 12 }}>
              <NoticeForm />
              <SentList items={items} uid={user?.id} coord={coord} />
            </div>
          </>
        )}

        {tab === "recibidos" && (
          <div style={{ maxWidth: 860, width: "100%" }}>
            <Inbox framed />
            {!canSend && <p style={{ fontSize: 11.5, color: RS.muted, margin: "8px 2px 0" }}>{t("Al abrir un aviso queda como leído (el club solo ve cuántos lo han leído y quién no).")}</p>}
          </div>
        )}
      </div>
    </Page>
  );
}
