import { POLL } from "@/lib/query-client";
import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { RS } from "@/components/rs2/kit";
import { filterInbox } from "@/lib/noticeUi";
import { useMarkRead } from "@/lib/noticeReads";
import { KindChip, Seg, kindOptions, useWhen } from "@/components/avisos/AvisoParts";
import { Head } from "@/components/rs2/dashParts";
import { useT } from "@/i18n";

// Avisos recibidos por esta persona: sin leer con un punto, se abren tocándolos (y quedan como leídos).
// `framed` = dentro de una tarjeta con su cabecera (página Avisos); sin él, solo la lista (pantalla de las familias).
export default function Inbox({ framed = false }) {
  const t = useT();
  const when = useWhen();
  const qc = useQueryClient();
  const markRead = useMarkRead();
  const { data = [], isLoading } = useQuery({ queryKey: ["inbox"], queryFn: () => base44.club.inbox(), refetchInterval: POLL.medium, refetchOnWindowFocus: true });
  const [unread, setUnread] = useState(false);
  const [kind, setKind] = useState("all");
  const [open, setOpen] = useState(null);
  const unreadN = data.filter((n) => !n.read).length;
  const kinds = useMemo(() => new Set(data.map((n) => n.kind)), [data]);
  const list = filterInbox(data, { unread, kind });

  const toggle = (n) => {
    setOpen(open === n.id ? null : n.id);
    if (!n.read) markRead([n.id]);
  };
  const readAll = async () => {
    qc.setQueryData(["inbox"], (old) => (Array.isArray(old) ? old.map((n) => ({ ...n, read: true })) : old));
    try { await base44.club.noticeReadAll(); } catch { /* nada */ }
    qc.invalidateQueries({ queryKey: ["notice-unread"] });
  };

  if (isLoading) return null;

  const filters = data.length > 0 && (
    <div className="flex flex-wrap items-center" style={{ gap: 8, padding: "8px 14px", borderBottom: `1px solid ${RS.lineSoft}` }}>
      <Seg testPrefix="inbox-filter" value={unread ? "unread" : "all"} onChange={(v) => setUnread(v === "unread")}
        options={[{ value: "all", label: "Todos" }, { value: "unread", label: `${t("Sin leer")} · ${unreadN}` }]} />
      {kinds.size > 1 && <Seg testPrefix="inbox-kind" value={kind} onChange={setKind} options={kindOptions(kinds)} />}
      {!framed && unreadN > 0 && (
        <button type="button" onClick={readAll} data-testid="inbox-read-all" style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: RS.granate, background: "none", border: "none" }}>
          {t("Marcar todo como leído")}
        </button>
      )}
    </div>
  );

  const body = data.length === 0 ? (
    <div style={{ padding: 28, textAlign: "center" }}>
      <Bell className="w-6 h-6 mx-auto mb-2" style={{ color: RS.input }} />
      <p style={{ fontSize: 13, color: RS.faint, margin: 0 }}>{t("Todavía no has recibido avisos.")}</p>
    </div>
  ) : list.length === 0 ? (
    <p style={{ fontSize: 13, color: RS.faint, padding: "14px", margin: 0 }}>{t("No hay avisos con este filtro.")}</p>
  ) : (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }} data-testid="inbox-list">
      {list.map((n) => {
        const isOpen = open === n.id;
        return (
          <li key={n.id} style={{ borderBottom: `1px solid ${RS.lineSoft}`, background: n.read ? "#fff" : "#FFFAF5" }}>
            <button type="button" onClick={() => toggle(n)} data-testid={`inbox-item-${n.id}`} data-read={n.read ? "1" : "0"}
              className="w-full text-left flex" style={{ gap: 10, padding: "10px 14px", background: "none", border: "none", cursor: "pointer" }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0, background: n.read ? "transparent" : RS.naranja }} />
              <span className="flex-1 min-w-0">
                <span className="flex flex-wrap items-center" style={{ gap: "2px 8px" }}>
                  <b style={{ fontSize: 14, color: RS.ink }}>{n.title}</b>
                  <KindChip kind={n.kind} />
                  {!n.read && <span className="sr-only">{t("Sin leer")}</span>}
                  <span style={{ marginLeft: "auto", fontSize: 12, color: RS.muted, whiteSpace: "nowrap" }}>{when(n.created_date)}</span>
                </span>
                <span className={isOpen ? "block" : "line-clamp-2"} style={{ fontSize: 13, color: RS.ink2, marginTop: 2, whiteSpace: "pre-line" }}>{n.body}</span>
                {n.sender_name && <span style={{ display: "block", fontSize: 11.5, color: RS.muted, marginTop: 3 }}>{t("De {name}", { name: n.sender_name })}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div style={{ background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 12, overflow: "hidden" }} data-testid="inbox">
      {framed && (
        <Head title={t("Recibidos")} right={unreadN > 0 && (
          <button type="button" onClick={readAll} data-testid="inbox-read-all" style={{ fontSize: 12, fontWeight: 700, color: RS.granate, background: "none", border: "none" }}>
            {t("Marcar todo como leído")}
          </button>
        )} />
      )}
      {filters}{body}
    </div>
  );
}
