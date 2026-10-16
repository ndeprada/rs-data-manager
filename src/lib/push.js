// Activar / desactivar avisos push en este dispositivo.
import { base44 } from '@/api/base44Client';

const b64ToUint8 = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// 'unsupported' | 'needs_install' (iPhone sin instalar) | 'denied' | 'off' | 'on'
export async function pushState() {
  if (isIOS() && !isStandalone()) return 'needs_install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub && Notification.permission === 'granted') return 'on';
  } catch { /* nada */ }
  return 'off';
}

export async function enablePush() {
  const { key } = await base44.club.vapid();
  if (!key) throw new Error('Los avisos aún no están configurados en el servidor.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('No se concedió el permiso de notificaciones.');
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) });
  await base44.club.subscribe(sub.toJSON());
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await base44.club.unsubscribe(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  }
}
