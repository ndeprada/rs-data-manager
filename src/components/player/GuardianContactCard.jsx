import React, { useState } from "react";
import { Phone, Mail, User, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const RELATIONSHIP_LABELS = {
  padre: "Padre",
  madre: "Madre",
  tutor: "Tutor",
  otro: "Contacto",
};

export default function GuardianContactCard({ player }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const hasGuardian = player.guardian_name || player.guardian_phone || player.guardian_email;
  if (!hasGuardian) return null;

  const relationship = RELATIONSHIP_LABELS[player.guardian_relationship] || "Tutor legal";

  const handleEmail = async () => {
    if (!player.guardian_email) return;
    setSending(true);
    await base44.integrations.Core.SendEmail({
      to: player.guardian_email,
      subject: `Contacto sobre ${player.first_name} ${player.last_name}`,
      body: `Estimado/a ${player.guardian_name || "tutor/a"},\n\nNos ponemos en contacto con usted en relación a ${player.first_name} ${player.last_name}.\n\nQuedamos a su disposición.\n\nUn saludo,\nRS Data Manager`,
    });
    setSending(false);
    toast({ title: "Email enviado", description: `Se ha enviado un email a ${player.guardian_email}` });
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm" style={{ borderRadius: "4px", borderTop: "3px solid var(--naranja)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--naranja-pale)" }}>
            <User className="w-4 h-4" style={{ color: "var(--naranja)" }} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm" style={{ fontFamily: "var(--font-display)" }}>
              {player.guardian_name || "Tutor legal"}
            </p>
            <p className="text-xs text-gray-400">{relationship}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {player.guardian_phone && (
            <a
              href={`tel:${player.guardian_phone}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded text-white transition-opacity hover:opacity-80"
              style={{ background: "var(--granate)" }}
            >
              <Phone className="w-3 h-3" /> Llamar
            </a>
          )}
          {player.guardian_email && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 border-gray-200"
              onClick={(e) => { e.stopPropagation(); handleEmail(); }}
              disabled={sending}
            >
              <Mail className="w-3 h-3 mr-1" />
              {sending ? "Enviando..." : "Email"}
            </Button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-100 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          {player.guardian_name && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Nombre</p>
              <p className="font-medium text-gray-800">{player.guardian_name}</p>
            </div>
          )}
          {player.guardian_phone && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Teléfono</p>
              <a href={`tel:${player.guardian_phone}`} className="font-medium hover:underline" style={{ color: "var(--granate)" }}>
                {player.guardian_phone}
              </a>
            </div>
          )}
          {player.guardian_email && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Email</p>
              <a href={`mailto:${player.guardian_email}`} className="font-medium hover:underline" style={{ color: "var(--granate)" }}>
                {player.guardian_email}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}