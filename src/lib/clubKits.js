// Equipaciones del club para el campo de la pestaña Preparación y la hoja del entrenador (13/11/2026, maqueta aprobada por Nacho).
// Cada camiseta es la foto real de su espalda (la pasó Nacho, sin fondo, 440 × 498 px) y dos capas sacadas de la misma foto
// —«sombra» y «luz»— que se ponen encima del dorsal y del nombre del club para que parezcan estampados y sigan los pliegues.
// Son los valores del club: si algún día se vende la app a otro club, cada club tendrá que poner las fotos de sus camisetas.
// `num` = color del dorsal y del texto de la espalda; `fill`/`stroke` = colores lisos para donde no cabe la foto (pizarra de balón parado).
import blanca from "@/assets/kits/blanca.webp";
import blancaSombra from "@/assets/kits/blanca-sombra.webp";
import blancaLuz from "@/assets/kits/blanca-luz.webp";
import granate from "@/assets/kits/granate.webp";
import granateSombra from "@/assets/kits/granate-sombra.webp";
import granateLuz from "@/assets/kits/granate-luz.webp";
import verde from "@/assets/kits/verde.webp";
import verdeSombra from "@/assets/kits/verde-sombra.webp";
import verdeLuz from "@/assets/kits/verde-luz.webp";
import naranja from "@/assets/kits/naranja.webp";
import naranjaSombra from "@/assets/kits/naranja-sombra.webp";
import naranjaLuz from "@/assets/kits/naranja-luz.webp";
import azul from "@/assets/kits/azul.webp";
import azulSombra from "@/assets/kits/azul-sombra.webp";
import azulLuz from "@/assets/kits/azul-luz.webp";
import { msg } from "@/i18n";
import { C as clubColor } from "@/lib/brand";

export const KIT_IMG = { w: 440, h: 498 };
// Texto oficial de la espalda, encima del dorsal
export const KIT_BACK_TEXT = "EF HRISTO STOITCHKOV";

export const KITS = {
  "1": { key: "primera", label: msg("1ª"), img: blanca, shade: blancaSombra, light: blancaLuz, num: clubColor.primary, fill: "#ffffff", stroke: clubColor.primary },
  "2": { key: "segunda", label: msg("2ª"), img: granate, shade: granateSombra, light: granateLuz, num: "#FFFFFF", fill: "#8C2A2F", stroke: "#541519" },
  "3": { key: "tercera", label: msg("3ª"), img: verde, shade: verdeSombra, light: verdeLuz, num: "#FFFFFF", fill: "#1C9156", stroke: "#0B5535" },
};
export const GK_KITS = {
  naranja: { label: msg("Naranja"), img: naranja, shade: naranjaSombra, light: naranjaLuz, num: "#FFFFFF", fill: "#FF6E00", stroke: "#A84600" },
  azul: { label: msg("Azul eléctrico"), img: azul, shade: azulSombra, light: azulLuz, num: "#FFFFFF", fill: "#1F6BFF", stroke: "#0A3290" },
};

// Copia de cada imagen como data URL: dentro de un SVG convertido en imagen (PNG, vídeo, impresión) no se cargan archivos de fuera
const dataUrls = new Map();
export const kitHref = (src) => dataUrls.get(src) || src;
let preload = null;
export function preloadKitData() {
  if (!preload) {
    const all = [...Object.values(KITS), ...Object.values(GK_KITS)].flatMap((k) => [k.img, k.shade, k.light]);
    preload = Promise.all(all.map(async (src) => {
      try {
        const blob = await fetch(src).then((r) => r.blob());
        const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
        dataUrls.set(src, url);
      } catch { /* se queda la dirección normal */ }
    }));
  }
  return preload;
}
/** Equipación de una ficha del equipo propio en la pizarra (camisetas reales): portero o de campo */
export const boardKitOf = (shirtKit, isGk) => (isGk ? GK_KITS[shirtKit?.gk] || GK_KITS.naranja : KITS[shirtKit?.field] || KITS["1"]);

export const kitFor = (player, kit, gkKit) =>
  player?.position === "portero" ? (GK_KITS[gkKit] || GK_KITS.naranja) : (KITS[kit] || KITS["1"]);

// La equipación del partido es una sola: la de la convocatoria y la Agenda del Panel (Event.agenda_meta.kit:
// "" o "primera" = 1ª, "segunda", "tercera"). Si el partido no la tiene indicada, vale la del plan guardado antes (MatchPlan.kit).
const KEY_TO_PLAN = { primera: "1", segunda: "2", tercera: "3" };
export function matchKit(agendaMeta, planKit) {
  if (agendaMeta && Object.prototype.hasOwnProperty.call(agendaMeta, "kit")) return KEY_TO_PLAN[agendaMeta.kit] || "1";
  return KITS[planKit] ? planKit : "1";
}
export const agendaKitOf = (planKit) => (planKit === "2" ? "segunda" : planKit === "3" ? "tercera" : "");

// Camiseta compuesta en un lienzo (para la hoja del entrenador en PDF): foto + texto + sombras y luces sobre el texto.
const imgCache = new Map();
function loadImg(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    }));
  }
  return imgCache.get(src);
}
export async function shirtPng(kit, number, { font = "Racing Sarria", backText = KIT_BACK_TEXT, scale = 1 } = {}) {
  const [img, shade, light] = await Promise.all([loadImg(kit.img), loadImg(kit.shade), loadImg(kit.light)]);
  if (!img) return null;
  try { await document.fonts?.load(`200px "${font}"`); } catch { /* sin la letra, la del navegador */ }
  const W = Math.round(KIT_IMG.w * scale), H = Math.round(KIT_IMG.h * scale);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0, W, H);
  const t = document.createElement("canvas"); t.width = W; t.height = H;
  const tg = t.getContext("2d");
  tg.scale(scale, scale);
  tg.fillStyle = kit.num; tg.textAlign = "center"; tg.textBaseline = "alphabetic";
  if (backText) { tg.font = `21px "${font}"`; tg.fillText(backText, 220, 112); }
  if (number !== "" && number != null) { tg.font = `205px "${font}"`; tg.fillText(String(number), 220, 326); }
  tg.setTransform(1, 0, 0, 1, 0, 0);
  tg.globalCompositeOperation = "source-atop";
  if (shade) tg.drawImage(shade, 0, 0, W, H);
  if (light) { tg.globalAlpha = 0.7; tg.drawImage(light, 0, 0, W, H); }
  g.drawImage(t, 0, 0);
  return { data: c.toDataURL("image/png"), w: W, h: H };
}
