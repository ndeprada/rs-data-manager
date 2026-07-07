import React from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, parseISO, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { es } from "date-fns/locale";

export default function AttendanceChart({ attendance }) {
  const last6Months = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date(),
  });

  const data = last6Months.map((month) => {
    const monthStr = format(month, "yyyy-MM");
    const monthRecords = attendance.filter((a) => a.date && a.date.startsWith(monthStr));
    const total = monthRecords.length;
    const present = monthRecords.filter((a) => a.status === "present" || (!a.status && a.attended !== false)).length;
    const apart = monthRecords.filter((a) => a.status === "apart").length;
    const absent = monthRecords.filter((a) => a.status === "absent" || (!a.status && a.attended === false)).length;
    const pct = total > 0 ? Math.round(((present + apart) / total) * 100) : 0;

    return {
      month: format(month, "MMM", { locale: es }),
      present,
      apart,
      absent,
      pct,
      total,
    };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-sm">
        <p className="font-semibold text-gray-900 capitalize mb-1">{label}</p>
        <p className="text-green-600">Presentes: {d.present}</p>
        <p className="text-blue-600">A parte: {d.apart}</p>
        <p className="text-red-500">Ausentes: {d.absent}</p>
        <p className="text-gray-700 font-medium mt-1">Asistencia: {d.pct}%</p>
      </div>
    );
  };

  const avgPct = data.filter((d) => d.total > 0).reduce((acc, d) => acc + d.pct, 0) /
    (data.filter((d) => d.total > 0).length || 1);

  return (
    <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl uppercase tracking-wide text-gray-900" style={{ fontFamily: "var(--font-display)" }}>Asistencia a Entrenamientos</h2>
          <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Últimos 6 meses</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold" style={{ color: "var(--granate)" }}>{Math.round(avgPct)}%</p>
          <p className="text-xs text-gray-400">media</p>
        </div>
      </div>
      <div className="p-5">
        <div className="flex gap-4 mb-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block"></span>Presente</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block"></span>A parte</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block"></span>Ausente</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} barSize={18} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar yAxisId="left" dataKey="present" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
            <Bar yAxisId="left" dataKey="apart" stackId="a" fill="#60a5fa" />
            <Bar yAxisId="left" dataKey="absent" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="pct" stroke="var(--naranja)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Media de asistencia" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}