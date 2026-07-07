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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Material Deportivo</h1>
        <p className="text-sm text-gray-500 mt-0.5">Inventario, asignaciones, incidencias y control de equipaciones</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const badge = badges[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors relative ${
                activeTab === tab.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {badge > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold leading-none ${
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