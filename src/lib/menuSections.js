// Apartados del menú que un club puede ocultar (Configuración → Estructura del club). Sin importaciones de la app.
// Ocultar solo quita la entrada del menú del personal; no borra datos ni cambia permisos.
export const MENU_SECTIONS = [
  { key: "stats", label: "Estadísticas", group: "tools" },
  { key: "methodology", label: "Metodología", group: "tools" },
  { key: "tactics", label: "Táctica", group: "tools" },
  { key: "video", label: "Vídeo", group: "tools" },
  { key: "scouting", label: "Planificación", group: "tools" },
  { key: "reports", label: "Informes", group: "tools" },
  { key: "material", label: "Material", group: "tools" },
  { key: "season", label: "Temporada", group: "admin", path: "/Season" },
  { key: "fields", label: "Campos", group: "admin", path: "/Fields" },
];
export const MENU_KEYS = MENU_SECTIONS.map((s) => s.key);
