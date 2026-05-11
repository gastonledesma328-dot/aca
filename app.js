const EVENTS_URL = "https://raw.githubusercontent.com/gastonledesma328-dot/2612163/refs/heads/main/eventos_streamhdx.json";
const AGENDA_URL = "https://partidos-hoy-worker.gastonledesma328.workers.dev";

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
     - Usa AGENDA_URL.
     - Lee el Worker de Cloudflare.
     - Muestra los partidos de la agenda ESPN.

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

const FEATURED_LOGO_FALLBACKS = {
  flamengo: "https://a.espncdn.com/i/teamlogos/soccer/500/819.png",
  medellin: "https://a.espncdn.com/i/teamlogos/soccer/500/2690.png",
  "independiente medellin": "https://a.espncdn.com/i/teamlogos/soccer/500/2690.png",
  "independiente medellín": "https://a.espncdn.com/i/teamlogos/soccer/500/2690.png",
};

const CACHE_TTL_MS = 60_000;
const STALE_CACHE_TTL_MS = 20 * 60_000;
const requestCache = new Map();
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

async function fetchJsonCached(url, cacheKey, ttl = CACHE_TTL_MS) {
  const fresh = readJsonCache(cacheKey, ttl);

  if (fresh) {
    return fresh;
  }

  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey);
  }

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
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
    .finally(() => requestCache.delete(cacheKey));

  requestCache.set(cacheKey, request);
  return request;
}

function fetchAgendaPayload() {
  return fetchJsonCached(`${AGENDA_URL}?v=${Math.floor(Date.now() / CACHE_TTL_MS)}`, "agenda-worker-cache");
}

function fetchStreamEventsPayload() {
  return fetchJsonCached(`${EVENTS_URL}?v=${Math.floor(Date.now() / CACHE_TTL_MS)}`, "stream-events-cache");
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

  const stale = readAnyJsonCache("stream-events-cache");
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
  const payload = await fetchAgendaPayload();
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

function setFeaturedEmbed(channel) {
  const rawUrl = channel?.url || "";
  const embedSrc = rawUrl ? autoplayEmbedUrl(rawUrl) : "";

  videoCard.dataset.channelUrl = rawUrl;
  videoCard.classList.toggle("has-embed", Boolean(embedSrc));
  videoCard.classList.toggle("playing", Boolean(embedSrc));
  muted = false;
  volumeToggle.classList.remove("active");
  volumeToggle.title = "Silenciar";

  window.clearTimeout(featuredEmbedTimer);

  if (!embedSrc) {
    featuredFrame.src = "about:blank";
    featuredFrame.title = "Reproductor sin canal";
    return;
  }

  if (featuredFrame.src !== embedSrc) {
    featuredFrame.src = embedSrc;
  }

  featuredFrame.title = `Reproductor ${channel.nombre || "canal en vivo"}`;
  featuredEmbedTimer = window.setTimeout(() => {
    tryNextFeaturedChannel();
  }, 7000);
}

function setFeaturedChannels(channels = []) {
  featuredChannels = channels.filter((channel) => channel?.url);
  featuredChannelIndex = 0;
  setFeaturedEmbed(featuredChannels[featuredChannelIndex] || null);
}

function tryNextFeaturedChannel() {
  if (featuredChannels.length <= 1) {
    return;
  }

  featuredChannelIndex = (featuredChannelIndex + 1) % featuredChannels.length;
  const nextChannel = featuredChannels[featuredChannelIndex];

  videoState.textContent = `Probando ${nextChannel.nombre || "alternativa"}`;
  setFeaturedEmbed(nextChannel);
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

  tryNextFeaturedChannel();
  if (featuredChannels.length > 1) {
    return;
  }

  featuredFrame.src = "about:blank";
  window.setTimeout(() => {
    featuredFrame.src = autoplayEmbedUrl(channelUrl);
    videoCard.classList.add("has-embed", "playing");
    videoState.textContent = "Transmitiendo";
    muted = false;
    volumeToggle.classList.remove("active");
    volumeToggle.title = "Silenciar";
  }, 80);
}

function applyEmbedAudioState() {
  const channelUrl = videoCard.dataset.channelUrl || "";

  volumeToggle.classList.toggle("active", muted);
  volumeToggle.title = muted ? "Activar sonido" : "Silenciar";

  if (!channelUrl) {
    videoState.textContent = "Sin canal";
    return;
  }

  featuredFrame.src = autoplayEmbedUrl(channelUrl, muted);
  videoCard.classList.add("has-embed", "playing");
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
  const homeLogo = featuredTeamLogo(featuredEvent, "home", info.home);
  const awayLogo = featuredTeamLogo(featuredEvent, "away", info.away);
  const status = eventStatus(featuredEvent);
  const statusText = {
    live: "EN VIVO",
    upcoming: "PROX",
    ended: "FIN",
  }[status];
  const channels = Array.isArray(featuredEvent.canales) ? featuredEvent.canales : [];
  const firstChannel = channels.find((channel) => channel?.url) || null;
  const liveEvent = featuredEvent;

  featured.classList.remove("no-live");

  document.querySelector(".crest-a").textContent = info.home.charAt(0).toUpperCase();
  document.querySelector(".crest-b").textContent = info.away.charAt(0).toUpperCase();
  document.querySelector(".team:first-child strong").textContent = info.home;
  document.querySelector(".team:last-child strong").textContent = info.away;

  document.querySelector(".live-pill").textContent = status === "live" ? "Live" : statusText;
  mainScore.textContent = statusText;
  featuredStatus.querySelector("strong").textContent = info.competition;

  featuredStatus.querySelector("p").textContent =
    `${liveEvent.hora} Â· ${liveEvent.clase || liveEvent.categoria} Â· ${liveEvent.canales?.[0]?.nombre || "Canal disponible"}`;

  featuredStatus.querySelector("p").textContent =
    `${featuredEvent.hora || "--:--"} · ${featuredEvent.clase || featuredEvent.categoria || "Evento"} · ${firstChannel?.nombre || "Canal disponible"}`;

  featuredStatus.querySelector("p").textContent =
    `${featuredEvent.hora || "--:--"} - ${featuredEvent.clase || featuredEvent.categoria || "Evento"} - ${firstChannel?.nombre || "Canal disponible"}`;

  setFeaturedChannels(channels);
  videoState.textContent = firstChannel
    ? `Transmitiendo ${firstChannel.nombre} ${firstChannel.calidad || ""}`.trim()
    : "Sin canal";
  watchButton.textContent = firstChannel ? "Ver canal" : "Sin canal";
  watchButton.disabled = !firstChannel?.url;
  watchButton.onclick = firstChannel?.url
    ? () => window.open(firstChannel.url, "_blank", "noopener,noreferrer")
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

  setFeaturedEmbed(firstChannel);
  videoState.textContent = firstChannel
    ? `Transmitiendo ${firstChannel.nombre} ${firstChannel.calidad || ""}`.trim()
    : "Sin canal";
  watchButton.textContent = firstChannel ? "Ver canal" : "Sin canal";
  watchButton.disabled = !firstChannel?.url;
  watchButton.onclick = firstChannel?.url
    ? () => window.open(firstChannel.url, "_blank", "noopener,noreferrer")
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
          return `<a class="channel-link" href="${channel.url}" target="_blank" rel="noreferrer">${channel.nombre} Â· ${channel.calidad || "HD"}</a>`;
        })
        .join("");

      card.innerHTML = `
        <button class="event-toggle" type="button" aria-expanded="false">
          <span>
            <strong>${info.matchup}</strong>
            <small>${event.hora} Â· ${info.competition}</small>
          </span>
          <span class="event-badge">${statusText}</span>
        </button>
        <div class="event-details" hidden>
          <div class="event-meta">
            <span>${event.fecha}</span>
            <span>${event.categoria || "Evento"}</span>
            <span>${event.clase || "General"}</span>
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
  const tiempo =
    match.mostrar_tiempo || match.minuto || match.estado_corto || match.estado || "";

  if (match.completado === true) {
    return "Fin";
  }

  if (
    String(tiempo).toLowerCase().includes("fin") ||
    String(tiempo).toLowerCase().includes("final")
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
  const logoHtml = logo
    ? `<img class="team-logo" src="${logo}" alt="${name}" loading="lazy" />`
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

function leagueLogoMarkup(name, logo) {
  if (logo) {
    return `<img class="league-logo" src="${logo}" alt="${name}" loading="lazy" />`;
  }

  return `<span class="league-logo league-logo-fallback">${initials(name)}</span>`;
}

function scoreMarkup(match) {
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
      .replace(/[â€“â€”]/g, "-");

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
    .replace(/[â€“â€”]/g, "-")
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
  const scorers = Array.isArray(match.goleadores)
    ? match.goleadores
        .map((scorer) => `${scorerName(scorer)} ${scorer.descripcion || ""} ${scorer.equipo || scorer.team || ""} ${scorerMinute(scorer)}`)
        .join(" ")
    : "";
  const cards = cardsSearchText(match);

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

function scorerName(scorer) {
  return (
    scorer.jugador ||
    scorer.nombre ||
    scorer.player ||
    scorer.athlete ||
    scorer.descripcion ||
    ""
  );
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

function scorersMarkup(match) {
  const scorers = Array.isArray(match.goleadores)
    ? match.goleadores.filter((scorer) => scorerName(scorer))
    : [];

  if (!scorers.length) {
    return "";
  }

  const summary = scorers
    .slice(0, 6)
    .map((scorer) => {
      const minute = scorerMinute(scorer);
      const team = scorer.equipo || scorer.team || "";
      const goalType = scorer.tipo || scorer.type || "";
      const detail = goalType && !/goal|gol/i.test(goalType) ? `, ${goalType}` : "";

      return `
        <span class="agenda-scorer-item">
          ${minute ? `<b>${minute}</b>` : ""}
          ${scorerName(scorer)}${detail}${team ? ` <em>${team}</em>` : ""}
        </span>
      `;
    })
    .join("");

  const extra = scorers.length > 6
    ? `<span class="agenda-scorer-more">+${scorers.length - 6}</span>`
    : "";

  return `<span class="agenda-scorers">${summary}${extra}</span>`;
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

function renderAgenda(matches, sourceUrl, meta = {}) {
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
    const leagueLogo = match.liga_logo || match.competicion?.logo || null;

    if (!acc.has(key)) {
      acc.set(key, {
        sport,
        league,
        leagueLogo,
        matches: [],
      });
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
            ${leagueLogoMarkup(group.league, group.leagueLogo)}
            <div>
              <span>${group.sport}</span>
              <strong>${group.league}</strong>
            </div>
          </div>
          <em>${group.matches.length}</em>
        </header>
        <div class="agenda-list"></div>
      `;

      const list = section.querySelector(".agenda-list");

      group.matches.forEach((match) => {
        const row = document.createElement("article");

        row.className = "agenda-row";
        row.dataset.espnUrl = match.url_espn || sourceUrl;

        const home = match.local || match.partido?.split(" vs ")[0] || "Local";
        const away = match.visitante || match.partido?.split(" vs ")[1] || "Visitante";
        const isLive = isAgendaMatchLive(match);
        const score = scoreMarkup(match);
        const homeRedCards = redCardsForTeam(match, "home", home);
        const awayRedCards = redCardsForTeam(match, "away", away);

        if (isLive) {
          row.classList.add("is-live");
        }

        row.dataset.search = matchSearchIndex(match, group, home, away, score);

        row.innerHTML = `
          <time>${agendaDisplayTime(match)}</time>

          <span class="agenda-teams">
            <a class="agenda-team team-link" href="${teamProfileHref(home, match.local_logo, group.league)}" title="Ver ficha de ${home}">
              ${teamLogoMarkup(home, match.local_logo, homeRedCards)}
              <span>${home}</span>
            </a>

            <span class="agenda-score">${score}</span>

            <a class="agenda-team team-link" href="${teamProfileHref(away, match.visitante_logo, group.league)}" title="Ver ficha de ${away}">
              ${teamLogoMarkup(away, match.visitante_logo, awayRedCards)}
              <span>${away}</span>
            </a>

            ${scorersMarkup(match)}
          </span>

          <span class="agenda-state">${agendaStatus(match)}</span>
        `;

        list.append(row);
      });

      leagueGrid.append(section);
    });
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

    const dailyMatches = partidos
      .filter((match) => {
        const matchDate = agendaDate(match);
        return !matchDate || matchDate === selectedDate;
      })
      .sort((a, b) => {
        const priorityA = Number(a.prioridad_liga ?? 9999);
        const priorityB = Number(b.prioridad_liga ?? 9999);

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        return (a.hora_inicio || a.hora || "").localeCompare(
          b.hora_inicio || b.hora || ""
        );
      });

    if (selectedDate === localDateISO()) {
      agendaLiveMatches = dailyMatches.filter(isAgendaMatchLive);
      agendaLiveLoaded = true;

      if (activeTab === "live") {
        renderEvents();
        updateFeatured();
      }
    }

    renderAgenda(dailyMatches, AGENDA_URL, {
      source: data.fuente,
      total: data.total,
    });
    applyAgendaSearch();

    agendaLoadedDate = selectedDate;
    if (!matchSearch.value.trim()) {
      setUtilityStatus("");
    }
  } catch (error) {
    leagueGrid.innerHTML = `
      <article class="empty-state">
        <strong>No se pudo cargar la agenda ESPN.</strong>
        <p>El Worker esta temporalmente saturado. Proba recargar en unos minutos.</p>
        <a class="channel-link" href="${AGENDA_URL}" target="_blank" rel="noreferrer">Abrir JSON</a>
      </article>
    `;
  } finally {
    agendaLoading = false;
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
        <span>@usuario Â· ahora</span>
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
    vivo: "live"
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
          block: "start"
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

showSection("agenda");
setUtilityStatus("");
updatePostCount();
loadAgenda();
loadEvents();
