import React, { useState } from "react";
import { Star, Pencil, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

function skillColor(value) {
  if (!value) return "#e5e7eb";
  if (value <= 3) return "#ef4444";
  if (value <= 5) return "#f97316";
  if (value <= 7) return "#eab308";
  return "#22c55e";
}

function SkillRow({ label, value, editing, onChange }) {
  const color = skillColor(value);
  const pct = value ? `${value * 10}%` : "0%";
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-36 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: pct, background: color }} />
      </div>
      {editing ? (
        <input
          type="number" min="0" max="10" step="1"
          value={value || 0}
          onChange={e => onChange(Math.min(10, Math.max(0, Number(e.target.value))))}
          className="w-14 text-center border border-gray-300 rounded-lg text-sm font-bold py-0.5 focus:outline-none focus:ring-1"
          style={{ color }}
        />
      ) : (
        <span className="w-12 text-center text-sm font-bold shrink-0" style={{ color }}>
          {value || 0}<span className="text-gray-400 font-normal text-xs">/10</span>
        </span>
      )}
    </div>
  );
}

function StarPicker({ value, onChange, readOnly }) {
  const [hover, setHover] = useState(0);
  return (
    <div className={`flex gap-1.5 ${readOnly ? "" : "cursor-pointer"}`}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange(i)}
          onMouseEnter={() => !readOnly && setHover(i)}
          onMouseLeave={() => !readOnly && setHover(0)}
          className="focus:outline-none disabled:cursor-default"
        >
          <Star
            className={`w-7 h-7 transition-all duration-150 ${
              i <= (hover || value)
                ? "fill-yellow-400 text-yellow-400 drop-shadow-sm"
                : "text-gray-200"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

const SKILL_GROUPS = [
  {
    title: "Habilidades Generales",
    skills: [
      { key: "skill_technical", label: "Habilidad Técnica" },
      { key: "skill_physical",  label: "Condición Física" },
      { key: "skill_tactical",  label: "Capacidad Táctica" },
      { key: "skill_mental",    label: "Aspectos Mentales" },
    ],
  },
  {
    title: "Habilidades de Juego",
    skills: [
      { key: "skill_attack",  label: "Juego en Ataque" },
      { key: "skill_defense", label: "Juego en Defensa" },
    ],
  },
];

const TAG_CATEGORIES = [
  {
    key: "ataque",
    label: "Ataque",
    activeClass: "bg-orange-500 text-white border-orange-500",
    inactiveClass: "bg-white text-orange-600 border-orange-300 hover:bg-orange-50",
    headerClass: "text-orange-600",
  },
  {
    key: "defensa",
    label: "Defensa",
    activeClass: "bg-blue-600 text-white border-blue-600",
    inactiveClass: "bg-white text-blue-600 border-blue-300 hover:bg-blue-50",
    headerClass: "text-blue-600",
  },
  {
    key: "mental_fisico",
    label: "Mental / Físico",
    activeClass: "bg-green-600 text-white border-green-600",
    inactiveClass: "bg-white text-green-700 border-green-300 hover:bg-green-50",
    headerClass: "text-green-700",
  },
  {
    key: "portero",
    label: "Portero",
    activeClass: "bg-yellow-500 text-white border-yellow-500",
    inactiveClass: "bg-white text-yellow-700 border-yellow-300 hover:bg-yellow-50",
    headerClass: "text-yellow-700",
  },
];

export default function PlayerAttributesPanel({ player }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [activeTags, setActiveTags] = useState(player.tags || []);

  // Load all scouting tags
  const { data: allTags = [] } = useQuery({
    queryKey: ["scouting_tags"],
    queryFn: () => base44.entities.ScoutingTag.list(),
  });

  const tagsByCategory = TAG_CATEGORIES.reduce((acc, cat) => {
    acc[cat.key] = allTags.filter(t => t.category === cat.key);
    return acc;
  }, {});

  const startEdit = () => {
    setDraft({
      skill_technical: player.skill_technical || 0,
      skill_physical:  player.skill_physical  || 0,
      skill_tactical:  player.skill_tactical  || 0,
      skill_mental:    player.skill_mental    || 0,
      skill_attack:    player.skill_attack    || 0,
      skill_defense:   player.skill_defense   || 0,
      rating:          player.rating          || 0,
    });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.ScoutedPlayer.update(player.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouted_players"] });
      setEditing(false);
      toast({ title: "Atributos guardados correctamente." });
    },
    onError: (err) => toast({ title: "Error al guardar", description: err.message, variant: "destructive" }),
  });

  const tagMutation = useMutation({
    mutationFn: (newTags) => base44.entities.ScoutedPlayer.update(player.id, { tags: newTags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouted_players"] });
    },
    onError: (err) => toast({ title: "Error al guardar tag", description: err.message, variant: "destructive" }),
  });

  const handleSave = () => saveMutation.mutate(draft);
  const set = (key, val) => setDraft(d => ({ ...d, [key]: val }));

  const toggleTag = (tagName) => {
    const newTags = activeTags.includes(tagName)
      ? activeTags.filter(t => t !== tagName)
      : [...activeTags, tagName];
    setActiveTags(newTags);
    tagMutation.mutate(newTags);
  };

  const vals = editing ? draft : player;
  const skills = [vals.skill_technical, vals.skill_physical, vals.skill_tactical, vals.skill_mental, vals.skill_attack, vals.skill_defense].filter(Boolean);
  const avgSkill = skills.length ? (skills.reduce((a, b) => a + b, 0) / skills.length).toFixed(1) : null;

  const isGoalkeeper = player.position === "portero";

  return (
    <div className="space-y-5">
      {/* Header: valoración global */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
            Valoración Global
          </p>
          <div className="flex items-center gap-3">
            <StarPicker
              value={editing ? draft.rating : (player.rating || 0)}
              onChange={v => editing && set("rating", v)}
              readOnly={!editing}
            />
            {(player.rating > 0 || editing) && (
              <span className="text-lg font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                {editing ? draft.rating : player.rating}/5
              </span>
            )}
            {avgSkill && (
              <span className="text-xs text-gray-400 ml-2">Media habilidades: <span className="font-bold text-gray-600">{avgSkill}/10</span></span>
            )}
          </div>
        </div>
        {!editing ? (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-400 transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={cancelEdit} className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              size="sm"
              className="text-white"
              style={{ background: "var(--granate)" }}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              {saveMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        )}
      </div>

      {/* Skill groups */}
      {SKILL_GROUPS.map(group => (
        <div key={group.title} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
            {group.title}
          </p>
          {group.skills.map(({ key, label }) => (
            <SkillRow
              key={key}
              label={label}
              value={vals[key] || 0}
              editing={editing}
              onChange={v => set(key, v)}
            />
          ))}
        </div>
      ))}

      {/* Mini summary grid */}
      {!editing && skills.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {SKILL_GROUPS.flatMap(g => g.skills).map(({ key, label }) => {
            const v = player[key] || 0;
            const color = skillColor(v);
            return (
              <div key={key} className="text-center bg-white border border-gray-100 rounded-xl py-3 px-2 shadow-sm">
                <div className="text-2xl font-black leading-none mb-1" style={{ fontFamily: "var(--font-display)", color }}>
                  {v || "—"}
                </div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {label.split(" ").slice(-1)[0]}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tags by category */}
      {allTags.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
            Características del Jugador
          </p>
          {TAG_CATEGORIES.filter(cat => cat.key !== "portero" || isGoalkeeper).map(cat => {
            const tags = tagsByCategory[cat.key] || [];
            if (tags.length === 0) return null;
            return (
              <div key={cat.key} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${cat.headerClass}`} style={{ fontFamily: "var(--font-display)" }}>
                  {cat.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => {
                    const isActive = activeTags.includes(tag.name);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.name)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-150 ${isActive ? cat.activeClass : cat.inactiveClass}`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}