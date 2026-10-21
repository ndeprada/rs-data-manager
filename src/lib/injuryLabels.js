// Nombres legibles de los valores guardados en lesiones y documentos (se muestran con t(...)).
import { msg } from "../i18n/translate.js";

export const INJURY_TYPE_LABELS = {
  muscular: msg("Muscular"), osea: msg("Ósea"), ligamento: msg("Ligamento"), tendon: msg("Tendón"), contusion: msg("Contusión"), otro: msg("Otro"),
};
export const BODY_PART_LABELS = {
  tobillo: msg("Tobillo"), rodilla: msg("Rodilla"), muslo: msg("Muslo"), gemelo: msg("Gemelo"), isquiotibial: msg("Isquiotibial"),
  cadera: msg("Cadera"), espalda: msg("Espalda"), hombro: msg("Hombro"), brazo: msg("Brazo"), cabeza: msg("Cabeza"), otro: msg("Otro"),
};
export const SEVERITY_LABELS = { leve: msg("Leve"), moderada: msg("Moderada"), grave: msg("Grave") };
export const DOCUMENT_TYPE_LABELS = {
  examen_medico: msg("Examen Médico"), autorizacion_legal: msg("Autorización Legal"), copia_identificacion: msg("Copia de Identificación"),
  seguro: msg("Seguro"), consentimiento_padres: msg("Consentimiento de Padres"), otro: msg("Otro"),
};

// Devuelve el nombre traducido si el valor es conocido; si no, el valor tal cual
export const labelOf = (map, value, t) => (map[value] ? t(map[value]) : value || "");
