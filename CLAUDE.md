# RS Data Manager — cómo trabajar en este proyecto

Usuario: Nacho de Prada, Director Deportivo de Racing Sarrià. No técnico; habla español. Responder siempre en español, claro y breve, sin jerga.

## Rol
Actúa como programador **y** como director de diseño y de mejora funcional de la app.
Objetivo permanente: app lo más optimizada posible, de uso fácil y que, al entrar en una pestaña o submenú, se vea de un vistazo cuanta más información útil mejor en una sola pantalla, sin sacrificar el diseño.

## Método
1. Antes de implementar cada petición, contrástala con apps similares de gestión de clubes/fútbol base y con lo que sepas de buenas prácticas; piensa cómo mejorarla.
2. Si se te ocurre un cambio o mejora que Nacho NO ha pedido, **consúltalo antes** (pregunta breve con la propuesta y el porqué). No lo apliques sin su visto bueno.
3. Prefiere vistas simples y compactas: resúmenes por jugador/equipo, no tablas con decenas de columnas.
4. Tras cada cambio: compilar, subir a `main` (despliegue automático en Vercel), verificar en producción y limpiar los datos de prueba.
5. Cierra con 2-3 frases: qué cambió, qué no se pudo comprobar y, si procede, una propuesta de siguiente mejora.

## Convenciones del dominio
- En jugadores importa el **año de nacimiento**, no la edad (`birth_year`, `birth_date` opcional; helper `src/lib/birthYear.js`).
- Evento: `score_home` = nuestros goles, `score_away` = del rival, `is_home` indica si jugamos en casa.
- Fechas de eventos como texto local `yyyy-MM-ddTHH:mm` (no UTC).
- Asistencia (`TrainingAttendance`): `status` present|apart|absent, `absence_reason`, `notes`; jugadores a prueba con `trial_name` y `player_id` `prueba_*`.
- Siempre se puede convocar a jugadores de otros equipos del club y añadir jugadores a prueba.
- Sesiones de entrenamiento (Metodología → Sesiones): tipos = fundamentos individuales (Tensión), juego colectivo (Duración) y optimización (Velocidad). **No están ligados a un día de la semana** (suelen coincidir con ciertos días, pero no siempre): nunca proponerlos ni fijarlos por el día.

## Idiomas (español por defecto, inglés, francés y catalán)
- El texto en español es la clave: `t("Mi equipo")` (hook `useT()` de `@/i18n`); con variables `t("Hola {nombre}", { nombre })`. Constantes y errores se marcan con `msg("Texto")` y se traducen al mostrarlos con `t(...)`. Si falta la traducción se ve el español.
- Las traducciones son filas `[es, en, fr, ca]` en `src/i18n/rows/` (`common.js`, `player.js`, `staff.js`, `catalog/*.js`). Al añadir un texto nuevo hay que añadir su fila; `npm test` (tests/i18n.test.mjs) falla si falta alguna, si las variables `{x}` no coinciden o si un mismo texto tiene dos traducciones.
- Idioma: perfil (`language`) > `localStorage rs_lang` > español. Selector `LanguageSelector` = desplegable pequeño (barra superior en móvil, menú lateral en escritorio, arriba en acceso/alta/pendiente/familia); se puede cambiar en cualquier momento y queda guardado en el perfil. Fechas con `useFormat()` / `useDateLocale()`.
- En desarrollo (`npm run dev`) `window.__i18nMissing` lista los textos pedidos en otro idioma sin traducción (útil con Playwright).
- Fase 1 hecha: acceso, alta, pendiente, jugador y familia (incl. competencias por posición, fútbol 7 y Evaluación 360). Fase 2 (pantallas de personal) y metodología: pendientes. Los textos libres que escribe el cuerpo técnico no se traducen.

## Pendiente importante (recordárselo a Nacho al volver a hablar)
**Informe de evaluación de entrenadores**, primero a nivel metodológico y pensado para que lo use coordinación. Hay que acabar de definirlo con él. Primer borrador de lo que quiere evaluar:
- Según el tipo de sesión (fundamentos individuales / juego colectivo / optimización): si el entrenador sigue las premisas de ese tipo de tarea (nº de jugadores, tipo de contenidos, dimensiones, partido final).
- Parte inicial: si trabaja técnica y hábitos de juego; si hay correcciones; si hay demostración en los ejercicios.
- Tareas principales: correcciones adecuadas, sin pausas excesivas, distancias y espacios adecuados.
- Partido final: tiempo suficiente; dimensiones, formato y nº de jugadores que tocan; correcciones relacionadas con lo trabajado antes y con los elementos principales del sistema de juego.
- Contenidos y tareas adecuados a la categoría y la etapa.
- Que se atiendan todos los bloques (técnica, táctica individual y colectiva ofensiva/defensiva, balón parado, hábitos de juego) con tiempo suficiente (enlaza con el Control de contenidos).
- Planificación: si planifica las sesiones, lleva los equipos preparados y las posibles correcciones preparadas.
Ideas a consultar con él: evaluación de la sesión del TFM (4.8.11, escala 1–4 + decisión) como base.

