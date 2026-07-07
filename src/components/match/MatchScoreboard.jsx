import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Shield } from "lucide-react";

/**
 * Muestra el marcador con los escudos de ambos equipos.
 * El escudo de nuestro equipo viene del campo team.logo_url.
 * El escudo del rival se puede subir y se guarda en event.opponent_logo_url.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FOOTBALL_FORMATS = [
  { value: "f11", label: "Fútbol 11" },
  { value: "f7", label: "Fútbol 7" },
];
const MATCH_DURATIONS = [
  { value: "90", label: "90' — Juveniles" },
  { value: "80", label: "80' — Cadetes" },
  { value: "70", label: "70' — Infantiles" },
  { value: "4x15", label: "4×15' — Alevines/Benjamines" },
  { value: "4x12", label: "4×12' — Prebenjamines" },
];

export default function MatchScoreboard({ event, team, homeGoals, awayGoals, resultLabel, resultColor, eventId, matchData, setMatchData }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const isHome = event?.is_home !== false; // default true

  const handleToggleHome = async () => {
    await base44.entities.Event.update(eventId, { is_home: !isHome });
    queryClient.invalidateQueries({ queryKey: ["event", eventId] });
  };

  const handleUploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Event.update(eventId, { opponent_logo_url: file_url });
    queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    setUploading(false);
  };

  const ShieldPlaceholder = ({ label, onClick, uploading }) => (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 border-dashed border-white/30 hover:border-white/60 transition-colors text-white/40 hover:text-white/70"
      title="Subir escudo del rival"
    >
      {uploading ? (
        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          <Upload className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] uppercase tracking-wide leading-tight text-center">Subir<br/>escudo</span>
        </>
      )}
    </button>
  );

  return (
    <div className="rounded-xl p-5 text-white flex flex-col gap-3" style={{ background: "var(--granate)" }}>
      {/* Local/Visitante toggle */}
      <div className="flex justify-center">
        <button
          onClick={handleToggleHome}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-white/30 hover:border-white/60 transition-colors"
          title="Cambiar condición de local/visitante"
        >
          <span className={isHome ? "text-white" : "text-white/40"}>LOCAL</span>
          <span className="text-white/30 mx-1">|</span>
          <span className={!isHome ? "text-white" : "text-white/40"}>VISITANTE</span>
        </button>
      </div>

      {/* Formato / Duración */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Formato</p>
          <Select value={matchData?.football_format||event?.football_format||""} onValueChange={v=>setMatchData(prev=>({...prev,football_format:v}))}>
            <SelectTrigger className="h-7 text-xs border-white/20 bg-white/10 text-white focus:ring-white/30 [&>svg]:text-white/50"><SelectValue placeholder="Formato…"/></SelectTrigger>
            <SelectContent>{FOOTBALL_FORMATS.map(f=><SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Duración</p>
          <Select value={matchData?.match_duration||event?.match_duration||""} onValueChange={v=>setMatchData(prev=>({...prev,match_duration:v}))}>
            <SelectTrigger className="h-7 text-xs border-white/20 bg-white/10 text-white focus:ring-white/30 [&>svg]:text-white/50"><SelectValue placeholder="Duración…"/></SelectTrigger>
            <SelectContent>{MATCH_DURATIONS.map(d=><SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* Our team block */}
        {(() => {
          const ourBlock = (
            <div className="flex-1 flex flex-col items-center gap-2">
              <img
                src={team?.logo_url || "https://media.base44.com/images/public/69b72e4f23c3602504953d0d/442c01da9_Escudo_Granate.png"}
                alt={team?.name || "Club"}
                className="w-14 h-14 object-contain drop-shadow"
                style={{ filter: team?.logo_url ? "none" : "brightness(0) invert(1)" }}
              />
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 text-center leading-tight">
                {team?.name || "Nuestro equipo"}
              </p>
              <p className="text-5xl font-bold leading-none" style={{ fontFamily: "var(--font-display)" }}>
                {homeGoals}
              </p>
            </div>
          );

          const rivalBlock = (
            <div className="flex-1 flex flex-col items-center gap-2">
              {event?.opponent_logo_url ? (
                <div className="relative group cursor-pointer w-14 h-14 shrink-0" onClick={() => fileInputRef.current?.click()}>
                  <img src={event.opponent_logo_url} alt="Rival" className="w-14 h-14 object-contain drop-shadow" />
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                </div>
              ) : (
                <ShieldPlaceholder uploading={uploading} onClick={() => fileInputRef.current?.click()} />
              )}
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 text-center leading-tight">
                {event?.opponent || "Rival"}
              </p>
              <p className="text-5xl font-bold leading-none" style={{ fontFamily: "var(--font-display)" }}>
                {awayGoals}
              </p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} />
            </div>
          );

          const center = (
            <div className="text-center shrink-0">
              <div className="text-3xl font-bold text-white/30 mb-1" style={{ fontFamily: "var(--font-display)" }}>–</div>
              {(homeGoals !== 0 || awayGoals !== 0) && (
                <div className={`text-[10px] font-bold uppercase tracking-widest ${resultColor}`}>
                  {resultLabel}
                </div>
              )}
            </div>
          );

          return isHome
            ? <>{ourBlock}{center}{rivalBlock}</>
            : <>{rivalBlock}{center}{ourBlock}</>;
        })()}
      </div>
    </div>
  );
}