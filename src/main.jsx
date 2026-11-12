import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { applyBrand } from '@/lib/applyBrand'

// Colores y tipografías del club (por ahora, los de Racing Sarrià; más adelante, los de Configuración)
applyBrand()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// App instalable (PWA): el service worker permite instalarla y recibir avisos; no guarda nada en caché
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
