import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bell } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Avisos recibidos por esta persona
export default function Inbox() {
  const { data = [], isLoading } = useQuery({ queryKey: ["inbox"], queryFn: () => base44.club.inbox(), refetchInterval: 60000 });
  if (isLoading) return null;
  if (data.length === 0) {
    return <div className="bg-white border border-gray-200 rounded-xl p-8 text-center"><Bell className="w-6 h-6 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">Todavía no has recibido avisos.</p></div>;
  }
  return (
    <div className="space-y-2">
      {data.map((n) => (
        <div key={n.id} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-bold text-sm text-gray-900">{n.title}</p>
            <p className="text-[10px] text-gray-400 shrink-0">{format(new Date(n.created_date), "d MMM · HH:mm", { locale: es })}</p>
          </div>
          <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{n.body}</p>
          {n.sender_name && <p className="text-[10px] text-gray-400 mt-2">De {n.sender_name}</p>}
        </div>
      ))}
    </div>
  );
}
