// Carga diferida del motor 3D (three.js solo se descarga la primera vez que hace falta)
let P = null;
export const load3d = () => (P ||= import("@/lib/board3d"));
