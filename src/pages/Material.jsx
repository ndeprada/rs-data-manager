import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, ArrowLeftRight, AlertTriangle, Shirt } from "lucide-react";
import MaterialInventoryTab from "@/components/material/MaterialInventoryTab";
import MaterialAssignmentsTab from "@/components/material/MaterialAssignmentsTab";
import MaterialIncidencesTab from "@/components/material/MaterialIncidencesTab";
import KitLoansTab from "@/components/material/KitLoansTab";

const TABS = [
  { id: "inventario", label: "Inventario", icon: Package },
  { id: "asignaciones", label: "Asignaciones", icon: ArrowLeftRight },
  { id: "incidencias", label: "Incidencias", icon: AlertTriangle },
  { id: "equipaciones", label: "Equipaciones", icon: Shirt },
];

export default function Material() {
  const [activeTab, setActiveTab] = useState("inventario");

  const { data: openIncidences = [] } = useQuery({
    queryKey: ["material_incidences_open"],
    queryFn: () => base44.entities.MaterialIncidence.filter({ status: "abierta" }),
  });

  const { data: activeLoans = [] } = useQuery({
    queryKey: ["kit_loans_active"],
    queryFn: () => base44.entities.KitLoan.filter({ status: "prestado" }),
  });

  const badges = {
    incidencias: openIncidences.length,
    equipaciones: activeLoans.length,
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Cabecera */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Club</p>
        <h1 className="text-3xl font-black leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Material</h1>
        <p className="text-xs text-gray-400 mt-1">Inventario, asignaciones, incidencias y control de equipaciones</p>
      </div>

      {/* Pestañas */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const badge = badges[tab.id];
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap rounded-lg border transition-colors ${
                active ? "text-white" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
              style={active ? { background: "var(--granate)", borderColor: "var(--granate)" } : undefined}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {badge > 0 && (
                <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-bold leading-none ${
                  tab.id === "incidencias" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === "inventario" && <MaterialInventoryTab />}
      {activeTab === "asignaciones" && <MaterialAssignmentsTab />}
      {activeTab === "incidencias" && <MaterialIncidencesTab />}
      {activeTab === "equipaciones" && <KitLoansTab />}
    </div>
  );
}