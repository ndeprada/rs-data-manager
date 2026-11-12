// Configuración del club (12/11/2026): identidad, colores y tipografías, con vista previa antes de guardar.
// Solo administración y dirección (también lo exige el servidor). Sin nada guardado, la app es la de Racing Sarrià.
// Pestañas: identidad, colores, tipografías, patrones de página, estructura del club y modo y copia (claro/oscuro, exportar/importar).
import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { canConfigureClub } from "@/lib/permissions";
import { useT, msg } from "@/i18n";
import { BRAND, SOCIAL_KEYS, brandDiff, colorWarnings, deriveTones, fullBrand } from "@/lib/brand";
import { brandDraftActive, startBrandDraft, storeBrand, endBrandDraft } from "@/lib/brandBoot";
import { Page, TopBar, Card, Btn, RS } from "@/components/rs2/kit";
import { FieldRow, ImageField, ColorField, FontField, inputStyle } from "@/components/settings/BrandFields";
import { BrandPreview } from "@/components/settings/BrandPreview";
import { PatternEditor } from "@/components/settings/PatternEditor";
import { StructureEditor } from "@/components/settings/StructureEditor";
import { ThemeBackup } from "@/components/settings/ThemeBackup";

const TABS = [
  { key: "identidad", label: msg("Identidad"), testId: "cfg-tab-identidad" },
  { key: "colores", label: msg("Colores"), testId: "cfg-tab-colores" },
  { key: "tipografias", label: msg("Tipografías"), testId: "cfg-tab-tipografias" },
  { key: "patrones", label: msg("Patrones de página"), testId: "cfg-tab-patrones" },
  { key: "estructura", label: msg("Estructura del club"), testId: "cfg-tab-estructura" },
  { key: "modo", label: msg("Modo y copia"), testId: "cfg-tab-modo" },
];

const COLOR_ROWS = [
  { key: "primary", label: msg("Color principal"), help: msg("Títulos, botones, menú lateral y cabeceras.") },
  { key: "accent", label: msg("Color de acento"), help: msg("Subtítulos, detalles y lo que se quiere resaltar.") },
  { key: "primaryDark", label: msg("Principal oscuro"), help: msg("Bandas, degradados y fondos oscuros.") },
  { key: "deep", label: msg("Casi negro"), help: msg("Barras de la pizarra y del editor de vídeo.") },
  { key: "primarySoft", label: msg("Fondo claro del principal"), help: msg("Etiquetas y fondos suaves.") },
  { key: "accentSoft", label: msg("Fondo claro del acento"), help: msg("Avisos y etiquetas en el color de acento.") },
];

const FONT_ROWS = [
  { role: "title", label: msg("Títulos"), help: msg("Títulos de las páginas, cabeceras y textos grandes."), sample: "MI EQUIPO · 2026-27" },
  { role: "body", label: msg("Textos"), help: msg("Todo lo demás: menús, tablas, formularios."), sample: "Convocatoria del sábado · 18 jugadores" },
  { role: "numbers", label: msg("Números"), help: msg("Cifras grandes de los resúmenes."), sample: "12 · 86% · 3-1" },
];

const SOCIAL_LABEL = { instagram: "Instagram", x: "X (Twitter)", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok" };

// «www.club.cat» → «https://www.club.cat» al salir del campo
const withScheme = (v) => { const s = (v || "").trim(); return !s || /^https?:\/\//i.test(s) ? s.replace(/^http:\/\//i, "https://") : `https://${s}`; };

const fontOf = (b, role) => ({ name: b.fonts[`${role}Name`], kind: b.fonts[`${role}Kind`], url: b.fonts[`${role}Url`] });

export default function ClubSettings() {
  const t = useT();
  const { user } = useAuth();
  const allowed = canConfigureClub(user);
  const [tab, setTab] = useState("identidad");
  const [saved, setSaved] = useState(null); // lo guardado en el servidor (solo diferencias)
  const [draft, setDraft] = useState(() => fullBrand(BRAND));
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!allowed) return;
    base44.club.brand().then(({ brand }) => {
      setSaved(brand || {});
      // Si se está probando un aspecto, se sigue editando la prueba; si no, lo guardado
      if (!brandDraftActive) setDraft(fullBrand(brand || {}));
    }).catch(() => setLoadError(true));
  }, [allowed]);

  const diff = useMemo(() => brandDiff(draft), [draft]);
  const dirty = saved !== null && JSON.stringify(diff) !== JSON.stringify(saved);
  const warnings = useMemo(() => colorWarnings(draft.colors), [draft.colors]);

  if (!allowed) {
    return <div className="p-8 text-center text-gray-500">{t("Solo administración y dirección pueden cambiar la configuración del club.")}</div>;
  }

  const set = (patch) => { setNote(""); setDraft((d) => ({ ...d, ...patch })); };
  const setColor = (k, v) => set({ colors: { ...draft.colors, [k]: v } });
  const setFont = (role, f) => set({ fonts: { ...draft.fonts, [`${role}Name`]: f.name, [`${role}Kind`]: f.kind, [`${role}Url`]: f.url || "" } });
  const setSocial = (k, v) => set({ social: { ...draft.social, [k]: v } });

  const save = async () => {
    setSaving(true);
    setNote("");
    try {
      const { brand } = await base44.club.saveBrand(diff);
      storeBrand(brand);
      setSaved(brand);
      setNote(t("Guardado. Recargando la app con el aspecto nuevo…"));
      try { window.sessionStorage.removeItem("rs_brand_draft"); } catch { /* sin almacenamiento */ }
      setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      setNote(t("No se ha podido guardar.") + " " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };
  const discard = () => { setNote(""); setDraft(fullBrand(saved || {})); };

  return (
    <Page testId="club-settings">
      <TopBar title={t("Configuración")} tabs={TABS.map((x) => ({ ...x, label: t(x.label) }))} active={tab} onTab={setTab} />
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "14px 24px 120px" }}>
        <p style={{ fontSize: 13, color: RS.ink2, marginBottom: 12, maxWidth: 820 }}>
          {t("Aquí se cambia el aspecto de la app: nombre, escudo, colores, tipografías, patrones de página y modo de color. Los cambios se ven antes de guardarlos y se pueden probar en toda la app sin que nadie más los vea.")}
        </p>
        {loadError && <div style={{ fontSize: 13, color: "#B91C1C", marginBottom: 10 }}>{t("No se ha podido leer la configuración guardada.")}</div>}

        {tab === "patrones" && <PatternEditor draft={draft} set={set} />}
        {tab === "estructura" && <StructureEditor draft={draft} set={set} />}
        {tab === "modo" && <ThemeBackup draft={draft} set={set} replace={(b) => { setNote(""); setDraft(b); }} />}
        {!["patrones", "estructura", "modo"].includes(tab) && (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_440px]" style={{ gap: 16, alignItems: "start" }}>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {tab === "identidad" && (
              <>
                <Card title={t("Nombres")}>
                  <FieldRow label={t("Nombre de la app")} help={t("Sale en el menú, en la pantalla de acceso y en la pestaña del navegador.")}>
                    <input value={draft.appName} maxLength={40} onChange={(e) => set({ appName: e.target.value })} style={{ ...inputStyle, maxWidth: 320 }} data-testid="cfg-appname" />
                  </FieldRow>
                  <FieldRow label={t("Nombre del club")} help={t("Sale en las hojas impresas, en los PDF y en algunos títulos.")}>
                    <input value={draft.clubName} maxLength={40} onChange={(e) => set({ clubName: e.target.value })} style={{ ...inputStyle, maxWidth: 320 }} data-testid="cfg-clubname" />
                  </FieldRow>
                </Card>
                <Card title={t("Escudo e imágenes")}>
                  <FieldRow label={t("Escudo")} help={t("Para fondos claros. Mejor PNG con fondo transparente.")}>
                    <ImageField value={draft.logo} onChange={(v) => set({ logo: v || BRAND.logo })} testId="cfg-logo" />
                  </FieldRow>
                  <FieldRow label={t("Escudo para fondos oscuros")} help={t("Normalmente, el escudo en blanco. Sale en el menú lateral.")}>
                    <div style={{ "--cfg-dark": draft.colors.primary }}>
                      <ImageField value={draft.logoWhite} onChange={(v) => set({ logoWhite: v || BRAND.logoWhite })} dark testId="cfg-logo-white" />
                    </div>
                  </FieldRow>
                  <FieldRow label={t("Icono de la app")} help={t("Para el móvil cuando se instala la app. PNG cuadrado de 512 × 512. Sin icono, el de siempre.")}>
                    <ImageField value={draft.icon} onChange={(v) => set({ icon: v })} accept="image/png" removable testId="cfg-icon" />
                  </FieldRow>
                  <FieldRow label={t("Imagen de la pantalla de acceso")} help={t("Opcional. Una foto de fondo detrás del recuadro para entrar.")}>
                    <ImageField value={draft.loginImage} onChange={(v) => set({ loginImage: v })} accept="image/png,image/jpeg,image/webp" removable wide testId="cfg-login-image" />
                  </FieldRow>
                </Card>
                <Card title={t("Web y redes sociales")}>
                  <FieldRow label={t("Web del club")} help={t("Dirección completa, empezando por https://")}>
                    <input value={draft.web} onChange={(e) => set({ web: e.target.value })} onBlur={(e) => set({ web: withScheme(e.target.value) })} placeholder="https://" style={{ ...inputStyle, maxWidth: 420 }} data-testid="cfg-web" />
                  </FieldRow>
                  {SOCIAL_KEYS.map((k) => (
                    <FieldRow key={k} label={SOCIAL_LABEL[k]}>
                      <input value={draft.social[k]} onChange={(e) => setSocial(k, e.target.value)} onBlur={(e) => setSocial(k, withScheme(e.target.value))} placeholder="https://" style={{ ...inputStyle, maxWidth: 420 }} data-testid={`cfg-social-${k}`} />
                    </FieldRow>
                  ))}
                  <p style={{ fontSize: 12, color: RS.muted, paddingTop: 8 }}>{t("Si hay alguna, salen como enlaces debajo de la pantalla de acceso.")}</p>
                </Card>
              </>
            )}

            {tab === "colores" && (
              <Card title={t("Colores del club")} action={
                <Btn kind="ghost" testId="cfg-derive" onClick={() => set({ colors: { ...draft.colors, ...deriveTones(draft.colors.primary, draft.colors.accent) } })}>
                  {t("Calcular los tonos a partir del principal y el acento")}
                </Btn>
              }>
                {COLOR_ROWS.map((r) => (
                  <FieldRow key={r.key} label={t(r.label)} help={t(r.help)} testId={`cfg-color-row-${r.key}`}>
                    <ColorField value={draft.colors[r.key]} onChange={(v) => setColor(r.key, v)} testId={`cfg-color-${r.key}`} />
                  </FieldRow>
                ))}
                {warnings.length > 0 && (
                  <div style={{ marginTop: 10, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "8px 12px" }} data-testid="cfg-color-warnings">
                    {warnings.map((w) => <div key={w.key} style={{ fontSize: 12, color: "#9A3412" }}>⚠ {t(w.text)}</div>)}
                  </div>
                )}
              </Card>
            )}

            {tab === "tipografias" && (
              <Card title={t("Tipografías")}>
                {FONT_ROWS.map((r) => (
                  <FieldRow key={r.role} label={t(r.label)} help={t(r.help)}>
                    <FontField value={fontOf(draft, r.role)} onChange={(f) => setFont(r.role, f)} sample={r.sample} testId={`cfg-font-${r.role}`} />
                  </FieldRow>
                ))}
                <p style={{ fontSize: 12, color: RS.muted, paddingTop: 8 }}>
                  {t("Las hojas impresas, los PDF y la pizarra usan sus propias tipografías.")}
                </p>
              </Card>
            )}
          </div>

          <div className="xl:sticky" style={{ top: 12 }}>
            <Card title={t("Vista previa")}>
              <BrandPreview brand={draft} />
            </Card>
          </div>
        </div>
        )}
      </div>

      {/* Barra de guardar */}
      <div className="fixed bottom-0 right-0 left-0 lg:left-40 z-30" style={{ background: "#fff", borderTop: `1px solid ${RS.line}`, boxShadow: "0 -2px 10px rgba(0,0,0,.05)" }} data-testid="cfg-bar">
        <div className="flex flex-wrap items-center" style={{ maxWidth: 1360, margin: "0 auto", padding: "10px 24px", gap: 10 }}>
          <span style={{ fontSize: 13, color: dirty ? RS.granate : RS.muted, fontWeight: dirty ? 600 : 400, flex: 1, minWidth: 180 }} data-testid="cfg-status">
            {note || (brandDraftActive ? t("Estás probando un aspecto sin guardar.") : dirty ? t("Hay cambios sin guardar.") : t("Sin cambios."))}
          </span>
          {brandDraftActive && <Btn kind="ghost" onClick={endBrandDraft} testId="cfg-end-try">{t("Salir de la prueba")}</Btn>}
          <Btn kind="ghost" onClick={discard} disabled={!dirty || saving} testId="cfg-discard">{t("Descartar cambios")}</Btn>
          <Btn kind="outline" onClick={() => startBrandDraft(diff)} disabled={saving} testId="cfg-try">{t("Probar en toda la app")}</Btn>
          <Btn onClick={save} disabled={!dirty || saving} testId="cfg-save">{saving ? t("Guardando…") : t("Guardar")}</Btn>
        </div>
      </div>
    </Page>
  );
}
