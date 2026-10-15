// Cliente propio que sustituye al SDK de Base44, manteniendo la misma
// interfaz (base44.entities.X.list/filter/create/update/delete,
// base44.auth.me/logout/redirectToLogin/updateMe,
// base44.integrations.Core.UploadFile/SendEmail/InvokeLLM)
// para no tener que tocar el resto de la app.

import { sortTeams } from '@/lib/teamOrder';

async function apiFetch(path, { method = 'GET', body, query } = {}) {
  let url = path;
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.set(k, v);
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

// Los equipos siempre salen ordenados de mayores a menores (ver lib/teamOrder.js)
const orderResult = (entityType, p, hideSuperseded = false) => {
  if (entityType === 'Team') return p.then((r) => (Array.isArray(r) ? sortTeams(r) : r));
  // Un partido aplazado que ya tiene su nueva fecha (otro evento) no se muestra en listados para no duplicarlo
  if (entityType === 'Event' && hideSuperseded) return p.then((r) => (Array.isArray(r) ? r.filter((e) => !(e.postponed && e.postponed_to_event_id)) : r));
  return p;
};

function makeEntityClient(entityType) {
  return {
    list: (sort, limit) =>
      orderResult(entityType, apiFetch(`/api/entities/${entityType}`, { query: { sort, limit } }), true),
    filter: (filterObj = {}, sort, limit) =>
      orderResult(entityType, apiFetch(`/api/entities/${entityType}`, {
        query: { q: JSON.stringify(filterObj), sort, limit },
      }), !filterObj?.id),
    get: (id) => apiFetch(`/api/entities/${entityType}/${id}`),
    create: (data) => apiFetch(`/api/entities/${entityType}`, { method: 'POST', body: data }),
    update: (id, data) =>
      apiFetch(`/api/entities/${entityType}/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiFetch(`/api/entities/${entityType}/${id}`, { method: 'DELETE' }),
  };
}

const entitiesCache = {};
const entitiesProxy = new Proxy(
  {},
  {
    get(_target, entityType) {
      if (typeof entityType !== 'string') return undefined;
      if (!entitiesCache[entityType]) {
        entitiesCache[entityType] = makeEntityClient(entityType);
      }
      return entitiesCache[entityType];
    },
  }
);

// Reduce las imágenes antes de subirlas: el servidor rechaza peticiones de más de ~4,5 MB
// y una foto de móvil recortada a resolución completa (sobre todo en PNG) las supera.
async function shrinkImage(file, maxSide = 1280) {
  if (!file.type?.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    URL.revokeObjectURL(url);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const keepPng = file.type === 'image/png';
    const blob = await new Promise((r) => canvas.toBlob(r, keepPng ? 'image/png' : 'image/jpeg', 0.88));
    if (!blob || blob.size >= file.size) return file;
    const base = (file.name || 'imagen').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.${keepPng ? 'png' : 'jpg'}`, { type: blob.type });
  } catch {
    return file;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const base44 = {
  entities: entitiesProxy,

  auth: {
    me: () => apiFetch('/api/auth/me'),
    updateMe: (data) => apiFetch('/api/auth/update-me', { method: 'PUT', body: data }),
    login: (email, password) =>
      apiFetch('/api/auth/login', { method: 'POST', body: { email, password } }),
    register: (email, password, full_name) =>
      apiFetch('/api/auth/register', { method: 'POST', body: { email, password, full_name } }),
    loginWithGoogle: () => {
      window.location.href = '/api/auth/google/start';
    },
    logout: (redirectTo) => {
      apiFetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        if (redirectTo) window.location.href = '/login';
      });
    },
    redirectToLogin: () => {
      window.location.href = '/login';
    },
  },

  integrations: {
    Core: {
      UploadFile: async ({ file: original }) => {
        const file = await shrinkImage(original);
        const base64 = await fileToBase64(file);
        if (base64.length > 4.2 * 1024 * 1024) {
          throw new Error('El archivo es demasiado grande (máximo unos 3 MB). Reduce su tamaño e inténtalo de nuevo.');
        }
        return apiFetch('/api/upload', {
          method: 'POST',
          body: { filename: file.name || 'archivo', contentType: file.type, base64 },
        });
      },
      // Sin proveedor de email/LLM configurado todavía: no-op seguro.
      SendEmail: async () => {
        console.warn('SendEmail no está configurado todavía.');
        return { ok: false };
      },
      InvokeLLM: async () => {
        console.warn('InvokeLLM no está configurado todavía.');
        return null;
      },
    },
  },
};
