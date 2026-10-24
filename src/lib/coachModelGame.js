// Indicadores del modelo de juego que se observan en el partido para valorar cuánto lo tiene interiorizado el equipo de un entrenador.
// Fuente: TFM «RCD Espanyol · Área de Metodología», apartados 4.8.13 a 4.8.16 (fútbol 7 y fútbol 11, en ataque y en defensa),
// y 4.8.12 (escala 0–4 y las tres preguntas de cada indicador: percepción, decisión y ejecución).
// En Racing Sarrià se juega a fútbol 7 hasta el S12 y a fútbol 11 desde el S13 (ver coachStage.js).
// No cambiar las claves (`key`): se guardan en las observaciones. Sin importaciones de la app (salvo la marca de traducción): se usa también en los tests.
import { msg } from "../i18n/translate.js";

export const GAME_FORMATS = ["f7", "f11"];
export const GAME_FORMAT_LABELS = { f7: msg("Fútbol 7"), f11: msg("Fútbol 11") };

const ATAQUE = "#B33A00";
const DEFENSA = "#36000D";

export const MODEL_BLOCKS = {
  f7: [
    { key: "mj7_ataque", label: msg("Modelo F7 · Ataque"), color: ATAQUE, scale: "model", criteria: [
      { key: "mj7a_posicion", label: msg("Posicionamiento básico"),
        hint: msg("Extremos abiertos y por delante del medio; mediapunta entre extremos y última línea; línea defensiva estrecha ocupando el centro; recuperan las posiciones de referencia tras desplazarse.") },
      { key: "mj7a_bloque", label: msg("Juego en bloque"),
        hint: msg("Distancias cortas: el equipo viaja junto al progresar el balón; apoyos cercanos y conexión con los jugadores alejados; estructura preparada para reaccionar ante una pérdida.") },
      { key: "mj7a_atacan4", label: msg("Atacan cuatro y cierran dos"),
        hint: msg("Se incorpora un jugador de la primera línea cuando es posible y los dos restantes cierran; estructura equilibrada ante la pérdida.") },
      { key: "mj7a_ayudas_medio", label: msg("Ayudas del medio"),
        hint: msg("Se desplaza a un costado con el balón en el central; ayuda en diagonal si el balón está en el lateral; se coloca de costado para ver y recibir orientado; no cae a la banda.") },
      { key: "mj7a_ayudas_extremo", label: msg("Ayudas al extremo"),
        hint: msg("Movimientos coordinados a partir de que el balón llega al extremo: doblada del mediapunta, pasillo del extremo, pasillo para el extremo alejado y para el central.") },
    ] },
    { key: "mj7_defensa", label: msg("Modelo F7 · Defensa"), color: DEFENSA, scale: "model", criteria: [
      { key: "mj7d_posicion", label: msg("Posicionamiento defensivo"),
        hint: msg("Dos líneas de tres, escalonadas, con ajuste según la posición del balón; protección prioritaria del espacio interior y la zona de portería; recuperan posiciones tras presionar o cubrir.") },
      { key: "mj7d_bloque", label: msg("Juego en bloque"),
        hint: msg("Distancias reducidas entre líneas, con avance y retroceso coordinados; reducen los espacios interiores del rival; estructura lista para atacar tras recuperar.") },
      { key: "mj7d_coberturas", label: msg("Coberturas"),
        hint: msg("El más próximo interviene y los demás cubren su espalda; embudo con balón frontal y diagonal con balón lateral; basculan cuando el balón cambia de zona.") },
      { key: "mj7d_repliegue", label: msg("Repliegue"),
        hint: msg("Reconocen la inferioridad y el espacio a la espalda; retroceso colectivo, no individual, protegiendo el centro; reorganizan el bloque antes de volver a presionar.") },
      { key: "mj7d_extremo", label: msg("Extremo arriba / abajo"),
        hint: msg("El extremo se queda abierto y algo arriba cuando el balón va por el lado contrario y baja cuando va por el suyo; ayuda al compañero evitando la superioridad rival; es la referencia para atacar tras recuperar.") },
    ] },
  ],
  f11: [
    { key: "mj11_ataque", label: msg("Modelo F11 · Ataque"), color: ATAQUE, scale: "model", criteria: [
      { key: "mj11a_posicion", label: msg("Posicionamiento básico"),
        hint: msg("Laterales por dentro; medios en los canales y a alturas distintas; extremos abiertos y más avanzados que el mediapunta.") },
      { key: "mj11a_bloque", label: msg("Juego en bloque"),
        hint: msg("Distancias cortas entre líneas; avance y retroceso coordinados, con conexión constante; estructura lista para continuar tras una pérdida.") },
      { key: "mj11a_ayudas_central", label: msg("Ayudas al central"),
        hint: msg("Máximo número de líneas de pase disponibles: laterales por dentro, extremos abiertos y altos, medios por dentro a diferentes alturas y el delantero centro como cuarto medio.") },
      { key: "mj11a_ayudas_lateral", label: msg("Ayudas al lateral"),
        hint: msg("Una ayuda a cada lado del lateral: interior cercano ayudando por dentro, extremo en la banda y los del lado alejado dando amplitud y profundidad desde su posición.") },
      { key: "mj11a_extremo", label: msg("Jugadas desde el extremo"),
        hint: msg("Acciones a partir de que el balón va a la banda según los espacios que se generan: doblada del delantero centro, doblada o pasillo del interior cercano, pasillo del interior alejado, pasillo del extremo con el interior por detrás.") },
      { key: "mj11a_centro", label: msg("Jugadas por el centro"),
        hint: msg("Apoyo del delantero centro con el balón por dentro; pared interior-delantero y continuidad (doy y voy); los extremos mantienen la amplitud para liberar espacio dentro.") },
    ] },
    { key: "mj11_defensa", label: msg("Modelo F11 · Defensa"), color: DEFENSA, scale: "model", criteria: [
      { key: "mj11d_bloque", label: msg("Juego en bloque"),
        hint: msg("Distancias reducidas y funcionales entre líneas; desplazamiento coordinado hacia el balón, avanzando y retrocediendo como unidad; próximos preparados para presionar y alejados cerrando espacios; estructura lista para atacar tras recuperar.") },
      { key: "mj11d_espacios", label: msg("Organización de espacios y marcajes"),
        hint: msg("Posicionamiento ajustado a la estructura y ocupación del rival; distancias de marcaje adecuadas para intervenir, presionar o robar; interpretan cuándo marcar cerca, conceder distancia o cambiar; coordinan presiones, 1×1 y 2×1.") },
      { key: "mj11d_coberturas", label: msg("Coberturas"),
        hint: msg("El más próximo interviene y los compañeros cubren su espalda; colocados en diagonal, evitando defender en línea; permutas de posición: si un compañero va a mi sitio, yo voy al suyo.") },
      { key: "mj11d_libre", label: msg("Posición y función del libre"),
        hint: msg("El central libre cubre cuando hay amenaza e interviene cuando un compañero es desbordado; por detrás o en diagonal, controla balón, receptores y espacio a la espalda; comunica para ordenar marcajes, coberturas y permutas.") },
      { key: "mj11d_repliegue", label: msg("Repliegue"),
        hint: msg("Reconocen la inferioridad y el espacio a la espalda; retroceso colectivo, no individual, protegiendo el centro; los desbordados recuperan posición; reorganizan el bloque antes de volver a presionar.") },
      { key: "mj11d_presion", label: msg("Presión tras pérdida"),
        hint: msg("Reacción inmediata del jugador más próximo al balón perdido; cierre de las líneas de pase cercanas; los alejados ajustan distancias; coordinan presión, marcajes y protección de la profundidad; si los superan, repliegue.") },
    ] },
  ],
};

export const isGameFormat = (f) => GAME_FORMATS.includes(f);
// Formato de juego de una observación (las anteriores a este apartado no lo tienen)
export const obsFormat = (obs) => (isGameFormat(obs?.game_format) ? obs.game_format : null);
// Formatos que aparecen en un conjunto de observaciones, en orden F7, F11
export const obsFormats = (observations = []) => GAME_FORMATS.filter((f) => observations.some((o) => obsFormat(o) === f));
export const modelBlocks = (formats = []) => GAME_FORMATS.filter((f) => formats.includes(f)).flatMap((f) => MODEL_BLOCKS[f]);
