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
const videoState = document.querySelector("#videoState");
const volumeToggle = document.querySelector("#volumeToggle");
const focusToggle = document.querySelector("#focusToggle");
const featured = document.querySelector(".featured");
const featuredStatus = document.querySelector("#featuredStatus");
const mainScore = document.querySelector("#mainScore");
const leagueGrid = document.querySelector("#leagueGrid");
const socialSection = document.querySelector("#socialSection");
const liveSection = document.querySelector("#liveSection");
const liveGrid = document.querySelector("#liveGrid");
const liveTitle = document.querySelector("#liveTitle");
const refreshLive = document.querySelector("#refreshLive");
const postForm = document.querySelector("#postForm");
const postInput = document.querySelector("#postInput");
const postFeed = document.querySelector("#postFeed");
const postCounter = document.querySelector("#postCounter");
const notification = document.querySelector(".notification");

let activeTab = "agenda";
let muted = false;
let favoriteMode = false;
let events = [];
let currentAgendaDate = new Date();

let agendaLoadedDate = "";
let agendaLoading = false;

/*
  Devuelve fecha local del navegador en formato YYYY-MM-DD.
  Se usa para comparar la fecha seleccionada con los partidos.
*/
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
  utilityPanel.classList.toggle("hidden", !open);
  searchToggle.setAttribute("aria-expanded", String(open));
  calendarToggle.setAttribute("aria-expanded", String(open));

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

  socialSection.classList.toggle("hidden", section !== "chat");
  liveSection.classList.toggle("hidden", !isLive);
  leagueGrid.classList.toggle("hidden", section !== "agenda");
  featured.classList.toggle("hidden", !isLive);
}

/* ============================================================
   EVENTOS STREAMHDX / PARTIDOS EN VIVO
============================================================ */

/*
  IMPORTANTE:
  Antes tenías esto:

    new Date(`${event.fecha_iso}T${event.hora}:00`)

  Eso puede hacer que el navegador interprete la hora según su zona horaria
  y termine calculando mal si el formato viene sin zona.

  Ahora usamos -03:00 explícito, que corresponde a Argentina.
  Esto arregla el cálculo de Live / Prox / Fin.

  OJO:
  Esto NO cambia el texto visible event.hora.
  Si el JSON trae "11:45", se va a mostrar 11:45.
  Para mostrar 13:45, el JSON debe traer "hora": "13:45".
*/
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

function updateFeatured() {
  const liveEvent = events.find((event) => eventStatus(event) === "live");

  if (!liveEvent) {
    featured.classList.add("no-live");
    featuredStatus.querySelector("strong").textContent = "Sin partido en vivo ahora";
    featuredStatus.querySelector("p").textContent =
      "Cuando el horario actual caiga dentro de un evento del JSON, esta seccion se actualiza sola.";
    videoState.textContent = "Sin directo";
    return;
  }

  const info = splitTitle(liveEvent.titulo);

  featured.classList.remove("no-live");

  document.querySelector(".crest-a").textContent = info.home.charAt(0).toUpperCase();
  document.querySelector(".crest-b").textContent = info.away.charAt(0).toUpperCase();
  document.querySelector(".team:first-child strong").textContent = info.home;
  document.querySelector(".team:last-child strong").textContent = info.away;

  mainScore.textContent = "EN VIVO";
  featuredStatus.querySelector("strong").textContent = info.competition;

  /*
    Mostramos liveEvent.hora directamente.
    No convertimos acá porque el JSON final debe venir ya en horario Argentina.
  */
  featuredStatus.querySelector("p").textContent =
    `${liveEvent.hora} · ${liveEvent.clase || liveEvent.categoria} · ${liveEvent.canales?.[0]?.nombre || "Canal disponible"}`;

  videoState.textContent = "Disponible";
}

function renderEvents() {
  const now = new Date();
  const today = localDateISO(now);
  const dailyEvents = events.filter((event) => event.fecha_iso === today);
  const sorted = dailyEvents.length ? dailyEvents : events;

  liveGrid.innerHTML = "";

  if (!sorted.length) {
    liveTitle.textContent = "No se encontraron eventos";
    liveGrid.innerHTML = `<p class="empty-state">No hay partidos para mostrar desde el JSON remoto.</p>`;
    return;
  }

  const liveCount = sorted.filter((event) => eventStatus(event, now) === "live").length;
  liveTitle.textContent = liveCount
    ? `${liveCount} en vivo ahora`
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

      card.className = `event-card live-event-card ${status === "live" ? "is-live" : ""}`;

      const statusText = {
        live: "Live",
        upcoming: "Prox",
        ended: "Fin",
      }[status];

      const channels = (event.canales || [])
        .map((channel) => {
          return `<a class="channel-link" href="${channel.url}" target="_blank" rel="noreferrer">${channel.nombre} · ${channel.calidad || "HD"}</a>`;
        })
        .join("");

      card.innerHTML = `
        <button class="event-toggle" type="button" aria-expanded="false">
          <span>
            <strong>${info.matchup}</strong>
            <small>${event.hora} · ${info.competition}</small>
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
    const response = await fetch(`${EVENTS_URL}?v=${Date.now()}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    events = await response.json();

    /*
      Ordena por fecha/hora Argentina usando eventStart().
      Como eventStart fuerza -03:00, el orden es más estable.
    */
    events.sort((a, b) => eventStart(a) - eventStart(b));

    renderEvents();
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

/*
  La agenda muestra hora_inicio o hora.
  No convertimos acá porque el Worker debería entregar la hora correcta.
*/
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

function teamLogoMarkup(name, logo) {
  if (logo) {
    return `<img class="team-logo" src="${logo}" alt="${name}" loading="lazy" />`;
  }

  return `<span class="team-logo logo-fallback">${initials(name)}</span>`;
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

  /*
    Si el partido no está en juego ni finalizado,
    mostramos solo "-" para dejar vacío el resultado.
  */
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

    // ESPN / tu Worker usa -1 como "sin marcador"
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

  /*
    Si ESPN dice que está en vivo/finalizado pero no hay marcador válido,
    mantenemos el separador vacío.
  */
  return "-";
}

function scorersMarkup(match) {
  const scorers = Array.isArray(match.goleadores)
    ? match.goleadores.filter((scorer) => scorer.jugador || scorer.descripcion)
    : [];

  if (!scorers.length) {
    return "";
  }

  const summary = scorers
    .slice(0, 4)
    .map((scorer) => {
      const minute = scorer.minuto ? `${scorer.minuto} ` : "";
      const team = scorer.equipo ? ` (${scorer.equipo})` : "";
      return `${minute}${scorer.jugador || scorer.descripcion}${team}`;
    })
    .join(" · ");

  const extra = scorers.length > 4 ? ` +${scorers.length - 4}` : "";

  return `<span class="agenda-scorers">${summary}${extra}</span>`;
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
        const isLive = match.mostrar_marcador === true && match.completado !== true;
        const score = scoreMarkup(match);

        if (isLive) {
          row.classList.add("is-live");
        }

        row.innerHTML = `
          <time>${agendaDisplayTime(match)}</time>

          <span class="agenda-teams">
            <a class="agenda-team team-link" href="${teamProfileHref(home, match.local_logo, group.league)}" title="Ver ficha de ${home}">
              ${teamLogoMarkup(home, match.local_logo)}
              <span>${home}</span>
            </a>

            <span class="agenda-score">${score}</span>

            <a class="agenda-team team-link" href="${teamProfileHref(away, match.visitante_logo, group.league)}" title="Ver ficha de ${away}">
              ${teamLogoMarkup(away, match.visitante_logo)}
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
    return;
  }

  agendaLoading = true;
  leagueGrid.innerHTML = `<p class="empty-state">Cargando Agenda...</p>`;

  try {
    const response = await fetch(`${AGENDA_URL}?v=${Date.now()}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
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

    renderAgenda(dailyMatches, AGENDA_URL, {
      source: data.fuente,
      total: data.total,
    });

    agendaLoadedDate = selectedDate;
    setUtilityStatus("");
  } catch (error) {
    leagueGrid.innerHTML = `
      <article class="empty-state">
        <strong>No se pudo cargar la agenda ESPN.</strong>
        <p>El Worker está temporalmente saturado. Probá recargar en unos minutos.</p>
        <a class="channel-link" href="${AGENDA_URL}" target="_blank" rel="noreferrer">Abrir JSON</a>
      </article>
    `;
  } finally {
    agendaLoading = false;
  }
}

/* ============================================================
   CHAT
============================================================ */

function updatePostCount() {
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

  if (activeTab === "chat") {
    notification.textContent = "0";
    socialSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (activeTab === "live") {
    setUtilityOpen(true);
    loadEvents();
    liveSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (activeTab === "agenda") {
    loadAgenda(currentAgendaDate);
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab));
});

searchToggle.addEventListener("click", () => {
  setUtilityOpen(utilityPanel.classList.contains("hidden"));
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

matchSearch.addEventListener("input", () => {
  const query = matchSearch.value.trim().toLowerCase();
  const rows = leagueGrid.querySelectorAll(".agenda-row, .empty-state");
  let visible = 0;

  rows.forEach((row) => {
    const matches = !query || row.textContent.toLowerCase().includes(query);
    row.classList.toggle("dimmed", !matches);

    if (matches) {
      visible += 1;
    }
  });

  setUtilityStatus(query ? `${visible} coincidencia${visible === 1 ? "" : "s"}` : "");
});

dateButtons.forEach((button) => {
  button.addEventListener("click", () => {
    dateButtons.forEach((item) => item.classList.toggle("active", item === button));

    const offsets = {
      ayer: -1,
      hoy: 0,
      manana: 1,
    };

    currentAgendaDate = dateFromOffset(offsets[button.dataset.day] || 0);

    setUtilityStatus("");

    if (activeTab === "agenda") {
      loadAgenda(currentAgendaDate);
    }
  });
});

playToggle.addEventListener("click", () => {
  const isPlaying = videoCard.classList.toggle("playing");
  videoState.textContent = isPlaying ? "Transmitiendo" : "En pausa";
  playToggle.setAttribute(
    "aria-label",
    isPlaying ? "Pausar partido" : "Reproducir partido"
  );
});

volumeToggle.addEventListener("click", () => {
  muted = !muted;
  volumeToggle.classList.toggle("active", muted);
  volumeToggle.title = muted ? "Activar sonido" : "Silenciar";
  setUtilityOpen(true);
});

focusToggle.addEventListener("click", () => {
  videoCard.classList.toggle("focused");
  videoCard.scrollIntoView({ behavior: "smooth", block: "center" });
});

postForm.addEventListener("submit", (event) => {
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
  notification.textContent = Number(notification.textContent) + 1;

  updatePostCount();
});

postFeed.addEventListener("click", (event) => {
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

/* ============================================================
   INIT
============================================================ */

showSection("agenda");
setUtilityStatus("");
updatePostCount();
loadAgenda();
loadEvents();
