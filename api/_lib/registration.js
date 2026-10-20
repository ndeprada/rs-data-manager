// Datos obligatorios al solicitar acceso como cuerpo técnico (el servidor no se fía de lo que compruebe la pantalla).
// Mismas reglas que src/lib/registration.js; tests/registration.test.mjs vigila que coincidan.

const MIN_AGE = 14;
const MAX_AGE = 100;

const validBirth = (value, today) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return false;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1;
  return age >= MIN_AGE && age <= MAX_AGE;
};

const validPhone = (value) => {
  const v = String(value || '').trim();
  if (!/^[\d\s+().-]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
};

export function invalidStaffFields(data, today = new Date()) {
  const bad = [];
  if (String(data?.first_name || '').trim().length < 2) bad.push('first_name');
  if (String(data?.last_name || '').trim().length < 2) bad.push('last_name');
  if (!validBirth(data?.birth_date, today)) bad.push('birth_date');
  if (!validPhone(data?.phone)) bad.push('phone');
  return bad;
}
