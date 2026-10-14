import React from "react";
import { Link } from "react-router-dom";
import { playerFullName } from "@/lib/playerName";

// Nombre de jugador que lleva a su ficha. Úsalo allí donde se muestre un nombre.
export default function PlayerName({ player, id, children, className = "", stop = true, format = "first" }) {
  const pid = id || player?.id;
  const label = children ?? (player
    ? playerFullName(player)
    : "");
  if (!pid) return <span className={className}>{label}</span>;
  return (
    <Link
      to={`/PlayerProfile?id=${pid}`}
      onClick={stop ? (e) => e.stopPropagation() : undefined}
      className={`hover:underline hover:text-[#6b1f28] transition-colors ${className}`}
    >
      {label}
    </Link>
  );
}
