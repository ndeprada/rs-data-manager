import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SessionSheet, { PAGE_H, PAGE_W } from "./SessionSheet";
import { downloadSessionPdf } from "./sessionPdf";

// Imprimir: las mismas hojas A4 de la vista previa, fuera de la app (en <body>), una por página y sin márgenes
// (la hoja ya lleva los suyos). Se imprime en vectorial: sale tan nítido como en pantalla.
export function usePrintSession() {
  const [job, setJob] = useState(null);
  const print = (props) => setJob(props);
  useEffect(() => {
    if (!job) return undefined;
    document.body.classList.add("printing-session");
    const done = () => { document.body.classList.remove("printing-session"); setJob(null); };
    window.addEventListener("afterprint", done, { once: true });
    // da tiempo a repartir las hojas y a cargar el escudo y las letras
    const t = setTimeout(async () => {
      try { if (document.fonts?.ready) await document.fonts.ready; window.print(); } catch { done(); }
    }, 900);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", done); document.body.classList.remove("printing-session"); };
  }, [job]);
  const portal = job ? createPortal(<div className="session-print-root"><SessionSheet {...job} /></div>, document.body) : null;
  return { print, portal };
}

// Nombre del archivo: «Sesion Infantil S14 A 2026-11-03.pdf»
const pdfName = (team, session) => `Sesion ${team?.name || ""} ${session?.date || ""}`.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() + ".pdf";

/** Vista previa de la hoja tal como se imprime (hojas A4), con Imprimir y Descargar PDF. */
export default function SessionPreview({ open, onOpenChange, startPdf = false, session, team, players, matchRef, pdiGoals = [], ownerName = "" }) {
  const wrap = useRef(null);
  const sheets = useRef(null);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const { print, portal } = usePrintSession();
  const { toast } = useToast();
  const sheetProps = { session, team, players, matchRef, pdiGoals, ownerName };

  useLayoutEffect(() => {
    if (!open) return undefined;
    const fit = () => {
      const w = wrap.current?.clientWidth;
      if (w) setScale(Math.min(1.2, (w - 24) / PAGE_W));
    };
    const t = setTimeout(fit, 30);
    window.addEventListener("resize", fit);
    return () => { clearTimeout(t); window.removeEventListener("resize", fit); };
  }, [open]);

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const nodes = [...(sheets.current?.querySelectorAll(".session-page") || [])];
      // se fotografían sin la reducción de la vista previa
      const prev = sheets.current.style.transform;
      sheets.current.style.transform = "none";
      try { await downloadSessionPdf(nodes, pdfName(team, session)); } finally { sheets.current.style.transform = prev; }
    } catch (e) {
      toast({ title: "No se pudo crear el PDF", description: String(e?.message || e), variant: "destructive" });
    }
    setBusy(false);
  };

  // «Descargar PDF» desde el editor: se abre la vista previa y se descarga en cuanto las hojas están repartidas
  const started = useRef(false);
  useEffect(() => {
    if (!open) { started.current = false; return undefined; }
    if (!startPdf || started.current) return undefined;
    const t = setTimeout(() => { started.current = true; downloadPdf(); }, 1200);
    return () => clearTimeout(t);
  }, [open, startPdf]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white max-w-4xl w-[96vw] max-h-[94vh] overflow-hidden flex flex-col p-0 gap-0" data-testid="session-preview">
          <DialogHeader className="p-4 pb-2 shrink-0 flex-row items-start justify-between gap-3 space-y-0">
            <div className="min-w-0">
              <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Hoja de la sesión</DialogTitle>
              <DialogDescription className="text-xs">Así sale en papel: {pageCount === 1 ? "1 hoja" : `${pageCount} hojas`} A4. Ninguna tarea se parte entre dos hojas.</DialogDescription>
            </div>
            <div className="flex gap-2 shrink-0 mr-6">
              <Button variant="outline" size="sm" onClick={() => print(sheetProps)} data-testid="session-print"><Printer className="w-4 h-4 mr-1.5" /> Imprimir</Button>
              <Button variant="club" size="sm" disabled={busy} onClick={downloadPdf} data-testid="session-pdf">
                <Download className="w-4 h-4 mr-1.5" /> {busy ? "Creando PDF…" : "Descargar PDF"}
              </Button>
            </div>
          </DialogHeader>
          <div ref={wrap} className="flex-1 overflow-auto bg-gray-200 p-3">
            <div style={{ width: PAGE_W * scale, height: (pageCount * PAGE_H + (pageCount - 1) * 16) * scale, margin: "0 auto", position: "relative" }}>
              <div ref={sheets} style={{ position: "absolute", top: 0, left: 0, width: PAGE_W, transform: `scale(${scale})`, transformOrigin: "top left", display: "flex", flexDirection: "column", gap: 16 }}>
                {open && <SessionSheet {...sheetProps} onPages={setPageCount} />}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {portal}
    </>
  );
}
