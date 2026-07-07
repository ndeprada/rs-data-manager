// Cliente propio que sustituye al SDK de Base44, manteniendo la misma
// interfaz (base44.entities.X.list/filter/create/update/delete,
// base44.auth.me/logout/redirectToLogin/updateMe,
// base44.integrations.Core.UploadFile/SendEmail/InvokeLLM)
// para no tener que tocar el resto de la app.

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

function makeEntityClient(entityType) {
  return {
    list: (sort, limit) =>
      apiFetch(`/api/entities/${entityType}`, { query: { sort, limit } }),
    filter: (filterObj = {}, sort, limit) =>
      apiFetch(`/api/entities/${entityType}`, {
        query: { q: JSON.stringify(filterObj), sort, limit },
      }),
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
      UploadFile: async ({ file }) => {
        const base64 = await fileToBase64(file);
        return apiFetch('/api/upload', {
          method: 'POST',
          body: { filename: file.name, contentType: file.type, base64 },
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
