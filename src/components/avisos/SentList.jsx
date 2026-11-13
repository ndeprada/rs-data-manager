import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { RS, SearchBox } from "@/components/rs2/kit";
import { Head } from "@/components/rs2/dashParts";
import { KindChip, ReadBar, Seg, kindOptions, useWhen } from "@/components/avisos/AvisoParts";
import { filterSent, splitSent, teamsLine } from "@/lib/noticeUi";
import { useT, useDateLocale } from "@/i18n";

const KIND_LABEL = { jugador: "Jugador", familiar: "Familiar", tecnico: "Cuerpo técnico", otro: "Usuario" };
const btn = (primary) => ({
  border: primary ? "none" : `1px solid ${RS.input}`, background: primary ? RS.granate : "#fff", color: primary ? "#fff" : RS.ink2,
  borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
});

// Detalle de un aviso enviado: quién no lo ha leído (por equipos), reenviar a esas personas y la lista completa
function SentDetail({ n }) {
  const t = useT();
  const when = useWhen();
  const qc = useQueryClient();
  const [list, setList] = useState(false);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["notice-people", n.id], queryFn: () => base44.club.noticePeople(n.id), enabled: n.tracked, staleTime: 60_000 });

  const resend = async () => {
    setBusy(true); setNote(null);
    try {
      const r = await base44.club.noticeResend(n.id);
      setNote({ ok: true, text: t("Reenviado a {n} personas ({d} móviles).", { n: r.to, d: r.sent }) });
      qc.invalidateQueries({ queryKey: ["noticeHistory"] });
    } catch (e) {
      const err = e.data?.error;
      setNote({ ok: false, text: err === "too_soon" ? t("Ya se reenvió hace poco. Espera media hora.") : err === "nobody" ? t("Ya lo han leído todos.") : t("No se pudo reenviar") });
    }
    setBusy(false);
  };

  return (
    <div style={{ margin: "8px 0 2px", padding: "9px 11px", borderRadius: 9, background: "#F8F2F1" }} data-testid={`sent-detail-${n.id}`}>
      <p style={{ margin: "0 0 6px", fontSize: 13, color: RS.ink2, whiteSpace: "pre-line" }}>{n.body}</p>
      {!n.tracked ? (
        <p style={{ margin: 0, fontSize: 12, color: RS.faint }}>{t("Enviado antes de que la app apuntara quién lo lee: no hay datos de lectura.")}</p>
      ) : isLoading ? (
        <p style={{ margin: 0, fontSize: 12, color: RS.faint }}>{t("Cargando…")}</p>
      ) : data && (
        <>
          {data.unread.length > 0 ? (
            <p style={{ margin: "0 0 7px", fontSize: 12.5, color: RS.ink2 }} data-testid={`sent-unread-${n.id}`}>
              <b>{t("Sin leer")} · {data.unread.length}</b> · {teamsLine(data.by_team, 4, t("Sin equipo"))}
            </p>
          ) : <p style={{ margin: "0 0 7px", fontSize: 12.5, color: "#15803D", fontWeight: 600 }}>{t("Lo han leído todos.")}</p>}
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {data.unread.length > 0 && (
              <button type="button" onClick={resend} disabled={busy} style={{ ...btn(true), opacity: busy ? 0.5 : 1 }} data-testid={`sent-resend-${n.id}`}>
                {busy ? t("Enviando…") : t("Reenviar a los que no lo han leído")}
              </button>
            )}
            <button type="button" onClick={() => setList(!list)} style={btn(false)} data-testid={`sent-list-${n.id}`}>{list ? t("Ocultar la lista") : t("Ver la lista")}</button>
          </div>
          {n.resent_at && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: RS.muted }}>{t("Último recordatorio: {when}", { when: when(n.resent_at) })}</p>}
          {note && <p style={{ margin: "6px 0 0", fontSize: 12, color: note.ok ? "#15803D" : "#B91C1C" }}>{note.text}</p>}
          {list && (
            <div className="grid sm:grid-cols-2" style={{ gap: 10, marginTop: 9 }}>
              {[["unread", t("Sin leer"), data.unread], ["read", t("Leído"), data.read]].map(([k, title, people]) => (
                <div key={k} data-testid={`sent-people-${k}`}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: k === "unread" ? "#B91C1C" : "#15803D" }}>{title} · {people.length}</p>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 220, overflowY: "auto" }}>
                    {people.map((p) => (
                      <li key={p.id} style={{ fontSize: 12.5, color: RS.ink, padding: "2px 0" }}>
                        {p.name} <span style={{ color: RS.muted }}>· {t(KIND_LABEL[p.kind] || "Usuario")}{p.child ? ` ${t("de {name}", { name: p.child })}` : ""}{p.team ? ` · ${p.team}` : ""}</span>
                      </li>
                    ))}
                    {people.length === 0 && <li style={{ fontSize: 12, color: RS.faint }}>—</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Avisos programados: cuándo salen, para quién, y enviar ya o cancelar
function Scheduled({ items }) {
  const t = useT();
  const locale = useDateLocale();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null);
  const act = async (fn, id) => {
    setBusy(id);
    try { await fn(id); } catch { /* se ve al refrescar */ }
    await qc.invalidateQueries({ queryKey: ["noticeHistory"] });
    setBusy(null);
  };
  return (
    <div style={{ padding: "8px 14px", borderBottom: `1px solid ${RS.lineSoft}`, background: "#FBF8F8" }} data-testid="sent-scheduled">
      <p style={{ margin: "0 0 4px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: RS.muted }}>{t("Programados")} · {items.length}</p>
      {items.map((n) => (
        <div key={n.id} className="flex flex-wrap items-center" style={{ gap: "4px 10px", padding: "6px 0", borderTop: `1px dashed ${RS.line}` }} data-testid={`sched-${n.id}`}>
          <CalendarClock className="w-4 h-4" style={{ color: RS.granate }} />
          <b style={{ fontSize: 13.5, color: RS.ink }}>{n.title}</b>
          <KindChip kind={n.kind} />
          <span style={{ fontSize: 12, color: RS.muted }}>{n.audience_label}{n.expected ? ` · ~${n.expected}` : ""}</span>
          <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: RS.granateDark }}>
            {n.status === "enviando" ? t("Enviando…") : format(new Date(n.send_at), "EEE d MMM · HH:mm", { locale })}
          </span>
          {n.status === "programado" && (
            <span className="inline-flex" style={{ gap: 6 }}>
              <button type="button" disabled={busy === n.id} onClick={() => act(base44.club.scheduleNow, n.id)} style={btn(false)} data-testid={`sched-now-${n.id}`}>{t("Enviar ya")}</button>
              <button type="button" disabled={busy === n.id} onClick={() => { if (window.confirm(t("¿Cancelar este aviso programado?"))) act(base44.club.scheduleCancel, n.id); }}
                style={{ ...btn(false), color: "#B91C1C" }} data-testid={`sched-cancel-${n.id}`}>{t("Cancelar")}</button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function SentList({ items, uid, coord }) {
  const t = useT();
  const when = useWhen();
  const [who, setWho] = useState("all");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const kinds = useMemo(() => new Set(items.map((n) => n.kind)), [items]);
  const { scheduled, failed, sent } = splitSent(filterSent(items, { who, kind, q }, uid));

  return (
    <section className="rs2-card" style={{ overflow: "hidden" }} data-testid="sent">
      <Head title={t("Enviados")} right={<span style={{ color: RS.muted, fontSize: 11.5 }}>{t("Leído = lo han abierto en la app o desde el aviso")}</span>} />
      <div className="flex flex-wrap items-center" style={{ gap: 8, padding: "8px 14px", borderBottom: `1px solid ${RS.lineSoft}` }}>
        {coord && <Seg testPrefix="sent-who" value={who} onChange={setWho} options={[{ value: "all", label: "Todos" }, { value: "mine", label: "Míos" }]} />}
        {kinds.size > 1 && <Seg testPrefix="sent-kind" value={kind} onChange={setKind} options={kindOptions(kinds)} />}
        <div style={{ flexBasis: "100%" }} />
        <SearchBox value={q} onChange={setQ} placeholder={t("Buscar…")} testId="sent-search" />
      </div>
      {scheduled.length > 0 && <Scheduled items={scheduled} />}
      {failed.map((n) => (
        <div key={n.id} style={{ padding: "8px 14px", borderBottom: `1px solid ${RS.lineSoft}`, background: "#FEF2F2", fontSize: 12.5, color: "#B91C1C" }} data-testid={`sent-failed-${n.id}`}>
          <b>{n.title}</b> · {t("No se pudo enviar el aviso programado")}{n.error === "no_recipients" ? ` (${t("no había nadie a quien enviarlo")})` : ""}
        </div>
      ))}
      {sent.length === 0 && scheduled.length === 0 ? (
        <p style={{ padding: 14, margin: 0, fontSize: 13, color: RS.faint }}>{items.length ? t("No hay avisos con este filtro.") : t("Aún no se ha enviado ningún aviso.")}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }} data-testid="sent-list">
          {sent.map((n) => {
            const isOpen = open === n.id;
            return (
              <li key={n.id} style={{ padding: "9px 14px", borderBottom: `1px solid ${RS.lineSoft}`, background: isOpen ? "#FFFCFB" : "#fff" }}>
                <button type="button" onClick={() => setOpen(isOpen ? null : n.id)} className="w-full text-left" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }} data-testid={`sent-item-${n.id}`}>
                  <span className="flex flex-wrap items-center" style={{ gap: "2px 8px" }}>
                    <b style={{ fontSize: 14, color: RS.ink }}>{n.title}</b>
                    <KindChip kind={n.kind} />
                    <span style={{ marginLeft: "auto", fontSize: 12, color: RS.muted, whiteSpace: "nowrap" }}>{when(n.created_date)}</span>
                  </span>
                  <span className="flex flex-wrap items-center" style={{ gap: "2px 8px", marginTop: 3 }}>
                    <span className="min-w-0" style={{ fontSize: 12.5, color: RS.muted, flex: "1 1 200px" }}>{n.sender_name} · {n.audience_label}</span>
                    {n.tracked ? <ReadBar read={n.read} total={n.recipients} testId={`sent-read-${n.id}`} />
                      : <span style={{ fontSize: 12, color: RS.faint }}>{n.recipients === 1 ? t("{n} destinatario", { n: 1 }) : t("{n} destinatarios", { n: n.recipients })}</span>}
                  </span>
                </button>
                {isOpen && <SentDetail n={n} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
