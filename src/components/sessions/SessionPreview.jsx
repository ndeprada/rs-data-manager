import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { downloadSessionPdf } from "./sessionPdf";
import { useToast } from "@/components/ui/use-toast";
import SessionSheet from "./SessionSheet";

// Imprime la ficha: se monta fuera de la app (en <body>) y una hoja de estilos de impresión oculta todo lo demás.
// A4 con márgenes de 7 mm arriba y abajo
const PAGE_H_MM = 297 - 14 - 4; // 4 mm de margen de seguridad
const MIN_FIT = 0.6; // por debajo de este tamaño es mejor repartir la ficha en dos hojas

export function usePrintSession() {
  const [job, setJob] = useState(null);
  const print = (props) => setJob(props);
  useEffect(() => {
    if (!job) return undefined;
    document.body.classList.add("printing-session");
    const done = () => { document.body.classList.remove("printing-session"); setJob(null); };
    window.addEventListener("afterprint", done, { once: true });
    // Da tiempo a pintar la ficha y a cargar el escudo; si es más alta que una hoja A4, se reduce lo justo para que quepa
    const t = setTimeout(() => {
      try {
        const root = document.querySelector(".session-print-root");
        const sheet = root?.firstElementChild;
        if (root && sheet) {
          root.style.cssText = "display:block;position:absolute;left:-10000px;top:0;visibility:hidden";
          const h = sheet.scrollHeight;
          root.style.cssText = "";
          const avail = PAGE_H_MM * (96 / 25.4);
          const k = h > avail ? avail / h : 1;
          sheet.style.zoom = k >= MIN_FIT ? String(Math.floor(k * 1000) / 1000) : "1";
        }
        window.print();
      } catch { done(); }
    }, 600);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", done); document.body.classList.remove("printing-session"); };
  }, [job]);
  const portal = job ? createPortal(<div className="session-print-root"><SessionSheet {...job} /></div>, document.body) : null;
  return { print, portal };
}

const SHEET_W_MM = 194;
const MM = 96 / 25.4; // px por mm en pantalla

/** Vista previa de la ficha (A4) ajustada al ancho disponible, con botón de imprimir / guardar PDF. */
// Nombre del archivo: «Sesion Infantil S14 A 2026-11-03.pdf»
const pdfName = (team, session) => `Sesion ${team?.name || ""} ${session?.date || ""}`.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() + ".pdf";

export default function SessionPreview({ open, onOpenChange, session, team, players, matchRef, pdiGoals = [], ownerName = "" }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const hidden = useRef(null);
  useEffect(() => {
    if (!job) return undefined;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const node = hidden.current?.firstElementChild;
        if (node) await downloadSessionPdf(node, pdfName(team, session));
      } catch (e) {
        toast({ title: "No se pudo crear el PDF", description: String(e?.message || e), variant: "destructive" });
      } finally {
        if (alive) { setJob(null); setBusy(false); }
      }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [job]);
  const sheetProps = { session, team, players, matchRef, pdiGoals, ownerName };
  const wrap = useRef(null);
  const [scale, setScale] = useState(1);
  const { print, portal } = usePrintSession();

  useLayoutEffect(() => {
    if (!open) return undefined;
    const fit = () => {
      const w = wrap.current?.clientWidth;
      if (w) setScale(Math.min(1.25, (w - 8) / (SHEET_W_MM * MM)));
    };
    const t = setTimeout(fit, 30);
    window.addEventListener("resize", fit);
    return () => { clearTimeout(t); window.removeEventListener("resize", fit); };
  }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white max-w-4xl w-[96vw] max-h-[94vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-2 shrink-0 flex-row items-start justify-between gap-3 space-y-0">
            <div className="min-w-0">
              <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Ficha de la sesión</DialogTitle>
              <DialogDescription className="text-xs">Así sale en A4 vertical. «Descargar PDF» la reparte en una o dos hojas sin cortar ninguna tarea por la mitad.</DialogDescription>
            </div>
            <div className="flex gap-2 shrink-0 mr-6">
              <Button variant="outline" size="sm" onClick={() => print(sheetProps)}><Printer className="w-4 h-4 mr-1.5" /> Imprimir</Button>
              <Button variant="club" size="sm" disabled={busy} onClick={() => { setBusy(true); setJob(Date.now()); }} data-testid="session-pdf">
                <Download className="w-4 h-4 mr-1.5" /> {busy ? "Creando PDF…" : "Descargar PDF"}
              </Button>
            </div>
          </DialogHeader>
          <div ref={wrap} className="flex-1 overflow-auto bg-gray-100 p-2">
            <div style={{ width: SHEET_W_MM * MM * scale, margin: "0 auto" }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: `${SHEET_W_MM}mm`, boxShadow: "0 1px 6px rgba(0,0,0,.18)" }}>
                <div style={{ padding: "0" }}><SessionSheet {...sheetProps} /></div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {portal}
      {job && createPortal(<div ref={hidden} aria-hidden="true" style={{ position: "fixed", left: "-12000px", top: 0, width: "194mm", background: "#fff" }}><SessionSheet {...sheetProps} /></div>, document.body)}
    </>
  );
}
