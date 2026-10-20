// Datos obligatorios al registrarse el cuerpo técnico: nombre, apellidos, fecha de nacimiento y teléfono.
// Las mismas reglas están en api/_lib/registration.js (el servidor las vuelve a comprobar); tests/registration.test.mjs vigila que coincidan.

export const MIN_STAFF_AGE = 14;
export const MAX_STAFF_AGE = 100;

export const STAFF_REQUIRED_LABELS = {
  first_name: "Nombre",
  last_name: "Apellidos",
  birth_date: "Fecha de nacimiento",
  phone: "Teléfono",
};

export const splitFullName = (full) => {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] || "", last_name: parts.slice(1).join(" ") };
};

export const joinFullName = (first, last) => [first, last].map((x) => String(x || "").trim()).filter(Boolean).join(" ");

const validBirth = (value, today) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return false;   // 31 de febrero, etc.
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1;
  return age >= MIN_STAFF_AGE && age <= MAX_STAFF_AGE;
};

const validPhone = (value) => {
  const v = String(value || "").trim();
  if (!/^[\d\s+().-]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
};

/** Devuelve la lista de campos que faltan o no son válidos (vacía = todo correcto) */
export function invalidStaffFields(data, today = new Date()) {
  const bad = [];
  if (String(data?.first_name || "").trim().length < 2) bad.push("first_name");
  if (String(data?.last_name || "").trim().length < 2) bad.push("last_name");
  if (!validBirth(data?.birth_date, today)) bad.push("birth_date");
  if (!validPhone(data?.phone)) bad.push("phone");
  return bad;
}
