import React from "react";

const styles = {
  granate: { accent: "var(--granate)", iconBg: "var(--granate-pale)", iconColor: "var(--granate)" },
  naranja: { accent: "var(--naranja)", iconBg: "var(--naranja-pale)", iconColor: "var(--naranja)" },
  blue: { accent: "#2563eb", iconBg: "#eff6ff", iconColor: "#2563eb" },
  slate: { accent: "#475569", iconBg: "#f1f5f9", iconColor: "#475569" },
};

export default function StatCard({ title, value, icon: Icon, color = "granate" }) {
  const s = styles[color] || styles.granate;

  return (
    <div className="bg-white border border-gray-200 p-5 shadow-sm" style={{ borderRadius: "4px", borderTop: `3px solid ${s.accent}` }}>
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-bold uppercase tracking-widest text-gray-500"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </span>
        <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: s.iconBg }}>
          <Icon className="w-4 h-4" style={{ color: s.iconColor }} />
        </div>
      </div>
      <p
        className="text-4xl font-black tracking-tight"
        style={{ fontFamily: "var(--font-display)", color: s.accent }}
      >
        {value}
      </p>
    </div>
  );
}