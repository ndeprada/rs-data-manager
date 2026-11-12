// Campos de la página Configuración: imagen (subir/quitar), color y tipografía.
import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useT, msg } from "@/i18n";
import { BUILTIN_FONTS, GOOGLE_FONT_SUGGESTIONS } from "@/lib/brand";
import { loadFont } from "@/lib/applyBrand";
import { RS } from "@/components/rs2/kit";

export const inputStyle = { height: 34, border: `1px solid ${RS.input}`, borderRadius: 8, padding: "0 10px", fontSize: 13, background: "#fff", width: "100%" };
const smallBtn = { height: 30, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${RS.input}`, background: "#fff", color: RS.ink2, whiteSpace: "nowrap" };

export function FieldRow({ label, help, children, testId }) {
  return (
    <div className="grid md:grid-cols-[220px_minmax(0,1fr)]" style={{ gap: "4px 16px", padding: "10px 0", borderTop: `1px solid ${RS.lineSoft}` }} data-testid={testId}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: RS.ink }}>{label}</div>
        {help && <div style={{ fontSize: 12, color: RS.muted, marginTop: 2 }}>{help}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// Subida de archivos a /api/upload (imágenes y tipografías)
export function useUpload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file) => {
    setBusy(true);
    setError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return file_url;
    } catch (e) {
      setError(e?.message || "error");
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { upload, busy, error };
}

export function ImageField({ value, onChange, accept = "image/png,image/jpeg,image/webp,image/svg+xml", dark = false, removable = false, wide = false, testId }) {
  const t = useT();
  const input = useRef(null);
  const { upload, busy, error } = useUpload();
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = await upload(f);
    if (url) onChange(url);
  };
  return (
    <div className="flex flex-wrap items-center" style={{ gap: 10 }} data-testid={testId}>
      <div className="flex items-center justify-center" style={{ width: wide ? 120 : 56, height: 56, borderRadius: 10, border: `1px solid ${RS.line}`, background: dark ? "var(--cfg-dark, #36000D)" : "#fff", overflow: "hidden" }}>
        {value ? <img src={value} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: wide ? "cover" : "contain", width: wide ? "100%" : undefined, height: wide ? "100%" : undefined }} /> : <span style={{ fontSize: 11, color: RS.faint }}>{t("Sin imagen")}</span>}
      </div>
      <button type="button" style={smallBtn} onClick={() => input.current?.click()} disabled={busy} data-testid={testId && `${testId}-upload`}>
        {busy ? t("Subiendo…") : value ? t("Cambiar") : t("Subir")}
      </button>
      {removable && value && (
        <button type="button" style={smallBtn} onClick={() => onChange("")} data-testid={testId && `${testId}-remove`}>{t("Quitar")}</button>
      )}
      <input ref={input} type="file" accept={accept} className="hidden" onChange={pick} />
      {error && <span style={{ fontSize: 12, color: "#B91C1C" }}>{t("No se ha podido subir el archivo.")} {error}</span>}
    </div>
  );
}

export function ColorField({ value, onChange, testId }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = (v) => {
    const h = v.trim().startsWith("#") ? v.trim() : `#${v.trim()}`;
    if (/^#[0-9a-fA-F]{6}$/.test(h)) onChange(h.toUpperCase());
    else setText(value);
  };
  return (
    <div className="flex items-center" style={{ gap: 8 }} data-testid={testId}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())}
        style={{ width: 40, height: 34, border: `1px solid ${RS.input}`, borderRadius: 8, padding: 2, background: "#fff", cursor: "pointer" }} aria-label={value} />
      <input value={text} onChange={(e) => setText(e.target.value)} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit(e.currentTarget.value)}
        style={{ ...inputStyle, width: 110, fontFamily: "ui-monospace, monospace" }} data-testid={testId && `${testId}-hex`} />
    </div>
  );
}

const KINDS = [
  { value: "builtin", label: msg("De la app") },
  { value: "google", label: msg("Google Fonts") },
  { value: "file", label: msg("Subir archivo") },
];

// Tipografía de un papel (títulos, textos o números): { name, kind, url }
export function FontField({ value, onChange, sample, testId }) {
  const t = useT();
  const input = useRef(null);
  const { upload, busy, error } = useUpload();
  const [gName, setGName] = useState(value.kind === "google" ? value.name : "");
  useEffect(() => { if (value.kind === "google") setGName(value.name); }, [value.kind, value.name]);
  useEffect(() => { loadFont(value, `preview-${testId}`); }, [value, testId]);
  const setKind = (kind) => {
    if (kind === value.kind) return;
    if (kind === "builtin") onChange({ name: BUILTIN_FONTS[1].name, kind, url: BUILTIN_FONTS[1].url });
    else if (kind === "google") onChange({ name: gName || GOOGLE_FONT_SUGGESTIONS[0], kind, url: "" });
    else input.current?.click();
  };
  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = await upload(f);
    if (!url) return;
    const name = f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/[^\p{L}\p{N} ]/gu, "").trim().slice(0, 50) || "Tipografía del club";
    onChange({ name, kind: "file", url });
  };
  return (
    <div className="flex flex-col" style={{ gap: 8 }} data-testid={testId}>
      <div className="flex flex-wrap" style={{ gap: 6 }}>
        {KINDS.map((k) => (
          <button key={k.value} type="button" onClick={() => setKind(k.value)} data-testid={`${testId}-kind-${k.value}`}
            style={{ ...smallBtn, ...(value.kind === k.value ? { background: RS.granate, color: "#fff", borderColor: RS.granate } : {}) }}>
            {k.value === "file" && busy ? t("Subiendo…") : t(k.label)}
          </button>
        ))}
        <input ref={input} type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" className="hidden" onChange={pickFile} />
      </div>
      {value.kind === "builtin" && (
        <select value={value.name} onChange={(e) => { const f = BUILTIN_FONTS.find((x) => x.name === e.target.value); onChange({ name: f.name, kind: "builtin", url: f.url }); }}
          style={{ ...inputStyle, maxWidth: 320 }} data-testid={`${testId}-builtin`}>
          {BUILTIN_FONTS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
        </select>
      )}
      {value.kind === "google" && (
        <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
          <input list={`${testId}-gf`} value={gName} onChange={(e) => setGName(e.target.value)}
            onBlur={() => gName.trim() && onChange({ name: gName.trim(), kind: "google", url: "" })}
            onKeyDown={(e) => e.key === "Enter" && gName.trim() && onChange({ name: gName.trim(), kind: "google", url: "" })}
            placeholder="Oswald" style={{ ...inputStyle, maxWidth: 260 }} data-testid={`${testId}-google`} />
          <datalist id={`${testId}-gf`}>{GOOGLE_FONT_SUGGESTIONS.map((n) => <option key={n} value={n} />)}</datalist>
          <span style={{ fontSize: 12, color: RS.muted }}>{t("Escribe el nombre tal como sale en fonts.google.com")}</span>
        </div>
      )}
      {value.kind === "file" && (
        <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
          <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} style={{ ...inputStyle, maxWidth: 260 }} data-testid={`${testId}-filename`} aria-label={t("Nombre de la tipografía")} />
          <button type="button" style={smallBtn} onClick={() => input.current?.click()} disabled={busy}>{busy ? t("Subiendo…") : t("Cambiar archivo")}</button>
        </div>
      )}
      {error && <span style={{ fontSize: 12, color: "#B91C1C" }}>{t("No se ha podido subir el archivo.")} {error}</span>}
      <div style={{ fontFamily: `'${value.name}', sans-serif`, fontSize: 22, color: RS.ink, lineHeight: 1.15, padding: "6px 10px", border: `1px dashed ${RS.line}`, borderRadius: 8, background: "#fff" }} data-testid={`${testId}-sample`}>
        {sample}
      </div>
    </div>
  );
}
