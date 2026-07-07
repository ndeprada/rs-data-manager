import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

const POSITIVE_WORDS = ["excelente", "sobresaliente", "muy bueno", "destaca", "gran", "bueno", "buen", "notable", "alto nivel", "superior", "muy bien", "destacado", "potente", "fuerte", "rápido", "veloz", "ágil", "preciso", "técnico", "habilidoso", "inteligente", "líder", "comprometido", "constante", "disciplinado"];
const NEGATIVE_WORDS = ["mejorar", "debe mejorar", "falta", "le falta", "deficiente", "bajo", "insuficiente", "irregular", "poco", "débil", "lento", "torpe", "mal", "dificultad", "le cuesta", "necesita mejorar"];
const BASE = 52;

function scoreFromText(text) {
  if (!text?.trim()) return null;
  let score = BASE;
  const lower = text.toLowerCase();
  POSITIVE_WORDS.forEach(w => { if (lower.includes(w)) score += 5; });
  NEGATIVE_WORDS.forEach(w => { if (lower.includes(w)) score -= 6; });
  return Math.max(15, Math.min(96, score));
}

function deriveAttributes(pdi) {
  if (!pdi) {
    return [
      { label: "Técnica",    value: 50, key: "tec" },
      { label: "Velocidad",  value: 50, key: "vel" },
      { label: "Físico",     value: 50, key: "fis" },
      { label: "Mentalidad", value: 50, key: "men" },
      { label: "Ataque",     value: 50, key: "ata" },
      { label: "Defensa",    value: 50, key: "def" },
    ];
  }

  const techScore = scoreFromText(pdi.technical) ?? BASE;
  const physScore = scoreFromText(pdi.physical)   ?? BASE;
  const mentScore = scoreFromText(pdi.mental)     ?? BASE;
  const combined  = `${pdi.tactical || ""} ${pdi.technical || ""}`.toLowerCase();

  const attackKw  = ["gol", "disparo", "tiro", "ataque", "ofensivo", "llegada", "delantera", "finalización", "asistencia", "presión alta"];
  const defenseKw = ["defensa", "defensivo", "recuperación", "marcaje", "solidez", "orden defensivo", "cobertura", "anticipación"];
  let ata = BASE, def = BASE;
  attackKw.forEach(w  => { if (combined.includes(w)) ata += 6; });
  defenseKw.forEach(w => { if (combined.includes(w)) def += 6; });
  NEGATIVE_WORDS.forEach(w => { if (combined.includes(w)) { ata -= 4; def -= 4; } });

  let vel = physScore;
  const physLow = (pdi.physical || "").toLowerCase();
  if (["veloz","rápido","velocidad","sprint","explosivo"].some(w => physLow.includes(w))) vel = Math.min(96, vel + 10);
  if (["lento","lentitud"].some(w => physLow.includes(w))) vel = Math.max(15, vel - 12);

  return [
    { label: "Técnica",    value: techScore,                     key: "tec" },
    { label: "Velocidad",  value: Math.max(15, Math.min(96,vel)),key: "vel" },
    { label: "Físico",     value: physScore,                     key: "fis" },
    { label: "Mentalidad", value: mentScore,                     key: "men" },
    { label: "Ataque",     value: Math.max(15, Math.min(96,ata)),key: "ata" },
    { label: "Defensa",    value: Math.max(15, Math.min(96,def)),key: "def" },
  ];
}

// FIFA-style circular stat
function StatCircle({ label, value }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const fill = circ - (circ * value) / 100;

  const color = value >= 75 ? "#16a34a"
    : value >= 60 ? "#6b1f28"
    : value >= 45 ? "#ea580c"
    : "#dc2626";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
          <circle cx="30" cy="30" r={r} fill="none" stroke="#f0f0f0" strokeWidth="5" />
          <circle
            cx="30" cy="30" r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={circ}
            strokeDashoffset={fill}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-gray-800" style={{ color }}>
          {value}
        </span>
      </div>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide text-center leading-tight">{label}</span>
    </div>
  );
}

export default function PlayerAttributesBar({ playerId }) {
  const { data: pdiList = [] } = useQuery({
    queryKey: ["pdi", playerId],
    queryFn: () => base44.entities.PDI.filter({ player_id: playerId }, "-date"),
  });

  const latestPDI = pdiList[0] ?? null;
  const attributes = useMemo(() => deriveAttributes(latestPDI), [latestPDI]);
  const fromPDI = !!latestPDI;
  const overall = Math.round(attributes.reduce((s, a) => s + a.value, 0) / attributes.length);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-gray-900">Atributos</span>
          {/* Overall badge */}
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-sm font-black text-white shadow-sm" style={{ background: "linear-gradient(135deg, #6b1f28, #3d0d13)" }}>
            {overall}
          </span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
          background: fromPDI ? "#f0fdf4" : "#f3f4f6",
          color: fromPDI ? "#16a34a" : "#9ca3af"
        }}>
          {fromPDI
            ? `PDI · ${latestPDI.period || new Date(latestPDI.date).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}`
            : "Sin evaluación PDI"}
        </span>
      </div>

      {/* Circles grid */}
      <div className="px-5 py-5 grid grid-cols-3 sm:grid-cols-6 gap-4 justify-items-center">
        {attributes.map(attr => (
          <StatCircle key={attr.key} label={attr.label} value={attr.value} />
        ))}
      </div>

      {!fromPDI && (
        <p className="text-center text-[10px] text-gray-400 pb-3 -mt-2">
          Crea una evaluación PDI para generar atributos personalizados
        </p>
      )}
    </div>
  );
}