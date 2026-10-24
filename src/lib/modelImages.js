// Archivos de las figuras del modelo de juego (src/assets/modelo-juego/<id>.webp, sacadas del TFM). Vite los publica con huella en el nombre
// y caché larga, y solo se descargan cuando alguien despliega las imágenes de un indicador (las URL se cargan sin incluir los archivos en el código).
const FILES = import.meta.glob("../assets/modelo-juego/*.webp", { eager: true, query: "?url", import: "default" });
const BY_ID = Object.fromEntries(Object.entries(FILES).map(([path, url]) => [path.split("/").pop().replace(/\.webp$/, ""), url]));

export const modelImageUrl = (id) => BY_ID[id] || null;
/** Figuras de un indicador con su dirección (las que no tienen archivo se ignoran). */
export const modelImagesOf = (criterion) => (criterion?.images || []).map((i) => ({ ...i, src: modelImageUrl(i.id) })).filter((i) => i.src);
