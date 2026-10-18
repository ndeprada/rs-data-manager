import React from "react";
import { cn } from "@/lib/utils";

/** Mensaje estándar cuando una lista o sección no tiene datos. */
export default function EmptyState({ icon: Icon, title, hint, children, className }) {
  return (
    <div className={cn("text-center py-10 px-4 text-gray-400", className)}>
      {Icon && <Icon className="w-9 h-9 mx-auto mb-2 text-gray-300" />}
      {title && <p className="text-sm font-medium text-gray-500">{title}</p>}
      {hint && <p className="text-xs mt-1">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
