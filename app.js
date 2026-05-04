let CACHE_AGENDA = null;
let CACHE_TIME = 0;
const CACHE_MS = 15000; // 15 segundos

const LEAGUES = {
  // FIFA / Mundo
  "fifa.world": "Mundial FIFA",
  "fifa.cwc": "Mundial de Clubes FIFA",
  "fifa.worldq.conmebol": "Eliminatorias CONMEBOL",
  "fifa.worldq.uefa": "Eliminatorias UEFA",

  // Europa top
  "uefa.champions": "UEFA Champions League",
  "uefa.europa": "UEFA Europa League",
  "uefa.europa.conf": "UEFA Conference League",
  "eng.1": "Premier League",
  "esp.1": "LaLiga",
  "ita.1": "Serie A",
  "ger.1": "Bundesliga",
  "fra.1": "Ligue 1",
  "por.1": "Primeira Liga",
  "ned.1": "Eredivisie",

  // Sudamérica
  "conmebol.libertadores": "CONMEBOL Libertadores",
  "conmebol.sudamericana": "CONMEBOL Sudamericana",
  "bra.1": "Brasileirão Serie A",
  "bra.2": "Brasileirão Serie B",
  "arg.1": "Liga Profesional Argentina",
  "arg.2": "Primera Nacional Argentina",
  "arg.copa": "Copa Argentina",
  "uru.1": "Primera División Uruguay",
  "chi.1": "Primera División Chile",
  "col.1": "Primera A Colombia",
  "ecu.1": "LigaPro Ecuador",
  "per.1": "Liga 1 Perú",
  "par.1": "Primera División Paraguay",
  "bol.1": "Primera División Bolivia",
  "ven.1": "Primera División Venezuela",

  // Norteamérica
  "mex.1": "Liga MX",
  "usa.1": "MLS",
  "concacaf.champions": "CONCACAF Champions Cup",

  // Femenino
  "fifa.wwc": "Mundial Femenino FIFA",
  "uefa.wchampions": "UEFA Women's Champions League",
  "eng.w.1": "Women's Super League Inglaterra",
  "usa.nwsl": "NWSL Estados Unidos",
};

const LEAGUE_PRIORITY = {
  "fifa.world": 1,
  "fifa.cwc": 2,
  "fifa.worldq.conmebol": 4,
  "fifa.worldq.uefa": 5,

  "uefa.champions": 10,
  "uefa.europa": 11,
  "uefa.europa.conf": 12,
  "eng.1": 20,
  "esp.1": 21,
  "ita.1": 22,
  "ger.1": 23,
  "fra.1": 24,
  "por.1": 50,
  "ned.1": 51,

  "conmebol.libertadores": 100,
  "conmebol.sudamericana": 101,
  "bra.1": 110,
  "bra.2": 112,
  "arg.1": 120,
  "arg.copa": 121,
  "arg.2": 123,
  "uru.1": 130,
  "chi.1": 131,
  "col.1": 132,
  "ecu.1": 133,
  "per.1": 134,
  "par.1": 135,
  "bol.1": 136,
  "ven.1": 137,

  "mex.1": 200,
  "usa.1": 201,
  "concacaf.champions": 202,

  "fifa.wwc": 500,
  "uefa.wchampions": 501,
  "eng.w.1": 503,
  "usa.nwsl": 504,
};

const SCOREBOARD_URLS = [
  "https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard",
  "https://site.web.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard",
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json,text/plain,*/*",
  "Referer": "https://www.espn.com.ar/futbol/calendario",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

const HEADERS_365 = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json,text/plain,*/*",
  "Origin": "https://www.365scores.com",
  "Referer": "https://www.365scores.com/",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

function fechaArgentinaDate() {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    yyyy: map.year,
    mm: map.month,
    dd: map.day,
    yyyymmdd: `${map.year}${map.month}${map.day}`,
    ddmmyyyy: `${map.day}/${map.month}/${map.year}`,
  };
}

function fechaApiUTC() {
  return fechaArgentinaDate().yyyymmdd;
}

function toArgentinaDateTime(iso) {
  if (!iso) {
    return {
      fecha: null,
      hora_inicio: null,
    };
  }

  const date = new Date(iso);

  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    fecha: `${map.year}-${map.month}-${map.day}`,
    hora_inicio: `${map.hour}:${map.minute}`,
  };
}

function normalizarScore(score) {
  if (score === undefined || score === null) return null;

  if (typeof score === "object") {
    score = score.value ?? score.displayValue ?? score.score;
  }

  if (score === undefined || score === null) return null;

  const number = Number(score);
  return Number.isFinite(number) ? String(number) : String(score);
}

function minutoNumero(value) {
  if (!value) return 0;
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function obtenerLogo(team) {
  const logos = team?.logos || [];

  for (const logo of logos) {
    if (logo.href && logo.href.toLowerCase().includes(".png")) {
      return logo.href;
    }
  }

  if (logos[0]?.href) return logos[0].href;
  if (team?.logo) return team.logo;
  if (team?.id) return `https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png`;

  return null;
}

function obtenerLogoLiga(leagueData, leagueSlug) {
  const logos = leagueData?.logos || [];

  for (const logo of logos) {
    if (logo.href && logo.href.toLowerCase().includes(".png")) {
      return logo.href;
    }
  }

  if (logos[0]?.href) return logos[0].href;

  const fallback = {
    "fifa.world": "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
    "fifa.cwc": "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png",
    "uefa.champions": "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
    "uefa.europa": "https://a.espncdn.com/i/leaguelogos/soccer/500/2310.png",
    "uefa.europa.conf": "https://a.espncdn.com/i/leaguelogos/soccer/500/2026.png",

    "eng.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
    "esp.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png",
    "ita.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png",
    "ger.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png",
    "fra.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png",
    "por.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/14.png",
    "ned.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/11.png",

    "conmebol.libertadores": "https://a.espncdn.com/i/leaguelogos/soccer/500/58.png",
    "conmebol.sudamericana": "https://a.espncdn.com/i/leaguelogos/soccer/500/2026.png",

    "bra.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/85.png",
    "bra.2": "https://a.espncdn.com/i/leaguelogos/soccer/500/85.png",
    "arg.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/1.png",
    "arg.2": "https://a.espncdn.com/i/leaguelogos/soccer/500/1.png",
    "arg.copa": "https://a.espncdn.com/i/leaguelogos/soccer/500/1.png",

    "uru.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/70.png",
    "chi.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/72.png",
    "col.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/41.png",
    "ecu.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/44.png",
    "per.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/45.png",
    "par.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/46.png",
    "bol.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/47.png",
    "ven.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/48.png",

    "mex.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/22.png",
    "usa.1": "https://a.espncdn.com/i/leaguelogos/soccer/500/19.png",
    "concacaf.champions": "https://a.espncdn.com/i/leaguelogos/soccer/500/13.png",
  };

  return fallback[leagueSlug] || null;
}

function extraerEstado(competition) {
  const status = competition?.status || {};
  const type = status.type || {};

  const estado_nombre = type.name || null;
  const completado = Boolean(type.completed);
  const minuto = status.displayClock || null;

  let mostrar_tiempo = type.shortDetail || type.description || null;

  if (
    completado ||
    estado_nombre === "STATUS_FINAL" ||
    estado_nombre === "STATUS_FULL_TIME"
  ) {
    mostrar_tiempo = "Fin";
  } else if (
    estado_nombre !== "STATUS_SCHEDULED" &&
    minuto &&
    minuto !== "0'"
  ) {
    mostrar_tiempo = minuto;
  }

  return {
    estado: type.description || null,
    estado_corto: type.shortDetail || null,
    estado_nombre,
    completado,
    minuto,
    periodo: status.period || null,
    mostrar_tiempo,
  };
}

// Versión rápida: ya no consulta ESPN summary.
async function elegirCompetenciaMasActualizada(event, leagueSlug) {
  return event.competitions?.[0] || {};
}

function partidoEmpezo(estado, marcadorLocal, marcadorVisitante) {
  const activos = new Set([
    "STATUS_IN_PROGRESS",
    "STATUS_FIRST_HALF",
    "STATUS_SECOND_HALF",
    "STATUS_HALFTIME",
    "STATUS_END_PERIOD",
    "STATUS_FINAL",
    "STATUS_FULL_TIME",
  ]);

  const noIniciados = new Set([
    "STATUS_SCHEDULED",
    "STATUS_POSTPONED",
    "STATUS_CANCELED",
    "STATUS_SUSPENDED",
    "STATUS_DELAYED",
    "STATUS_ABANDONED",
  ]);

  if (noIniciados.has(estado.estado_nombre)) return false;
  if (estado.completado) return true;
  if (activos.has(estado.estado_nombre)) return true;

  if (
    estado.minuto &&
    estado.minuto !== "0'" &&
    estado.estado_nombre !== "STATUS_SCHEDULED"
  ) {
    return true;
  }

  const gl = Number(marcadorLocal || 0);
  const gv = Number(marcadorVisitante || 0);

  return gl > 0 || gv > 0;
}

function extraerEquipos(competition) {
  const competitors = competition?.competitors || [];

  const data = {
    local: null,
    visitante: null,
    local_id: null,
    visitante_id: null,
    local_logo: null,
    visitante_logo: null,
    marcador_local: null,
    marcador_visitante: null,
  };

  for (const c of competitors) {
    const team = c.team || {};
    const nombre = team.displayName || team.shortDisplayName || team.name || null;
    const score = normalizarScore(c.score);

    if (c.homeAway === "home") {
      data.local = nombre;
      data.local_id = team.id || null;
      data.local_logo = obtenerLogo(team);
      data.marcador_local = score;
    }

    if (c.homeAway === "away") {
      data.visitante = nombre;
      data.visitante_id = team.id || null;
      data.visitante_logo = obtenerLogo(team);
      data.marcador_visitante = score;
    }
  }

  return data;
}

function limpiarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\bclub\b/g, "")
    .replace(/\batletico\b/g, "atletico")
    .replace(/\bdeportivo\b/g, "deportivo")
    .replace(/\bca\b/g, "")
    .replace(/\bfc\b/g, "")
    .replace(/\bcf\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensEquipo(nombre) {
  return limpiarTexto(nombre)
    .split(" ")
    .filter((t) => t.length >= 3);
}

function similitudNombre(a, b) {
  const ta = tokensEquipo(a);
  const tb = tokensEquipo(b);

  if (!ta.length || !tb.length) return 0;

  const aa = limpiarTexto(a);
  const bb = limpiarTexto(b);

  if (aa === bb) return 100;
  if (aa.includes(bb) || bb.includes(aa)) return 90;

  let hits = 0;

  for (const token of ta) {
    if (tb.includes(token)) hits++;
  }

  return Math.round((hits / Math.max(ta.length, tb.length)) * 100);
}

function formatoMinuto365(game) {
  const statusText = game?.statusText || "";
  const shortStatusText = game?.shortStatusText || "";
  const gameTime = Number(game?.gameTime || 0);

  if (
    game?.statusGroup === 4 ||
    /final/i.test(statusText) ||
    /final/i.test(shortStatusText)
  ) {
    return "Fin";
  }

  if (game?.gameTimeDisplay) {
    return String(game.gameTimeDisplay);
  }

  if (gameTime > 0) {
    return `${Math.floor(gameTime)}'`;
  }

  return null;
}

function convertir365Game(game) {
  const local = game?.homeCompetitor?.name || null;
  const visitante = game?.awayCompetitor?.name || null;

  if (!local || !visitante) return null;

  const marcadorLocal = normalizarScore(game?.homeCompetitor?.score);
  const marcadorVisitante = normalizarScore(game?.awayCompetitor?.score);

  const completado =
    game?.statusGroup === 4 ||
    /final/i.test(game?.statusText || "") ||
    /final/i.test(game?.shortStatusText || "");

  const enVivo =
    game?.statusGroup === 3 ||
    (!completado && Number(game?.gameTime || 0) > 0);

  const minuto = formatoMinuto365(game);

  return {
    id_365: game.id || null,
    local_365: local,
    visitante_365: visitante,
    liga_365: game.competitionDisplayName || null,
    start_365: game.startTime || null,
    estado_365: game.statusText || null,
    estado_corto_365: game.shortStatusText || null,
    status_group_365: game.statusGroup ?? null,
    game_time_365: game.gameTime ?? null,
    minuto_365: minuto,
    completado_365: completado,
    en_vivo_365: enVivo,
    marcador_local_365: marcadorLocal,
    marcador_visitante_365: marcadorVisitante,
    resultado_365:
      marcadorLocal !== null && marcadorVisitante !== null
        ? `${marcadorLocal}-${marcadorVisitante}`
        : null,
  };
}

async function fetch365Scores() {
  const fecha = fechaArgentinaDate().ddmmyyyy;

  const urls = [
    `https://webws.365scores.com/web/games/allscores/?appTypeId=5&langId=14&timezoneName=America%2FBuenos_Aires&userCountryId=386&sports=1&startDate=${encodeURIComponent(fecha)}&endDate=${encodeURIComponent(fecha)}&onlyMajorGames=true&withTop=true&topBookmaker=14`,
    `https://webws.365scores.com/web/games/allscores/?appTypeId=5&langId=14&timezoneName=America%2FBuenos_Aires&userCountryId=386&sports=1&startDate=${encodeURIComponent(fecha)}&endDate=${encodeURIComponent(fecha)}&withTop=true&topBookmaker=14`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(`${url}&_=${Date.now()}`, {
        headers: HEADERS_365,
        cache: "no-store",
      });

      if (!response.ok) continue;

      const data = await response.json();
      const games = Array.isArray(data.games) ? data.games : [];

      if (games.length) {
        return games.map(convertir365Game).filter(Boolean);
      }
    } catch {
      // Si falla 365Scores, seguimos con ESPN.
    }
  }

  return [];
}

function buscarPartido365(partido, juegos365) {
  let mejor = null;
  let mejorScore = 0;

  for (const game of juegos365) {
    const directaLocal = similitudNombre(partido.local, game.local_365);
    const directaVisitante = similitudNombre(partido.visitante, game.visitante_365);

    const invertidaLocal = similitudNombre(partido.local, game.visitante_365);
    const invertidaVisitante = similitudNombre(partido.visitante, game.local_365);

    const directa = directaLocal + directaVisitante;
    const invertida = invertidaLocal + invertidaVisitante;

    const score = Math.max(directa, invertida);

    if (score > mejorScore) {
      mejorScore = score;
      mejor = {
        game,
        invertido: invertida > directa,
        score,
      };
    }
  }

  if (!mejor || mejor.score < 110) return null;

  return mejor;
}

function aplicar365(partido, juegos365) {
  const match = buscarPartido365(partido, juegos365);

  if (!match) {
    return {
      ...partido,
      fuente_live: partido.fuente_live || "ESPN",
      match_365: null,
    };
  }

  const game = match.game;

  const marcadorLocal365 = match.invertido
    ? game.marcador_visitante_365
    : game.marcador_local_365;

  const marcadorVisitante365 = match.invertido
    ? game.marcador_local_365
    : game.marcador_visitante_365;

  const tieneMarcador365 =
    marcadorLocal365 !== null &&
    marcadorVisitante365 !== null;

  const usar365 =
    game.completado_365 ||
    game.en_vivo_365 ||
    minutoNumero(game.minuto_365) >= minutoNumero(partido.minuto) ||
    tieneMarcador365;

  if (!usar365) {
    return {
      ...partido,
      fuente_live: partido.fuente_live || "ESPN",
      match_365: {
        id_365: game.id_365,
        score_match: match.score,
        usado: false,
      },
    };
  }

  let hora = partido.hora;
  let mostrarTiempo = partido.mostrar_tiempo;
  let estado = partido.estado;
  let estadoCorto = partido.estado_corto;
  let estadoNombre = partido.estado_nombre;
  let completado = partido.completado;
  let minuto = partido.minuto;

  if (game.completado_365) {
    hora = "Fin";
    mostrarTiempo = "Fin";
    estado = "Finalizado";
    estadoCorto = "Final";
    estadoNombre = "STATUS_FINAL";
    completado = true;
    minuto = "Fin";
  } else if (game.minuto_365) {
    hora = game.minuto_365;
    mostrarTiempo = game.minuto_365;
    estado = game.estado_365 || "En vivo";
    estadoCorto = game.estado_corto_365 || game.minuto_365;
    estadoNombre = "STATUS_IN_PROGRESS";
    completado = false;
    minuto = game.minuto_365;
  }

  const resultado =
    tieneMarcador365
      ? `${marcadorLocal365}-${marcadorVisitante365}`
      : partido.resultado;

  return {
    ...partido,

    hora,
    mostrar_tiempo: mostrarTiempo,

    estado,
    estado_corto: estadoCorto,
    estado_nombre: estadoNombre,
    completado,
    minuto,

    marcador_local: tieneMarcador365 ? marcadorLocal365 : partido.marcador_local,
    marcador_visitante: tieneMarcador365 ? marcadorVisitante365 : partido.marcador_visitante,

    marcador_local_display: tieneMarcador365 ? marcadorLocal365 : partido.marcador_local_display,
    marcador_visitante_display: tieneMarcador365 ? marcadorVisitante365 : partido.marcador_visitante_display,

    resultado,
    mostrar_marcador: tieneMarcador365 ? true : partido.mostrar_marcador,

    fuente_live: "365Scores",
    match_365: {
      id_365: game.id_365,
      local_365: game.local_365,
      visitante_365: game.visitante_365,
      liga_365: game.liga_365,
      estado_365: game.estado_365,
      minuto_365: game.minuto_365,
      resultado_365: game.resultado_365,
      score_match: match.score,
      invertido: match.invertido,
      usado: true,
    },
  };
}

async function limpiarEvento(event, leagueSlug, leagueName, leagueLogo = null) {
  const competition = await elegirCompetenciaMasActualizada(event, leagueSlug);
  const equipos = extraerEquipos(competition);
  const estado = extraerEstado(competition);

  const mostrarMarcador = partidoEmpezo(
    estado,
    equipos.marcador_local,
    equipos.marcador_visitante
  );

  const fechaEvento = competition.date || event.date;
  const { fecha, hora_inicio } = toArgentinaDateTime(fechaEvento);

  let hora = hora_inicio;

  if (estado.completado) {
    hora = "Fin";
  } else if (
    estado.estado_nombre !== "STATUS_SCHEDULED" &&
    estado.minuto &&
    estado.minuto !== "0'"
  ) {
    hora = estado.minuto;
  }

  const resultado =
    mostrarMarcador &&
    equipos.marcador_local !== null &&
    equipos.marcador_visitante !== null
      ? `${equipos.marcador_local}-${equipos.marcador_visitante}`
      : null;

  const urlEspn = event.links?.[0]?.href || null;
  const prioridad = LEAGUE_PRIORITY[leagueSlug] ?? 9999;

  return {
    id: event.id || null,
    partido:
      equipos.local && equipos.visitante
        ? `${equipos.local} vs ${equipos.visitante}`
        : event.name || null,

    local: equipos.local,
    visitante: equipos.visitante,
    local_id: equipos.local_id,
    visitante_id: equipos.visitante_id,
    local_logo: equipos.local_logo,
    visitante_logo: equipos.visitante_logo,

    liga: leagueName,
    liga_corta: leagueName,
    liga_slug: leagueSlug,
    liga_logo: leagueLogo,
    prioridad_liga: prioridad,

    competicion: {
      nombre: leagueName,
      nombre_corto: leagueName,
      slug: leagueSlug,
      logo: leagueLogo,
      prioridad,
    },

    fecha,
    hora_inicio,

    hora,
    mostrar_tiempo: hora,

    estado: estado.estado,
    estado_corto: estado.estado_corto,
    estado_nombre: estado.estado_nombre,
    completado: estado.completado,
    minuto: estado.minuto,
    periodo: estado.periodo,

    marcador_local: equipos.marcador_local,
    marcador_visitante: equipos.marcador_visitante,

    marcador_local_display: mostrarMarcador ? equipos.marcador_local : null,
    marcador_visitante_display: mostrarMarcador ? equipos.marcador_visitante : null,

    resultado,
    mostrar_marcador: mostrarMarcador,

    goleadores: [],

    fecha_espn: fechaEvento || null,
    url_espn: urlEspn,

    fuente_live: "ESPN",
    match_365: null,
  };
}

async function fetchLeague(leagueSlug, leagueName) {
  const params = new URLSearchParams({
    region: "ar",
    lang: "es",
    contentorigin: "espn",
    dates: fechaApiUTC(),
    limit: "300",
    _: String(Date.now()),
  });

  let lastError = null;

  for (const template of SCOREBOARD_URLS) {
    const url = `${template.replace("{league}", leagueSlug)}?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: HEADERS,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const events = Array.isArray(data.events) ? data.events : [];
      const leagueData = Array.isArray(data.leagues) ? data.leagues[0] : null;

      return {
        leagueSlug,
        leagueName,
        leagueLogo: obtenerLogoLiga(leagueData, leagueSlug),
        events,
        ok: true,
        error: null,
      };
    } catch (error) {
      lastError = error.message;
    }
  }

  return {
    leagueSlug,
    leagueName,
    leagueLogo: obtenerLogoLiga(null, leagueSlug),
    events: [],
    ok: false,
    error: lastError,
  };
}

function agruparPorLiga(partidos) {
  const ligas = {};

  for (const partido of partidos) {
    const liga = partido.liga || "Sin competición";
    const prioridad = partido.prioridad_liga ?? 9999;

    if (!ligas[liga]) {
      ligas[liga] = {
        liga,
        liga_slug: partido.liga_slug,
        liga_logo: partido.liga_logo || null,
        prioridad,
        partidos: [],
      };
    }

    if (!ligas[liga].liga_logo && partido.liga_logo) {
      ligas[liga].liga_logo = partido.liga_logo;
    }

    ligas[liga].partidos.push(partido);
  }

  const agrupado = Object.values(ligas).map((ligaData) => {
    ligaData.partidos.sort((a, b) => {
      return (
        String(a.fecha || "").localeCompare(String(b.fecha || "")) ||
        String(a.hora_inicio || "").localeCompare(String(b.hora_inicio || "")) ||
        String(a.partido || "").localeCompare(String(b.partido || ""))
      );
    });

    return {
      liga: ligaData.liga,
      liga_slug: ligaData.liga_slug,
      liga_logo: ligaData.liga_logo || null,
      prioridad: ligaData.prioridad,
      total: ligaData.partidos.length,
      partidos: ligaData.partidos,
    };
  });

  agrupado.sort((a, b) => {
    return (
      (a.prioridad ?? 9999) - (b.prioridad ?? 9999) ||
      String(a.liga || "").localeCompare(String(b.liga || ""))
    );
  });

  return agrupado;
}

async function buildAgenda() {
  const [results, juegos365] = await Promise.all([
    Promise.all(
      Object.entries(LEAGUES).map(([slug, name]) => fetchLeague(slug, name))
    ),
    fetch365Scores(),
  ]);

  const partidos = [];
  const errores = [];
  const vistos = new Set();

  for (const result of results) {
    if (!result.ok) {
      errores.push({
        liga: result.leagueName,
        slug: result.leagueSlug,
        error: result.error,
      });
      continue;
    }

    for (const event of result.events) {
      const key = event.id || `${result.leagueSlug}-${event.name}-${event.date}`;

      if (vistos.has(key)) continue;

      const itemBase = await limpiarEvento(
        event,
        result.leagueSlug,
        result.leagueName,
        result.leagueLogo
      );

      if (itemBase.local && itemBase.visitante) {
        const itemFinal = aplicar365(itemBase, juegos365);
        partidos.push(itemFinal);
        vistos.add(key);
      }
    }
  }

  partidos.sort((a, b) => {
    return (
      (a.prioridad_liga ?? 9999) - (b.prioridad_liga ?? 9999) ||
      String(a.fecha || "").localeCompare(String(b.fecha || "")) ||
      String(a.hora_inicio || "").localeCompare(String(b.hora_inicio || "")) ||
      String(a.partido || "").localeCompare(String(b.partido || ""))
    );
  });

  return {
    fuente: "ESPN Argentina + 365Scores",
    metodo: "Cloudflare Worker ESPN scoreboard + corrector 365Scores + logos de liga + caché 15s",
    fecha_scrapeo: new Date().toISOString(),
    total: partidos.length,
    total_ligas_consultadas: Object.keys(LEAGUES).length,
    total_partidos_365scores: juegos365.length,
    partidos,
    agrupado_por_liga: agruparPorLiga(partidos),
    errores,
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Cache-Control": "no-store",
        },
      });
    }

    if (url.pathname === "/" || url.pathname === "/agenda") {
      try {
        const now = Date.now();

        if (CACHE_AGENDA && now - CACHE_TIME < CACHE_MS) {
          return jsonResponse({
            ...CACHE_AGENDA,
            cache_worker: true,
            cache_edad_segundos: Math.round((now - CACHE_TIME) / 1000),
          });
        }

        const data = await buildAgenda();

        CACHE_AGENDA = data;
        CACHE_TIME = now;

        return jsonResponse({
          ...data,
          cache_worker: false,
          cache_edad_segundos: 0,
        });
      } catch (error) {
        return jsonResponse(
          {
            ok: false,
            error: error.message,
          },
          500
        );
      }
    }

    return jsonResponse(
      {
        ok: false,
        error: "Ruta no encontrada. Usa /agenda",
      },
      404
    );
  },
};
