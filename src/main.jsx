// El aspecto del club va PRIMERO: así los módulos de la app ya leen sus colores y tipografías al cargarse
import { refreshBrand } from '@/lib/brandBoot'
import { applyBrand } from '@/lib/applyBrand'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Colores, tipografías, título e icono del club (sin configuración guardada, los de Racing Sarrià)
applyBrand()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Comprueba si la configuración del club ha cambiado desde la última visita
refreshBrand()

// App instalable (PWA): el service worker permite instalarla y recibir avisos; no guarda nada en caché
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
