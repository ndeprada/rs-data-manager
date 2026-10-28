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
    // Datos de temporadas cerradas / jugadores dados de baja en un cierre (los listados normales no los incluyen)
    archived: (filterObj = {}, mode = 'only', sort, limit) =>
      apiFetch(`/api/entities/${entityType}`, { query: { q: JSON.stringify(filterObj), archived: mode, sort, limit } }),
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

// Avisos push y familiares (todo pasa por /api/club)
const clubGet = (a, query = {}) => apiFetch('/api/club', { query: { a, ...query } });
const clubPost = (a, body = {}) => apiFetch(`/api/club?a=${a}`, { method: 'POST', body });

export const base44 = {
  entities: entitiesProxy,

  club: {
    vapid: () => clubGet('vapid'),
    myPush: () => clubGet('my_push'),
    subscribe: (subscription) => clubPost('subscribe', { subscription }),
    unsubscribe: (endpoint) => clubPost('unsubscribe', { endpoint }),
    inbox: () => clubGet('inbox'),
    history: () => clubGet('history'),
    preview: (audience) => clubPost('preview', { audience }),
    people: (q) => clubGet('people', { q }),
    send: (payload) => clubPost('send', payload),
    searchPlayers: (q) => clubGet('players_search', { q }),
    // Base de datos FCF (Planificación → Scouting)
    fcfMeta: () => clubGet('fcf_meta'),
    fcfSearch: (filters) => clubGet('fcf_search', filters),
    fcfPlayer: (id) => clubGet('fcf_player', { id }),
    fcfImport: (actas) => clubPost('fcf_import', { actas }),
    fcfYears: (season) => clubGet('fcf_years', { season }),
    fcfGroupTeams: (q) => clubGet('fcf_group_teams', q),
    fcfTeam: (q) => clubGet('fcf_team', q),
    fcfAlerts: (season) => clubGet('fcf_alerts', { season }),
    requestLink: (player_id, relationship) => clubPost('link_request', { player_id, relationship }),
    myLinks: () => clubGet('my_links'),
    playerLinks: (player_id) => clubGet('player_links', { player_id }),
    pendingLinks: () => clubGet('pending_links'),
    playerAccounts: () => clubGet('player_accounts'),
    decideLink: (link_id, decision) => clubPost('link_decision', { link_id, decision }),
    createLink: (user_id, player_id, relationship) => clubPost('link_create', { user_id, player_id, relationship }),
    // Cierre de temporada (coordinación)
    seasonStatus: (season) => clubGet('season_status', { season }),
    seasonClose: (season, standings = {}, dry = false) => clubPost('season_close', { season, standings, dry }),
    seasonReopen: (season) => clubPost('season_reopen', { season }),
    // Informe del rival de un partido de liga (datos públicos de la FCF)
    rivalReport: (event_id) => clubGet('rival', { event_id }),
    icsLink: (team_id) => clubGet('ics_link', { team_id }),
    icsRotate: (team_id) => clubPost('ics_rotate', { team_id }),
    // Copias de seguridad (coordinación)
    backupList: () => clubGet('backup_list'),
    backupCreate: () => clubPost('backup_create'),
    // Limpieza de duplicados: vista previa (no cambia nada) y aplicar (guarda antes una copia de seguridad)
    dupesPreview: () => clubGet('dupes_preview'),
    dupesApply: () => clubPost('dupes_apply'),
    // Descarga una copia guardada (id) o los datos de ahora mismo (sin id) como archivo
    backupDownload: async (id) => {
      const res = await fetch(`/api/club?a=backup_download${id ? `&id=${id}` : ''}`, { credentials: 'include' });
      if (!res.ok) throw new Error('No se pudo descargar la copia');
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || 'rs-manager-copia.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return name;
    },
  },

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
      // No hay servicio de email ni de IA conectado. Fallan a la vista (en vez de fingir que han enviado nada)
      // para que ninguna pantalla vuelva a marcar como "enviado" algo que no ha salido.
      SendEmail: async () => {
        throw new Error('El envío de emails no está activado en la app.');
      },
      InvokeLLM: async () => {
        throw new Error('La IA no está conectada en la app.');
      },
    },
  },
};
