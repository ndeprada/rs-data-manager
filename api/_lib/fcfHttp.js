// Cómo se piden los datos a la API pública de la FCF (solo lectura). Un único sitio para la sincronización, las clasificaciones y el informe de rival.
//
// Desde octubre de 2026 la protección de la web de la FCF (CloudFront) contesta 403 «The request could not be satisfied» a las peticiones que solo llevan
// User-Agent y «Accept: application/json»; con las cabeceras que manda un navegador (Accept-Language, Referer y Origin de fcf.cat) contesta 200.
// Se probó desde el servidor de Vercel en EE. UU. (iad1) y en París (cdg1) con el mismo resultado, así que no depende del país ni de la IP.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export const FCF_HEADERS = {
  'user-agent': UA,
  accept: 'application/json, text/plain, */*',
  'accept-language': 'ca-ES,ca;q=0.9,es;q=0.8,en;q=0.7',
  referer: 'https://www.fcf.cat/',
  origin: 'https://www.fcf.cat',
};

export const fcfFetch = (url) => fetch(url, { headers: FCF_HEADERS });
