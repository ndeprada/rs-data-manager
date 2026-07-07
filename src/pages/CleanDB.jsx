import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CleanDB() {
  const [progress, setProgress] = useState({ entity: "", message: "Iniciando limpieza..." });
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);

  const runCleanup = async () => {
    try {
      setResults([]);
      setError(null);
      setIsComplete(false);

      // 1. Delete all Teams
      setProgress({ entity: "Teams", message: "Eliminando todos los Teams..." });
      const teams = await base44.entities.Team.filter({});
      let teamsDeleted = 0;
      for (const team of teams) {
        await base44.entities.Team.delete(team.id);
        teamsDeleted++;
      }
      setResults(prev => [...prev, { entity: "Teams", deletedCount: teamsDeleted, status: "success" }]);

      // 2. Delete all Players
      setProgress({ entity: "Players", message: "Eliminando todos los Players..." });
      const players = await base44.entities.Player.filter({});
      let playersDeleted = 0;
      for (const player of players) {
        await base44.entities.Player.delete(player.id);
        playersDeleted++;
      }
      setResults(prev => [...prev, { entity: "Players", deletedCount: playersDeleted, status: "success" }]);

      // 3. Delete all Events
      setProgress({ entity: "Events", message: "Eliminando todos los Events..." });
      const events = await base44.entities.Event.filter({});
      let eventsDeleted = 0;
      for (const event of events) {
        await base44.entities.Event.delete(event.id);
        eventsDeleted++;
      }
      setResults(prev => [...prev, { entity: "Events", deletedCount: eventsDeleted, status: "success" }]);

      // 4. Delete all StaffMembers
      setProgress({ entity: "StaffMembers", message: "Eliminando todos los StaffMembers..." });
      const staff = await base44.entities.StaffMember.filter({});
      let staffDeleted = 0;
      for (const s of staff) {
        await base44.entities.StaffMember.delete(s.id);
        staffDeleted++;
      }
      setResults(prev => [...prev, { entity: "StaffMembers", deletedCount: staffDeleted, status: "success" }]);

      // 5. Delete all MatchStats
      setProgress({ entity: "MatchStats", message: "Eliminando todos los MatchStats..." });
      const matchStats = await base44.entities.MatchStats.filter({});
      let matchStatsDeleted = 0;
      for (const ms of matchStats) {
        await base44.entities.MatchStats.delete(ms.id);
        matchStatsDeleted++;
      }
      setResults(prev => [...prev, { entity: "MatchStats", deletedCount: matchStatsDeleted, status: "success" }]);

      setProgress({ entity: "", message: "¡Limpieza completada!" });
      setIsComplete(true);
    } catch (err) {
      setError("Error durante la limpieza: " + err.message);
    }
  };

  useEffect(() => {
    runCleanup();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Mantenimiento</p>
        <h1>Limpieza de Duplicados</h1>
        <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Eliminación automática de registros duplicados</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {["Teams", "Players", "Events", "StaffMembers", "MatchStats"].map((item) => {
          const result = results.find(r => r.entity === item);
          const isActive = progress.entity === item;
          return (
            <div key={item} className={`rounded-lg p-4 border ${
              isActive ? "bg-blue-50 border-blue-200" : 
              result ? "bg-green-50 border-green-200" : 
              "bg-white border-gray-200"
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded flex items-center justify-center text-white text-sm font-black shrink-0 ${
                  result ? "bg-green-500" : isActive ? "bg-blue-500" : "bg-gray-300"
                }`}>
                  {result ? <CheckCircle className="w-4 h-4" /> : isActive ? <Loader2 className="w-4 h-4 animate-spin" /> : "✓"}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{item}</p>
                  {result && <p className="text-xs text-green-600 mt-1">{result.deletedCount} registros eliminados</p>}
                  {!result && <p className="text-xs text-gray-500 mt-1">Pendiente</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isComplete && !error && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto" style={{ color: "var(--granate)" }} />
          <p className="font-semibold text-gray-900">{progress.message}</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${(results.length / 5) * 100}%`, background: "var(--granate)" }}
            />
          </div>
        </div>
      )}

      {isComplete && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="font-bold text-lg text-green-900">¡Limpieza Completada!</p>
            <p className="text-green-700 mt-2">Se eliminaron {results.reduce((sum, r) => sum + r.deletedCount, 0)} registros en total</p>
          </div>

          <div className="grid gap-3">
            {results.map((r) => (
              <div key={r.entity} className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                <p className="font-semibold text-gray-900">{r.entity}</p>
                <p className="text-sm font-bold text-orange-600">
                  {r.deletedCount} eliminados
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setIsComplete(false);
              setResults([]);
              setProgress({ entity: "", message: "Iniciando limpieza..." });
              setError(null);
              runCleanup();
            }}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold hover:bg-gray-50 transition-colors"
          >
            Ejecutar nuevamente
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex gap-3">
          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}