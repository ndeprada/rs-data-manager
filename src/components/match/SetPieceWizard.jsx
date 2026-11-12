import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/i18n";
import {
  SP_KINDS, typeOf, hasSide, pieceSetup, structuresFor, applyStructure, emptyPieceBoard, legacyToBoard, flipBoard,
  proposeSquad, ownChips, copyPiece, pieceBoard, withSheet, applySpBase,
} from "@/lib/setPieceBoard";
import { C as clubColor, F as clubFont } from "@/lib/brand";

// «Nueva jugada en 3 toques» (06/11/2026, maqueta «Maqueta ABP · versión nueva» aprobada por Nacho: «ok ponte con ello»):
// 1) qué jugada (tipo, a favor / en contra, lado), 2) punto de partida (estructuras de córner, la plantilla básica del tipo,
// las jugadas de la biblioteca del mismo tipo o en blanco) y 3) quién y con qué señal (los convocados se colocan solos en las
// fichas, por puesto y dorsal, como «Rellenar con convocados»; las señales que ya usa otra jugada del partido salen tachadas).
// La jugada se crea solo con la HOJA (sin animación): la animación se añade después en la pizarra.
const SIGNALS = ["Mano arriba", "Puño cerrado", "Dos dedos", "Tocarse la cabeza", "Dos manos arriba", "Brazo extendido"];
const sigKey = (x) => String(x || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const R = { granate: clubColor.primary, dark: clubColor.primaryDark, bg: "#F5F2F1", line: "#E6DEDD", soft: "#F0EAE9", ink: "#1E1416", ink2: "#4A3D3F", muted: "#6B5E60", input: "#D9CFCE" };

export default function SetPieceWizard({ open, onOpenChange, onCreate, templates, candidates = [], lookup = [], pieces = [], library = [], Thumb, kindLabel, fnLabel, uid, availableIds = [], base = null, onClearBase }) {
  const t = useT();
  const [kind, setKind] = useState("corner");
  const [attack, setAttack] = useState(true);
  const [side, setSide] = useState("r");
  const [startId, setStartId] = useState(null);
  const [fill, setFill] = useState(true);
  const [signal, setSignal] = useState("");
  // vista base guardada (campo, vista, colores, letra de las fichas): se pone en la jugada nueva si está marcada
  const [useBase, setUseBase] = useState(true);
  const [baseGone, setBaseGone] = useState(false);
  const hasBase = !!base && !baseGone;
  const drawSide = side === "l" ? "l" : "r";

  const options = useMemo(() => {
    const out = [];
    for (const st of structuresFor(kind, attack)) out.push({ id: `st:${st.id}`, label: st.label, board: withSheet(applyStructure(emptyPieceBoard(), st, { side: drawSide, newId: uid })) });
    const tpl = templates.find((x) => x.key === typeOf(kind, attack));
    if (tpl && !out.length) {
      const made = tpl.make();
      let b = legacyToBoard({ id: uid(), tokens: made.tokens, arrows: made.arrows });
      if (drawSide === "l") b = flipBoard(b);
      out.push({ id: "tpl", label: t("Básica: {name}", { name: t(tpl.label) }), board: withSheet(b) });
    }
    for (const l of library) {
      const s = pieceSetup(l);
      if (s.kind === kind && s.attack === attack) out.push({ id: `lib:${l.id}`, label: l.name || t("Sin nombre"), lib: l, board: pieceBoard(l, lookup), fromLib: true });
    }
    out.push({ id: "blank", label: t("En blanco"), board: null });
    return out;
  }, [kind, attack, drawSide, library, templates]);
  const chosen = options.find((o) => o.id === startId) || options[0];
  const preview = useMemo(() => (chosen?.board ? (fill ? proposeSquad(chosen.board, candidates, chosen.lib ? pieceSetup(chosen.lib).attack : attack) : chosen.board) : null), [chosen, fill, candidates, attack]);
  const chips = preview ? ownChips(preview) : [];
  const groups = [];
  for (const c of chips) {
    const key = c.fn || "";
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label: key ? fnLabel(key) : t("Sin función"), list: [] }));
    g.list.push(c);
  }
  const used = new Set(pieces.map((p) => sigKey(p.signal)).filter(Boolean));
  const usedNow = signal && used.has(sigKey(signal));
  const kindText = kind === "otro" ? t("Otra jugada") : t(kindLabel(kind));
  const sameKind = pieces.filter((p) => pieceSetup(p).kind === kind).length;

  const create = () => {
    let piece;
    if (chosen?.lib) {
      const l = chosen.lib;
      piece = copyPiece({ id: uid(), name: l.name, type: l.type, ...(l.kind ? { kind: l.kind, attack: l.attack, side: l.side } : {}), signal: l.signal || "", notes: l.notes || "", lib_id: l.id, tokens: l.tokens || [], arrows: l.arrows || [], ...(l.board ? { board: l.board } : {}) }, { newId: uid, players: lookup, availableIds });
      if (fill) piece = { ...piece, board: proposeSquad(piece.board, candidates, pieceSetup(piece).attack) };
      if (signal.trim()) piece = { ...piece, signal: signal.trim() };
    } else {
      let b = chosen?.board || withSheet(emptyPieceBoard());
      if (fill) b = proposeSquad(b, candidates, attack);
      piece = {
        id: uid(), name: `${kindText} ${sameKind + 1}`, kind, attack, side: hasSide(kind) ? side : "r", draw_side: drawSide,
        type: typeOf(kind, attack), signal: signal.trim(), notes: "", tokens: [], arrows: [], board: b,
      };
    }
    if (hasBase && useBase) piece = { ...piece, board: applySpBase(piece.board, base) };
    onCreate(piece);
    setStartId(null); setSignal("");
  };

  const seg = (on) => ({ flex: 1, height: 34, borderRadius: 8, fontSize: 13, fontWeight: on ? 700 : 500, background: on ? R.dark : "transparent", color: on ? "#fff" : R.ink2 });
  const stepHead = (n, label) => (
    <div className="flex items-center" style={{ gap: 8 }}>
      <span className="flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: 999, background: R.granate, color: "#fff", fontSize: 12, fontWeight: 800 }}>{n}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color: R.ink }}>{label}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1060px] w-[calc(100vw-24px)] p-0 gap-0 overflow-hidden" style={{ fontFamily: `'${clubFont.bodyName}', system-ui, sans-serif`, color: R.ink }} data-testid="sp-wizard">
        <div className="flex items-center flex-wrap" style={{ gap: "4px 12px", padding: "16px 20px", borderBottom: `1px solid ${R.soft}` }}>
          <DialogTitle className="m-0" style={{ fontFamily: clubFont.titleBody, fontWeight: 400, fontSize: 26, lineHeight: 1, color: R.granate }}>{t("NUEVA JUGADA")}</DialogTitle>
          <span style={{ fontSize: 13, color: R.muted }}>{t("Tres decisiones y ya está en la pizarra, lista para retocar")}</span>
        </div>
        <div className="grid md:grid-cols-[290px_minmax(0,1fr)_minmax(0,1fr)] max-h-[70vh] overflow-y-auto">
          <section className="flex flex-col" style={{ padding: "16px 18px", gap: 12, borderRight: `1px solid ${R.soft}` }}>
            {stepHead(1, t("¿Qué jugada?"))}
            <div className="grid grid-cols-2" style={{ gap: 7 }} role="group" aria-label={t("Tipo de jugada")}>
              {SP_KINDS.map((k) => (
                <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => { setKind(k.id); setStartId(null); }} data-testid={`wz-kind-${k.id}`}
                  style={{ height: 44, borderRadius: 9, fontSize: 13, fontWeight: kind === k.id ? 700 : 500, border: kind === k.id ? `2px solid ${R.granate}` : `1px solid ${R.line}`, background: kind === k.id ? "#FBEFEF" : "#fff", color: kind === k.id ? R.granate : R.ink2 }}>
                  {t(kindLabel(k.id))}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: R.muted }}>{t("Para quién")}</span>
            <div className="flex" style={{ padding: 3, borderRadius: 10, background: "#F1ECEB" }}>
              <button type="button" aria-pressed={attack} onClick={() => { setAttack(true); setStartId(null); }} style={seg(attack)} data-testid="wz-attack">{t("A favor")}</button>
              <button type="button" aria-pressed={!attack} onClick={() => { setAttack(false); setStartId(null); }} style={seg(!attack)} data-testid="wz-defense">{t("En contra")}</button>
            </div>
            {hasSide(kind) && (
              <>
                <span style={{ fontSize: 12, fontWeight: 600, color: R.muted }}>{t("Desde qué lado")}</span>
                <div className="flex" style={{ padding: 3, borderRadius: 10, background: "#F1ECEB" }}>
                  {[["l", t("Izquierdo")], ["r", t("Derecho")], ["both", t("Los dos")]].map(([v, l]) => (
                    <button key={v} type="button" aria-pressed={side === v} onClick={() => setSide(v)} style={seg(side === v)} data-testid={`wz-side-${v}`}>{l}</button>
                  ))}
                </div>
                <span style={{ fontSize: 11.5, lineHeight: 1.4, color: R.muted }}>{t("«Los dos»: se dibuja una vez y sirve para los dos lados.")}</span>
              </>
            )}
          </section>

          <section className="flex flex-col" style={{ padding: "16px 18px", gap: 12, borderRight: `1px solid ${R.soft}`, background: "#FBF9F8" }}>
            {stepHead(2, t("Punto de partida"))}
            <div className="grid grid-cols-2" style={{ gap: 9 }}>
              {options.map((o) => {
                const on = chosen?.id === o.id;
                return (
                  <button key={o.id} type="button" aria-pressed={on} onClick={() => setStartId(o.id)} className="flex flex-col text-left" data-testid={`wz-start-${o.id}`}
                    style={{ padding: 5, gap: 5, borderRadius: 9, border: on ? `2px solid ${R.granate}` : o.id === "blank" ? `1.5px dashed ${R.input}` : `1px solid ${R.line}`, background: "#fff" }}>
                    <span className="block overflow-hidden" style={{ width: "100%", aspectRatio: "74 / 50", borderRadius: 6, border: `1px solid ${R.line}`, background: o.board ? "#fff" : R.bg }}>
                      {o.board ? <Thumb piece={{ id: o.id, board: o.board }} lookup={lookup} /> : <span className="flex w-full h-full items-center justify-center" style={{ fontSize: 22, color: "#B5A9A7" }}>+</span>}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: on ? 700 : 600, color: on ? R.granate : R.ink, padding: "0 2px" }}>{o.label}{o.fromLib ? <span style={{ fontWeight: 400, color: R.muted }}> · {t("biblioteca")}</span> : null}</span>
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: 11.5, lineHeight: 1.45, color: R.muted }}>{t("Se crea solo la hoja (la imagen que se imprime). La animación, si la quieres, se añade después en la pizarra.")}</span>
          </section>

          <section className="flex flex-col" style={{ padding: "16px 18px", gap: 10 }}>
            {stepHead(3, t("¿Quién y con qué señal?"))}
            <label className="flex items-center" style={{ gap: 8, fontSize: 13, color: R.ink2 }}>
              <input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} style={{ accentColor: R.granate, width: 16, height: 16 }} data-testid="wz-fill" />
              {t("Poner a los convocados en las fichas según su puesto")}
            </label>
            {groups.length > 0 ? (
              <div className="flex flex-col" style={{ gap: 6 }} data-testid="wz-who">
                {groups.map((g) => (
                  <div key={g.key} className="grid items-start" style={{ gridTemplateColumns: "92px minmax(0,1fr)", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: R.ink2, paddingTop: 5 }}>{g.label}</span>
                    <div className="flex flex-wrap" style={{ gap: 5 }}>
                      {g.list.map((c) => (
                        <span key={c.id} className="inline-flex items-center" style={{ height: 28, gap: 5, padding: "0 9px 0 3px", borderRadius: 999, border: `1px solid ${R.line}`, background: "#fff", fontSize: 12, fontWeight: 600 }}>
                          <span className="flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: 999, background: R.granate, color: "#fff", fontSize: 10.5, fontWeight: 800 }}>{c.inner || "·"}</span>
                          {c.label || t("Sin asignar")}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <span style={{ fontSize: 11.5, color: R.muted }}>{t("Se cambia luego tocando cada ficha.")}</span>
              </div>
            ) : <p style={{ margin: 0, fontSize: 12.5, color: R.muted }}>{t("En blanco: colocas tú las fichas en la pizarra.")}</p>}
            <div style={{ height: 1, background: R.soft, margin: "4px 0" }} />
            <label htmlFor="wz-signal" style={{ fontSize: 12.5, fontWeight: 700, color: R.ink2 }}>{t("Señal")}</label>
            <div className="flex flex-wrap" style={{ gap: 5 }}>
              {SIGNALS.map((x) => {
                const taken = used.has(sigKey(x));
                const on = sigKey(signal) === sigKey(x);
                return (
                  <button key={x} type="button" disabled={taken} onClick={() => setSignal(x)} aria-pressed={on}
                    style={{ height: 30, padding: "0 11px", borderRadius: 999, fontSize: 12, fontWeight: on ? 700 : 500, border: on ? "none" : `1px solid ${R.line}`, background: on ? R.granate : taken ? R.bg : "#fff", color: on ? "#fff" : taken ? "#9A8E90" : R.ink, textDecoration: taken ? "line-through" : "none" }}>
                    {x}
                  </button>
                );
              })}
            </div>
            <input id="wz-signal" value={signal} onChange={(e) => setSignal(e.target.value)} placeholder={t("O escríbela: brazo derecho extendido…")} data-testid="wz-signal"
              className="outline-none focus:ring-1 focus:ring-club" style={{ height: 38, borderRadius: 9, border: `1px solid ${usedNow ? "#B42318" : R.input}`, padding: "0 12px", fontSize: 14, color: R.ink }} />
            <span style={{ fontSize: 11.5, color: usedNow ? "#B42318" : R.muted }}>{usedNow ? t("Esa señal ya la usa otra jugada de este partido.") : t("Las tachadas ya las usa otra jugada de este partido.")}</span>
          </section>
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: 10, padding: "12px 20px", borderTop: `1px solid ${R.soft}`, background: "#FBF9F8" }}>
          <span style={{ fontSize: 13, color: R.ink2 }}><b>{kindText} · {attack ? t("A favor") : t("En contra")}</b>{chosen ? ` · ${chosen.label}` : ""}{chips.length ? ` · ${t("{n} fichas del Racing", { n: chips.length })}` : ""}</span>
          <span className="flex-1" />
          {hasBase ? (
            <span className="inline-flex items-center" style={{ gap: 8, fontSize: 12.5, color: R.ink2 }} data-testid="wz-base">
              <label className="inline-flex items-center" style={{ gap: 5, cursor: "pointer" }}>
                <input type="checkbox" checked={useBase} onChange={(e) => setUseBase(e.target.checked)} data-testid="wz-base-use" />
                {t("Con mi vista base")}
              </label>
              <button type="button" onClick={() => { setBaseGone(true); onClearBase?.(); }} className="underline" style={{ color: R.ink2 }} data-testid="wz-base-clear">{t("Quitar")}</button>
            </span>
          ) : (
            <span style={{ fontSize: 12, color: R.ink2, maxWidth: 260 }} data-testid="wz-base-hint">{t("Para que salgan siempre con tu campo, colores y letras: «Usar como vista base» en una jugada")}</span>
          )}
          <button type="button" onClick={() => onOpenChange(false)} style={{ height: 40, padding: "0 16px", borderRadius: 9, border: `1px solid ${R.input}`, background: "#fff", fontSize: 14, fontWeight: 600, color: R.ink2 }}>{t("Cancelar")}</button>
          <button type="button" onClick={create} style={{ height: 40, padding: "0 20px", borderRadius: 9, background: R.granate, fontSize: 14, fontWeight: 700, color: "#fff" }} data-testid="wz-create">{t("Crear y abrir en la pizarra")}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
