// Campo de fútbol 7 típico (45 × 65 m) y sus marcas, para dibujarlo a escala en la alineación (pantalla y PDF).
// Medidas del Reglament de Joc de Futbol 7 de la FCF (Regla I) y de las Normas Reguladoras de Fútbol 7 de la RFEF:
//  · área de penalti: 9 m desde la cara interior de cada poste (6 + 2·9 = 24 m de ancho) y 9 m de fondo;
//  · área de meta: 3 m desde cada poste (6 + 2·3 = 12 m de ancho) y 3 m de fondo;
//  · punto de penalti a 9 m; círculo central de 6 m; sin arco del área;
//  · línea de fuera de juego a 12 m de la línea de meta, paralela a ella, de banda a banda.
// Si se cambian estas medidas hay que mantener igual el SPEC.f7 de BoardSvg.jsx (lo vigila tests/pitchGeometry.test.mjs).
export const F7_FIELD = Object.freeze({
  width: 45,
  length: 65,
  goalWidth: 6,
  areaWidth: 24,
  areaDepth: 9,
  goalAreaWidth: 12,
  goalAreaDepth: 3,
  penaltySpot: 9,
  centreRadius: 6,
  offsideLine: 12,
});

// Marcas del campo F7 dentro del rectángulo (x, y, w, h) que representa el terreno de juego (de línea de fondo a línea de fondo).
// Todo se mide desde la línea de meta de arriba; las de abajo son simétricas (h - valor).
export function f7Markings(x, y, w, h) {
  const F = F7_FIELD;
  const sx = w / F.width, sy = h / F.length;
  const cx = x + w / 2;
  return {
    area: { x: cx - (F.areaWidth * sx) / 2, w: F.areaWidth * sx, d: F.areaDepth * sy },
    goalArea: { x: cx - (F.goalAreaWidth * sx) / 2, w: F.goalAreaWidth * sx, d: F.goalAreaDepth * sy },
    spot: F.penaltySpot * sy,
    centre: { x: cx, y: y + h / 2, r: F.centreRadius * ((sx + sy) / 2) },
    offside: F.offsideLine * sy, // distancia desde cada línea de meta
  };
}
