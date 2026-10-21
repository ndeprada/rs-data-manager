import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, ArrowLeftRight, AlertTriangle, Shirt } from "lucide-react";
import MaterialInventoryTab from "@/components/material/MaterialInventoryTab";
import MaterialAssignmentsTab from "@/components/material/MaterialAssignmentsTab";
import MaterialIncidencesTab from "@/components/material/MaterialIncidencesTab";
import KitLoansTab from "@/components/material/KitLoansTab";

import { PageTitle } from "@/components/common/PageHeader";
import TabBar from "@/components/common/TabBar";
import { useT, msg } from "@/i18n";
const TABS = [
  { id: "inventario", label: msg("Inventario"), icon: Package },
  { id: "asignaciones", label: msg("Asignaciones"), icon: ArrowLeftRight },
  { id: "incidencias", label: msg("Incidencias"), icon: AlertTriangle },
  { id: "equipaciones", label: msg("Equipaciones"), icon: Shirt },
];

export default function Material() {
  const t = useT();
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
    <div className="space-y-4">
      {/* Cabecera */}
      <PageTitle kicker={t("Club")} title={t("Material")} subtitle={t("Inventario, asignaciones, incidencias y control de equipaciones")} />

      {/* Pestañas */}
      <TabBar
        value={activeTab}
        onChange={setActiveTab}
        items={TABS.map((t) => ({
          value: t.id, label: t.label, icon: t.icon, badge: badges[t.id],
          badgeClass: t.id === "incidencias" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700",
        }))}
      />

      {/* Content */}
      {activeTab === "inventario" && <MaterialInventoryTab />}
      {activeTab === "asignaciones" && <MaterialAssignmentsTab />}
      {activeTab === "incidencias" && <MaterialIncidencesTab />}
      {activeTab === "equipaciones" && <KitLoansTab />}
    </div>
  );
}