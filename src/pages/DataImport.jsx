import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Loader2 } from "lucide-react";

// Hardcoded data
const TEAMS_DATA = [
  { "name": "Primer Equipo", "category": "primera_federacio" },
  { "name": "Juvenil A", "category": "divisio_honor_juvenil" },
  { "name": "Juvenil B", "category": "lliga_nacional_juvenil" },
  { "name": "Cadet A S16", "category": "divisio_honor_cadet_s16" },
  { "name": "Cadet B S16", "category": "preferent_cadet_s16" },
  { "name": "Cadet A S15", "category": "divisio_honor_cadet_s15" },
  { "name": "Cadet B S15", "category": "preferent_cadet_s15" },
  { "name": "Infantil A S14", "category": "divisio_honor_infantil_s14" },
  { "name": "Infantil B S14", "category": "preferent_infantil_s14" },
  { "name": "Infantil A S13", "category": "divisio_honor_infantil_s13" },
  { "name": "Infantil B S13", "category": "preferent_infantil_s13" },
  { "name": "Aleví A S12", "category": "preferent_alevin_s12" },
  { "name": "Aleví B S12", "category": "primera_divisio_alevin_s12" },
  { "name": "Aleví A S11", "category": "preferent_alevin_s11" },
  { "name": "Aleví B S11", "category": "primera_divisio_alevin_s11" },
  { "name": "Benjamí A S10", "category": "preferent_benjamin_s10" },
  { "name": "Benjamí B S10", "category": "primera_divisio_benjamin_s10" },
  { "name": "Benjamí A S9", "category": "preferent_benjamin_s9" },
  { "name": "Benjamí B S9", "category": "primera_divisio_benjamin_s9" },
  { "name": "Prebenjamí S8", "category": "prebenjami_s8" },
  { "name": "Prebenjamí S7", "category": "prebenjami_s7" },
  { "name": "Lúdica Infantil", "category": "ludica_infantil_futbol_7" }
];

const PLAYERS_DATA = [
  {"first_name":"Aleix","last_name":"Farrè Arias","birth_date":"2008-10-12","position":"lateral","secondary_position":"extremo","laterality":"zurdo","jersey_number":23,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Joan","last_name":"Torres Peralta","birth_date":"2008-06-11","position":"lateral","secondary_position":null,"laterality":"diestro","jersey_number":22,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Iker","last_name":"Mbenoun Ngo Ngué","birth_date":"2009-01-12","position":"libre","secondary_position":"central","laterality":"diestro","jersey_number":15,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Matsvei","last_name":"Nestsiarovic","birth_date":"2008-02-08","position":"lateral","secondary_position":null,"laterality":"zurdo","jersey_number":16,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Kaspar","last_name":"Petrosyan","birth_date":"2007-03-01","position":"extremo","secondary_position":null,"laterality":"zurdo","jersey_number":18,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Pau","last_name":"Martínez Cavallè","birth_date":"2008-02-06","position":"extremo","secondary_position":null,"laterality":"zurdo","jersey_number":10,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Pau","last_name":"López-Rivadulla Torrella","birth_date":"2007-07-11","position":"extremo","secondary_position":null,"laterality":"diestro","jersey_number":7,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Víctor","last_name":"Llimós Ferrer","birth_date":"2007-08-22","position":"interior","secondary_position":null,"laterality":"diestro","jersey_number":5,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Mauro","last_name":"Díaz Marín","birth_date":"2007-02-19","position":"interior","secondary_position":null,"laterality":"diestro","jersey_number":3,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Enric","last_name":"Torres Conesa","birth_date":"2008-11-07","position":"lateral","secondary_position":null,"laterality":"diestro","jersey_number":2,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Hugo","last_name":"Sarroca Carmona","birth_date":"2007-11-07","position":"interior","secondary_position":null,"laterality":"zurdo","jersey_number":6,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Toni","last_name":"González Pidemunt","birth_date":"2007-03-02","position":"interior","secondary_position":null,"laterality":"diestro","jersey_number":8,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Luis","last_name":"Hermida Gazquez","birth_date":"2009-06-13","position":"lateral","secondary_position":null,"laterality":"diestro","jersey_number":20,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Gael","last_name":"Planagumà Bagan","birth_date":"2008-05-28","position":"central","secondary_position":null,"laterality":"diestro","jersey_number":9,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Pablo","last_name":"Valls Talens","birth_date":"2009-04-10","position":"central","secondary_position":null,"laterality":"diestro","jersey_number":17,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Albert","last_name":"Casanovas Urpí","birth_date":"2008-11-17","position":"portero","secondary_position":null,"laterality":"diestro","jersey_number":1,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Bruno","last_name":"Vidal Ley","birth_date":"2008-09-20","position":"portero","secondary_position":null,"laterality":"diestro","jersey_number":13,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Biel","last_name":"Cruz Suarez","birth_date":"2007-09-01","position":"extremo","secondary_position":null,"laterality":"diestro","jersey_number":19,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Marc","last_name":"Adamuz Tébar","birth_date":"2007-11-27","position":"interior","secondary_position":null,"laterality":"diestro","jersey_number":11,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Pau","last_name":"Vilalta Puig","birth_date":"2008-11-28","position":"interior","secondary_position":null,"laterality":"diestro","jersey_number":14,"team_name":"Juvenil A","status":"activo"},
  {"first_name":"Pol","last_name":"Royán","birth_date":"2006-05-13","position":"portero","secondary_position":null,"laterality":"diestro","jersey_number":1,"team_name":"Primer Equipo","status":"activo"}
];

const EVENTS_DATA = [
  {"title":"MIC 26","type":"torneo","team_name":"Juvenil A","date":"2026-04-01T16:00","end_date":"2026-04-05T14:00","location":"Lloret (Costa Brava)","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-05-21T16:00","end_date":"2026-05-21T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-04-30T16:00","end_date":"2026-04-30T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-04-23T15:45","end_date":"2026-04-23T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-03-30T15:45","end_date":"2026-03-30T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-04-09T15:45","end_date":"2026-04-09T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"J24 Juvenil A - APA Poble Sec","type":"partido","team_name":"Juvenil A","date":"2026-03-28T13:10","end_date":null,"location":"Camp Teixonera","rival":"APA Poble Sec","is_home":false,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-03-26T16:00","end_date":"2026-03-26T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-03-25T15:45","end_date":"2026-03-25T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"J23 Juvenil A - UE Sant Andreu","type":"partido","team_name":"Juvenil A","date":"2026-03-21T12:00","end_date":null,"location":"Camp Teixonera","rival":"UE Sant Andreu","is_home":true,"score_home":3,"score_away":0},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-03-19T15:45","end_date":"2026-03-19T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-03-18T16:00","end_date":"2026-03-18T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"J22 Juvenil A - CE Jupiter","type":"partido","team_name":"Juvenil A","date":"2026-03-14T12:00","end_date":null,"location":"Camp Teixonera","rival":"CE Jupiter","is_home":false,"score_home":1,"score_away":1},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-03-12T15:45","end_date":"2026-03-12T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-03-11T16:00","end_date":"2026-03-11T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"J21 Juvenil A - Damm B","type":"partido","team_name":"Juvenil A","date":"2026-03-07T12:00","end_date":null,"location":"Camp Teixonera","rival":"Damm B","is_home":true,"score_home":2,"score_away":1},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-03-05T15:45","end_date":"2026-03-05T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-03-04T16:00","end_date":"2026-03-04T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"J20 Juvenil A - RCD Espanyol B","type":"partido","team_name":"Juvenil A","date":"2026-02-28T12:00","end_date":null,"location":"Camp Teixonera","rival":"RCD Espanyol B","is_home":false,"score_home":0,"score_away":2},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-02-26T15:45","end_date":"2026-02-26T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-02-25T16:00","end_date":"2026-02-25T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"J19 Juvenil A - CF Reus","type":"partido","team_name":"Juvenil A","date":"2026-02-22T12:00","end_date":null,"location":"Camp Teixonera","rival":"CF Reus","is_home":true,"score_home":4,"score_away":1},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-02-19T15:45","end_date":"2026-02-19T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-02-18T16:00","end_date":"2026-02-18T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"J18 Juvenil A - Gracia FC","type":"partido","team_name":"Juvenil A","date":"2026-02-15T12:00","end_date":null,"location":"Camp Teixonera","rival":"Gracia FC","is_home":false,"score_home":1,"score_away":2},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-02-12T15:45","end_date":"2026-02-12T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-02-11T16:00","end_date":"2026-02-11T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"J17 Juvenil A - FC Barcelona B","type":"partido","team_name":"Juvenil A","date":"2026-02-07T11:00","end_date":null,"location":"Camp Teixonera","rival":"FC Barcelona B","is_home":true,"score_home":0,"score_away":3},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-02-05T15:45","end_date":"2026-02-05T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-02-04T16:00","end_date":"2026-02-04T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"J16 Juvenil A - AE Prat","type":"partido","team_name":"Juvenil A","date":"2026-01-31T12:00","end_date":null,"location":"Camp Teixonera","rival":"AE Prat","is_home":false,"score_home":2,"score_away":2},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-01-29T15:45","end_date":"2026-01-29T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-01-28T16:00","end_date":"2026-01-28T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"J15 Juvenil A - Montcada","type":"partido","team_name":"Juvenil A","date":"2026-01-24T12:00","end_date":null,"location":"Camp Teixonera","rival":"Montcada","is_home":true,"score_home":3,"score_away":1},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-01-22T15:45","end_date":"2026-01-22T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-01-21T16:00","end_date":"2026-01-21T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"J14 Juvenil A - Cornella","type":"partido","team_name":"Juvenil A","date":"2026-01-17T12:00","end_date":null,"location":"Camp Teixonera","rival":"Cornella","is_home":false,"score_home":1,"score_away":0},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-01-15T15:45","end_date":"2026-01-15T17:15","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"Sesion entrenamiento","type":"entrenamiento","team_name":"Juvenil A","date":"2026-01-14T16:00","end_date":"2026-01-14T17:30","location":"Teixonera","rival":null,"is_home":true,"score_home":null,"score_away":null},
  {"title":"J13 Juvenil A - Nastic Tarragona","type":"partido","team_name":"Juvenil A","date":"2026-01-10T12:00","end_date":null,"location":"Camp Teixonera","rival":"Nastic Tarragona","is_home":true,"score_home":2,"score_away":0},
  {"title":"J12 Juvenil A - UE Viladecans","type":"partido","team_name":"Juvenil A","date":"2025-12-21T12:00","end_date":null,"location":"Camp Teixonera","rival":"UE Viladecans","is_home":false,"score_home":0,"score_away":1},
  {"title":"J11 Juvenil A - Gracia FC","type":"partido","team_name":"Juvenil A","date":"2025-12-13T12:00","end_date":null,"location":"Camp Teixonera","rival":"Gracia FC","is_home":true,"score_home":3,"score_away":2},
  {"title":"J10 Juvenil A - CF Reus","type":"partido","team_name":"Juvenil A","date":"2025-11-29T12:00","end_date":null,"location":"Camp Teixonera","rival":"CF Reus","is_home":false,"score_home":1,"score_away":1},
  {"title":"J9 Juvenil A - Damm B","type":"partido","team_name":"Juvenil A","date":"2025-11-22T12:00","end_date":null,"location":"Camp Teixonera","rival":"Damm B","is_home":false,"score_home":1,"score_away":3},
  {"title":"J8 Juvenil A - APA Poble Sec","type":"partido","team_name":"Juvenil A","date":"2025-11-15T12:00","end_date":null,"location":"Camp Teixonera","rival":"APA Poble Sec","is_home":true,"score_home":2,"score_away":0},
  {"title":"J7 Juvenil A - CE Jupiter","type":"partido","team_name":"Juvenil A","date":"2025-11-01T12:00","end_date":null,"location":"Camp Teixonera","rival":"CE Jupiter","is_home":true,"score_home":4,"score_away":1},
  {"title":"J6 Juvenil A - RCD Espanyol B","type":"partido","team_name":"Juvenil A","date":"2025-10-25T12:00","end_date":null,"location":"Camp Teixonera","rival":"RCD Espanyol B","is_home":true,"score_home":1,"score_away":1},
  {"title":"J5 Juvenil A - AE Prat","type":"partido","team_name":"Juvenil A","date":"2025-10-18T12:00","end_date":null,"location":"Camp Teixonera","rival":"AE Prat","is_home":true,"score_home":3,"score_away":0},
  {"title":"J4 Juvenil A - Montcada","type":"partido","team_name":"Juvenil A","date":"2025-10-11T12:00","end_date":null,"location":"Camp Teixonera","rival":"Montcada","is_home":false,"score_home":2,"score_away":2},
  {"title":"J3 Juvenil A - Cornella","type":"partido","team_name":"Juvenil A","date":"2025-10-04T12:00","end_date":null,"location":"Camp Teixonera","rival":"Cornella","is_home":true,"score_home":1,"score_away":0},
  {"title":"J2 Juvenil A - Nastic Tarragona","type":"partido","team_name":"Juvenil A","date":"2025-09-27T12:00","end_date":null,"location":"Camp Teixonera","rival":"Nastic Tarragona","is_home":false,"score_home":0,"score_away":2},
  {"title":"J1 Juvenil A - UE Viladecans","type":"partido","team_name":"Juvenil A","date":"2025-09-20T12:00","end_date":null,"location":"Camp Teixonera","rival":"UE Viladecans","is_home":true,"score_home":2,"score_away":1}
];

const STAFF_DATA = [
  {"first_name":"Nacho","last_name":"de Prada Bergaz","role":"entrenador","team_role":"primer_entrenador","team_name":"Juvenil A","phone":"660750182","email":"ndeprada@gmail.com"}
];

const MATCHSTATS_DATA = [
  {"player":"Pau Vilalta Puig","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":90,"goals":0,"assists":0,"yellow_cards":0,"red_cards":0,"rating":3},
  {"player":"Pablo Valls Talens","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":90,"goals":0,"assists":0,"yellow_cards":0,"red_cards":0,"rating":3},
  {"player":"Gael Planagumà Bagan","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":90,"goals":1,"assists":0,"yellow_cards":0,"red_cards":0,"rating":8},
  {"player":"Víctor Llimós Ferrer","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":90,"goals":0,"assists":1,"yellow_cards":0,"red_cards":0,"rating":7},
  {"player":"Mauro Díaz Marín","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":90,"goals":0,"assists":0,"yellow_cards":0,"red_cards":0,"rating":6},
  {"player":"Marc Adamuz Tébar","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":90,"goals":1,"assists":0,"yellow_cards":0,"red_cards":0,"rating":8},
  {"player":"Biel Cruz Suarez","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":72,"goals":0,"assists":1,"yellow_cards":0,"red_cards":0,"rating":7},
  {"player":"Toni González Pidemunt","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":90,"goals":0,"assists":0,"yellow_cards":0,"red_cards":0,"rating":6},
  {"player":"Aleix Farrè Arias","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":90,"goals":0,"assists":0,"yellow_cards":0,"red_cards":0,"rating":6},
  {"player":"Hugo Sarroca Carmona","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":90,"goals":1,"assists":0,"yellow_cards":0,"red_cards":0,"rating":8},
  {"player":"Enric Torres Conesa","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":false,"minutes_played":45,"goals":0,"assists":0,"yellow_cards":0,"red_cards":0,"rating":5},
  {"player":"Joan Torres Peralta","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":90,"goals":0,"assists":0,"yellow_cards":0,"red_cards":0,"rating":6},
  {"player":"Luis Hermida Gazquez","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":false,"minutes_played":18,"goals":0,"assists":0,"yellow_cards":0,"red_cards":0,"rating":5},
  {"player":"Albert Casanovas Urpí","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":90,"goals":0,"assists":0,"yellow_cards":0,"red_cards":0,"rating":7},
  {"player":"Pau López-Rivadulla Torrella","event_title":"J23 Juvenil A - UE Sant Andreu","date":"2026-03-21","is_starter":true,"minutes_played":90,"goals":0,"assists":1,"yellow_cards":1,"red_cards":0,"rating":5}
];

export default function DataImport() {
  const [progress, setProgress] = useState({ step: 0, message: "Iniciando importación..." });
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const runImport = async () => {
      try {
        // Clean existing data
        setProgress({ step: 0, message: "Limpiando datos anteriores..." });
        setResults([]);
        
        const entitiesToClean = [
          base44.entities.MatchStats,
          base44.entities.StaffMember,
          base44.entities.Event,
          base44.entities.Player,
          base44.entities.Team,
        ];

        await Promise.all(
          entitiesToClean.map(async (entity) => {
            const records = await entity.filter({});
            await Promise.all(records.map(r => entity.delete(r.id)));
          })
        );

        // Step 1: Insert Teams
        setProgress({ step: 1, message: "Insertando datos nuevos..." });
        setProgress({ step: 1, message: "Insertando 22 Teams..." });
        await base44.entities.Team.bulkCreate(TEAMS_DATA);
        setResults(prev => [...prev, { type: "Teams", count: TEAMS_DATA.length, status: "success" }]);

        // Step 2: Insert Players
        setProgress({ step: 2, message: "Insertando 21 Players (resolviendo team_id)..." });
        const allTeams = await base44.entities.Team.list();
        const teamMap = new Map(allTeams.map(t => [t.name.toLowerCase(), t.id]));

        const playersWithTeamId = PLAYERS_DATA.map(p => {
          const resolvedTeamId = teamMap.get(p.team_name?.toLowerCase());
          const { team_name, ...playerData } = p;
          return { ...playerData, team_id: resolvedTeamId };
        }).filter(p => p.team_id);

        if (playersWithTeamId.length > 0) {
          await base44.entities.Player.bulkCreate(playersWithTeamId);
          setResults(prev => [...prev, { type: "Players", count: playersWithTeamId.length, status: "success" }]);
        }

        // Step 3: Insert Events
        setProgress({ step: 3, message: "Insertando 51 Events (resolviendo team_id)..." });
        const teamsForEvents = await base44.entities.Team.list();
        const teamMapEvents = new Map(teamsForEvents.map(t => [t.name.toLowerCase(), t.id]));

        const eventsWithTeamId = EVENTS_DATA.map(e => {
          const resolvedTeamId = teamMapEvents.get(e.team_name?.toLowerCase());
          const { team_name, ...eventData } = e;
          return { ...eventData, team_id: resolvedTeamId };
        }).filter(e => e.team_id);

        if (eventsWithTeamId.length > 0) {
          await base44.entities.Event.bulkCreate(eventsWithTeamId);
          setResults(prev => [...prev, { type: "Events", count: eventsWithTeamId.length, status: "success" }]);
        }

        // Step 4: Insert Staff
        setProgress({ step: 4, message: "Insertando 1 Staff (resolviendo team_id)..." });
        const teamsForStaff = await base44.entities.Team.list();
        const teamMapStaff = new Map(teamsForStaff.map(t => [t.name.toLowerCase(), t.id]));

        const staffWithTeamId = STAFF_DATA.map(s => {
          const resolvedTeamId = teamMapStaff.get(s.team_name?.toLowerCase());
          const { team_name, ...staffData } = s;
          return { ...staffData, team_id: resolvedTeamId };
        }).filter(s => s.team_id);

        if (staffWithTeamId.length > 0) {
          await base44.entities.StaffMember.bulkCreate(staffWithTeamId);
          setResults(prev => [...prev, { type: "StaffMembers", count: staffWithTeamId.length, status: "success" }]);
        }

        // Step 5: Insert MatchStats
        setProgress({ step: 5, message: "Insertando 15 MatchStats (resolviendo player_id y event_id)..." });
        const allPlayers = await base44.entities.Player.list();
        const allEvents = await base44.entities.Event.list();

        const playerMap = new Map(allPlayers.map(p => [`${p.first_name} ${p.last_name}`.toLowerCase(), p.id]));
        const eventMap = new Map(allEvents.map(e => [`${e.title}|${e.date?.split('T')[0]}`.toLowerCase(), e.id]));

        const matchStatsWithIds = MATCHSTATS_DATA.map(ms => {
          const resolvedPlayerId = playerMap.get(ms.player.toLowerCase());
          const resolvedEventId = eventMap.get(`${ms.event_title}|${ms.date}`.toLowerCase());
          const { player, event_title, ...statsData } = ms;
          return { ...statsData, player_id: resolvedPlayerId, event_id: resolvedEventId, date: ms.date };
        }).filter(ms => ms.player_id && ms.event_id);

        if (matchStatsWithIds.length > 0) {
          await base44.entities.MatchStats.bulkCreate(matchStatsWithIds);
          setResults(prev => [...prev, { type: "MatchStats", count: matchStatsWithIds.length, status: "success" }]);
        }

        setProgress({ step: 5, message: "¡Importación completada!" });
        setIsComplete(true);
      } catch (err) {
        setError("Error durante la importación: " + err.message);
      }
    };

    runImport();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Utilidades</p>
        <h1>Importador de Datos</h1>
        <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Importación automática de Teams, Players, Events y StaffMembers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {["Teams", "Players", "Events", "StaffMembers", "MatchStats"].map((item, idx) => (
          <div key={item} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded flex items-center justify-center text-white text-sm font-black shrink-0 ${
                idx < progress.step ? "bg-green-500" : "bg-gray-300"
              }`}>
                {idx < progress.step ? <CheckCircle className="w-4 h-4" /> : idx + 1}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{item}</p>
                <p className="text-xs text-gray-500 mt-1">Paso {idx + 1}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isComplete && !error && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto" style={{ color: "var(--granate)" }} />
          <p className="font-semibold text-gray-900">{progress.message}</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${(progress.step / 5) * 100}%`, background: "var(--granate)" }}
            />
          </div>
        </div>
      )}

      {isComplete && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="font-bold text-lg text-green-900">¡Importación Completada!</p>
            <p className="text-green-700 mt-2">Se insertaron {results.reduce((sum, r) => sum + r.count, 0)} registros</p>
          </div>

          <div className="grid gap-3">
            {results.map((r) => (
              <div key={r.type} className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                <p className="font-semibold text-gray-900">{r.type}</p>
                <p className="text-sm font-bold text-green-600">{r.count} registros</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex gap-3">
          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-red-600 text-sm font-bold">!</span>
          </div>
          <div>
            <p className="font-semibold text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}