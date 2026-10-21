import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GOAL_PHASES, GOAL_AREAS, GOAL_SECTORS, SP_TYPES, SP_HOW, CREATE_ORG, CREATE_TRANS, FINISHES } from "@/lib/goalTypes";
import { useT } from "@/i18n";

// Clasificación de un gol: fase de juego + (zona y sector) o (tipo de balón parado, cómo y lado)
function Field({ label, value, onChange, options, placeholder = "—", w = "w-36" }) {
  const t = useT();
  return (
    <div>
      <p className="text-[10px] text-gray-400 mb-1">{label}</p>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className={`h-8 ${w} text-xs border-gray-200 bg-white`}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{placeholder}</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function GoalClassifier({ value = {}, onChange }) {
  const t = useT();
  const set = (patch) => onChange({ ...value, ...patch });
  const bp = value.phase === "balon_parado";
  const normal = value.phase === "ataque_organizado" || value.phase === "transicion";
  return (
    <>
      <Field label={t("Tipo de gol")} value={value.phase} onChange={(v) => set({ phase: v, create: "", ...(v === "balon_parado" ? { area: "" } : { sp: "", how: "" }) })} options={GOAL_PHASES} placeholder={t("Tipo…")} w="w-40" />
      {normal && (
        <>
          <Field label={t("Cómo se creó")} value={value.create} onChange={(v) => set({ create: v })} options={value.phase === "transicion" ? CREATE_TRANS : CREATE_ORG} w="w-48" />
          <Field label={t("Zona")} value={value.area} onChange={(v) => set({ area: v })} options={GOAL_AREAS} w="w-36" />
          <Field label={t("Sector")} value={value.sector} onChange={(v) => set({ sector: v })} options={GOAL_SECTORS} w="w-28" />
        </>
      )}
      {bp && (
        <>
          <Field label={t("Balón parado")} value={value.sp} onChange={(v) => set({ sp: v })} options={SP_TYPES} w="w-36" />
          {value.sp !== "penalti" && (
            <>
              <Field label={t("Cómo")} value={value.how} onChange={(v) => set({ how: v })} options={SP_HOW} w="w-36" />
              <Field label={t("Lado / zona")} value={value.sector} onChange={(v) => set({ sector: v })} options={GOAL_SECTORS} w="w-28" />
            </>
          )}
        </>
      )}
      {(normal || (bp && value.sp !== "penalti")) && (
        <Field label={t("Remate")} value={value.finish} onChange={(v) => set({ finish: v })} options={FINISHES} w="w-44" />
      )}
    </>
  );
}
