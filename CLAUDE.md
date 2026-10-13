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
