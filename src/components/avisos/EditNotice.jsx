import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { sortTeams } from "@/lib/teamOrder";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RS } from "@/components/rs2/kit";
import { Pick, Lab } from "@/components/avisos/AvisoParts";
import { KINDS, toLocalInput, fromLocalInput, scheduleError, quickTimes } from "@/lib/noticeUi";
import { useT, msg } from "@/i18n";

const GROUPS = [["jugadores", msg("Jugadores")], ["familiares", msg("Familiares")], ["tecnico", msg("Cuerpo técnico")]];
const COORD_ROLES = ["director", "director_deportivo", "coordinador_general", "coordinador_f7", "coordinador_f11"];
const input = { width: "100%", border: `1px solid ${RS.input}`, borderRadius: 8, padding: "8px 11px", fontSize: 14, color: RS.ink, background: "#fff", outline: "none" };

// Corregir un aviso. Enviado: título, texto y tipo (en la app se ve la versión corregida con «Editado»; lo que ya llegó
// al móvil no se puede cambiar). Programado: además la hora y, si se eligió por equipos, los equipos y a quién llega.
export default function EditNotice({ notice, onClose }) {
  const t = useT();
  const qc = useQueryClient();
  const { user } = useAuth();
  const scheduled = notice.status === "programado";
  const canAudience = scheduled && !notice.by_people;
  const isCoord = user?.role === "admin" || COORD_ROLES.includes(user?.app_role);
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list(), enabled: canAudience });
  const myTeamIds = useMemo(() => new Set([...(user?.team_ids || []), ...(user?.team_id ? [user.team_id] : [])]), [user]);
  const available = sortTeams(isCoord ? teams : teams.filter((x) => myTeamIds.has(x.id)));

  const [title, setTitle] = useState(notice.title || "");
  const [body, setBody] = useState(notice.body || "");
  const [kind, setKind] = useState(notice.kind || "general");
  const [at, setAt] = useState(scheduled && notice.send_at ? toLocalInput(new Date(notice.send_at)) : "");
  const [allClub, setAllClub] = useState(!!notice.all_club);
  const [teamIds, setTeamIds] = useState(notice.team_ids || []);
  const [groups, setGroups] = useState(notice.groups?.length ? notice.groups : ["jugadores", "familiares"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const atDate = fromLocalInput(at);
  const schedErr = scheduled ? scheduleError(atDate) : null;
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const targetOk = !canAudience || ((allClub || teamIds.length > 0) && groups.length > 0);
  const ok = title.trim() && body.trim() && !schedErr && targetOk;

  const save = async () => {
    setBusy(true); setErr(null);
    const payload = { id: notice.id, title, body, kind };
    if (scheduled) payload.send_at = atDate.toISOString();
    if (canAudience) {
      payload.audience = { all_club: allClub, team_ids: allClub ? [] : teamIds, groups };
      const who = groups.map((g) => GROUPS.find((x) => x[0] === g)?.[1]).filter(Boolean).join(" + ");
      const where = allClub ? "Todo el club" : teams.filter((x) => teamIds.includes(x.id)).map((x) => x.name).join(", ");
      payload.audience_label = `${where} · ${who}`;
    }
    try {
      await base44.club.noticeEdit(payload);
      qc.invalidateQueries({ queryKey: ["noticeHistory"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      onClose(true);
    } catch (e) {
      const c = e.data?.error;
      setErr(c === "no_recipients" ? t("No hay nadie a quien enviar con esa selección.") : c === "bad_send_at" ? t("La hora de envío no vale.") : t("No se pudo guardar"));
    }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(false); }}>
      <DialogContent className="bg-white max-w-xl max-h-[90vh] overflow-y-auto" data-testid="notice-edit">
        <DialogHeader><DialogTitle style={{ color: RS.ink }}>{scheduled ? t("Editar aviso programado") : t("Corregir aviso enviado")}</DialogTitle></DialogHeader>
        {!scheduled && (
          <p style={{ margin: 0, fontSize: 12.5, color: RS.ink2, background: RS.soft, borderRadius: 8, padding: "7px 10px" }}>
            {t("En la app todos verán el texto corregido, marcado como «Editado». La notificación que ya llegó al móvil no se puede cambiar.")}
          </p>
        )}
        <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
          <span style={{ fontSize: 12.5, color: RS.muted }}>{t("Tipo")}</span>
          {KINDS.map((k) => {
            const on = kind === k.key;
            return (
              <button key={k.key} type="button" onClick={() => setKind(k.key)} data-testid={`edit-kind-${k.key}`}
                style={{ border: `1px solid ${on ? k.fg : "transparent"}`, background: on ? k.bg : "#F8F5F5", color: on ? k.fg : RS.faint, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: on ? 700 : 500 }}>
                {t(k.label)}
              </button>
            );
          })}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder={t("Título")} data-testid="edit-title" style={{ ...input, fontWeight: 700 }} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1800} rows={6} placeholder={t("Mensaje")} data-testid="edit-body" style={{ ...input, resize: "vertical", lineHeight: 1.45 }} />

        {scheduled && (
          <div>
            <Lab>{t("Cuándo")}</Lab>
            <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
              {quickTimes().map((q) => <Pick key={q.key} on={at === toLocalInput(q.date)} onClick={() => setAt(toLocalInput(q.date))}>{t(q.label)}</Pick>)}
              <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} data-testid="edit-at" aria-label={t("Día y hora del envío")} style={{ ...input, width: "auto", padding: "5px 9px", fontSize: 13 }} />
            </div>
            {schedErr && at && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#B91C1C" }}>{t(schedErr)}</p>}
          </div>
        )}

        {canAudience && (
          <div data-testid="edit-audience">
            <Lab>{t("Para")}</Lab>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {isCoord && <Pick on={allClub} onClick={() => setAllClub(!allClub)}>{t("Todo el club")}</Pick>}
              {available.map((x) => <Pick key={x.id} on={!allClub && teamIds.includes(x.id)} onClick={() => { setAllClub(false); toggle(teamIds, setTeamIds, x.id); }} testId={`edit-team-${x.id}`}>{x.name}</Pick>)}
            </div>
            <div className="flex flex-wrap items-center" style={{ gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 12.5, color: RS.muted }}>{t("Les llega a")}</span>
              {GROUPS.map(([k, l]) => <Pick key={k} on={groups.includes(k)} onClick={() => toggle(groups, setGroups, k)}>{t(l)}</Pick>)}
            </div>
          </div>
        )}
        {scheduled && notice.by_people && <p style={{ margin: 0, fontSize: 12, color: RS.muted }}>{t("Para: {who} (para cambiar las personas, cancélalo y crea otro).", { who: notice.audience_label })}</p>}

        {err && <p style={{ margin: 0, fontSize: 12.5, color: "#B91C1C" }}>{err}</p>}
        <div className="flex justify-end" style={{ gap: 8 }}>
          <button type="button" onClick={() => onClose(false)} style={{ border: `1px solid ${RS.input}`, background: "#fff", color: RS.ink2, borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600 }}>{t("Cancelar")}</button>
          <button type="button" onClick={save} disabled={!ok || busy} data-testid="edit-save"
            style={{ border: "none", background: RS.granate, color: "#fff", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, opacity: !ok || busy ? 0.45 : 1 }}>
            {busy ? t("Guardando…") : t("Guardar cambios")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
