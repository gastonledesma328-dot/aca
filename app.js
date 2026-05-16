const EVENTS_URL = "https://raw.githubusercontent.com/gastonledesma328-dot/2612163/refs/heads/main/eventos_streamhdx.json";

const WORKER_BASE_URL = "https://partidos-hoy-worker.gastonledesma328.workers.dev";

// Worker viejo / compatible
const AGENDA_URL = `${WORKER_BASE_URL}/`;
const AGENDA_ENDPOINT = `${WORKER_BASE_URL}/`;
const AGENDA_LIVE_ENDPOINT = `${WORKER_BASE_URL}/live`;
const TV_PARTIDOS_URL = "./data/tv_partidos.json";

const INCIDENCIAS_WORKER_BASE_URL = "https://partidos-hoy-incidencias-worker.gastonledesma328.workers.dev";
const INCIDENCIAS_ENDPOINT = `${INCIDENCIAS_WORKER_BASE_URL}/api/incidencias`;

/*
  ============================================================
  FLUJO GENERAL DEL PROYECTO
  ============================================================

  1) PARTIDOS EN VIVO:
     - Usa EVENTS_URL.
     - Lee el archivo eventos_streamhdx.json desde GitHub.
     - Ese JSON ya debe traer la hora correcta en Argentina.
     - La web muestra event.hora directamente.

  2) AGENDA:
     - Usa AGENDA_ENDPOINT.
     - Lee / del Worker compatible de Cloudflare.
     - Ese endpoint devuelve data/agenda.json generado por GitHub Actions.

  3) LIVE:
     - Usa AGENDA_LIVE_ENDPOINT.
     - Lee /live del Worker 1.
     - Actualiza solo minuto, marcador y estado sin recargar toda la agenda.

  4) INCIDENCIAS:
     - Usa INCIDENCIAS_ENDPOINT.
     - Lee /api/incidencias del Worker 2.
     - Actualiza goleadores, minuto del gol y cantidad de rojas por equipo.
     - No muestra jugador expulsado.

  IMPORTANTE:
  Este app.js no genera los horarios.
  Solo muestra lo que recibe.
  Si eventos_streamhdx.json trae "hora": "11:45", la web va a mostrar 11:45.
  Para que muestre 13:45, el JSON final tiene que venir con "hora": "13:45".
*/

const tabs = document.querySelectorAll(".tab");
const utilityPanel = document.querySelector("#utilityPanel");
const searchToggle = document.querySelector("#searchToggle");
const calendarToggle = document.querySelector("#calendarToggle");
const profileToggle = document.querySelector("#profileToggle");
const matchSearch = document.querySelector("#matchSearch");
const utilityStatus = document.querySelector("#utilityStatus");
const dateButtons = document.querySelectorAll("[data-day]");
const playToggle = document.querySelector("#playToggle");
const videoCard = document.querySelector("#videoCard");
const featuredFrame = document.querySelector("#featuredFrame");
const videoState = document.querySelector("#videoState");
const watchButton = document.querySelector(".watch-btn");
const reloadEmbed = document.querySelector("#reloadEmbed");
const volumeToggle = document.querySelector("#volumeToggle");
const focusToggle = document.querySelector("#focusToggle");
const featured = document.querySelector(".featured");
const featuredStatus = document.querySelector("#featuredStatus");
const mainScore = document.querySelector("#mainScore");
const leagueGrid = document.querySelector("#leagueGrid");
const gamesSection = document.querySelector("#gamesSection");
const liveSection = document.querySelector("#liveSection");
const liveGrid = document.querySelector("#liveGrid");
const liveTitle = document.querySelector("#liveTitle");
const refreshLive = document.querySelector("#refreshLive");
const postForm = document.querySelector("#postForm");
const postInput = document.querySelector("#postInput");
const postFeed = document.querySelector("#postFeed");
const postCounter = document.querySelector("#postCounter");

let activeTab = "agenda";
let muted = false;
let favoriteMode = false;
let events = [];
let agendaLiveMatches = [];
let agendaLiveLoaded = false;
let currentAgendaDate = new Date();

let agendaLoadedDate = "";
let agendaLoading = false;
let featuredChannels = [];
let featuredChannelIndex = 0;
let featuredEmbedTimer = null;
let featuredEmbedUserStarted = false;
let TV_PARTIDOS_CACHE = null;
let TV_PARTIDOS_LOADING = null;
let TV_PARTIDOS_READY = false;
let agendaTimerMatches = new Map();
let agendaVisualTimerStarted = false;
let agendaCurrentMatches = [];
let incidenciasLoading = false;

const FEATURED_LOGO_FALLBACKS = {
  flamengo: "https://a.espncdn.com/i/teamlogos/soccer/500/819.png",
  medellin: "https://a.espncdn.com/i/teamlogos/soccer/500/2690.png",
  "independiente medellin": "https://a.espncdn.com/i/teamlogos/soccer/500/2690.png",
  "independiente medellín": "https://a.espncdn.com/i/teamlogos/soccer/500/2690.png",
};

const CACHE_TTL_MS = 90_000;
const LIVE_REFRESH_MS = 60_000;
const LIVE_VISUAL_TIMER_MS = 1_000;
const LIVE_CACHE_TTL_MS = 15_000;
const LIVE_FETCH_TIMEOUT_MS = 3_000;
const INCIDENCIAS_REFRESH_MS = 120_000;
const INCIDENCIAS_CACHE_TTL_MS = 120_000;
const INCIDENCIAS_FETCH_TIMEOUT_MS = 5_000;
const STALE_CACHE_TTL_MS = 20 * 60_000;
const requestCache = new Map();
const APP_CACHE_VERSION = "v5-worker2-logo-goles-layout";
const CACHE_KEY_AGENDA = `agenda-worker-cache-${APP_CACHE_VERSION}`;
const CACHE_KEY_LIVE = `agenda-live-worker-cache-${APP_CACHE_VERSION}`;
const CACHE_KEY_TV = `tv-partidos-cache-${APP_CACHE_VERSION}`;
const CACHE_KEY_STREAMS = `stream-events-cache-${APP_CACHE_VERSION}`;
const CACHE_KEY_INCIDENCIAS = `incidencias-worker-cache-${APP_CACHE_VERSION}`;
const CACHE_KEY_INCIDENCIAS_ESTADO = `incidencias-estado-cache-${APP_CACHE_VERSION}`;
const INCIDENCIAS_MEMORIA = new Map();

const STATIC_STREAM_FALLBACKS = [
  {
    titulo: "Copa Libertadores: Junior vs Cerro Porteño",
    categoria: "futbol",
    clase: "LIB",
    fecha: "Jueves 07 de Mayo 2026",
    fecha_iso: "2026-05-07",
    hora: "23:00",
    duracion_min: 140,
    canales: [
      {
        nombre: "Fanatiz",
        calidad: "720p",
        url: "https://streamhdx.com/live1.php?stream=fanatiz9",
      },
      {
        nombre: "Disney+",
        calidad: "720p",
        url: "https://streamhdx.com/live1.php?stream=disney11",
      },
    ],
  },
];

function inyectarAjustesVisuales() {
  if (document.getElementById("partidos-hoy-ajustes-visuales")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "partidos-hoy-ajustes-visuales";
  style.textContent = `
    .agenda-incidencias-box {
      grid-column: 1 / -1;
      width: 100%;
      min-width: 0;
      display: block;
    }

    .agenda-goals-row {
      width: 100%;
      min-width: 0;
      display: grid;
      grid-template-columns: 1fr;
      gap: 4px;
      margin-top: 3px;
    }

    .agenda-goals-row.has-both-sides {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    .agenda-goals-team:empty,
    .agenda-goals-unknown:empty {
      display: none !important;
    }

    .agenda-goal-item {
      width: 100%;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 3px 8px;
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
      line-height: 1.15;
    }

    .agenda-goal-item span {
      min-width: 0;
      overflow: visible;
      text-overflow: clip;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .league-logo-fallback {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    @media (max-width: 640px) {
      .agenda-goals-row.has-both-sides {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}


function injectAgendaGoalSideStyles() {
  if (document.getElementById("agenda-goal-side-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "agenda-goal-side-styles";
  style.textContent = `
    .agenda-goals-row {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 0;
      width: 100%;
      overflow: hidden;
    }

    .agenda-goals-row.has-side-divider::after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 1px;
      background: rgba(255,255,255,0.18);
      transform: translateX(-0.5px);
      pointer-events: none;
    }

    .agenda-goals-team,
    .agenda-goals-team:empty {
      min-width: 0;
      display: flex !important;
      align-items: center;
      justify-content: center;
      padding: 0 6px;
    }

    .agenda-goals-home {
      justify-content: center;
    }

    .agenda-goals-away {
      justify-content: center;
    }

    .agenda-goal-item {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .agenda-goal-item span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .agenda-goals-empty {
      min-height: 18px;
      display: block;
      opacity: 0;
    }

    .agenda-goal-side {
      display: none !important;
    }

    @media (max-width: 720px) {
      .agenda-goals-row {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
    }
  `;
  document.head.append(style);
}

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date;
}

function readJsonCache(key, maxAge = CACHE_TTL_MS) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw);

    if (Date.now() - cached.savedAt > maxAge) {
      return null;
    }

    return cached.data;
  } catch (error) {
    return null;
  }
}

function readAnyJsonCache(key) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw).data;
  } catch (error) {
    return null;
  }
}

function writeJsonCache(key, data) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      })
    );
  } catch (error) {
    // Cache is best-effort only.
  }
}

async function fetchJsonCached(url, cacheKey, ttl = CACHE_TTL_MS, options = {}) {
  const networkFirst = options.networkFirst === true;

  if (!networkFirst) {
    const fresh = readJsonCache(cacheKey, ttl);

    if (fresh) {
      return fresh;
    }
  }

  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey);
  }

  const finalUrl = networkFirst
    ? `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`
    : url;

  const timeoutMs = Number(options.timeoutMs || 0);
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timeout = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  const request = fetch(finalUrl, {
    cache: networkFirst ? "reload" : "default",
    signal: controller?.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      return response.json();
    })
    .then((data) => {
      writeJsonCache(cacheKey, data);
      return data;
    })
    .catch((error) => {
      const stale = readJsonCache(cacheKey, STALE_CACHE_TTL_MS);

      if (stale) {
        return stale;
      }

      throw error;
    })
    .finally(() => {
      if (timeout) {
        window.clearTimeout(timeout);
      }

      requestCache.delete(cacheKey);
    });

  requestCache.set(cacheKey, request);
  return request;
}

function fetchAgendaPayload() {
  return fetchJsonCached(
    AGENDA_ENDPOINT,
    CACHE_KEY_AGENDA,
    CACHE_TTL_MS,
    {
      networkFirst: true,
    }
  );
}

function fetchAgendaLivePayload() {
  return fetchJsonCached(
    AGENDA_LIVE_ENDPOINT,
    CACHE_KEY_LIVE,
    LIVE_CACHE_TTL_MS,
    {
      networkFirst: true,
      timeoutMs: LIVE_FETCH_TIMEOUT_MS,
    }
  );
}

function incidenciaCacheKey(match) {
  const id = String(match?.id || match?.uid || "").trim();
  const liga = String(match?.liga_slug || match?.competicion?.slug || "").trim();
  const gameId = String(match?.id_365 || match?.match_365?.id_365 || "").trim();
  const teams = agendaTeams(match || {});

  // Clave estable: no usamos gameId si ya hay id ESPN, porque a veces llega después
  // y eso hacía que se pierdan los goles/rojas guardados.
  if (id && liga) {
    return `${id}|${liga}`;
  }

  if (gameId) {
    return `365|${gameId}`;
  }

  return [
    normalizeText(teams.home),
    normalizeText(teams.away),
    agendaDate(match),
  ]
    .filter(Boolean)
    .join("|");
}

function incidenciasDataTieneDatos(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  return (
    listaConDatos(data.goleadores) ||
    numeroMayorQueCero(data.local_rojas) ||
    numeroMayorQueCero(data.visitante_rojas)
  );
}

function incidenciasDesdeMatch(match = {}) {
  return {
    goleadores: Array.isArray(match.goleadores) ? match.goleadores : [],
    local_rojas: Number(match.local_rojas || match.rojas_local || match.tarjetas_rojas_local || 0),
    visitante_rojas: Number(match.visitante_rojas || match.rojas_visitante || match.tarjetas_rojas_visitante || 0),
    actualizado_en: match.incidencias_actualizado_en || new Date().toISOString(),
  };
}

function fusionarIncidenciasData(prev = {}, next = {}) {
  const prevGoles = Array.isArray(prev.goleadores) ? prev.goleadores : [];
  const nextGoles = Array.isArray(next.goleadores) ? next.goleadores : [];

  return {
    goleadores: listaConDatos(nextGoles) ? nextGoles : prevGoles,
    local_rojas: Math.max(Number(prev.local_rojas || 0), Number(next.local_rojas || 0)),
    visitante_rojas: Math.max(Number(prev.visitante_rojas || 0), Number(next.visitante_rojas || 0)),
    actualizado_en: next.actualizado_en || prev.actualizado_en || new Date().toISOString(),
  };
}

function cargarIncidenciasPersistidas() {
  try {
    const raw = localStorage.getItem(CACHE_KEY_INCIDENCIAS_ESTADO);
    if (!raw) return;

    const saved = JSON.parse(raw);
    const entries = saved && typeof saved === "object" ? saved.entries || saved : {};

    Object.entries(entries).forEach(([key, data]) => {
      if (key && incidenciasDataTieneDatos(data)) {
        INCIDENCIAS_MEMORIA.set(key, data);
      }
    });
  } catch (error) {
    // Cache persistente best-effort.
  }
}

function guardarIncidenciasPersistidas() {
  try {
    const entries = Object.fromEntries(INCIDENCIAS_MEMORIA.entries());
    localStorage.setItem(
      CACHE_KEY_INCIDENCIAS_ESTADO,
      JSON.stringify({
        savedAt: Date.now(),
        entries,
      })
    );
  } catch (error) {
    // Cache persistente best-effort.
  }
}

function guardarIncidenciasMatch(match) {
  const key = incidenciaCacheKey(match);
  if (!key) return;

  const next = incidenciasDesdeMatch(match);
  if (!incidenciasDataTieneDatos(next)) return;

  const prev = INCIDENCIAS_MEMORIA.get(key) || {};
  INCIDENCIAS_MEMORIA.set(key, fusionarIncidenciasData(prev, next));
  guardarIncidenciasPersistidas();
}

function aplicarIncidenciasDataAlPartido(match, data) {
  if (!incidenciasDataTieneDatos(data)) {
    return match;
  }

  return {
    ...match,
    goleadores: listaConDatos(data.goleadores)
      ? data.goleadores
      : match.goleadores || [],
    tarjetas_rojas: [],
    local_rojas: numeroMayorQueCero(data.local_rojas)
      ? Number(data.local_rojas)
      : Number(match.local_rojas || 0),
    visitante_rojas: numeroMayorQueCero(data.visitante_rojas)
      ? Number(data.visitante_rojas)
      : Number(match.visitante_rojas || 0),
    incidencias_actualizadas: true,
    incidencias_actualizado_en: data.actualizado_en || match.incidencias_actualizado_en || null,
  };
}

function aplicarIncidenciasPersistidas(match) {
  const key = incidenciaCacheKey(match);
  const data = key ? INCIDENCIAS_MEMORIA.get(key) : null;
  return data ? aplicarIncidenciasDataAlPartido(match, data) : match;
}

function aplicarIncidenciasPersistidasALista(matches) {
  return (Array.isArray(matches) ? matches : []).map(aplicarIncidenciasPersistidas);
}

async function fetchIncidenciasPartido(match) {
  const id = String(match?.id || "").trim();
  const liga = String(match?.liga_slug || match?.competicion?.slug || "").trim();
  const gameId = String(match?.id_365 || match?.match_365?.id_365 || "").trim();
  const cacheKey = `${CACHE_KEY_INCIDENCIAS}:${incidenciaCacheKey(match)}`;

  if (!id || !liga) {
    return readJsonCache(cacheKey, INCIDENCIAS_CACHE_TTL_MS) || null;
  }

  const params = new URLSearchParams();
  params.set("id", id);
  // liga = slug ESPN para summary, ejemplo: uru.1 / par.1 / bol.1
  params.set("liga", liga);

  // Datos extra para que Worker 2 pueda matchear manualmente 365Scores
  // aunque el slug ESPN no se parezca al nombre de la liga.
  const ligaNombre = String(match?.liga || match?.liga_corta || match?.competicion?.nombre || "").trim();
  const fecha = String(agendaDate(match) || match?.fecha || match?.fecha_espn || "").slice(0, 10);
  const hora = String(match?.hora_inicio || match?.hora || "").trim();

  if (gameId) params.set("gameId", gameId);
  if (ligaNombre) params.set("liga_nombre", ligaNombre);
  if (fecha) params.set("fecha", fecha);
  if (hora) params.set("hora", hora);
  if (match.local) params.set("local", match.local);
  if (match.visitante) params.set("visitante", match.visitante);
  if (match.local_id) params.set("local_id", match.local_id);
  if (match.visitante_id) params.set("visitante_id", match.visitante_id);

  // No cacheamos respuestas vacías. Si el Worker 2 tarda en encontrar los datos,
  // una respuesta sin goles no debe bloquear futuras consultas durante 2 minutos.
  const fresh = readJsonCache(cacheKey, INCIDENCIAS_CACHE_TTL_MS);
  if (fresh && incidenciasDataTieneDatos(normalizarIncidenciasPayload(fresh))) {
    return fresh;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), INCIDENCIAS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${INCIDENCIAS_ENDPOINT}?${params.toString()}&_=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const normalizada = normalizarIncidenciasPayload(data);

    if (incidenciasDataTieneDatos(normalizada)) {
      writeJsonCache(cacheKey, data);
      return data;
    }

    const stale = readJsonCache(cacheKey, STALE_CACHE_TTL_MS);
    return stale || data;
  } catch (error) {
    const stale = readJsonCache(cacheKey, STALE_CACHE_TTL_MS);
    if (stale) return stale;
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function fetchStreamEventsPayload() {
  return fetchJsonCached(
    `${EVENTS_URL}?v=${Math.floor(Date.now() / CACHE_TTL_MS)}`,
    CACHE_KEY_STREAMS
  );
}

async function cargarTvPartidos() {
  if (TV_PARTIDOS_CACHE) {
    return TV_PARTIDOS_CACHE;
  }

  if (TV_PARTIDOS_LOADING) {
    return TV_PARTIDOS_LOADING;
  }

  TV_PARTIDOS_LOADING = fetchJsonCached(
    `${TV_PARTIDOS_URL}?v=${Date.now()}`,
    CACHE_KEY_TV,
    CACHE_TTL_MS,
    {
      networkFirst: true,
    }
  )
    .then((data) => {
      TV_PARTIDOS_CACHE = data && typeof data === "object"
        ? data
        : { partidos: {} };
      TV_PARTIDOS_READY = true;

      return TV_PARTIDOS_CACHE;
    })
    .catch((error) => {
      console.warn("Error cargando TV de partidos:", error);

      const stale = readAnyJsonCache(CACHE_KEY_TV);

      TV_PARTIDOS_CACHE = stale && typeof stale === "object"
        ? stale
        : { partidos: {} };
      TV_PARTIDOS_READY = true;

      return TV_PARTIDOS_CACHE;
    })
    .finally(() => {
      TV_PARTIDOS_LOADING = null;
    });

  return TV_PARTIDOS_LOADING;
}

function normalizarTextoTV(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/['’`´.]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensEquipoTV(nombre) {
  const base = normalizarTextoTV(nombre);

  const reemplazos = {
    "utd": "united",
    "intl": "internacional",
    "inter": "internacional",
    "st": "saint",
    "dep": "deportivo",
    "atl": "atletico",
    "kansas": "kansas",
  };

  const stopwords = new Set([
    "club",
    "ca",
    "fc",
    "cf",
    "sc",
    "cd",
    "ac",
    "afc",
    "the",
    "de",
    "del",
    "da",
    "do",
    "la",
    "el",
    "los",
    "las",
    "y",
    "and",
  ]);

  const compactosEspeciales = {
    "lafc": ["los", "angeles"],
    "nycfc": ["new", "york", "city"],
    "nyrb": ["new", "york", "red", "bulls"],
    "psg": ["paris", "saint", "germain"],
  };

  if (compactosEspeciales[base]) {
    return compactosEspeciales[base];
  }

  const tokens = base
    .split(" ")
    .map((t) => reemplazos[t] || t)
    .filter((t) => t && !stopwords.has(t));

  // Caso común: "Sporting Kansas City" frente a "Sporting KC".
  if (tokens.includes("sporting") && tokens.includes("kansas") && tokens.includes("city")) {
    return ["sporting", "kc"];
  }

  if (tokens.includes("sporting") && tokens.includes("kc")) {
    return ["sporting", "kc"];
  }

  // Caso común: "Los Angeles FC" frente a "LAFC".
  if (tokens.includes("los") && tokens.includes("angeles")) {
    return ["los", "angeles"];
  }

  // Caso común: "St Louis City SC" frente a variantes con Saint/St.
  if (tokens.includes("saint") && tokens.includes("louis")) {
    return ["saint", "louis", "city"];
  }

  return tokens;
}

function inicialesEquipoTV(tokens) {
  return tokens
    .filter((t) => t.length > 1)
    .map((t) => t[0])
    .join("");
}

function normalizarEquipoTV(nombre) {
  return tokensEquipoTV(nombre).join(" ");
}

function tokenParecidoTV(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;

  if (a.length <= 3 || b.length <= 3) {
    return a.startsWith(b) || b.startsWith(a);
  }

  return a.includes(b) || b.includes(a);
}

function similitudTV(a, b) {
  const ta = tokensEquipoTV(a);
  const tb = tokensEquipoTV(b);

  if (!ta.length || !tb.length) return 0;

  const na = ta.join(" ");
  const nb = tb.join(" ");

  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.92;

  const ia = inicialesEquipoTV(ta);
  const ib = inicialesEquipoTV(tb);

  // LAFC ≈ Los Angeles FC, NYCFC ≈ New York City FC, PSG ≈ Paris Saint Germain.
  if (ia && ib && (ia === ib || ia.includes(ib) || ib.includes(ia))) {
    return 0.9;
  }

  let comunes = 0;

  for (const tokenA of ta) {
    if (tb.some((tokenB) => tokenParecidoTV(tokenA, tokenB))) {
      comunes += 1;
    }
  }

  const score = comunes / Math.max(ta.length, tb.length);
  const comparteFuerte = ta.some((x) => x.length >= 5 && tb.some((y) => tokenParecidoTV(x, y)));

  if (score >= 0.5 && comparteFuerte) {
    return Math.max(score, 0.74);
  }

  return score;
}

function mismoPartidoTV(match, tv) {
  const localAgenda = match.local || match.home || match.equipo_local || "";
  const visitanteAgenda = match.visitante || match.away || match.equipo_visitante || "";

  const localTV = tv.local || "";
  const visitanteTV = tv.visitante || "";

  const directo =
    similitudTV(localAgenda, localTV) >= 0.72 &&
    similitudTV(visitanteAgenda, visitanteTV) >= 0.72;

  const invertido =
    similitudTV(localAgenda, visitanteTV) >= 0.72 &&
    similitudTV(visitanteAgenda, localTV) >= 0.72;

  return directo || invertido;
}

function tieneCanalesConfirmados(canales) {
  if (!Array.isArray(canales)) return false;

  return canales.some((canal) => {
    const value = String(canal || "").trim().toLowerCase();
    return value && value !== "a confirmar" && value !== "sin datos";
  });
}
const CANALES_TV_BLOQUEADOS_POR_LIGA = [
  "liga futve youtube",
  "liga futve",
  "ligafutve app",
];

function canalBloqueadoParaAgenda(match, canal) {
  const canalNorm = normalizarTextoTV(canal);
  const ligaAgenda = normalizarTextoTV(
    `${match?.liga || ""} ${match?.liga_corta || ""} ${match?.competicion?.nombre || ""} ${inferAgendaLeague(match) || ""}`
  );

  const esArgentina =
    ligaAgenda.includes("liga profesional") ||
    ligaAgenda.includes("torneo betano") ||
    ligaAgenda.includes("copa argentina") ||
    ligaAgenda.includes("primera nacional") ||
    ligaAgenda.includes("argentina");

  if (esArgentina && CANALES_TV_BLOQUEADOS_POR_LIGA.some((c) => canalNorm.includes(c))) {
    return true;
  }

  return false;
}

function canalesValidosParaAgenda(match, canales) {
  if (!Array.isArray(canales)) return [];

  return canales.filter((canal) => {
    const value = String(canal || "").trim().toLowerCase();

    if (!value || value === "a confirmar" || value === "sin datos") {
      return false;
    }

    if (canalBloqueadoParaAgenda(match, canal)) {
      return false;
    }

    return true;
  });
}

function ligaCompatibleTV(match, tv) {
  const ligaAgenda = normalizarTextoTV(
    `${match?.liga || ""} ${match?.liga_corta || ""} ${match?.competicion?.nombre || ""} ${inferAgendaLeague(match) || ""}`
  );

  const ligaTv = normalizarTextoTV(
    `${tv?.liga || ""} ${tv?.pais || ""} ${tv?.partido || ""}`
  );

  const agendaArgentina =
    ligaAgenda.includes("liga profesional") ||
    ligaAgenda.includes("torneo betano") ||
    ligaAgenda.includes("copa argentina") ||
    ligaAgenda.includes("primera nacional") ||
    ligaAgenda.includes("argentina");

  if (agendaArgentina) {
    return (
      ligaTv.includes("torneo betano") ||
      ligaTv.includes("liga profesional") ||
      ligaTv.includes("copa argentina") ||
      ligaTv.includes("primera nacional") ||
      ligaTv.includes("argentina")
    );
  }

  return true;
}

const LIGAS_SIN_DONDE_VER = [
  "liga mx",
  "liga profesional boliviana",
  "division profesional bolivia",
  "división profesional bolivia",
  "bolivia",
  "ligapro ecuador",
  "ligapro serie a",
  "liga pro ecuador",
  "ecuador",
];

function ligaTvBloqueada(match, tv = null) {
  const textos = [
    match?.liga,
    match?.liga_corta,
    match?.competicion?.nombre,
    match?.competicion?.name,
    inferAgendaLeague(match),
    tv?.liga,
    tv?.pais,
  ]
    .filter(Boolean)
    .map((value) => normalizarTextoTV(value));

  return textos.some((texto) =>
    LIGAS_SIN_DONDE_VER.some((bloqueada) => texto.includes(normalizarTextoTV(bloqueada)))
  );
}


function fechaAgendaParaTV(match) {
  return String(
    agendaDate(match) ||
    match.fecha ||
    match.fecha_iso ||
    match.date ||
    match.dia ||
    match.fecha_espn ||
    ""
  ).slice(0, 10);
}

function buscarTvPorNombre(tvData, match) {
  const partidosObj = tvData?.partidos || {};
  const partidos = Array.isArray(partidosObj)
    ? partidosObj
    : Object.values(partidosObj);

  const fechaMatch = fechaAgendaParaTV(match);

  let mejor = null;
  let mejorScore = 0;

  for (const tv of partidos) {
    if (!tv || !tieneCanalesConfirmados(tv.canales)) continue;
    if (ligaTvBloqueada(match, tv)) continue;
    if (!ligaCompatibleTV(match, tv)) continue;

    const canalesValidos = canalesValidosParaAgenda(match, tv.canales);

    if (!canalesValidos.length) continue;

    const fechaTv = String(tv.fecha || tv.dia || "").slice(0, 10);

    if (fechaMatch && fechaTv && fechaMatch !== fechaTv) {
      continue;
    }

    const localAgenda = match.local || match.home || match.equipo_local || "";
    const visitanteAgenda = match.visitante || match.away || match.equipo_visitante || "";

    const scoreDirecto =
      similitudTV(localAgenda, tv.local) +
      similitudTV(visitanteAgenda, tv.visitante);

    const scoreInvertido =
      similitudTV(localAgenda, tv.visitante) +
      similitudTV(visitanteAgenda, tv.local);

    const score = Math.max(scoreDirecto, scoreInvertido);

    if (score < 1.35) {
      continue;
    }

    if (score > mejorScore) {
      mejorScore = score;
      mejor = {
        ...tv,
        canales: canalesValidos,
      };
    }
  }

  return mejor;
}

function renderTvPartido(tv) {
  const canales = Array.isArray(tv?.canales) ? tv.canales : [];

  if (!tieneCanalesConfirmados(canales)) {
    return "";
  }

  const canalesLimpios = canales.filter((canal) => {
    const value = String(canal || "").trim().toLowerCase();
    return value && value !== "a confirmar" && value !== "sin datos";
  });

  return `
    <span class="tv-box" title="Fuente: ${escapeHtml(tv?.fuente || "Fútbol en Vivo Argentina")}">
      <span class="tv-label">Dónde ver</span>
      <span class="tv-canales">
        ${canalesLimpios
          .map((canal) => `<span class="tv-chip tv-chip-confirmado">${escapeHtml(canal)}</span>`)
          .join("")}
      </span>
    </span>
  `;
}

function obtenerTvPartidoSync(match) {
  if (ligaTvBloqueada(match)) {
    return {
      canales: [],
      fuente: "",
      confianza: "bloqueada",
    };
  }

  const tvData = TV_PARTIDOS_CACHE;

  if (!tvData || typeof tvData !== "object") {
    return {
      canales: [],
      fuente: "",
      confianza: "baja",
    };
  }

  const partidosObj = tvData.partidos || {};
  const partidos = Array.isArray(partidosObj)
    ? partidosObj
    : Object.values(partidosObj);

  if (!partidos.length) {
    return {
      canales: [],
      fuente: "",
      confianza: "baja",
    };
  }

  // 1) Intento por ID exacto, si alguna vez coinciden.
  const idsAgenda = [
    match.id,
    match.uid,
    match.fixture_id,
    match.event_id,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (const tv of partidos) {
    const idsTv = [
      tv.id,
      tv.uid,
      tv.fixture_id,
      tv.event_id,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    if (
      idsAgenda.some((id) => idsTv.includes(id)) &&
      tieneCanalesConfirmados(tv.canales) &&
      !ligaTvBloqueada(match, tv) &&
      ligaCompatibleTV(match, tv)
    ) {
      const canalesValidosId = canalesValidosParaAgenda(match, tv.canales);

      if (canalesValidosId.length) {
        return {
          ...tv,
          canales: canalesValidosId,
        };
      }
    }
  }

  // 2) Intento por nombres normalizados + fecha.
  const byName = buscarTvPorNombre(tvData, match);

  if (
    byName &&
    tieneCanalesConfirmados(byName.canales) &&
    !ligaTvBloqueada(match, byName) &&
    ligaCompatibleTV(match, byName)
  ) {
    const canalesValidosNombre = canalesValidosParaAgenda(match, byName.canales);

    if (canalesValidosNombre.length) {
      return {
        ...byName,
        canales: canalesValidosNombre,
      };
    }
  }

  return {
    canales: [],
    fuente: "",
    confianza: "baja",
  };
}


async function getStreamEventsFallback() {
  try {
    const payload = await fetchStreamEventsPayload();

    if (Array.isArray(payload)) {
      return payload;
    }
  } catch (error) {
    // Fall through to in-memory and stale caches.
  }

  if (events.length) {
    return events;
  }

  const stale = readAnyJsonCache(CACHE_KEY_STREAMS);

  if (Array.isArray(stale) && stale.length) {
    return stale;
  }

  return STATIC_STREAM_FALLBACKS;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function crearTeamId(nombre) {
  return String(nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function teamProfileHref(nombre, logo = "", liga = "") {
  const id = crearTeamId(nombre);
  const params = new URLSearchParams();

  params.set("id", id);

  if (logo) {
    params.set("logo", logo);
  }

  if (liga) {
    params.set("liga", liga);
  }

  return `equipo.html?${params.toString()}`;
}

window.teamProfileHref = teamProfileHref;
window.crearTeamId = crearTeamId;

function setUtilityOpen(open) {
  utilityPanel.classList.remove("hidden");
  searchToggle.setAttribute("aria-expanded", "true");
  calendarToggle.setAttribute("aria-expanded", "true");

  if (open) {
    matchSearch.focus();
  }
}

function setUtilityStatus(text = "") {
  utilityStatus.textContent = text;
  utilityStatus.classList.toggle("hidden", !text);
}

function showSection(section) {
  const isLive = section === "live";

  gamesSection.classList.toggle("hidden", section !== "games");
  liveSection.classList.toggle("hidden", !isLive);
  leagueGrid.classList.toggle("hidden", section !== "agenda");
  featured.classList.toggle("hidden", !isLive);
}

/* ============================================================
   EVENTOS STREAMHDX / PARTIDOS EN VIVO
============================================================ */

function eventStart(event) {
  const fecha = event.fecha_iso || event.fecha;
  const hora = event.hora || "00:00";

  if (!fecha) {
    return new Date(NaN);
  }

  return new Date(`${fecha}T${hora}:00-03:00`);
}

function eventEnd(event) {
  return new Date(
    eventStart(event).getTime() + Number(event.duracion_min || 140) * 60_000
  );
}

function eventStatus(event, now = new Date()) {
  const start = eventStart(event);
  const end = eventEnd(event);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "upcoming";
  }

  if (now >= start && now <= end) {
    return "live";
  }

  return now < start ? "upcoming" : "ended";
}

function splitTitle(title = "") {
  const parts = title.split(":");
  const competition = parts.length > 1 ? parts.shift().trim() : "Evento";
  const matchup = parts.join(":").trim() || title;
  const teams = matchup.split(/\s+vs\.?\s+/i);

  return {
    competition,
    matchup,
    home: teams[0]?.trim() || "Local",
    away: teams[1]?.trim() || "Visitante",
  };
}

function streamElapsedLabel(event, now = new Date()) {
  const elapsed = Math.max(1, Math.floor((now - eventStart(event)) / 60_000));

  if (elapsed > Number(event.duracion_min || 140)) {
    return "Fin";
  }

  return `${elapsed}'`;
}

function startsAfterNightThreshold(event) {
  const [hours = "0", minutes = "0"] = String(event.hora || "00:00").split(":");
  const totalMinutes = Number(hours) * 60 + Number(minutes);

  return totalMinutes >= 21 * 60 + 30;
}

function eventIsLiveByNightRule(event, now = new Date()) {
  const start = eventStart(event);
  const end = eventEnd(event);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  return startsAfterNightThreshold(event) && now >= start && now <= end;
}

function eventBelongsToTodayOrRecentNight(event, now = new Date()) {
  const today = localDateISO(now);
  const yesterday = localDateISO(dateFromOffsetForBase(now, -1));

  return (
    event.fecha_iso === today ||
    (event.fecha_iso === yesterday && startsAfterNightThreshold(event))
  );
}

function compactMatchName(value) {
  return normalizeText(value)
    .replace(/\b(club|fc|cf|sc|deportivo|independiente|atletico|atl|cd)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLookRelated(a, b) {
  const left = compactMatchName(a);
  const right = compactMatchName(b);

  if (!left || !right) {
    return false;
  }

  return left.includes(right) || right.includes(left);
}

function agendaTeams(match) {
  const parts = String(match.partido || "").split(/\s+vs\.?\s+/i);

  return {
    home: match.local || parts[0]?.trim() || "",
    away: match.visitante || parts[1]?.trim() || "",
  };
}

function isAgendaMatchLive(match) {
  const statusText = normalizeText(
    `${match.mostrar_tiempo || ""} ${match.minuto || ""} ${match.estado_corto || ""} ${match.estado || ""}`
  );

  if (match.completado === true || /fin|final|full time|\bft\b/.test(statusText)) {
    return false;
  }

  if (/scheduled|programado|prox/.test(statusText)) {
    return false;
  }

  return (
    match.mostrar_marcador === true ||
    /live|en vivo|entretiempo|descanso|halftime|\bht\b/.test(statusText) ||
    /(^|\s)\d{1,3}('|’|\+| min)/.test(statusText)
  );
}


function agendaTimerKey(match) {
  return String(
    match?.id ||
      match?.uid ||
      agendaMatchKey(match || {}) ||
      `${match?.local || ""}-${match?.visitante || ""}-${match?.hora_inicio || match?.hora || ""}`
  );
}

function extraerMinutoAgendaNumero(value) {
  const text = String(value || "");

  if (!text || /fin|final|full time|ft/i.test(text)) {
    return null;
  }

  const match = text.match(/(\d{1,3})(?:\+\d{1,2})?['’]?/);
  const minute = match ? Number(match[1]) : null;

  if (!Number.isFinite(minute) || minute <= 0 || minute > 130) {
    return null;
  }

  return minute;
}

function partidoPermiteTimerVisual(match) {
  if (!match || match.completado === true) {
    return false;
  }

  const statusText = normalizeText(
    `${match.mostrar_tiempo || ""} ${match.minuto || ""} ${match.estado_corto || ""} ${match.estado || ""} ${match.estado_nombre || ""}`
  );

  if (/fin|final|full time|\bft\b|scheduled|programado|postponed|cancelado|suspendido/.test(statusText)) {
    return false;
  }

  return isAgendaMatchLive(match);
}

function calcularTimerSuave(timerMatch, now = Date.now()) {
  const baseMinute = Number(
    timerMatch?.live_sync_minuto ||
      extraerMinutoAgendaNumero(timerMatch?.minuto || timerMatch?.mostrar_tiempo)
  );
  const syncTs = Number(timerMatch?.live_sync_ts || 0);

  if (!Number.isFinite(baseMinute) || baseMinute <= 0 || !syncTs) {
    return {
      minuto: Number.isFinite(baseMinute) ? baseMinute : null,
      syncTs: now,
    };
  }

  const elapsedMs = Math.max(0, now - syncTs);
  const extraMinutes = Math.floor(elapsedMs / 60_000);

  return {
    minuto: Math.min(baseMinute + extraMinutes, 130),
    // Mantenemos el resto del minuto para que no salte de golpe al refrescar /live.
    syncTs: syncTs + extraMinutes * 60_000,
  };
}

function sincronizarTimerPartido(match) {
  if (!match || !partidoPermiteTimerVisual(match)) {
    return match;
  }

  const minutoApi = extraerMinutoAgendaNumero(
    match.minuto || match.mostrar_tiempo || match.hora || match.estado_corto
  );

  if (!minutoApi) {
    return match;
  }

  const key = agendaTimerKey(match);
  const previous = agendaTimerMatches.get(key);
  const now = Date.now();

  // Primera sincronización: usamos el minuto que llegó de ESPN/365.
  if (!previous?.live_sync_minuto || !previous?.live_sync_ts) {
    const synced = {
      ...match,
      live_sync_minuto: minutoApi,
      live_sync_ts: now,
    };

    agendaTimerMatches.set(key, synced);
    return synced;
  }

  const visualActual = calcularTimerSuave(previous, now);
  const previousMinute = Number(previous.live_sync_minuto || 0);

  // Regla principal:
  // aunque la API salte de 75 a 77/80, la pantalla avanza como reloj: 75, 76, 77...
  // Nunca retrocede y nunca adelanta más de lo que corresponde por tiempo real.
  const minutoSuavizado = Math.max(
    previousMinute,
    visualActual.minuto || previousMinute
  );

  const synced = {
    ...match,
    live_sync_minuto: minutoSuavizado,
    live_sync_ts: visualActual.syncTs || now,
    live_api_minuto: minutoApi,
  };

  agendaTimerMatches.set(key, synced);
  return synced;
}

function calcularMinutoVisual(match) {
  if (!partidoPermiteTimerVisual(match)) {
    return null;
  }

  const key = agendaTimerKey(match);
  const timerMatch = agendaTimerMatches.get(key) || match;
  const timer = calcularTimerSuave(timerMatch);

  if (!Number.isFinite(timer.minuto) || timer.minuto <= 0) {
    const minute = extraerMinutoAgendaNumero(match.minuto || match.mostrar_tiempo || match.hora);
    return minute ? `${minute}'` : null;
  }

  return `${timer.minuto}'`;
}

function actualizarTimersVisibles() {
  document.querySelectorAll("[data-live-timer-id]").forEach((el) => {
    const match = agendaTimerMatches.get(el.dataset.liveTimerId);
    const visual = calcularMinutoVisual(match);

    if (visual) {
      el.textContent = visual;
    }
  });

  document.querySelectorAll("[data-live-state-id]").forEach((el) => {
    const match = agendaTimerMatches.get(el.dataset.liveStateId);
    const visual = calcularMinutoVisual(match);

    if (visual) {
      el.textContent = visual;
    }
  });
}

function iniciarAgendaVisualTimer() {
  if (agendaVisualTimerStarted) {
    return;
  }

  agendaVisualTimerStarted = true;
  window.setInterval(actualizarTimersVisibles, LIVE_VISUAL_TIMER_MS);
}

function eventHasLiveAgendaMatch(event) {
  if (eventStatus(event) === "live") {
    return true;
  }

  if (!agendaLiveLoaded) {
    return false;
  }

  if (!agendaLiveMatches.length) {
    return false;
  }

  const eventInfo = splitTitle(event.titulo);

  return agendaLiveMatches.some((match) => {
    const teams = agendaTeams(match);
    const sameOrder =
      namesLookRelated(eventInfo.home, teams.home) &&
      namesLookRelated(eventInfo.away, teams.away);
    const swappedOrder =
      namesLookRelated(eventInfo.home, teams.away) &&
      namesLookRelated(eventInfo.away, teams.home);

    return sameOrder || swappedOrder;
  });
}

async function fetchAgendaLiveMatches(date = new Date()) {
  const selectedDate = localDateISO(date);
  const payload = await fetchAgendaLivePayload();
  const partidos = uniqueMatches(
    Array.isArray(payload.partidos) ? payload.partidos : []
  );

  return partidos.filter((match) => {
    return agendaMatchesSelectedDate(match, selectedDate) && isAgendaMatchLive(match);
  });
}

function randomFeaturedEvent() {
  const pool = events.filter(eventHasLiveAgendaMatch);

  if (!pool.length) {
    return null;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

function autoplayEmbedUrl(url, shouldMute = muted) {
  if (!url || /^file:/i.test(String(url))) {
    return "about:blank";
  }

  try {
    const embedUrl = new URL(url, window.location.href);

    if (embedUrl.protocol === "file:") {
      return "about:blank";
    }

    if (!embedUrl.searchParams.has("autoplay")) {
      embedUrl.searchParams.set("autoplay", "1");
    }

    embedUrl.searchParams.set("muted", shouldMute ? "1" : "0");
    embedUrl.searchParams.set("mute", shouldMute ? "1" : "0");
    embedUrl.searchParams.set("volume", shouldMute ? "0" : "1");

    if (!embedUrl.searchParams.has("playsinline")) {
      embedUrl.searchParams.set("playsinline", "1");
    }

    return embedUrl.href;
  } catch (error) {
    return url;
  }
}

function loadFeaturedEmbed(channel, shouldMute = muted) {
  const rawUrl = channel?.url || videoCard.dataset.channelUrl || "";
  const embedSrc = rawUrl ? autoplayEmbedUrl(rawUrl, shouldMute) : "";

  window.clearTimeout(featuredEmbedTimer);

  if (!embedSrc || embedSrc === "about:blank") {
    featuredFrame.src = "about:blank";
    featuredFrame.title = "Reproductor sin canal";
    videoCard.classList.remove("playing");
    videoState.textContent = "Sin canal";
    return;
  }

  featuredEmbedUserStarted = true;
  videoCard.dataset.channelUrl = rawUrl;
  videoCard.classList.add("has-embed", "playing");

  if (featuredFrame.src !== embedSrc) {
    featuredFrame.src = embedSrc;
  }

  featuredFrame.title = `Reproductor ${channel?.nombre || videoCard.dataset.channelName || "canal en vivo"}`;
  videoState.textContent = `Transmitiendo ${channel?.nombre || videoCard.dataset.channelName || "canal"}`.trim();

  featuredEmbedTimer = window.setTimeout(() => {
    tryNextFeaturedChannel();
  }, 7000);
}

function setFeaturedEmbed(channel, options = {}) {
  const rawUrl = channel?.url || "";
  const channelName = channel?.nombre || "canal";
  const shouldAutoLoad = Boolean(options.autoLoad);

  videoCard.dataset.channelUrl = rawUrl;
  videoCard.dataset.channelName = channelName;
  videoCard.classList.toggle("has-embed", Boolean(rawUrl));
  videoCard.classList.remove("playing");
  muted = false;
  volumeToggle.classList.remove("active");
  volumeToggle.title = "Silenciar";

  window.clearTimeout(featuredEmbedTimer);

  // Importante: no cargamos el iframe/stream automáticamente.
  // Los m3u8 lentos hacían que la página pareciera tardar más de 1 minuto.
  featuredFrame.src = "about:blank";
  featuredFrame.title = rawUrl
    ? `Reproductor listo: ${channelName}`
    : "Reproductor sin canal";

  if (!rawUrl) {
    videoState.textContent = "Sin canal";
    return;
  }

  videoState.textContent = `Canal listo: ${channelName}. Tocá Ver canal para reproducir.`;

  if (shouldAutoLoad) {
    loadFeaturedEmbed(channel);
  }
}
function setFeaturedChannels(channels = []) {
  featuredChannels = channels.filter((channel) => channel?.url);
  featuredChannelIndex = 0;
  featuredEmbedUserStarted = false;
  setFeaturedEmbed(featuredChannels[featuredChannelIndex] || null);
}

function tryNextFeaturedChannel() {
  if (featuredChannels.length <= 1) {
    return;
  }

  featuredChannelIndex = (featuredChannelIndex + 1) % featuredChannels.length;
  const nextChannel = featuredChannels[featuredChannelIndex];

  videoState.textContent = featuredEmbedUserStarted
    ? `Probando ${nextChannel.nombre || "alternativa"}`
    : `Canal listo: ${nextChannel.nombre || "alternativa"}`;
  setFeaturedEmbed(nextChannel, { autoLoad: featuredEmbedUserStarted });
}

function fallbackFeaturedLogo(teamName) {
  const normalized = normalizeText(teamName);

  return FEATURED_LOGO_FALLBACKS[normalized] || "";
}

function featuredTeamLogo(event, side, teamName = "") {
  const prefixes = side === "home"
    ? ["local", "home", "equipo_local", "team_home"]
    : ["visitante", "away", "equipo_visitante", "team_away"];
  const teamIndex = side === "home" ? 0 : 1;
  const candidates = [
    event.equipos?.[teamIndex],
    event.teams?.[teamIndex],
    event.competitors?.[teamIndex],
    event.competidores?.[teamIndex],
  ].filter(Boolean);

  for (const prefix of prefixes) {
    const logo =
      event[`${prefix}_logo`] ||
      event[`${prefix}_escudo`] ||
      event[`${prefix}Logo`] ||
      event[`${prefix}Escudo`] ||
      event[prefix]?.logo ||
      event[prefix]?.escudo ||
      event[prefix]?.image ||
      event[prefix]?.imagen;

    if (logo) {
      return logo;
    }
  }

  for (const team of candidates) {
    const logo = team.logo || team.escudo || team.image || team.imagen || team.logo_url;

    if (logo) {
      return logo;
    }
  }

  return fallbackFeaturedLogo(teamName);
}

function setFeaturedCrest(selector, teamName, logo) {
  const crest = document.querySelector(selector);

  crest.textContent = "";
  crest.classList.toggle("has-logo", Boolean(logo));

  if (logo) {
    const image = document.createElement("img");
    image.src = logo;
    image.alt = teamName;
    image.loading = "lazy";
    image.onerror = () => {
      crest.classList.remove("has-logo");
      crest.textContent = teamName?.charAt(0).toUpperCase() || "-";
    };
    crest.append(image);
    return;
  }

  crest.textContent = teamName?.charAt(0).toUpperCase() || "-";
}

function reloadFeaturedEmbed() {
  const channelUrl = videoCard.dataset.channelUrl || "";

  if (!channelUrl) {
    videoState.textContent = "Sin canal";
    return;
  }

  const currentChannel =
    featuredChannels[featuredChannelIndex] ||
    {
      url: channelUrl,
      nombre: videoCard.dataset.channelName || "canal",
    };

  loadFeaturedEmbed(currentChannel, muted);
}
function applyEmbedAudioState() {
  const channelUrl = videoCard.dataset.channelUrl || "";

  volumeToggle.classList.toggle("active", muted);
  volumeToggle.title = muted ? "Activar sonido" : "Silenciar";

  if (!channelUrl) {
    videoState.textContent = "Sin canal";
    return;
  }

  if (!featuredEmbedUserStarted && !videoCard.classList.contains("playing")) {
    videoState.textContent = muted
      ? "El canal iniciará silenciado"
      : "Canal listo para reproducir";
    return;
  }

  const currentChannel =
    featuredChannels[featuredChannelIndex] ||
    {
      url: channelUrl,
      nombre: videoCard.dataset.channelName || "canal",
    };

  loadFeaturedEmbed(currentChannel, muted);
  videoState.textContent = muted ? "Silenciado" : "Transmitiendo con sonido";
}
featuredFrame.addEventListener("load", () => {
  window.clearTimeout(featuredEmbedTimer);
});

featuredFrame.addEventListener("error", tryNextFeaturedChannel);

async function toggleVideoFullscreen() {
  if (!videoCard.classList.contains("has-embed")) {
    videoState.textContent = "Sin reproductor";
    return;
  }

  try {
    if (document.fullscreenElement === videoCard) {
      await document.exitFullscreen();
    } else {
      await videoCard.requestFullscreen();
    }
  } catch (error) {
    window.open(videoCard.dataset.channelUrl, "_blank", "noopener,noreferrer");
  }
}

function updateFeaturedLegacy() {
  const featuredEvent = randomFeaturedEvent();

  if (!featuredEvent) {
    featured.classList.add("no-live");
    featuredStatus.querySelector("strong").textContent = "Sin partidos en vivo ahora";
    featuredStatus.querySelector("p").textContent =
      "La lista puede tener streams por horario, pero el destacado espera confirmacion de la agenda.";
    setFeaturedCrest(".crest-a", "-", "");
    setFeaturedCrest(".crest-b", "-", "");
    document.querySelector(".team:first-child strong").textContent = "Sin directo";
    document.querySelector(".team:last-child strong").textContent = "Ahora";
    document.querySelector(".live-pill").textContent = "Live";
    mainScore.textContent = "--";
    setFeaturedChannels([]);
    videoState.textContent = "Sin directo";
    watchButton.textContent = "Sin canal";
    watchButton.disabled = true;
    watchButton.onclick = null;
    return;
  }

  const info = splitTitle(featuredEvent.titulo);
  const status = eventStatus(featuredEvent);
  const statusText = {
    live: "EN VIVO",
    upcoming: "PROX",
    ended: "FIN",
  }[status];
  const channels = Array.isArray(featuredEvent.canales) ? featuredEvent.canales : [];
  const firstChannel = channels.find((channel) => channel?.url) || null;

  featured.classList.remove("no-live");

  document.querySelector(".crest-a").textContent = info.home.charAt(0).toUpperCase();
  document.querySelector(".crest-b").textContent = info.away.charAt(0).toUpperCase();
  document.querySelector(".team:first-child strong").textContent = info.home;
  document.querySelector(".team:last-child strong").textContent = info.away;

  document.querySelector(".live-pill").textContent = status === "live" ? "Live" : statusText;
  mainScore.textContent = statusText;
  featuredStatus.querySelector("strong").textContent = info.competition;

  featuredStatus.querySelector("p").textContent =
    `${featuredEvent.hora || "--:--"} - ${featuredEvent.clase || featuredEvent.categoria || "Evento"} - ${firstChannel?.nombre || "Canal disponible"}`;

  setFeaturedChannels(channels);
  videoState.textContent = firstChannel
    ? `Canal listo: ${firstChannel.nombre} ${firstChannel.calidad || ""}`.trim()
    : "Sin canal";
  watchButton.textContent = firstChannel ? "Ver canal" : "Sin canal";
  watchButton.disabled = !firstChannel?.url;
  watchButton.onclick = firstChannel?.url
    ? () => loadFeaturedEmbed(firstChannel)
    : null;
}

function updateFeatured() {
  const featuredEvent = randomFeaturedEvent();

  if (!featuredEvent) {
    featured.classList.add("no-live");
    featuredStatus.querySelector("strong").textContent = "Sin partidos en vivo ahora";
    featuredStatus.querySelector("p").textContent =
      "La lista puede tener streams por horario, pero el destacado espera confirmacion de la agenda.";
    setFeaturedCrest(".crest-a", "-", "");
    setFeaturedCrest(".crest-b", "-", "");
    document.querySelector(".team:first-child strong").textContent = "Sin directo";
    document.querySelector(".team:last-child strong").textContent = "Ahora";
    document.querySelector(".live-pill").textContent = "Live";
    mainScore.textContent = "--";
    setFeaturedEmbed(null);
    videoState.textContent = "Sin directo";
    watchButton.textContent = "Sin canal";
    watchButton.disabled = true;
    watchButton.onclick = null;
    return;
  }

  const info = splitTitle(featuredEvent.titulo);
  const homeLogo = featuredTeamLogo(featuredEvent, "home", info.home);
  const awayLogo = featuredTeamLogo(featuredEvent, "away", info.away);
  const status = eventStatus(featuredEvent);
  const statusText = {
    live: "EN VIVO",
    upcoming: "PROX",
    ended: "FIN",
  }[status];
  const firstChannel = featuredEvent.canales?.[0] || null;

  featured.classList.remove("no-live");
  setFeaturedCrest(".crest-a", info.home, homeLogo);
  setFeaturedCrest(".crest-b", info.away, awayLogo);
  document.querySelector(".team:first-child strong").textContent = info.home;
  document.querySelector(".team:last-child strong").textContent = info.away;
  document.querySelector(".live-pill").textContent = status === "live" ? "Live" : statusText;

  mainScore.textContent = statusText;
  featuredStatus.querySelector("strong").textContent = info.competition;
  featuredStatus.querySelector("p").textContent =
    `${featuredEvent.hora || "--:--"} - ${featuredEvent.categoria || "Evento"} - ${statusText}`;

  featuredEmbedUserStarted = false;
  setFeaturedEmbed(firstChannel);
  videoState.textContent = firstChannel
    ? `Canal listo: ${firstChannel.nombre} ${firstChannel.calidad || ""}`.trim()
    : "Sin canal";
  watchButton.textContent = firstChannel ? "Ver canal" : "Sin canal";
  watchButton.disabled = !firstChannel?.url;
  watchButton.onclick = firstChannel?.url
    ? () => loadFeaturedEmbed(firstChannel)
    : null;
}

function renderEvents() {
  const now = new Date();
  const liveEvents = events.filter((event) => eventStatus(event, now) === "live");
  const sorted = liveEvents.length
    ? liveEvents
    : events.filter((event) => eventBelongsToTodayOrRecentNight(event, now));

  liveGrid.innerHTML = "";

  if (!sorted.length) {
    liveTitle.textContent = "No se encontraron eventos";
    liveGrid.innerHTML = `<p class="empty-state">No hay partidos para mostrar desde el JSON remoto.</p>`;
    return;
  }

  liveTitle.textContent = liveEvents.length
    ? `${liveEvents.length} en vivo ahora`
    : `Agenda cargada: ${sorted.length} eventos`;

  const groups = sorted.reduce((acc, event) => {
    const sport = event.categoria || "deporte";
    const league = event.clase || splitTitle(event.titulo).competition || "general";
    const key = `${sport}||${league}`;

    if (!acc.has(key)) {
      acc.set(key, { sport, league, events: [] });
    }

    acc.get(key).events.push(event);
    return acc;
  }, new Map());

  groups.forEach((group) => {
    const groupNode = document.createElement("section");
    groupNode.className = "event-group";
    groupNode.innerHTML = `
      <header class="event-group-head">
        <div>
          <span>${group.sport}</span>
          <strong>${group.league}</strong>
        </div>
        <em>${group.events.length}</em>
      </header>
      <div class="event-group-list"></div>
    `;

    const list = groupNode.querySelector(".event-group-list");

    group.events.forEach((event) => {
      const status = eventStatus(event, now);
      const info = splitTitle(event.titulo);
      const card = document.createElement("article");
      const channelsText = (event.canales || [])
        .map((channel) => `${channel.nombre || ""} ${channel.calidad || ""}`)
        .join(" ");

      card.className = `event-card live-event-card ${status === "live" ? "is-live" : ""}`;
      card.dataset.search = searchValue(
        [
          info.home,
          info.away,
          info.matchup,
          info.competition,
          group.league,
          group.sport,
          event.hora,
          event.fecha,
          event.fecha_iso,
          status,
          channelsText,
        ].join(" ")
      );

      const statusText = {
        live: "Live",
        upcoming: "Prox",
        ended: "Fin",
      }[status];

      const channels = (event.canales || [])
        .map((channel) => {
          return `<a class="channel-link" href="${channel.url}" target="_blank" rel="noreferrer">${escapeHtml(channel.nombre)} · ${escapeHtml(channel.calidad || "HD")}</a>`;
        })
        .join("");

      card.innerHTML = `
        <button class="event-toggle" type="button" aria-expanded="false">
          <span>
            <strong>${escapeHtml(info.matchup)}</strong>
            <small>${escapeHtml(event.hora || "--:--")} · ${escapeHtml(info.competition)}</small>
          </span>
          <span class="event-badge">${statusText}</span>
        </button>
        <div class="event-details" hidden>
          <div class="event-meta">
            <span>${escapeHtml(event.fecha || "")}</span>
            <span>${escapeHtml(event.categoria || "Evento")}</span>
            <span>${escapeHtml(event.clase || "General")}</span>
          </div>
          <div class="channel-row">${channels || "<span>Sin canal</span>"}</div>
        </div>
      `;

      list.append(card);
    });

    liveGrid.append(groupNode);
  });
}

async function loadEvents() {
  liveTitle.textContent = "Cargando eventos...";

  try {
    const [data, liveAgendaResult] = await Promise.all([
      fetchStreamEventsPayload(),
      fetchAgendaLiveMatches()
        .then((matches) => ({ ok: true, matches }))
        .catch(() => ({ ok: false, matches: [] })),
    ]);

    events = Array.isArray(data) ? data : [];
    agendaLiveMatches = liveAgendaResult.matches;
    agendaLiveLoaded = liveAgendaResult.ok;

    events.sort((a, b) => eventStart(a) - eventStart(b));

    renderEvents();
    applySearch();
    updateFeatured();
    setUtilityStatus("");
  } catch (error) {
    liveTitle.textContent = "No se pudo cargar el JSON";
    liveGrid.innerHTML =
      `<p class="empty-state">Revisa la conexion o intenta actualizar nuevamente.</p>`;
    featuredStatus.querySelector("strong").textContent = "JSON no disponible";
    featuredStatus.querySelector("p").textContent =
      "La seccion destacada depende de la lista remota de partidos en vivo.";
  }
}

/* ============================================================
   AGENDA ESPN
============================================================ */

function agendaDate(match) {
  if (match.fecha) {
    return match.fecha;
  }

  if (!match.fecha_espn) {
    return "";
  }

  return localDateISO(new Date(match.fecha_espn));
}

function agendaStart(match) {
  if (match.fecha_espn) {
    const date = new Date(match.fecha_espn);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const fecha = agendaDate(match);
  const hora = match.hora_inicio || match.hora || "00:00";

  if (!fecha) {
    return new Date(NaN);
  }

  return new Date(`${fecha}T${hora}:00-03:00`);
}

function agendaEnd(match) {
  const duration = Number(match.duracion_min || match.duracion || 180);
  return new Date(agendaStart(match).getTime() + duration * 60_000);
}

function agendaMatchesSelectedDate(match, selectedDate) {
  const matchDate = agendaDate(match);

  if (matchDate === selectedDate) {
    return true;
  }

  const start = agendaStart(match);
  const end = agendaEnd(match);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  const dayStart = new Date(`${selectedDate}T00:00:00-03:00`);
  const dayEnd = new Date(`${selectedDate}T23:59:59-03:00`);

  return start <= dayEnd && end >= dayStart;
}

function agendaWindowDates(date) {
  return [-1, 0, 1].map((offset) => localDateISO(dateFromOffsetForBase(date, offset)));
}

function dateFromOffsetForBase(baseDate, offset) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + offset);
  return date;
}

function agendaMatchKey(match) {
  const teams = agendaTeams(match);

  return [
    match.id,
    match.uid,
    match.url_espn,
    agendaDate(match),
    normalizeText(teams.home),
    normalizeText(teams.away),
    match.hora_inicio || match.hora || "",
  ]
    .filter(Boolean)
    .join("|");
}

function uniqueMatches(matches) {
  const seen = new Set();

  return matches.filter((match) => {
    const key = agendaMatchKey(match);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sortAgendaMatchesStable(matches) {
  return [...matches].sort((a, b) => {
    const priorityA = Number(a.prioridad_liga ?? 9999);
    const priorityB = Number(b.prioridad_liga ?? 9999);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const leagueA = normalizeText(inferAgendaLeague(a));
    const leagueB = normalizeText(inferAgendaLeague(b));

    if (leagueA !== leagueB) {
      return leagueA.localeCompare(leagueB);
    }

    const timeA = a.hora_inicio || a.hora || "";
    const timeB = b.hora_inicio || b.hora || "";

    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }

    const teamsA = agendaTeams(a);
    const teamsB = agendaTeams(b);

    return `${teamsA.home} ${teamsA.away}`.localeCompare(`${teamsB.home} ${teamsB.away}`);
  });
}

function sameAgendaMatch(a, b) {
  if (!a || !b) {
    return false;
  }

  const aId = String(a.id || a.uid || "").trim();
  const bId = String(b.id || b.uid || "").trim();

  if (aId && bId && aId === bId) {
    return true;
  }

  const aTeams = agendaTeams(a);
  const bTeams = agendaTeams(b);
  const sameOrder =
    namesLookRelated(aTeams.home, bTeams.home) &&
    namesLookRelated(aTeams.away, bTeams.away);
  const swappedOrder =
    namesLookRelated(aTeams.home, bTeams.away) &&
    namesLookRelated(aTeams.away, bTeams.home);

  return (sameOrder || swappedOrder) && agendaDate(a) === agendaDate(b);
}

function listaConDatos(items) {
  return Array.isArray(items) && items.length > 0;
}

function numeroMayorQueCero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function preservarIncidenciasExistentes(matchAnterior = {}, matchNuevo = {}) {
  const golesPrevios = matchAnterior.goleadores || matchAnterior.scorers || matchAnterior.goles || [];
  const golesNuevos = matchNuevo.goleadores || matchNuevo.scorers || matchNuevo.goles || [];

  const localRojasPrevias = Number(matchAnterior.local_rojas || matchAnterior.rojas_local || matchAnterior.tarjetas_rojas_local || 0);
  const visitanteRojasPrevias = Number(matchAnterior.visitante_rojas || matchAnterior.rojas_visitante || matchAnterior.tarjetas_rojas_visitante || 0);

  return {
    ...matchNuevo,

    // Worker 1 /live no trae incidencias. Si ya tenemos goles desde Worker 2,
    // no los borramos al actualizar minuto, marcador o estado.
    goleadores: listaConDatos(golesNuevos) ? golesNuevos : golesPrevios,
    tarjetas_rojas: [],

    // No mostramos jugador expulsado. Solo mantenemos el conteo de rojas por equipo.
    local_rojas: numeroMayorQueCero(matchNuevo.local_rojas)
      ? Number(matchNuevo.local_rojas)
      : localRojasPrevias,
    visitante_rojas: numeroMayorQueCero(matchNuevo.visitante_rojas)
      ? Number(matchNuevo.visitante_rojas)
      : visitanteRojasPrevias,
  };
}

function mergeAgendaWithLive(baseMatches, liveMatches) {
  const merged = Array.isArray(baseMatches) ? [...baseMatches] : [];

  (Array.isArray(liveMatches) ? liveMatches : []).forEach((liveMatch) => {
    const index = merged.findIndex((match) => sameAgendaMatch(match, liveMatch));

    if (index >= 0) {
      const anterior = merged[index];
      const actualizado = {
        ...anterior,
        ...liveMatch,
        local: anterior.local || liveMatch.local,
        visitante: anterior.visitante || liveMatch.visitante,
        local_logo: anterior.local_logo || liveMatch.local_logo,
        visitante_logo: anterior.visitante_logo || liveMatch.visitante_logo,
        liga: anterior.liga || liveMatch.liga,
        liga_corta: anterior.liga_corta || liveMatch.liga_corta,
        liga_logo: anterior.liga_logo || liveMatch.liga_logo,
        prioridad_liga: anterior.prioridad_liga ?? liveMatch.prioridad_liga,
      };

      merged[index] = sincronizarTimerPartido(
        preservarIncidenciasExistentes(anterior, actualizado)
      );
    } else {
      merged.push(liveMatch);
    }
  });

  return uniqueMatches(merged);
}

function hasSameTeamsMatch(matches, candidate) {
  const candidateTeams = agendaTeams(candidate);

  return matches.some((match) => {
    const teams = agendaTeams(match);
    const sameOrder =
      namesLookRelated(candidateTeams.home, teams.home) &&
      namesLookRelated(candidateTeams.away, teams.away);
    const swappedOrder =
      namesLookRelated(candidateTeams.home, teams.away) &&
      namesLookRelated(candidateTeams.away, teams.home);

    return sameOrder || swappedOrder;
  });
}

function mergeStreamAgendaMatches(matches, streamMatches) {
  const merged = [...matches];

  streamMatches.forEach((streamMatch) => {
    if (!hasSameTeamsMatch(merged, streamMatch)) {
      merged.push(streamMatch);
    }
  });

  return uniqueMatches(merged);
}

function agendaStatus(match) {
  const visual = calcularMinutoVisual(match);

  if (visual) {
    return visual;
  }

  const tiempo =
    match.mostrar_tiempo || match.minuto || match.estado_corto || match.estado || "";

  const texto = String(tiempo).toLowerCase();
  const start = agendaStart(match);
  const now = new Date();

  const partidoTodaviaNoEmpezo =
    !Number.isNaN(start.getTime()) && now < start;

  if (partidoTodaviaNoEmpezo) {
    return match.hora_inicio || match.hora || "Prox";
  }

  if (match.completado === true) {
    return "Fin";
  }

  if (
    texto.includes("fin") ||
    texto.includes("final") ||
    texto.includes("full time") ||
    texto.includes("ft")
  ) {
    return "Fin";
  }

  if (String(tiempo).includes("'") || String(tiempo).includes("+")) {
    return tiempo;
  }

  if (match.mostrar_marcador === true) {
    return tiempo || "Live";
  }

  if (tiempo === "Scheduled" || tiempo === "Programado") {
    return "Prox";
  }

  return tiempo || "Prox";
}

function agendaDisplayTime(match) {
  const visual = calcularMinutoVisual(match);

  if (visual) {
    return visual;
  }

  const tiempo = match.mostrar_tiempo || match.minuto || "";

  if (match.completado === true) {
    return match.hora_inicio || match.hora || "Fin";
  }

  if (String(tiempo).includes("'") || String(tiempo).includes("+")) {
    return tiempo;
  }

  if (
    tiempo &&
    tiempo !== "Prox" &&
    tiempo !== "Programado" &&
    tiempo !== "Scheduled"
  ) {
    return tiempo;
  }

  return match.hora_inicio || match.hora || "--:--";
}

function teamLogoMarkup(name, logo, redCards = 0) {
  const safeName = escapeHtml(name);
  const logoHtml = logo
    ? `<img class="team-logo" src="${escapeHtml(logo)}" alt="${safeName}" loading="lazy" />`
    : `<span class="team-logo logo-fallback">${initials(name)}</span>`;

  const cards = Number(redCards) || 0;

  if (cards <= 0) {
    return logoHtml;
  }

  return `
    <span class="team-logo-wrap" title="${cards} tarjeta${cards === 1 ? "" : "s"} roja${cards === 1 ? "" : "s"}">
      ${logoHtml}
      <span class="mini-red-card">${cards > 1 ? cards : ""}</span>
    </span>
  `;
}

function initials(name = "") {
  return (
    String(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "PH"
  );
}

const LOCAL_LEAGUE_LOGOS = {
  "ecu.1": "https://raw.githubusercontent.com/gastonledesma328-dot/aca/refs/heads/main/img/ligas/LigaPro_ecuador.png",
  "mex.1": "https://raw.githubusercontent.com/gastonledesma328-dot/aca/refs/heads/main/img/ligas/liga_bbva_mx.png",
};

function leagueLogoFallback(name = "", slug = "") {
  const slugKey = String(slug || "").trim();

  if (LOCAL_LEAGUE_LOGOS[slugKey]) {
    return LOCAL_LEAGUE_LOGOS[slugKey];
  }

  const normalized = normalizeText(name);

  if (normalized.includes("ligapro ecuador") || normalized.includes("ligapro serie a") || normalized.includes("liga pro ecuador")) {
    return LOCAL_LEAGUE_LOGOS["ecu.1"];
  }

  if (normalized.includes("liga mx")) {
    return LOCAL_LEAGUE_LOGOS["mex.1"];
  }

  return "";
}

function resolverLogoLiga(logo, name = "", slug = "") {
  const fallback = leagueLogoFallback(name, slug);

  // Para ligas con logo local propio, siempre priorizamos el repo y no ESPN.
  if (fallback) {
    return fallback;
  }

  return logo || "";
}

function aplicarFallbackLogosLiga() {
  document.querySelectorAll("img.league-logo").forEach((img) => {
    const fallback = img.dataset.fallbackLogo || "";
    const fallbackText = img.dataset.fallbackText || "PH";

    img.onerror = () => {
      img.onerror = null;

      if (fallback && img.src !== fallback) {
        img.src = fallback;
        return;
      }

      const span = document.createElement("span");
      span.className = "league-logo league-logo-fallback";
      span.textContent = fallbackText;
      img.replaceWith(span);
    };

    if (img.complete && img.naturalWidth === 0) {
      img.onerror();
    }
  });
}

function leagueLogoMarkup(name, logo, slug = "") {
  const fallback = leagueLogoFallback(name, slug);
  const finalLogo = resolverLogoLiga(logo, name, slug);
  const fallbackText = initials(name);

  if (finalLogo) {
    return `<img class="league-logo" src="${escapeHtml(finalLogo)}" alt="${escapeHtml(name)}" loading="lazy" data-fallback-logo="${escapeHtml(fallback)}" data-fallback-text="${escapeHtml(fallbackText)}" />`;
  }

  return `<span class="league-logo league-logo-fallback">${fallbackText}</span>`;
}

function scoreMarkup(match) {
  const start = agendaStart(match);
  const now = new Date();

  if (!Number.isNaN(start.getTime()) && now < start) {
    return "-";
  }

  const tiempo = String(
    match.mostrar_tiempo ||
    match.minuto ||
    match.estado_corto ||
    match.estado ||
    ""
  ).toLowerCase();

  const estaFinalizado =
    match.completado === true ||
    tiempo.includes("fin") ||
    tiempo.includes("final") ||
    tiempo.includes("full time") ||
    tiempo.includes("ft");

  const estaEnVivo =
    match.mostrar_marcador === true &&
    match.completado !== true &&
    (
      tiempo.includes("'") ||
      tiempo.includes("+") ||
      tiempo.includes("live") ||
      tiempo.includes("en vivo") ||
      tiempo.includes("halftime") ||
      tiempo.includes("entretiempo") ||
      tiempo.includes("descanso") ||
      tiempo.includes("ht")
    );

  if (!estaEnVivo && !estaFinalizado) {
    return "-";
  }

  const normalizarGol = (value) => {
    if (value === undefined || value === null) {
      return null;
    }

    const text = String(value).trim();

    if (!text) {
      return null;
    }

    const number = Number(text);

    if (Number.isNaN(number)) {
      return null;
    }

    if (number < 0) {
      return null;
    }

    return number;
  };

  const local = normalizarGol(match.marcador_local);
  const visitante = normalizarGol(match.marcador_visitante);

  if (local !== null && visitante !== null) {
    return `${local} - ${visitante}`;
  }

  if (match.resultado && String(match.resultado).trim()) {
    const resultado = String(match.resultado)
      .trim()
      .replace(/\s+/g, "")
      .replace(/[–—]/g, "-");

    const partes = resultado.split("-").filter(Boolean);

    if (partes.length >= 2) {
      const resultadoLocal = normalizarGol(partes[0]);
      const resultadoVisitante = normalizarGol(partes[1]);

      if (resultadoLocal !== null && resultadoVisitante !== null) {
        return `${resultadoLocal} - ${resultadoVisitante}`;
      }
    }
  }

  return "-";
}

function searchValue(value) {
  return normalizeText(value)
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9:+\-'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreSearchTerms(match, home, away, score) {
  const terms = [score];
  const scoreMatch = String(score).match(/(\d+)\s*-\s*(\d+)/);

  if (!scoreMatch) {
    return terms;
  }

  const homeGoals = Number(scoreMatch[1]);
  const awayGoals = Number(scoreMatch[2]);

  terms.push(
    `${homeGoals}-${awayGoals}`,
    `${homeGoals}:${awayGoals}`,
    `${homeGoals} ${awayGoals}`,
    `${homeGoals} a ${awayGoals}`,
    `marcador ${homeGoals}-${awayGoals}`,
    `resultado ${homeGoals}-${awayGoals}`
  );

  if (homeGoals === awayGoals) {
    terms.push("empate igualado igualados");
  } else if (homeGoals > awayGoals) {
    terms.push(`gana local gana ${home} victoria ${home}`);
  } else {
    terms.push(`gana visitante gana ${away} victoria ${away}`);
  }

  if (match.mostrar_marcador === true && match.completado !== true) {
    terms.push("en vivo live jugando ahora");
  }

  return terms;
}

function matchSearchIndex(match, group, home, away, score) {
  const status = agendaStatus(match);
  const scorers = normalizeScorerList(match)
    .map((scorer) => `${scorerName(scorer)} ${scorer.descripcion || ""} ${scorerTeamText(scorer)} ${scorerMinute(scorer)} ${scorerTypeLabel(scorer)}`)
    .join(" ");
  const cards = cardsSearchText(match);
  const tv = obtenerTvPartidoSync(match);
  const tvText = Array.isArray(tv.canales) ? tv.canales.join(" ") : "";

  return searchValue(
    [
      home,
      away,
      `${home} vs ${away}`,
      `${away} vs ${home}`,
      match.partido,
      group.league,
      group.sport,
      status,
      agendaDisplayTime(match),
      match.hora_inicio,
      match.hora,
      match.estado,
      match.estado_corto,
      match.mostrar_tiempo,
      match.minuto,
      match.resultado,
      scorers,
      cards,
      tvText,
      tv.fuente,
      tv.confianza,
      ...scoreSearchTerms(match, home, away, score),
    ].join(" ")
  );
}

function agendaRowMatchesQuery(row, query) {
  const normalizedQuery = searchValue(query);

  if (!normalizedQuery) {
    return true;
  }

  const search = row.dataset.search || searchValue(row.textContent);
  const compactQuery = normalizedQuery.replace(/\s+/g, "");

  if (search.includes(normalizedQuery) || search.replace(/\s+/g, "").includes(compactQuery)) {
    return true;
  }

  return normalizedQuery
    .split(" ")
    .filter(Boolean)
    .every((term) => search.includes(term));
}

function liveCardMatchesQuery(card, query) {
  const normalizedQuery = searchValue(query);

  if (!normalizedQuery) {
    return true;
  }

  const search = card.dataset.search || searchValue(card.textContent);
  const compactQuery = normalizedQuery.replace(/\s+/g, "");

  if (search.includes(normalizedQuery) || search.replace(/\s+/g, "").includes(compactQuery)) {
    return true;
  }

  return normalizedQuery
    .split(" ")
    .filter(Boolean)
    .every((term) => search.includes(term));
}

function applyLiveSearch() {
  const query = matchSearch.value.trim();
  const cards = liveGrid.querySelectorAll(".live-event-card");
  const groups = liveGrid.querySelectorAll(".event-group");
  let visible = 0;

  cards.forEach((card) => {
    const matches = liveCardMatchesQuery(card, query);
    card.classList.toggle("dimmed", !matches);

    if (matches) {
      visible += 1;
    }
  });

  groups.forEach((group) => {
    const hasVisibleCards = Boolean(group.querySelector(".live-event-card:not(.dimmed)"));
    group.classList.toggle("dimmed", Boolean(query) && !hasVisibleCards);
  });

  setUtilityStatus(query ? `${visible} coincidencia${visible === 1 ? "" : "s"}` : "");
}

function applySearch() {
  if (activeTab === "live") {
    applyLiveSearch();
    return;
  }

  applyAgendaSearch();
}

function applyAgendaSearch() {
  const query = matchSearch.value.trim();
  const rows = leagueGrid.querySelectorAll(".agenda-row");
  const groups = leagueGrid.querySelectorAll(".agenda-group");
  let visible = 0;

  rows.forEach((row) => {
    const matches = agendaRowMatchesQuery(row, query);
    row.classList.toggle("dimmed", !matches);

    if (matches) {
      visible += 1;
    }
  });

  groups.forEach((group) => {
    const hasVisibleRows = Boolean(group.querySelector(".agenda-row:not(.dimmed)"));
    group.classList.toggle("dimmed", Boolean(query) && !hasVisibleRows);
  });

  setUtilityStatus(query ? `${visible} coincidencia${visible === 1 ? "" : "s"}` : "");
}

function normalizeMinute(value) {
  if (value === undefined || value === null) {
    return "";
  }

  const text = String(value).trim();

  if (!text) {
    return "";
  }

  if (text.includes("'")) {
    return text;
  }

  return `${text}'`;
}

function extraerNombreJugadorDesdeValor(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    return String(
      value.displayName ||
        value.fullName ||
        value.shortName ||
        value.name ||
        value.nombre ||
        value.player?.displayName ||
        value.player?.fullName ||
        value.player?.shortName ||
        value.player?.name ||
        value.athlete?.displayName ||
        value.athlete?.fullName ||
        value.athlete?.shortName ||
        value.athlete?.name ||
        ""
    ).trim();
  }

  return String(value || "").trim();
}

function limpiarNombreJugadorGol(value) {
  let text = String(value || "").trim();

  if (!text) {
    return "";
  }

  const soloPalabrasInvalidas = (rawValue) => {
    const normalizado = normalizeText(rawValue)
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalizado) return true;

    const invalidWords = new Set([
      "gol",
      "goal",
      "own",
      "autogol",
      "penal",
      "penalty",
      "red",
      "card",
      "tarjeta",
      "roja",
      "amarilla",
      "yellow",
      "expulsion",
      "expulsado",
      "scored",
      "converted",
    ]);

    return normalizado.split(" ").every((word) => invalidWords.has(word));
  };

  text = text
    .replace(/^\s*\d{1,3}(?:\+\d{1,2})?['’]?\s*/i, "")
    .replace(/^\s*(gol|goal)\s*[:\-]?\s*/i, "")
    .replace(/\s+(Goal|Gol|Own Goal|Autogol|Red Card|Tarjeta Roja|Yellow Card|Tarjeta Amarilla).*$/i, "")
    .replace(/\s+\d{1,3}(?:\+\d{1,2})?['’]?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text || soloPalabrasInvalidas(text)) {
    return "";
  }

  return text;
}

function scorerName(scorer) {
  if (!scorer || typeof scorer !== "object") {
    return "";
  }

  const directCandidates = [
    scorer.jugador,
    scorer.nombre,
    scorer.playerName,
    scorer.athleteName,
    scorer.scorer,
    scorer.autor,
    scorer.player,
    scorer.athlete,
    scorer.participant,
    scorer.member,
    scorer.player1,
    scorer.competitorPlayer,
    scorer.fullName,
    scorer.displayName,
    scorer.shortName,
    scorer.name,
  ];

  for (const candidate of directCandidates) {
    const name = limpiarNombreJugadorGol(extraerNombreJugadorDesdeValor(candidate));

    if (name) {
      return name;
    }
  }

  const arrayCandidates = [
    scorer.athletesInvolved,
    scorer.athletes,
    scorer.participants,
    scorer.players,
    scorer.members,
  ].filter(Array.isArray);

  for (const arr of arrayCandidates) {
    for (const candidate of arr) {
      const name = limpiarNombreJugadorGol(extraerNombreJugadorDesdeValor(candidate));

      if (name) {
        return name;
      }
    }
  }

  const textCandidates = [
    scorer.descripcion,
    scorer.description,
    scorer.text,
    scorer.playText,
    scorer.title,
    scorer.headline,
    scorer.detalle,
  ];

  for (const candidate of textCandidates) {
    const name = limpiarNombreJugadorGol(candidate);

    if (name) {
      return name;
    }
  }

  return "";
}

function scorerMinute(scorer) {
  return normalizeMinute(
    scorer.minuto ||
      scorer.minute ||
      scorer.tiempo ||
      scorer.displayMinute ||
      scorer.clock
  );
}

function scorerTypeLabel(scorer) {
  const raw = String(
    scorer.tipo ||
      scorer.type ||
      scorer.detalle ||
      scorer.detail ||
      scorer.descripcion_tipo ||
      scorer.descripcion ||
      ""
  ).trim();

  const normalized = normalizeText(raw);

  if (/penal|penalty|\bpen\b|tiro penal/.test(normalized)) {
    return "(Pen.)";
  }

  if (/en contra|contra|own goal|autogol|og|e c|ec/.test(normalized)) {
    return "(E.C.)";
  }

  return "Gol";
}

function scorerTeamText(scorer) {
  return String(
    scorer.equipo ||
      scorer.team ||
      scorer.teamName ||
      scorer.club ||
      scorer.nombre_equipo ||
      ""
  ).trim();
}

function scorerSideValue(scorer) {
  return String(
    scorer.lado ||
      scorer.side ||
      scorer.homeAway ||
      scorer.home_away ||
      scorer.teamSide ||
      scorer.team_side ||
      ""
  ).toLowerCase();
}

function normalizeScorerList(match) {
  const list = [];

  const add = (items, side = "") => {
    if (!Array.isArray(items)) {
      return;
    }

    items.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }

      list.push({ ...item, _sideHint: side });
    });
  };

  add(match.goleadores);
  add(match.scorers);
  add(match.goles);
  add(match.goals);
  add(match.goles_local, "home");
  add(match.local_goles, "home");
  add(match.home_goals, "home");
  add(match.goles_visitante, "away");
  add(match.visitante_goles, "away");
  add(match.away_goals, "away");

  const seen = new Set();

  return list.filter((scorer) => {
    const name = scorerName(scorer);

    if (!name) {
      return false;
    }

    const key = `${scorerMinute(scorer)}-${name}-${scorerTeamText(scorer)}-${scorerTypeLabel(scorer)}-${scorer._sideHint || ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function scorerBelongsToSide(scorer, home, away) {
  const hint = String(scorer._sideHint || "").toLowerCase();

  if (["home", "local", "h"].includes(hint)) {
    return "home";
  }

  if (["away", "visitante", "a"].includes(hint)) {
    return "away";
  }

  const side = scorerSideValue(scorer);

  if (["home", "local", "h"].includes(side)) {
    return "home";
  }

  if (["away", "visitante", "a"].includes(side)) {
    return "away";
  }

  if (scorer.local === true || scorer.isHome === true || scorer.home === true) {
    return "home";
  }

  if (scorer.visitante === true || scorer.isAway === true || scorer.away === true) {
    return "away";
  }

  const team = scorerTeamText(scorer);

  if (teamValueMatches(team, home)) {
    return "home";
  }

  if (teamValueMatches(team, away)) {
    return "away";
  }

  return "unknown";
}

function goalItemMarkup(scorer, side = "unknown", teamName = "") {
  const minute = scorerMinute(scorer);
  const player = scorerName(scorer);
  const typeLabel = scorerTypeLabel(scorer);
  const sideClass = side === "home" ? "is-home-goal" : side === "away" ? "is-away-goal" : "is-unknown-goal";

  if (!player) {
    return "";
  }

  return `
    <span class="agenda-goal-item ${sideClass}">
      ${minute ? `<b>${escapeHtml(minute)}</b>` : ""}
      <span>${escapeHtml(player)}</span>
      <em>${typeLabel}</em>
    </span>
  `;
}

function scorersMarkup(match, home = "", away = "") {
  const scorers = normalizeScorerList(match);

  if (!scorers.length) {
    return "";
  }

  const homeGoals = [];
  const awayGoals = [];
  const unknownGoals = [];

  scorers.forEach((scorer) => {
    const side = scorerBelongsToSide(scorer, home, away);

    if (side === "home") {
      homeGoals.push(scorer);
    } else if (side === "away") {
      awayGoals.push(scorer);
    } else {
      unknownGoals.push(scorer);
    }
  });

  const homeMarkup = homeGoals.map((scorer) => goalItemMarkup(scorer, "home", home)).join("");
  const awayMarkup = awayGoals.map((scorer) => goalItemMarkup(scorer, "away", away)).join("");
  const unknown = unknownGoals.map((scorer) => goalItemMarkup(scorer, "unknown", scorerTeamText(scorer))).join("");
  const hasKnownSideGoals = homeGoals.length > 0 || awayGoals.length > 0;

  if (!hasKnownSideGoals && unknown) {
    return `
      <span class="agenda-goals-row has-single-side">
        <span class="agenda-goals-team agenda-goals-unknown" data-goal-side="unknown">${unknown}</span>
      </span>
    `;
  }

  return `
    <span class="agenda-goals-row has-side-divider">
      <span class="agenda-goals-team agenda-goals-home" data-goal-side="home" title="Gol de ${escapeHtml(home)}">
        ${homeMarkup || `<span class="agenda-goals-empty" aria-hidden="true"></span>`}
      </span>
      <span class="agenda-goals-team agenda-goals-away" data-goal-side="away" title="Gol de ${escapeHtml(away)}">
        ${awayMarkup || `<span class="agenda-goals-empty" aria-hidden="true"></span>`}
      </span>
    </span>
  `;
}

function normalizeTeamForCompare(value) {
  return normalizeText(value)
    .replace(/\bclub\b|\batletico\b|\bdeportivo\b|\basociacion\b|\bca\b|\bfc\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function teamValueMatches(value, teamName) {
  const a = normalizeTeamForCompare(value);
  const b = normalizeTeamForCompare(teamName);

  if (!a || !b) {
    return false;
  }

  return a === b || a.includes(b) || b.includes(a);
}

function normalizeCardList(match) {
  return [
    ...(Array.isArray(match.tarjetas) ? match.tarjetas : []),
    ...(Array.isArray(match.cards) ? match.cards : []),
    ...(Array.isArray(match.tarjetas_rojas) ? match.tarjetas_rojas : []),
    ...(Array.isArray(match.rojas) ? match.rojas : []),
    ...(Array.isArray(match.redCards) ? match.redCards : []),
  ];
}

function isRedCard(card) {
  const text = normalizeText(
    `${card.tipo || ""} ${card.type || ""} ${card.card || ""} ${card.descripcion || ""} ${card.text || ""}`
  );

  return (
    card.roja === true ||
    card.red === true ||
    card.redCard === true ||
    text.includes("roja") ||
    text.includes("red card") ||
    text.includes("red-card")
  );
}

function explicitRedCardCount(match, side) {
  const keys =
    side === "home"
      ? ["local_rojas", "rojas_local", "tarjetas_rojas_local", "home_red_cards", "red_cards_home"]
      : ["visitante_rojas", "rojas_visitante", "tarjetas_rojas_visitante", "away_red_cards", "red_cards_away"];

  for (const key of keys) {
    const value = Number(match[key]);

    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return 0;
}

function redCardsForTeam(match, side, teamName) {
  const explicit = explicitRedCardCount(match, side);

  if (explicit > 0) {
    return explicit;
  }

  return normalizeCardList(match).filter((card) => {
    if (!card || !isRedCard(card)) {
      return false;
    }

    const cardSide = normalizeText(card.local_visitante || card.homeAway || card.side || "");

    if (side === "home" && ["home", "local"].includes(cardSide)) {
      return true;
    }

    if (side === "away" && ["away", "visitante"].includes(cardSide)) {
      return true;
    }

    return teamValueMatches(card.equipo || card.team || card.teamName || "", teamName);
  }).length;
}

function cardsSearchText(match) {
  return normalizeCardList(match)
    .filter(isRedCard)
    .map((card) => `${card.jugador || card.nombre || card.player || ""} ${card.equipo || card.team || ""} roja red card ${card.minuto || card.minute || ""}`)
    .join(" ");
}

function agendaSport(match) {
  return match.deporte || match.categoria || "Futbol";
}

function inferWomenLeague(match) {
  const text = normalizeText(
    `${match.partido || ""} ${match.local || ""} ${match.visitante || ""} ${match.url_espn || ""}`
  );

  if (/argentina|boca|river|san lorenzo|racing|independiente/.test(text)) {
    return "Campeonato Femenino de Primera Division";
  }

  if (/brasil|brasileirao|corinthians|palmeiras|ferroviaria|sao paulo|flamengo/.test(text)) {
    return "Brasileirao Feminino Serie A1";
  }

  if (/colombia|america de cali|deportivo cali|santa fe|millonarios/.test(text)) {
    return "Liga Femenina Colombia";
  }

  if (/chile|colo colo|universidad de chile|santiago morning/.test(text)) {
    return "Primera Division Femenina Chile";
  }

  if (/espana|liga f|barcelona|real madrid|atletico|athletic/.test(text)) {
    return "Liga F";
  }

  if (/inglaterra|wsl|women.*super league|arsenal|chelsea|manchester|liverpool/.test(text)) {
    return "Womens Super League";
  }

  return "Ligas femeninas";
}

function inferAgendaLeague(match) {
  if (match.liga) {
    return match.liga;
  }

  const text = normalizeText(
    `${match.partido || ""} ${match.local || ""} ${match.visitante || ""} ${match.url_espn || ""}`
  );

  if (/femenin|women|womens|\(f\)|liga f|frauen|femminile|vrouwen/.test(text)) {
    return inferWomenLeague(match);
  }

  if (/world cup|copa del mundo|mundial/.test(text)) {
    return "Copa del Mundo";
  }

  if (/libertadores/.test(text)) {
    return "Copa Libertadores";
  }

  if (/sudamericana/.test(text)) {
    return "Copa Sudamericana";
  }

  if (/arsenal|brentford|newcastle|brighton|fulham|west ham|sunderland|wolverhampton|chelsea|liverpool|manchester|tottenham|aston villa|nottingham|everton|crystal palace|burnley|leeds/.test(text)) {
    return "Premier League";
  }

  if (/barcelona|real madrid|atletico|valencia|osasuna|alaves|villarreal|levante|athletic club|sevilla|betis|celta|getafe|girona|real sociedad|mallorca|espanyol|rayo/.test(text)) {
    return "LaLiga";
  }

  if (/napoli|atalanta|torino|udinese|genova|como|inter milan|internazionale|ac milan|juventus|roma|lazio|fiorentina|bologna|sassuolo|verona|lecce|parma/.test(text)) {
    return "Serie A";
  }

  if (/bayern|leverkusen|leipzig|frankfurt|hamburg sv|augsburg|werder|union berlin|dortmund|stuttgart|wolfsburg|hoffenheim|freiburg|mainz|monchengladbach|heidenheim|koln|cologne/.test(text)) {
    return "Bundesliga";
  }

  if (/psg|paris saint-germain|marseille|nice|lens|monaco|metz|nantes|lyon|lille|rennes|lorient|toulouse|strasbourg|montpellier|angers|auxerre/.test(text)) {
    return "Ligue 1";
  }

  if (/benfica|porto|sporting cp|sporting lisbon|braga|famalicao|arouca|santa clara|moreirense|estrela|nacional|avs/.test(text)) {
    return "Primeira Liga";
  }

  if (/ajax|psv|feyenoord|utrecht|groningen|excelsior|nec nijmegen|telstar|nac breda|twente|az alkmaar|heerenveen|sparta rotterdam|almere/.test(text)) {
    return "Eredivisie";
  }

  if (/flamengo|palmeiras|corinthians|sao paulo|botafogo|fluminense|vasco|gremio|internacional|cruzeiro|atletico mineiro|bahia|fortaleza|goias|cuiaba|criciuma|nautico/.test(text)) {
    return "Brasileirao";
  }

  if (/boca|river|san lorenzo|independiente|racing|banfield|platense|talleres|lanus|union|barracas|central cordoba|estudiantes|huracan|velez|rosario central|newell/.test(text)) {
    return "Liga Profesional de Futbol";
  }

  if (/defensores de belgrano|central norte|san telmo|estudiantes.*buenos aires|san martin.*tucuman|colon|los andes|atletico rafaela/.test(text)) {
    return "Primera Nacional";
  }

  if (/comunicaciones|deportivo armenio|dock sud|deportivo merlo|villa san carlos|uai urquiza|excursionistas|sportivo italiano|argentino de quilmes|real pilar|brown adrogue/.test(text)) {
    return "Primera B Metropolitana";
  }

  if (/colo colo|universidad de chile|universidad catolica|cobresal|huachipato|everton de vina|union espanola|audax/.test(text)) {
    return "Primera Division de Chile";
  }

  if (/atletico nacional|once caldas|millonarios|america de cali|deportivo cali|junior|tolima|santa fe|real cartagena|bogota fc/.test(text)) {
    return "Categoria Primera A";
  }

  if (/liga de quito|ldu quito|barcelona sc|emelec|independiente del valle|aucas|el nacional|universidad catolica|libertad.*aucas/.test(text)) {
    return "LigaPro Serie A";
  }

  if (/olimpia|cerro porteno|libertad|guarani|sportivo trinidense|sportivo san lorenzo|nacional asuncion/.test(text)) {
    return "Primera Division de Paraguay";
  }

  if (/alianza lima|universitario|sporting cristal|melgar|cusco|cesar vallejo|peru/.test(text)) {
    return "Liga 1 Peru";
  }

  if (/penarol|nacional.*uruguay|defensor sporting|danubio|liverpool.*uruguay|montevideo wanderers|cerro largo/.test(text)) {
    return "Primera Division de Uruguay";
  }

  if (/caracas|tachira|deportivo la guaira|la guaira|carabobo|monagas|metropolitanos|zamora/.test(text)) {
    return "Liga FUTVE";
  }

  if (/bolivar|the strongest|always ready|oriente petrolero|jorge wilstermann|wilstermann|real potosi/.test(text)) {
    return "Division Profesional Bolivia";
  }

  if (/mls|inter miami|orlando|toronto|seattle|portland|salt lake|atlanta|columbus|philadelphia|cincinnati/.test(text)) {
    return "MLS";
  }

  return "Otras ligas";
}

function groupPriority(group) {
  const orderedLeagues = [
    "liga profesional de futbol",
    "primera nacional",
    "primera b metropolitana",
    "torneo federal a",
    "primera c",
    "promocional amateur",
    "premier league",
    "laliga",
    "serie a",
    "bundesliga",
    "ligue 1",
    "primeira liga",
    "eredivisie",
    "belgian pro league",
    "super lig",
    "scottish premiership",
    "brasileirao",
    "brasileirao serie b",
    "brasileirao serie c",
    "brasileirao serie d",
    "campeonato paulista",
    "campeonato carioca",
    "campeonato mineiro",
    "campeonato gaucho",
    "primera division de chile",
    "categoria primera a",
    "ligapro serie a",
    "primera division de paraguay",
    "liga 1 peru",
    "primera division de uruguay",
    "liga futve",
    "division profesional bolivia",
    "campeonato femenino de primera division",
    "brasileirao feminino serie a1",
    "liga femenina colombia",
    "primera division femenina chile",
    "campeonato anual fem",
    "campeonato uruguayo femenino",
    "liga f",
    "womens super league",
    "premiere ligue",
    "frauen-bundesliga",
    "serie a femminile",
    "campeonato nacional feminino",
    "vrouwen eredivisie",
  ];

  const league = normalizeText(group.league);
  const index = orderedLeagues.indexOf(league);

  return index === -1 ? 9999 : index;
}

function isWomenGroup(group) {
  const text = normalizeText(
    `${group.sport} ${group.league} ${group.matches
      .map((match) => `${match.partido} ${match.local} ${match.visitante}`)
      .join(" ")}`
  );

  return /femenin|women|womens|\(f\)|liga f|frauen|femminile|vrouwen/.test(text);
}

function numeroSeguro(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function contarRojasDesdeLista(items = [], side = "") {
  if (!Array.isArray(items)) {
    return 0;
  }

  return items.filter((item) => {
    const itemSide = normalizeText(
      item?.local_visitante || item?.side || item?.homeAway || item?.equipo_lado || ""
    );

    if (side === "home") {
      return ["home", "local"].includes(itemSide);
    }

    if (side === "away") {
      return ["away", "visitante"].includes(itemSide);
    }

    return false;
  }).length;
}

function normalizarIncidenciasPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const goleadores = Array.isArray(payload.goleadores)
    ? payload.goleadores
    : Array.isArray(payload.goles)
      ? payload.goles
      : Array.isArray(payload.scorers)
        ? payload.scorers
        : [];

  const tarjetas = Array.isArray(payload.tarjetas_rojas)
    ? payload.tarjetas_rojas
    : Array.isArray(payload.rojas)
      ? payload.rojas
      : [];

  const localRojas = numeroSeguro(
    payload.rojas?.local ??
      payload.local_rojas ??
      payload.rojas_local ??
      payload.tarjetas_rojas_local ??
      contarRojasDesdeLista(tarjetas, "home")
  );

  const visitanteRojas = numeroSeguro(
    payload.rojas?.visitante ??
      payload.rojas?.away ??
      payload.visitante_rojas ??
      payload.rojas_visitante ??
      payload.tarjetas_rojas_visitante ??
      contarRojasDesdeLista(tarjetas, "away")
  );

  const goleadoresNormalizados = goleadores
    .filter((gol) => gol && typeof gol === "object")
    .map((gol) => {
      const jugador = scorerName(gol);

      return {
        ...gol,
        jugador: jugador || gol.jugador || gol.nombre || null,
        minuto: scorerMinute(gol) || gol.minuto || gol.minute || null,
        local_visitante:
          gol.local_visitante ||
          gol.lado ||
          gol.side ||
          gol.homeAway ||
          gol.home_away ||
          null,
        equipo: scorerTeamText(gol) || gol.equipo || gol.team || gol.teamName || null,
      };
    });

  return {
    goleadores: goleadoresNormalizados,
    tarjetas_rojas: [],
    local_rojas: localRojas,
    visitante_rojas: visitanteRojas,
  };
}

function aplicarIncidenciasAlPartido(match, payload) {
  const incidencias = normalizarIncidenciasPayload(payload);

  if (!incidencias) {
    return aplicarIncidenciasPersistidas(match);
  }

  const key = incidenciaCacheKey(match);
  const persistidas = key ? INCIDENCIAS_MEMORIA.get(key) : null;
  const golesPrevios = match.goleadores || match.scorers || match.goles || [];
  const golesPersistidos = persistidas?.goleadores || [];
  const golesEntrantes = incidencias.goleadores || [];

  const dataFusionada = fusionarIncidenciasData(
    fusionarIncidenciasData(
      {
        goleadores: golesPrevios,
        local_rojas: match.local_rojas,
        visitante_rojas: match.visitante_rojas,
      },
      persistidas || {}
    ),
    {
      goleadores: golesEntrantes,
      local_rojas: incidencias.local_rojas,
      visitante_rojas: incidencias.visitante_rojas,
      actualizado_en: new Date().toISOString(),
    }
  );

  const actualizado = {
    ...match,
    goleadores: listaConDatos(dataFusionada.goleadores)
      ? dataFusionada.goleadores
      : listaConDatos(golesPersistidos)
        ? golesPersistidos
        : golesPrevios,
    tarjetas_rojas: [],
    local_rojas: Number(dataFusionada.local_rojas || 0),
    visitante_rojas: Number(dataFusionada.visitante_rojas || 0),
    incidencias_actualizadas: true,
    incidencias_actualizado_en: dataFusionada.actualizado_en,
  };

  guardarIncidenciasMatch(actualizado);
  return actualizado;
}

function mergeMatchesWithIncidencias(matches, incidenciasPorKey) {
  return matches.map((match) => {
    const conPersistidas = aplicarIncidenciasPersistidas(match);
    const payload = incidenciasPorKey.get(incidenciaCacheKey(conPersistidas));
    return payload ? aplicarIncidenciasAlPartido(conPersistidas, payload) : conPersistidas;
  });
}

function renderAgenda(matches, sourceUrl, meta = {}) {
  matches = aplicarIncidenciasPersistidasALista(matches);
  agendaCurrentMatches = Array.isArray(matches) ? matches : [];
  leagueGrid.innerHTML = "";

  if (!matches.length) {
    leagueGrid.innerHTML = `
      <article class="empty-state">
        <strong>No hay partidos para esta fecha.</strong>
        <p>La agenda se esta leyendo desde el JSON de ESPN Argentina.</p>
        <a class="channel-link" href="${sourceUrl}" target="_blank" rel="noreferrer">Abrir JSON</a>
      </article>
    `;
    return;
  }

  const groups = matches.reduce((acc, match) => {
    const sport = agendaSport(match);
    const league = inferAgendaLeague(match);
    const key = `${sport}||${league}`;
    const leagueSlug = match.liga_slug || match.competicion?.slug || "";
    const rawLeagueLogo = match.liga_logo || match.competicion?.logo || null;
    const leagueLogo = resolverLogoLiga(rawLeagueLogo, league, leagueSlug);

    if (!acc.has(key)) {
      acc.set(key, {
        sport,
        league,
        leagueSlug,
        leagueLogo,
        matches: [],
      });
    }

    if (!acc.get(key).leagueSlug && leagueSlug) {
      acc.get(key).leagueSlug = leagueSlug;
    }

    if (!acc.get(key).leagueLogo && leagueLogo) {
      acc.get(key).leagueLogo = leagueLogo;
    }

    acc.get(key).matches.push(match);
    return acc;
  }, new Map());

  Array.from(groups.values())
    .sort((a, b) => {
      const priority = groupPriority(a) - groupPriority(b);

      if (priority !== 0) {
        return priority;
      }

      const genderPriority = Number(isWomenGroup(a)) - Number(isWomenGroup(b));

      if (genderPriority !== 0) {
        return genderPriority;
      }

      const firstTimeA = a.matches[0]?.hora_inicio || a.matches[0]?.hora || "";
      const firstTimeB = b.matches[0]?.hora_inicio || b.matches[0]?.hora || "";

      return firstTimeA.localeCompare(firstTimeB) || a.league.localeCompare(b.league);
    })
    .forEach((group) => {
      group.matches.sort((a, b) => {
        const liveA = a.mostrar_marcador === true && a.completado !== true ? 0 : 1;
        const liveB = b.mostrar_marcador === true && b.completado !== true ? 0 : 1;

        if (liveA !== liveB) {
          return liveA - liveB;
        }

        return (a.hora_inicio || a.hora || "").localeCompare(
          b.hora_inicio || b.hora || ""
        );
      });

      const section = document.createElement("section");
      section.className = "agenda-group";
      section.innerHTML = `
        <header class="agenda-group-head">
          <div class="agenda-league-title">
            ${leagueLogoMarkup(group.league, group.leagueLogo, group.leagueSlug)}
            <div>
              <span>${escapeHtml(group.sport)}</span>
              <strong>${escapeHtml(group.league)}</strong>
            </div>
          </div>
          <em>${group.matches.length}</em>
        </header>
        <div class="agenda-list"></div>
      `;

      const list = section.querySelector(".agenda-list");

      group.matches.forEach((match) => {
        match = sincronizarTimerPartido(match);
        const row = document.createElement("article");
        const timerId = agendaTimerKey(match);

        row.className = "agenda-row";
        row.dataset.espnUrl = match.url_espn || sourceUrl;

        const home = match.local || match.partido?.split(" vs ")[0] || "Local";
        const away = match.visitante || match.partido?.split(" vs ")[1] || "Visitante";
        const isLive = isAgendaMatchLive(match);
        const score = scoreMarkup(match);
        const homeRedCards = redCardsForTeam(match, "home", home);
        const awayRedCards = redCardsForTeam(match, "away", away);
        const tv = obtenerTvPartidoSync(match);

        if (isLive) {
          row.classList.add("is-live");
        }

        row.dataset.search = matchSearchIndex(match, group, home, away, score);

        row.innerHTML = `
          <time data-live-timer-id="${escapeHtml(timerId)}">${escapeHtml(agendaDisplayTime(match))}</time>

          <span class="agenda-teams">
            <a class="agenda-team team-link" href="${teamProfileHref(home, match.local_logo, group.league)}" title="Ver ficha de ${escapeHtml(home)}">
              ${teamLogoMarkup(home, match.local_logo, homeRedCards)}
              <span>${escapeHtml(home)}</span>
            </a>

            <span class="agenda-score">${escapeHtml(score)}</span>

            <a class="agenda-team team-link" href="${teamProfileHref(away, match.visitante_logo, group.league)}" title="Ver ficha de ${escapeHtml(away)}">
              ${teamLogoMarkup(away, match.visitante_logo, awayRedCards)}
              <span>${escapeHtml(away)}</span>
            </a>

            <span class="agenda-incidencias-box" data-incidencias-id="${escapeHtml(timerId)}">${scorersMarkup(match, home, away)}</span>
            ${renderTvPartido(tv)}
          </span>

          <span class="agenda-state" data-live-state-id="${escapeHtml(timerId)}">${escapeHtml(agendaStatus(match))}</span>
        `;

        list.append(row);
      });

      leagueGrid.append(section);
    });

  aplicarFallbackLogosLiga();
}

async function loadAgenda(date = currentAgendaDate) {
  const selectedDate = localDateISO(date);

  if (agendaLoading) {
    return;
  }

  if (agendaLoadedDate === selectedDate && leagueGrid.children.length > 0) {
    applyAgendaSearch();
    return;
  }

  agendaLoading = true;
  leagueGrid.innerHTML = `<p class="empty-state">Cargando Agenda...</p>`;

  try {
    const data = await fetchAgendaPayload();
    const partidos = Array.isArray(data.partidos) ? data.partidos : [];

    const dailyMatches = aplicarIncidenciasPersistidasALista(
      sortAgendaMatchesStable(
        uniqueMatches(partidos).filter((match) =>
          agendaMatchesSelectedDate(match, selectedDate)
        )
      )
    );

    if (selectedDate === localDateISO()) {
      agendaLiveMatches = dailyMatches.filter(isAgendaMatchLive);
      agendaLiveLoaded = true;

      if (activeTab === "live") {
        renderEvents();
        updateFeatured();
      }
    }

    renderAgenda(dailyMatches, AGENDA_ENDPOINT, {
      source: data.fuente,
      total: data.total,
    });

    applyAgendaSearch();

    agendaLoadedDate = selectedDate;

    if (!matchSearch.value.trim()) {
      setUtilityStatus("");
    }

    // El live se actualiza después, sin bloquear ni reordenar la primera carga.
    window.setTimeout(refreshAgendaLive, 250);
    window.setTimeout(refreshIncidenciasLive, 1500);
  } catch (error) {
    console.error("Error actualizando agenda desde Worker:", error);

    const cachedData = readAnyJsonCache(CACHE_KEY_AGENDA);

    if (cachedData && Array.isArray(cachedData.partidos)) {
      const cachedMatches = aplicarIncidenciasPersistidasALista(
        sortAgendaMatchesStable(
          uniqueMatches(cachedData.partidos).filter((match) =>
            agendaMatchesSelectedDate(match, selectedDate)
          )
        )
      );

      renderAgenda(cachedMatches, AGENDA_ENDPOINT, {
        source: cachedData.fuente,
        total: cachedData.total,
        fromCache: true,
      });

      applyAgendaSearch();
      setUtilityStatus("Mostrando agenda guardada. Reintentando actualización...");
      return;
    }

    leagueGrid.innerHTML = `
      <article class="empty-state">
        <strong>No se pudo cargar la agenda ESPN.</strong>
        <p>El Worker esta temporalmente saturado. Proba recargar en unos minutos.</p>
        <a class="channel-link" href="${AGENDA_ENDPOINT}" target="_blank" rel="noreferrer">Abrir JSON</a>
      </article>
    `;
  } finally {
    agendaLoading = false;
  }
}

function recargarAgendaConTvSiCorresponde() {
  if (activeTab !== "agenda") {
    return;
  }

  if (agendaLoading) {
    window.setTimeout(recargarAgendaConTvSiCorresponde, 500);
    return;
  }

  agendaLoadedDate = "";
  loadAgenda(currentAgendaDate);
}

async function refreshAgendaLive() {
  if (activeTab !== "agenda") {
    return;
  }

  if (agendaLoading) {
    return;
  }

  const selectedDate = localDateISO(currentAgendaDate);

  try {
    const cachedData = readAnyJsonCache(CACHE_KEY_AGENDA);
    const currentPartidos = Array.isArray(agendaCurrentMatches) ? agendaCurrentMatches : [];
    const basePartidos = currentPartidos.length
      ? currentPartidos
      : Array.isArray(cachedData?.partidos)
        ? cachedData.partidos
        : [];

    const liveData = await fetchAgendaLivePayload();
    const livePartidos = Array.isArray(liveData.partidos) ? liveData.partidos : [];

    const mergedPartidos = mergeAgendaWithLive(basePartidos, livePartidos);

    const dailyMatches = aplicarIncidenciasPersistidasALista(
      sortAgendaMatchesStable(
        uniqueMatches(mergedPartidos).filter((match) =>
          agendaMatchesSelectedDate(match, selectedDate)
        )
      )
    );

    if (selectedDate === localDateISO()) {
      agendaLiveMatches = dailyMatches.filter(isAgendaMatchLive);
      agendaLiveLoaded = true;
    }

    if (dailyMatches.length) {
      agendaCurrentMatches = dailyMatches;

      // No renderizamos toda la agenda en cada refresh de /live.
      // Renderizar recrea las filas y hace que el cuadro del gol desaparezca y vuelva a aparecer.
      const domActualizado = actualizarLiveEnDOM(dailyMatches);

      if (!domActualizado || !leagueGrid.querySelector(".agenda-row")) {
        renderAgenda(dailyMatches, AGENDA_LIVE_ENDPOINT, {
          source: liveData.fuente || cachedData?.fuente,
          total: cachedData?.total || dailyMatches.length,
        });
      }

      applyAgendaSearch();
      agendaLoadedDate = selectedDate;
    }

    if (!matchSearch.value.trim()) {
      setUtilityStatus(agendaLiveMatches.length ? "En vivo actualizado" : "");
    }

    window.setTimeout(refreshIncidenciasLive, 500);
  } catch (error) {
    console.warn("No se pudo actualizar solo el vivo", error);
    setUtilityStatus("Agenda guardada. Reintentando vivo...");
  }
}


function actualizarIncidenciasEnDOM(matches) {
  const list = Array.isArray(matches) ? matches : [];

  for (const match of list) {
    const timerId = agendaTimerKey(match);
    const box = Array.from(document.querySelectorAll("[data-incidencias-id]")).find(
      (el) => el.dataset.incidenciasId === timerId
    );

    if (!box) {
      continue;
    }

    const home = match.local || match.partido?.split(" vs ")[0] || "Local";
    const away = match.visitante || match.partido?.split(" vs ")[1] || "Visitante";
    const nextHtml = scorersMarkup(match, home, away);

    // Clave: si ya hay un gol visible, nunca vaciamos el cuadro por una respuesta vacía.
    // Esto evita el parpadeo: desaparece → aparece.
    if (!nextHtml.trim() && box.innerHTML.trim()) {
      continue;
    }

    // Solo tocamos el DOM si el HTML final realmente cambió.
    if (box.innerHTML !== nextHtml) {
      box.innerHTML = nextHtml;
    }

    const row = box.closest(".agenda-row");

    if (row) {
      const group = row.closest(".agenda-group");
      const league = group?.querySelector(".agenda-league-title strong")?.textContent || inferAgendaLeague(match);
      const sport = group?.querySelector(".agenda-league-title span")?.textContent || agendaSport(match);
      const score = scoreMarkup(match);

      row.dataset.search = matchSearchIndex(
        match,
        { league, sport },
        home,
        away,
        score
      );
    }
  }
}


function actualizarLiveEnDOM(matches) {
  const list = Array.isArray(matches) ? matches : [];
  let faltanFilas = false;

  for (const match of list) {
    const timerId = agendaTimerKey(match);
    const timerEl = Array.from(document.querySelectorAll("[data-live-timer-id]")).find(
      (el) => el.dataset.liveTimerId === timerId
    );

    if (!timerEl) {
      // Si aparece un partido nuevo que no estaba en pantalla, ahí sí hay que renderizar.
      // Pero para partidos ya dibujados no tocamos toda la grilla.
      if (isAgendaMatchLive(match)) {
        faltanFilas = true;
      }
      continue;
    }

    const row = timerEl.closest(".agenda-row");
    if (!row) {
      continue;
    }

    const stateEl = row.querySelector("[data-live-state-id]");
    const scoreEl = row.querySelector(".agenda-score");

    const nextTime = agendaDisplayTime(match);
    const nextState = agendaStatus(match);
    const nextScore = scoreMarkup(match);

    if (timerEl.textContent !== nextTime) {
      timerEl.textContent = nextTime;
    }

    if (stateEl && stateEl.textContent !== nextState) {
      stateEl.textContent = nextState;
    }

    if (scoreEl && scoreEl.textContent !== nextScore) {
      scoreEl.textContent = nextScore;
    }

    row.classList.toggle("is-live", isAgendaMatchLive(match));

    const group = row.closest(".agenda-group");
    const league = group?.querySelector(".agenda-league-title strong")?.textContent || inferAgendaLeague(match);
    const sport = group?.querySelector(".agenda-league-title span")?.textContent || agendaSport(match);
    const teams = agendaTeams(match);

    row.dataset.search = matchSearchIndex(
      match,
      { league, sport },
      teams.home || match.local || "Local",
      teams.away || match.visitante || "Visitante",
      nextScore
    );
  }

  return !faltanFilas;
}

function partidoTieneMarcadorConGoles(match) {
  const score = scoreMarkup(match);

  if (!score || score === "-") {
    return false;
  }

  const matchScore = String(score).match(/(\d+)\s*-\s*(\d+)/);

  if (!matchScore) {
    return false;
  }

  const local = Number(matchScore[1]);
  const visitante = Number(matchScore[2]);

  return (Number.isFinite(local) && local > 0) || (Number.isFinite(visitante) && visitante > 0);
}

function partidoDebeConsultarIncidencias(match) {
  if (!match?.id || !match?.liga_slug) {
    return false;
  }

  if (isAgendaMatchLive(match)) {
    return true;
  }

  // También consultamos partidos finalizados o con marcador con goles.
  // Si no hacemos esto, algunos partidos con resultado 2-1, 3-0, etc.
  // nunca piden Worker 2 y por eso no aparece el minuto/jugador del gol.
  if (partidoTieneMarcadorConGoles(match)) {
    return true;
  }

  if (Number(match.local_rojas || 0) > 0 || Number(match.visitante_rojas || 0) > 0) {
    return true;
  }

  return false;
}

function prioridadConsultaIncidencias(match) {
  let prioridad = 0;

  if (isAgendaMatchLive(match)) prioridad -= 1000;
  if (partidoTieneMarcadorConGoles(match)) prioridad -= 500;
  if (match.completado === true) prioridad -= 100;
  if (incidenciasDataTieneDatos(incidenciasDesdeMatch(match))) prioridad += 300;

  const score = scoreMarkup(match);
  const scoreMatch = String(score || "").match(/(\d+)\s*-\s*(\d+)/);

  if (scoreMatch) {
    prioridad -= Number(scoreMatch[1]) + Number(scoreMatch[2]);
  }

  return prioridad;
}

async function refreshIncidenciasLive() {
  if (activeTab !== "agenda" || incidenciasLoading || agendaLoading) {
    return;
  }

  const selectedDate = localDateISO(currentAgendaDate);
  const partidosBase = Array.isArray(agendaCurrentMatches) && agendaCurrentMatches.length
    ? agendaCurrentMatches
    : uniqueMatches(readAnyJsonCache(CACHE_KEY_AGENDA)?.partidos || []);

  const partidosParaIncidencias = uniqueMatches(partidosBase)
    .filter((match) => agendaMatchesSelectedDate(match, selectedDate))
    .filter(partidoDebeConsultarIncidencias)
    .sort((a, b) => prioridadConsultaIncidencias(a) - prioridadConsultaIncidencias(b))
    .slice(0, 120);

  if (!partidosParaIncidencias.length) {
    return;
  }

  incidenciasLoading = true;

  try {
    const results = await Promise.allSettled(
      partidosParaIncidencias.map(async (match) => {
        const payload = await fetchIncidenciasPartido(match);
        return {
          key: incidenciaCacheKey(match),
          payload,
        };
      })
    );

    const incidenciasPorKey = new Map();

    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value?.payload) {
        continue;
      }

      incidenciasPorKey.set(result.value.key, result.value.payload);
    }

    if (!incidenciasPorKey.size) {
      return;
    }

    const dailyMatches = aplicarIncidenciasPersistidasALista(
      sortAgendaMatchesStable(
        mergeMatchesWithIncidencias(agendaCurrentMatches, incidenciasPorKey)
          .filter((match) => agendaMatchesSelectedDate(match, selectedDate))
      )
    );

    // No hacemos renderAgenda() acá, porque eso borra y recrea las filas.
    // Actualizamos solo el cuadro de goles/rojas en el DOM para evitar parpadeos.
    agendaCurrentMatches = dailyMatches;
    actualizarIncidenciasEnDOM(dailyMatches);

    applyAgendaSearch();

    // No mostramos cartel de "Incidencias actualizadas" para evitar ruido visual.
  } catch (error) {
    console.warn("No se pudieron actualizar incidencias", error);
  } finally {
    incidenciasLoading = false;
  }
}

/* ============================================================
   JUEGOS / LEGACY SOCIAL
============================================================ */

function updatePostCount() {
  if (!postFeed || !postCounter) {
    return;
  }

  const total = postFeed.querySelectorAll(".post-card").length;
  postCounter.textContent = `${total} post${total === 1 ? "" : "s"}`;
}

/* ============================================================
   TABS / UI
============================================================ */

function activateTab(tab) {
  activeTab = tab.dataset.tab;

  tabs.forEach((item) => item.classList.toggle("active", item === tab));
  showSection(activeTab);

  if (activeTab === "live") {
    setUtilityOpen(true);
    loadEvents();
  }

  if (activeTab === "agenda") {
    loadAgenda(currentAgendaDate);
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab));
});

searchToggle.addEventListener("click", () => {
  setUtilityOpen(true);
});

calendarToggle.addEventListener("click", () => {
  setUtilityOpen(true);
  setUtilityStatus("");
});

profileToggle.addEventListener("click", () => {
  favoriteMode = !favoriteMode;
  profileToggle.classList.toggle("active", favoriteMode);
  setUtilityOpen(true);
});

matchSearch.addEventListener("input", applySearch);

dateButtons.forEach((button) => {
  button.addEventListener("click", () => {
    dateButtons.forEach((item) => item.classList.toggle("active", item === button));

    const offsets = {
      ayer: -1,
      hoy: 0,
      manana: 1,
    };

    currentAgendaDate = dateFromOffset(offsets[button.dataset.day] || 0);

    matchSearch.value = "";
    setUtilityStatus("");

    if (activeTab === "agenda") {
      loadAgenda(currentAgendaDate);
    }
  });
});

playToggle.addEventListener("click", () => {
  if (videoCard.dataset.channelUrl) {
    reloadFeaturedEmbed();
    videoState.textContent = "Transmitiendo";
    return;
  }

  const isPlaying = videoCard.classList.toggle("playing");
  videoState.textContent = isPlaying ? "Transmitiendo" : "En pausa";
  playToggle.setAttribute(
    "aria-label",
    isPlaying ? "Pausar partido" : "Reproducir partido"
  );
});

reloadEmbed.addEventListener("click", reloadFeaturedEmbed);

volumeToggle.addEventListener("click", () => {
  muted = !muted;
  applyEmbedAudioState();
});

focusToggle.addEventListener("click", () => {
  toggleVideoFullscreen();
});

document.addEventListener("fullscreenchange", () => {
  const isFullscreen = document.fullscreenElement === videoCard;
  videoCard.classList.toggle("focused", isFullscreen);
  focusToggle.title = isFullscreen ? "Salir de pantalla completa" : "Pantalla completa";
  focusToggle.setAttribute(
    "aria-label",
    isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"
  );
});

postForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const value = postInput.value.trim();

  if (!value) {
    return;
  }

  const post = document.createElement("article");
  post.className = "post-card";
  post.innerHTML = `
    <div class="post-avatar">T</div>
    <div>
      <header>
        <strong>Tu cuenta</strong>
        <span>@usuario · ahora</span>
      </header>
      <p></p>
      <footer>
        <button type="button">Responder</button>
        <button type="button">Repost</button>
        <button type="button" data-like>Me gusta <span>0</span></button>
      </footer>
    </div>
  `;

  post.querySelector("p").textContent = value;
  postFeed.prepend(post);
  postInput.value = "";
  updatePostCount();
});

postFeed?.addEventListener("click", (event) => {
  const likeButton = event.target.closest("[data-like]");

  if (!likeButton) {
    return;
  }

  const count = likeButton.querySelector("span");
  const active = likeButton.classList.toggle("active");

  count.textContent = Number(count.textContent) + (active ? 1 : -1);
});

liveGrid.addEventListener("click", (event) => {
  const toggle = event.target.closest(".event-toggle");

  if (!toggle) {
    return;
  }

  const card = toggle.closest(".live-event-card");
  const details = card.querySelector(".event-details");
  const isOpen = card.classList.toggle("open");

  toggle.setAttribute("aria-expanded", String(isOpen));
  details.hidden = !isOpen;
});

leagueGrid.addEventListener("click", (event) => {
  const teamLink = event.target.closest(".team-link");

  if (teamLink) {
    return;
  }

  const row = event.target.closest(".agenda-row");

  if (!favoriteMode || !row) {
    return;
  }

  event.preventDefault();
  row.classList.toggle("favorite");
});

refreshLive.addEventListener("click", loadEvents);

function abrirSeccionDesdeHash() {
  const hash = window.location.hash.replace("#", "");

  if (!hash) return;

  const aliases = {
    juegos: "games",
    juego: "games",
    games: "games",
    agenda: "agenda",
    live: "live",
    vivo: "live",
  };

  const tabName = aliases[hash] || hash;
  const tabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);

  if (!tabBtn) return;

  setTimeout(() => {
    tabBtn.click();

    setTimeout(() => {
      const section =
        document.getElementById(`${tabName}Section`) ||
        document.querySelector(`[data-section="${tabName}"]`);

      if (section) {
        section.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 120);
  }, 80);
}

window.addEventListener("DOMContentLoaded", abrirSeccionDesdeHash);
window.addEventListener("hashchange", abrirSeccionDesdeHash);
window.addEventListener("load", abrirSeccionDesdeHash);

/* ============================================================
   INIT
============================================================ */

inyectarAjustesVisuales();
injectAgendaGoalSideStyles();
showSection("agenda");
setUtilityStatus("");
updatePostCount();
cargarIncidenciasPersistidas();
loadAgenda();
loadEvents();

cargarTvPartidos()
  .then(recargarAgendaConTvSiCorresponde)
  .catch(() => {
    // La agenda no debe depender del JSON de TV.
  });

iniciarAgendaVisualTimer();

setInterval(() => {
  refreshAgendaLive();
}, LIVE_REFRESH_MS);

setInterval(() => {
  refreshIncidenciasLive();
}, INCIDENCIAS_REFRESH_MS);
