// Sesiones de entrenamiento: currículum por etapas, tipos de sesión y de tarea, fases del juego y cómputo del tiempo.
// Fuente: TFM de Nacho de Prada (Área de Metodología), apartados 4.6 (microciclos y sesiones tipo), 4.7 (método y tipos de tarea)
// y 4.8 (porcentajes por bloque, prioridades de contenidos y registro de lo trabajado).
// Sin importaciones de la app: se usa también en los tests.

// ── Etapas ───────────────────────────────────────────────────────────────────
export const STAGES = [
  { id: "inic1", label: "Iniciación I", teams: "S8–S9" },
  { id: "inic2", label: "Iniciación II", teams: "S10–S11" },
  { id: "des1", label: "Desarrollo I", teams: "S12–S13" },
  { id: "des2", label: "Desarrollo II", teams: "S14–S15" },
  { id: "perf", label: "Perfeccionamiento", teams: "S16–Juvenil B" },
  { id: "rend", label: "Rendimiento", teams: "Juvenil A – Primer Equipo" },
];
export const stageInfo = (id) => STAGES.find((s) => s.id === id) || null;

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// Etapa que corresponde a un equipo por su nombre (null si no se reconoce: se elige a mano en la sesión)
export function stageOfTeamName(name) {
  const n = norm(name);
  if (!n) return null;
  if (n.startsWith("primer equipo")) return "rend";
  if (/^juvenil a\b/.test(n)) return "rend";
  if (n.startsWith("juvenil")) return "perf";
  if (/^cadet s16\b/.test(n)) return "perf";
  if (/^cadet s15\b/.test(n)) return "des2";
  if (/^infantil s14\b/.test(n)) return "des2";
  if (/^infantil s13\b/.test(n)) return "des1";
  if (/^alevi s12\b/.test(n)) return "des1";
  if (/^alevi s11\b/.test(n)) return "inic2";
  if (/^benjami s10\b/.test(n)) return "inic2";
  if (/^benjami s9\b/.test(n)) return "inic1";
  if (n.startsWith("prebenjami") || n.startsWith("escuela")) return "inic1";
  return null;
}

// ── Bloques de contenido y porcentaje de referencia por etapa (TFM 4.8.4) ───────
export const BLOCKS = [
  { id: "tecnica", label: "Técnica", short: "Técnica", color: "#0891b2" },
  { id: "habitos", label: "Hábitos de juego", short: "Hábitos", color: "#7c3aed" },
  { id: "fi_of", label: "Fundamentos individuales ofensivos", short: "Fund. ind. ofensivos", color: "#2563eb" },
  { id: "fi_def", label: "Fundamentos individuales defensivos", short: "Fund. ind. defensivos", color: "#dc2626" },
  { id: "oc_of", label: "Organización colectiva ofensiva", short: "Org. colectiva of.", color: "#1d4ed8" },
  { id: "oc_def", label: "Organización colectiva defensiva", short: "Org. colectiva def.", color: "#b91c1c" },
  { id: "cc_of", label: "Comportamientos colectivos ofensivos", short: "Comport. colect. of.", color: "#0ea5e9" },
  { id: "cc_def", label: "Comportamientos colectivos defensivos", short: "Comport. colect. def.", color: "#ef4444" },
  { id: "abp", label: "Balón parado (específico)", short: "Balón parado", color: "#d97706" },
];
export const blockInfo = (id) => BLOCKS.find((b) => b.id === id) || null;

//                      inic1 inic2 des1 des2 perf rend
const TARGETS = {
  tecnica: [25, 20, 10, 10, 5, 5],
  habitos: [15, 15, 5, 5, 5, 5],
  fi_of: [25, 25, 25, 25, 15, 15],
  fi_def: [10, 10, 15, 15, 10, 10],
  oc_of: [10, 15, 20, 20, 25, 25],
  oc_def: [5, 5, 10, 10, 20, 20],
  cc_of: [5, 5, 10, 10, 10, 10],
  cc_def: [5, 5, 5, 5, 5, 5],
  abp: [0, 0, 0, 0, 5, 5],
};
export const targetPct = (block, stage) => {
  const i = STAGES.findIndex((s) => s.id === stage);
  return i < 0 || !TARGETS[block] ? 0 : TARGETS[block][i];
};

// ── Contenidos y prioridad (alta / media / baja) por bloque y etapa (TFM 4.8.7 a 4.8.9) ─────────
// Cada bloque: { A: [...alta], M: [...media], B: [...baja] } por etapa. El nombre sirve de identificador (con el bloque delante).
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
export const contentId = (block, name) => `${block}.${slug(name)}`;

const TEC_BASE_LOW = ["Dejar correr el balón", "Saque de banda"];
const HAB_BASE = {
  A: ["Mirar antes y después de recibir", "Jugar de costado"],
};
const ABP = {
  A: ["Córner ofensivo", "Córner defensivo", "Falta lateral defensiva", "Saque de banda ofensivo"],
  M: ["Falta lateral ofensiva", "Saque de banda defensivo"],
  B: ["Falta frontal ofensiva", "Falta frontal defensiva", "Saque de centro", "Penaltis"],
};

const FI_OF_INIC = { A: ["Dar opción de pase", "Desmarque de apoyo", "Desmarque en profundidad"], M: ["Doy y voy", "Doy y estoy"], B: [] };
const FI_OF_DES = { A: FI_OF_INIC.A, M: ["Doy y voy", "Doy y estoy", "Recibir entre líneas"], B: [] };
const FI_OF_ELITE = { A: FI_OF_INIC.A, M: ["Doy y voy", "Doy y estoy", "Recibir entre líneas"], B: [] };
const OC_OF_INIC = { A: ["Ocupación racional del terreno", "Superioridades numéricas"], M: ["Pared", "Doblada", "Pasillo"], B: ["Desdoblamiento"] };
const OC_OF_DES = { A: ["Ocupación racional del terreno", "Doblada", "Pasillo"], M: ["Superioridades numéricas", "Tercer hombre", "Pared"], B: ["Desdoblamiento"] };
const FI_DEF_INIC = { A: ["Marcaje", "Presión"], M: [], B: [] };
const FI_DEF_INIC2 = { A: ["Marcaje", "Presión"], M: ["Anticipación", "Interceptación"], B: [] };
const FI_DEF_DES = { A: ["Marcaje", "Presión"], M: ["Anticipación", "Interceptación", "Defensa de la pared"], B: [] };
const CC_DEF_INIC = { A: ["Juego en bloque"], M: ["Defender para atacar"], B: [] };
const CC_DEF_ELITE = { A: ["Juego en bloque", "Defender para atacar"], M: [], B: [] };
const HAB_INIC = { ...HAB_BASE, M: ["Movimientos del fútbol"], B: ["Jugar en movimiento", "No demostrar el pase", "Sacar rápido"] };
const HAB_DES = { ...HAB_BASE, M: ["Comunicación", "Jugar en movimiento", "Usar el cuerpo"], B: ["Pasar donde va el compañero", "No demostrar el pase", "Sacar rápido"] };
const HAB_ELITE = { A: [...HAB_BASE.A, "Comunicación"], M: ["Jugar en movimiento", "Usar el cuerpo"], B: ["Pasar donde va el compañero", "No demostrar el pase", "Sacar rápido"] };

const CURRICULUM = {
  inic1: {
    tecnica: { A: ["Controles orientados", "Pases", "Conducción", "Regate"], M: ["Tiro", "Recepción girada", "Entrada"], B: ["Dejar correr el balón", "Saque de banda", "Cobertura de balón"] },
    habitos: HAB_INIC,
    fi_of: FI_OF_INIC,
    fi_def: FI_DEF_INIC,
    oc_of: OC_OF_INIC,
    oc_def: { A: ["Colocación racional", "Coberturas"], M: ["Repliegue"], B: [] },
    cc_of: { A: ["Juego en bloque", "Atacan cuatro y cierran dos"], M: ["Ocupar las zonas de remate"], B: [] },
    cc_def: CC_DEF_INIC,
    abp: { A: [], M: [], B: [] },
  },
  inic2: {
    tecnica: { A: ["Controles orientados", "Pases", "Conducción", "Regate con finta", "Entrada"], M: ["Recepción girada", "Tiro", "Juego de cabeza sin oposición"], B: ["Dejar correr el balón", "Saque de banda", "Cobertura de balón"] },
    habitos: HAB_INIC,
    fi_of: FI_OF_INIC,
    fi_def: FI_DEF_INIC2,
    oc_of: OC_OF_INIC,
    oc_def: { A: ["Colocación racional", "Coberturas", "Presión colectiva"], M: ["Permutas de posición", "Repliegue", "Defensa del área"], B: ["Desdoblamiento", "No dejar mi marca por otra"] },
    cc_of: { A: ["Juego en bloque", "Atacan cuatro y cierran dos", "Vigilancias ofensivas"], M: ["Cambios de orientación", "Ocupar las zonas de remate", "Robar, asegurar y alejar"], B: [] },
    cc_def: CC_DEF_INIC,
    abp: { A: [], M: [], B: [] },
  },
  des1: {
    tecnica: { A: ["Controles orientados", "Pases", "Conducción", "Regate con finta", "Entrada", "Tiro"], M: ["Recepción girada", "Juego de cabeza con poca oposición"], B: ["Dejar correr el balón", "Saque de banda", "Cobertura de balón"] },
    habitos: HAB_DES,
    fi_of: FI_OF_DES,
    fi_def: FI_DEF_DES,
    oc_of: OC_OF_DES,
    oc_def: { A: ["Colocación racional", "Coberturas", "Presión colectiva", "Defensa del área", "Presión tras pérdida", "Repliegue"], M: ["Permutas de posición", "Función del libre"], B: ["Desdoblamiento", "No dejar mi marca por otra"] },
    cc_of: { A: ["Juego en bloque", "Robar, asegurar y alejar"], M: ["Cambios de orientación", "Ocupar las zonas de remate"], B: ["Vigilancias ofensivas"] },
    cc_def: CC_DEF_INIC,
    abp: { A: [], M: [], B: [] },
  },
  des2: {
    tecnica: { A: ["Controles orientados", "Pases", "Conducción", "Regate con finta", "Entrada", "Tiro"], M: ["Recepción girada", "Juego de cabeza con oposición"], B: ["Dejar correr el balón", "Saque de banda", "Cobertura de balón"] },
    habitos: { ...HAB_DES },
    fi_of: FI_OF_DES,
    fi_def: FI_DEF_DES,
    oc_of: OC_OF_DES,
    oc_def: { A: ["Colocación racional", "Coberturas", "Presión colectiva", "Defensa del área", "Presión tras pérdida"], M: ["Permutas de posición", "Función del libre", "Balón presionado / no presionado", "Repliegue"], B: ["Desdoblamiento", "No dejar mi marca por otra"] },
    cc_of: { A: ["Juego en bloque", "Robar, asegurar y alejar"], M: ["Cambios de orientación", "Ocupar las zonas de remate", "Primer pase hacia delante tras robo"], B: ["Vigilancias ofensivas"] },
    cc_def: CC_DEF_INIC,
    abp: { A: [], M: [], B: [] },
  },
};
const ELITE = {
  tecnica: { A: ["Controles orientados", "Pases", "Conducción", "Regate con finta", "Entrada", "Tiro", "Juego de cabeza con oposición"], M: ["Recepción girada", "Cobertura de balón"], B: TEC_BASE_LOW },
  habitos: HAB_ELITE,
  fi_of: FI_OF_ELITE,
  fi_def: FI_DEF_DES,
  oc_of: { ...OC_OF_DES },
  oc_def: { A: ["Colocación racional", "Coberturas", "Permutas de posición", "Presión colectiva", "Defensa del área", "Presión tras pérdida"], M: ["Función del libre", "Balón presionado / no presionado", "Repliegue"], B: ["Desdoblamiento", "No dejar mi marca por otra"] },
  cc_of: { A: ["Juego en bloque", "Robar, asegurar y alejar"], M: ["Cambios de orientación", "Ocupar las zonas de remate", "Primer pase hacia delante tras robo", "Vigilancias ofensivas"], B: [] },
  cc_def: CC_DEF_ELITE,
  abp: ABP,
};
CURRICULUM.perf = ELITE;
// Rendimiento: igual que Perfeccionamiento salvo en técnica (la conducción pasa a prioridad media)
CURRICULUM.rend = {
  ...ELITE,
  tecnica: { A: ["Controles orientados", "Pases", "Regate con finta", "Entrada", "Tiro", "Juego de cabeza con oposición"], M: ["Recepción girada", "Conducción", "Cobertura de balón"], B: TEC_BASE_LOW },
};

export const PRIORITY = {
  A: { label: "Alta", short: "A", color: "#16a34a", bg: "#dcfce7" },
  M: { label: "Media", short: "M", color: "#d97706", bg: "#fef3c7" },
  B: { label: "Baja", short: "B", color: "#6b7280", bg: "#f3f4f6" },
};

// Contenidos de una etapa: [{ id, name, block, priority }] en orden de bloque y prioridad
export function stageContents(stage) {
  const cur = CURRICULUM[stage];
  if (!cur) return [];
  const out = [];
  for (const b of BLOCKS) {
    const lv = cur[b.id];
    if (!lv) continue;
    for (const p of ["A", "M", "B"]) for (const name of lv[p] || []) out.push({ id: contentId(b.id, name), name, block: b.id, priority: p });
  }
  return out;
}

// Todos los contenidos de todas las etapas (para poder mostrar lo registrado aunque la etapa se cambie después)
const ALL = new Map();
for (const s of STAGES) for (const c of stageContents(s.id)) if (!ALL.has(c.id)) ALL.set(c.id, { id: c.id, name: c.name, block: c.block });
export const contentInfo = (id) => ALL.get(id) || null;
export const contentName = (id) => ALL.get(id)?.name || id;
export const contentBlock = (id) => ALL.get(id)?.block || null;

export function priorityOf(stage, id) {
  return stageContents(stage).find((c) => c.id === id)?.priority || null;
}

// ── Tipos de sesión (TFM 4.6) ─────────────────────────────────────────────────
// «Tensión», «Duración» y «Velocidad» son los nombres que usa el club para las tres sesiones de adquisición.
export const SESSION_TYPES = [
  { id: "fundamentos", label: "Tensión", full: "Fundamentos individuales", color: "#dc2626", hint: "Técnica, hábitos y fundamentos individuales. Espacios reducidos y mucha repetición." },
  { id: "juego_colectivo", label: "Duración", full: "Juego colectivo", color: "#16a34a", hint: "Sistema de juego y organización colectiva. Espacios grandes y series largas." },
  { id: "optimizacion", label: "Velocidad", full: "Optimización", color: "#2563eb", hint: "Contextualiza lo trabajado para la competición. Series muy cortas de máxima intensidad." },
  { id: "compensatoria", label: "Compensatoria", full: "Compensatoria", color: "#7c3aed", hint: "Perfeccionamiento y Rendimiento: recuperación y compensación según los minutos del partido." },
  { id: "prepartido", label: "Prepartido", full: "Prepartido", color: "#d97706", hint: "Rendimiento (seis días entre partidos): repaso del plan de partido con carga muy baja." },
];
export const sessionTypeInfo = (id) => SESSION_TYPES.find((t) => t.id === id) || null;

// El tipo de sesión NO depende del día de la semana (decisión de Nacho): lo elige siempre el entrenador.

// ── Tipos de tarea (TFM 4.7.3) ────────────────────────────────────────────────
export const TASK_TYPES = [
  { id: "circuito_tecnico", label: "Circuito técnico", group: "Individual" },
  { id: "analitica", label: "Tarea analítica (figuras de pase, parejas…)", group: "Individual" },
  { id: "juego_tecnico", label: "Juego técnico", group: "Individual" },
  { id: "juego_persecucion", label: "Juego de persecución", group: "Individual" },
  { id: "juego_velocidad", label: "Juego de velocidad", group: "Individual" },
  { id: "juego_aplicacion", label: "Juego de aplicación", group: "Individual" },
  { id: "rondo", label: "Rondo", group: "Individual" },
  { id: "partido_reducido", label: "Partido reducido", group: "Individual" },
  { id: "finalizacion", label: "Finalización con oposición", group: "Individual" },
  { id: "explicativa", label: "Tarea explicativa", group: "Colectiva" },
  { id: "juego_posicion", label: "Juego de posición", group: "Colectiva" },
  { id: "conservacion", label: "Conservación", group: "Colectiva" },
  { id: "oleada", label: "Oleadas", group: "Colectiva" },
  { id: "automatismo", label: "Automatismos / evoluciones", group: "Colectiva" },
  { id: "juego_situacion", label: "Juego de situación", group: "Colectiva" },
  { id: "minipartido", label: "Minipartido", group: "Colectiva" },
  { id: "partido", label: "Partido", group: "Colectiva" },
  { id: "abp", label: "Tarea de balón parado", group: "Colectiva" },
  { id: "pf", label: "Preparación física (PF)", group: "Otras" },
  { id: "activacion", label: "Activación / movilidad", group: "Otras" },
  { id: "plan_partido", label: "Explicación del plan de partido", group: "Otras" },
];
export const taskTypeLabel = (id) => TASK_TYPES.find((t) => t.id === id)?.label || "";
// Nombre corto para el título de la tarea en la ficha
export const taskTypeShort = (id) => taskTypeLabel(id).replace(/ \(.*\)$/, "");

// ── Fases del juego ──────────────────────────────────────────────────────────
export const PHASES = [
  { id: "ataque_org", label: "Ataque organizado" },
  { id: "defensa_org", label: "Defensa organizada" },
  { id: "trans_of", label: "Transición ofensiva" },
  { id: "trans_def", label: "Transición defensiva" },
  { id: "abp", label: "Balón parado" },
];
export const PHASE_PRESETS = [
  { id: "ataque", label: "Todas en ataque", phases: ["ataque_org", "trans_of"] },
  { id: "defensa", label: "Todas en defensa", phases: ["defensa_org", "trans_def"] },
  { id: "todas", label: "Todas las fases", phases: ["ataque_org", "defensa_org", "trans_of", "trans_def"] },
];
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
export function phasesLabel(phases = []) {
  if (!phases.length) return "";
  const preset = PHASE_PRESETS.find((p) => sameSet(p.phases, phases));
  if (preset) return preset.id === "todas" ? "Todas las fases" : preset.label;
  if (sameSet(phases, [...PHASE_PRESETS[2].phases, "abp"])) return "Todas las fases";
  return PHASES.filter((p) => phases.includes(p.id)).map((p) => p.label).join(" + ");
}

// ── Tiempos ──────────────────────────────────────────────────────────────────
const round1 = (n) => Math.round(n * 10) / 10;
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };

// Tiempo total de una tarea: series × tiempo de cada serie + las recuperaciones entre series (o el total puesto a mano)
export function taskMinutes(task) {
  if (!task) return 0;
  const manual = num(task.total_override);
  if (manual) return round1(manual);
  const series = Math.max(1, Math.round(num(task.series) || 1));
  const each = num(task.serie_min);
  const rec = num(task.rec_min);
  return round1(series * each + (series - 1) * rec);
}

export const fmtMin = (n) => `${Number.isInteger(n) ? n : String(round1(n)).replace(".", ",")}’`;

// «4x4’» o «2x12’ (rec. 1’)»
export function seriesLabel(task) {
  const series = Math.max(1, Math.round(num(task.series) || 1));
  const each = num(task.serie_min);
  if (!each) return "";
  return `${series}x${String(each).replace(".", ",")}’`;
}

export const hasText = (s) => String(s ?? "").trim().length > 0;
export const allTasks = (session) => [...(session?.initial?.tasks || []), ...(session?.main?.tasks || [])];

// ── Registro de lo trabajado (TFM 4.8.5) ─────────────────────────────────────
//  · Los minutos de la tarea se cuentan UNA sola vez en el bloque principal (el del primer contenido principal).
//  · Los contenidos principales (1 o 2) registran toda la duración, aunque sean dos a la vez.
//  · Los secundarios (hasta 2) se registran aparte, sin sumarse al volumen del bloque, y solo si la tarea tiene correcciones.
//  · Las tareas «sin contenido del currículum» (PF, activación…) no entran en los porcentajes.
export function registerSession(session) {
  const out = { total: 0, withBlock: 0, noCurriculum: 0, unclassified: 0, blocks: {}, contents: {}, tasks: 0 };
  const content = (id) => (out.contents[id] ||= { id, principal: 0, secondary: 0, tasks: 0 });
  for (const t of allTasks(session)) {
    const m = taskMinutes(t);
    if (!m) continue;
    out.total += m;
    out.tasks += 1;
    if (t.no_curriculum) { out.noCurriculum += m; continue; }
    const principals = (t.principal || []).filter(contentInfo).slice(0, 2);
    if (!principals.length) { out.unclassified += m; continue; }
    const block = contentBlock(principals[0]);
    out.withBlock += m;
    out.blocks[block] = round1((out.blocks[block] || 0) + m);
    for (const id of principals) { const c = content(id); c.principal = round1(c.principal + m); c.tasks += 1; }
    if (hasText(t.corrections)) {
      for (const id of (t.secondary || []).filter((x) => contentInfo(x) && !principals.includes(x)).slice(0, 2)) {
        const c = content(id); c.secondary = round1(c.secondary + m);
      }
    }
  }
  out.total = round1(out.total);
  out.withBlock = round1(out.withBlock);
  out.noCurriculum = round1(out.noCurriculum);
  out.unclassified = round1(out.unclassified);
  return out;
}

// Suma de varias sesiones
export function aggregateSessions(sessions) {
  const acc = { total: 0, withBlock: 0, noCurriculum: 0, unclassified: 0, blocks: {}, contents: {}, sessions: 0, tasks: 0 };
  for (const s of sessions) {
    const r = registerSession(s);
    acc.sessions += 1;
    acc.tasks += r.tasks;
    for (const k of ["total", "withBlock", "noCurriculum", "unclassified"]) acc[k] = round1(acc[k] + r[k]);
    for (const [b, m] of Object.entries(r.blocks)) acc.blocks[b] = round1((acc.blocks[b] || 0) + m);
    for (const [id, c] of Object.entries(r.contents)) {
      const a = (acc.contents[id] ||= { id, principal: 0, secondary: 0, tasks: 0 });
      a.principal = round1(a.principal + c.principal);
      a.secondary = round1(a.secondary + c.secondary);
      a.tasks += c.tasks;
    }
  }
  return acc;
}

// Avisos de una tarea (para ayudar a rellenarla; no impiden guardar)
export function taskWarnings(t) {
  const w = [];
  if (!t) return w;
  const principals = t.principal || [];
  if (!t.no_curriculum && !principals.length) w.push("Elige al menos un contenido principal: sin él, los minutos no se cuentan en ningún bloque.");
  const blocks = new Set(principals.map(contentBlock).filter(Boolean));
  if (blocks.size > 1) w.push(`Los contenidos principales son de bloques distintos: los minutos cuentan en «${blockInfo(contentBlock(principals[0]))?.short}» (el del primero) y el resto queda como exposición.`);
  if ((t.secondary || []).length && !hasText(t.corrections)) w.push("Los contenidos secundarios solo computan si la tarea tiene correcciones.");
  return w;
}

// ── Comparación con los porcentajes de la etapa (TFM 4.8.3: márgenes) ──────────
export function marginState(diff) {
  const a = Math.abs(diff);
  if (a <= 5) return { id: "ok", label: "Dentro del margen (±5)", color: "#16a34a" };
  if (a <= 10) return { id: "revisar", label: "Adaptación a justificar con el coordinador (±5 a ±10)", color: "#d97706" };
  return { id: "alerta", label: "Revisión obligatoria (más de ±10)", color: "#dc2626" };
}

// Por bloque: minutos, % real (sobre el tiempo con bloque), % de referencia de la etapa y desviación en puntos
export function compareWithStage(agg, stage) {
  const base = agg.withBlock || 0;
  return BLOCKS.map((b) => {
    const min = agg.blocks[b.id] || 0;
    const pct = base ? (min / base) * 100 : 0;
    const target = targetPct(b.id, stage);
    return { block: b.id, minutes: min, pct, target, diff: pct - target, state: base ? marginState(pct - target) : null };
  });
}

// Jerarquía interna: la prioridad alta menos trabajada debe acabar por encima de la media más trabajada, y esta de la baja más trabajada
export function hierarchyIssues(agg, stage) {
  const issues = [];
  for (const b of BLOCKS) {
    const list = stageContents(stage).filter((c) => c.block === b.id);
    if (!list.length) continue;
    const m = (c) => agg.contents[c.id]?.principal || 0;
    const by = (p) => list.filter((c) => c.priority === p);
    const minOf = (arr) => (arr.length ? Math.min(...arr.map(m)) : null);
    const maxOf = (arr) => (arr.length ? Math.max(...arr.map(m)) : null);
    const blockTotal = list.reduce((s, c) => s + m(c), 0);
    if (!blockTotal) continue; // sin trabajo en el bloque no hay jerarquía que comprobar
    const lowA = minOf(by("A")), highM = maxOf(by("M")), lowM = minOf(by("M")), highB = maxOf(by("B"));
    if (lowA !== null && highM !== null && highM > 0 && lowA <= highM) issues.push({ block: b.id, text: `En ${b.short}, algún contenido de prioridad media lleva tanto o más tiempo que alguno de prioridad alta.` });
    if (lowM !== null && highB !== null && highB > 0 && lowM <= highB) issues.push({ block: b.id, text: `En ${b.short}, algún contenido de prioridad baja lleva tanto o más tiempo que alguno de prioridad media.` });
  }
  return issues;
}

// ── Estructura vacía de una sesión y de una tarea ─────────────────────────────
let seq = 0;
export const newId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

export function emptyTask(part = "principal") {
  return {
    id: newId(), part, title: "", type: "", series: 1, serie_min: 0, rec_min: 0, total_override: "",
    description: "", objective: "", phases: [], principal: [], secondary: [], no_curriculum: false,
    corrections: "", staff_corrections: "", scoring: "", board: null,
  };
}

export function emptySession({ teamId = "", date = "", stage = null, type = null } = {}) {
  return {
    team_id: teamId, date, stage, session_type: type, duration: 90, match_ref: "", event_id: null,
    obj_atk: "", obj_def: "", held: true,
    initial: { tasks: [emptyTask("inicial")] },
    main: { tasks: [emptyTask("principal"), emptyTask("principal"), emptyTask("principal")] },
    attendance: {}, notes: "",
  };
}

// Un trabajo vacío (sin título, sin tiempo y sin contenidos) no cuenta ni se imprime
export const isBlankTask = (t) => !hasText(t.title) && !taskMinutes(t) && !(t.principal || []).length && !hasText(t.description);
