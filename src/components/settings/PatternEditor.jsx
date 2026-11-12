// Configuración → Patrones: ajustes de cada patrón de página (como el «patrón de diapositivas» de PowerPoint),
// qué páginas lo usan y ajustes que valen solo para una página. Con vista previa al momento.
import React, { useMemo, useState } from "react";
import { useT } from "@/i18n";
import { PATTERNS, PAGES, PATTERN_FIELDS, choiceLabel, settingsCss, cleanSettings } from "@/lib/pagePatterns";
import { RS, Card } from "@/components/rs2/kit";

const btn = (on) => ({
  height: 28, padding: "0 10px", borderRadius: 7, fontSize: 12, fontWeight: on ? 600 : 400, whiteSpace: "nowrap",
  border: `1px solid ${on ? RS.granate : RS.input}`, background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink2,
});

// Un grupo de ajustes (de un patrón o de una página). `inherit` = lo que sale si no se toca (texto)
function SettingsForm({ value, onChange, inherit, testId }) {
  const t = useT();
  const set = (k, v) => {
    const next = { ...value };
    if (v === undefined) delete next[k];
    else next[k] = v;
    onChange(cleanSettings(next));
  };
  return (
    <div className="flex flex-col" data-testid={testId}>
      {PATTERN_FIELDS.map((f) => {
        const cur = value[f.key];
        return (
          <div key={f.key} className="grid sm:grid-cols-[190px_minmax(0,1fr)] items-center" style={{ gap: "4px 12px", padding: "6px 0", borderTop: `1px solid ${RS.lineSoft}` }}>
            <div style={{ fontSize: 13, color: RS.ink, fontWeight: 600 }}>{t(f.label)}</div>
            <div className="flex flex-wrap items-center" style={{ gap: 5 }}>
              <button type="button" style={btn(cur === undefined)} onClick={() => set(f.key, undefined)} data-testid={`${testId}-${f.key}-inherit`}>{t(inherit)}</button>
              {f.type === "color" ? (
                <label className="inline-flex items-center" style={{ ...btn(cur !== undefined), gap: 6, cursor: "pointer" }}>
                  <input type="color" value={cur || "#F5F5F5"} onChange={(e) => set(f.key, e.target.value.toUpperCase())}
                    style={{ width: 20, height: 18, border: "none", padding: 0, background: "transparent" }} data-testid={`${testId}-${f.key}-color`} />
                  {cur || t("Elegir color")}
                </label>
              ) : (
                f.options.map((o) => (
                  <button key={o} type="button" style={btn(cur === o)} onClick={() => set(f.key, o)} data-testid={`${testId}-${f.key}-${o}`}>
                    {t(choiceLabel(f.key, o))}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Muestra de una página con los ajustes aplicados (mismas reglas que la app, con otro selector)
function PatternPreview({ settings, colors }) {
  const t = useT();
  const css = useMemo(() => settingsCss('[data-pv="1"][data-pv]', settings, colors), [settings, colors]);
  return (
    <div style={{ border: `1px solid ${RS.line}`, borderRadius: 12, overflow: "hidden" }}>
      <style>{css}</style>
      <div data-pv="1" style={{ background: "#f5f5f5" }}>
        <div data-pattern-body style={{ padding: 14 }} data-testid="pattern-preview">
          <h1 style={{ fontSize: "1.6rem", margin: 0 }}>{t("Jugadores")}</h1>
          <h3 style={{ fontSize: 12, margin: "4px 0 10px" }}>{t("Temporada")} 2026-27</h3>
          <div className="grid grid-cols-3" style={{ gap: 8, marginBottom: 8 }}>
            {[["24", t("Jugadores")], ["2", t("Lesionados")], ["86%", t("Asistencia")]].map(([v, l]) => (
              <div key={l} className="bg-white rounded-xl border border-gray-200" style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: RS.muted }}>{l}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: colors.primaryDark }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200" style={{ padding: "8px 10px" }}>
            <h4 style={{ fontSize: 11, margin: "0 0 6px" }}>{t("Plantilla")}</h4>
            {["1 · Marc Puig", "4 · Pol Vidal", "8 · Arnau Font"].map((n) => (
              <div key={n} style={{ fontSize: 12, padding: "4px 0", borderTop: "1px solid #f0eaea" }}>{n}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PatternEditor({ draft, set }) {
  const t = useT();
  const [sel, setSel] = useState("listados");
  const [openPage, setOpenPage] = useState(null);
  const patterns = draft.patterns || {};
  const pages = draft.pages || {};
  const patternOf = (p) => pages[p.path]?.pattern || p.pattern;
  const setPattern = (k, s) => set({ patterns: { ...patterns, [k]: s } });
  const setPage = (path, v) => set({ pages: { ...pages, [path]: v } });
  const pageOwn = (path) => { const v = { ...(pages[path] || {}) }; delete v.pattern; return v; };
  const current = PATTERNS.find((p) => p.key === sel);
  const members = PAGES.filter((p) => patternOf(p) === sel);
  const nSet = (o) => Object.keys(o || {}).length;
  const previewSettings = openPage ? { ...(patterns[sel] || {}), ...pageOwn(openPage) } : patterns[sel] || {};

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_400px]" style={{ gap: 16, alignItems: "start" }}>
      <div className="flex flex-col" style={{ gap: 12 }}>
        <Card title={t("Patrones de página")}>
          <p style={{ fontSize: 12, color: RS.muted, marginBottom: 8 }}>
            {t("Cada página de la app usa un patrón. Lo que cambies en un patrón vale para todas sus páginas; a una página se le puede cambiar algo solo a ella.")}
          </p>
          <div className="flex flex-wrap" style={{ gap: 6 }} data-testid="pattern-list">
            {PATTERNS.map((p) => {
              const n = PAGES.filter((pg) => patternOf(pg) === p.key).length;
              const k = nSet(patterns[p.key]);
              return (
                <button key={p.key} type="button" onClick={() => { setSel(p.key); setOpenPage(null); }} data-testid={`pattern-${p.key}`}
                  style={{ ...btn(sel === p.key), height: "auto", padding: "6px 12px", textAlign: "left" }}>
                  <div style={{ fontWeight: 600 }}>{t(p.label)}</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>{t("{n} páginas", { n })}{k ? ` · ${t("{n} cambios", { n: k })}` : ""}</div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title={t(current.label)} testId="pattern-settings">
          <p style={{ fontSize: 12, color: RS.muted, marginBottom: 4 }}>{t(current.help)}</p>
          <SettingsForm value={patterns[sel] || {}} onChange={(s) => setPattern(sel, s)} inherit="Como siempre" testId={`pat-${sel}`} />
        </Card>

        <Card title={t("Páginas")} testId="pattern-pages">
          <p style={{ fontSize: 12, color: RS.muted, marginBottom: 6 }}>{t("Las páginas que usan este patrón. Se pueden pasar a otro patrón o cambiarles algo solo a ellas.")}</p>
          {members.length === 0 && <div style={{ fontSize: 13, color: RS.muted }}>{t("Ninguna página usa este patrón.")}</div>}
          {members.map((p) => {
            const own = pageOwn(p.path);
            const open = openPage === p.path;
            return (
              <div key={p.path} style={{ borderTop: `1px solid ${RS.lineSoft}`, padding: "6px 0" }} data-testid={`page-${p.path}`}>
                <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: RS.ink, flex: 1, minWidth: 150 }}>
                    {t(p.label)}
                    {nSet(own) > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: RS.naranja, fontWeight: 600 }}>{t("{n} propios", { n: nSet(own) })}</span>}
                  </span>
                  <select value={patternOf(p)} onChange={(e) => { setPage(p.path, { ...own, pattern: e.target.value }); setOpenPage(null); }}
                    style={{ height: 28, fontSize: 12, border: `1px solid ${RS.input}`, borderRadius: 7, padding: "0 6px", background: "#fff" }} data-testid={`page-pattern-${p.path}`}>
                    {PATTERNS.map((x) => <option key={x.key} value={x.key}>{t(x.label)}</option>)}
                  </select>
                  <button type="button" style={btn(open)} onClick={() => setOpenPage(open ? null : p.path)} data-testid={`page-own-${p.path}`}>
                    {open ? t("Cerrar") : t("Solo esta página")}
                  </button>
                </div>
                {open && (
                  <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: `3px solid ${RS.naranja}` }}>
                    <SettingsForm value={own} onChange={(s) => setPage(p.path, { ...s, ...(pages[p.path]?.pattern ? { pattern: pages[p.path].pattern } : {}) })}
                      inherit="Como el patrón" testId={`own-${p.path}`} />
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </div>

      <div className="xl:sticky" style={{ top: 12 }}>
        <Card title={openPage ? `${t("Vista previa")} · ${t(PAGES.find((p) => p.path === openPage).label)}` : `${t("Vista previa")} · ${t(current.label)}`}>
          <PatternPreview settings={previewSettings} colors={draft.colors} />
          <p style={{ fontSize: 12, color: RS.muted, marginTop: 8 }}>
            {t("Para verlo en las páginas de verdad, usa «Probar en toda la app».")}
          </p>
        </Card>
      </div>
    </div>
  );
}
