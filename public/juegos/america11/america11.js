const DATA_URL = "../../data/jugadores_america.json";
// ─────────────────────────────────────────────────────────────
// INTENTO DIARIO — una sola partida por día en todos los modos
// ─────────────────────────────────────────────────────────────
const DAILY_KEY = "america11_daily";

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getDailyState() {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (state.date !== getTodayStr()) {
      localStorage.removeItem(DAILY_KEY);
      return null;
    }
    return state;
  } catch { return null; }
}

function saveDailyState(reason, completed, total, mode) {
  const state = {
    date: getTodayStr(),
    reason,
    completed,
    total,
    mode,
    ts: Date.now()
  };
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(state)); } catch {}
}


function updateGlobalStats(won) {
  try {
    const raw = localStorage.getItem("ph_stats");
    const stats = raw ? JSON.parse(raw) : { wins: 0, losses: 0 };
    if (won) stats.wins = (stats.wins || 0) + 1;
    else      stats.losses = (stats.losses || 0) + 1;
    localStorage.setItem("ph_stats", JSON.stringify(stats));
  } catch {}
}
function getTimeUntilTomorrow() {
  const now = new Date();
  const tom = new Date(now);
  tom.setDate(tom.getDate() + 1);
  tom.setHours(0, 0, 0, 0);
  const diff = tom - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function showDailyBlocked(state) {
  // Bloquear botones de modo
  modeButtons.forEach(b => b.disabled = true);

  // Mostrar estado en la cancha
  pitchFrame.innerHTML = `
    <div class="daily-blocked">
      <div class="daily-blocked-icon">${state.reason === "win" ? "🏆" : "⏳"}</div>
      <p class="daily-blocked-title">${state.reason === "win" ? "¡Ya completaste el desafío de hoy!" : "Ya usaste tu intento de hoy"}</p>
      <p class="daily-blocked-sub">Completaste <strong>${state.completed}/${state.total}</strong> en modo <strong>${state.mode}</strong></p>
      <p class="daily-blocked-timer">Próximo desafío en <strong id="dailyCountdown">${getTimeUntilTomorrow()}</strong></p>
    </div>
  `;

  // Actualizar countdown cada minuto
  setInterval(() => {
    const el = document.getElementById("dailyCountdown");
    if (el) el.textContent = getTimeUntilTomorrow();
  }, 60000);

  // Bloquear input
  playerSearch.disabled = true;
  surrenderBtn.disabled = true;

  // Ocultar panel de challenge
  const challengePanel = document.querySelector(".country-panel");
  if (challengePanel) challengePanel.style.display = "none";
}


const ESCUDOS_URL = "../../data/escudos_america.json";

let ESCUDOS = {};

const GAME_MODES = {
  easy: {
    label: "Fácil",
    showHints: true,
    timeLimit: null,
    points: 100,
    help: "Clubes populares · Con pista de iniciales."
  },
  normal: {
    label: "Normal",
    showHints: false,
    timeLimit: null,
    points: 150,
    help: "Clubes populares · Sin ayudas."
  },
  hard: {
    label: "Difícil",
    showHints: false,
    timeLimit: 90,
    points: 200,
    help: "Más equipos · Sin ayudas · 90 seg."
  },
  expert: {
    label: "Experto",
    showHints: false,
    timeLimit: 60,
    points: 300,
    help: "Todos los clubes · Sin ayudas · 60 seg."
  }
};

const FORMATIONS = [
  {
    name: "4-3-3",
    rows: [
      ["LW", "ST", "RW"],
      ["CM", "CM", "CM"],
      ["LB", "CB", "CB", "RB"],
      ["GK"]
    ]
  },
  {
    name: "4-2-3-1",
    rows: [
      ["ST"],
      ["LW", "CAM", "RW"],
      ["CDM", "CDM"],
      ["LB", "CB", "CB", "RB"],
      ["GK"]
    ]
  },
  {
    name: "4-4-2",
    rows: [
      ["ST", "ST"],
      ["LM", "CM", "CM", "RM"],
      ["LB", "CB", "CB", "RB"],
      ["GK"]
    ]
  },
  {
    name: "3-5-2",
    rows: [
      ["ST", "ST"],
      ["LM", "CDM", "CM", "CM", "RM"],
      ["CB", "CB", "CB"],
      ["GK"]
    ]
  },
  {
    name: "4-1-4-1",
    rows: [
      ["ST"],
      ["LM", "CM", "CM", "RM"],
      ["CDM"],
      ["LB", "CB", "CB", "RB"],
      ["GK"]
    ]
  },
  {
    name: "3-4-3",
    rows: [
      ["LW", "ST", "RW"],
      ["LM", "CM", "CM", "RM"],
      ["CB", "CB", "CB"],
      ["GK"]
    ]
  },
  {
    name: "5-3-2",
    rows: [
      ["ST", "ST"],
      ["CM", "CM", "CM"],
      ["LB", "CB", "CB", "CB", "RB"],
      ["GK"]
    ]
  }
];

const POSITION_COMPATIBILITY = {
  GK:  ["GK"],
  CB:  ["CB"],
  LB:  ["LB", "CB"],
  RB:  ["RB", "CB"],
  CDM: ["CDM", "CM"],
  CM:  ["CM", "CDM", "CAM", "LM", "RM"],
  CAM: ["CAM", "CM"],
  LM:  ["LM", "LW", "CM"],
  RM:  ["RM", "RW", "CM"],
  LW:  ["LW", "LM", "ST"],
  RW:  ["RW", "RM", "ST"],
  ST:  ["ST", "LW", "RW"]
};

// Posiciones exactas — el jugador solo ocupa su posición natural
// excepto como último recurso cuando no hay slot exacto disponible
const POSITION_EXACT = {
  GK:  ["GK"],
  CB:  ["CB"],
  LB:  ["LB"],
  RB:  ["RB"],
  CDM: ["CDM"],
  CM:  ["CM"],
  CAM: ["CAM"],
  LM:  ["LM"],
  RM:  ["RM"],
  LW:  ["LW"],
  RW:  ["RW"],
  ST:  ["ST"],
  SS:  ["SS"],
};

function playerExactSlotExists(player) {
  // Hay algún slot libre del mismo club que acepta exactamente la posición del jugador
  return getEmptySlots().some(slot => {
    const slotData = getSlotData(slot);
    return (
      playerBelongsToSlotClub(player, slotData) &&
      normalizePosition(slotData.position) === normalizePosition(player.posicion)
    );
  });
}

const COUNTRY_FLAGS = {
  Argentina: "ar",
  Brasil: "br",
  México: "mx",
  Mexico: "mx",
  "Estados Unidos": "us",
  Uruguay: "uy",
  Chile: "cl",
  Colombia: "co",
  Ecuador: "ec",
  Perú: "pe",
  Peru: "pe",
  Paraguay: "py",
  Bolivia: "bo",
  Venezuela: "ve"
};

// ─────────────────────────────────────────────────────────────
// TIERS DE DIFICULTAD (por slug365)
// Tier 1 → Fácil/Normal  |  Tier 2 → Difícil  |  Tier 3 → Experto
// ─────────────────────────────────────────────────────────────
const CLUB_TIER = {
  // Tier 1 — Argentina (los 5 grandes + Estudiantes)
  "boca-juniors":1, "river-plate":1, "racing-club":1,
  "independiente":1, "san-lorenzo":1, "estudiantes-de-la-plata":1,
  // Tier 1 — Brasil
  "flamengo":1, "palmeiras":1, "corinthians":1, "fluminense":1,
  "atletico-mineiro":1, "botafogo":1, "internacional":1, "gremio":1,
  // Tier 1 — Uruguay
  "penarol":1, "nacional":1,
  // Tier 1 — Chile
  "colo-colo":1, "universidad-de-chile":1, "u-catolica":1,
  // Tier 1 — Colombia
  "atletico-nacional":1, "millonarios":1, "america-de-cali":1,
  // Tier 1 — México
  "club-america":1, "chivas":1, "tigres-uanl":1, "monterrey":1, "pumas-unam":1,
  // Tier 2 — Argentina
  "velez-sarsfield":2, "rosario-central":2, "newells-old-boys":2, "talleres-cordoba":2,
  "banfield":2, "lanus":2, "huracan":2, "argentinos-juniors":2, "atletico-tucuman":2,
  "belgrano":2, "defensa-y-justicia":2, "union-santa-fe":2, "gimnasia-la-plata":2,
  "platense":2, "tigre":2,
  // Tier 2 — Brasil
  "sao-paulo":2, "santos":2, "cruzeiro":2, "vasco-da-gama":2,
  "athletico-paranaense":2, "bahia":2, "rb-bragantino":2, "coritiba":2,
  // Tier 2 — Chile
  "o-higgins":2, "coquimbo-unido":2, "palestino":2, "huachipato":2,
  // Tier 2 — Colombia
  "deportivo-cali":2, "deportivo-pereira":2, "independiente-medellin":2,
  "independiente-santa-fe":2, "atletico-bucaramanga":2, "deportes-tolima":2,
  // Tier 2 — México
  "pachuca":2, "toluca":2, "leon":2, "santos-laguna":2, "atlas":2, "guadalajara":2,
  // Tier 2 — Uruguay
  "defensor-sporting":2, "liverpool-montevideo":2, "danubio-fc":2, "montevideo-city-torque":2,
  // Tier 2 — MLS
  "los-angeles-fc":2, "los-angeles-galaxy":2, "fc-dallas":2, "columbus-crew":2, "nashville-sc":2,
};

// Prioridad de país al elegir clubes (menor número = aparece antes)
const COUNTRY_PRIORITY = {
  "Argentina":   1,
  "Brasil":      2,
  "Chile":       3,
  "Uruguay":     4,
  "Colombia":    5,
  "Mexico":      6,
  "México":      6,
  "Estados Unidos": 7,
};

const pitchFrame = document.querySelector(".pitch-frame");
const timerBar  = document.getElementById("timerBar");
const timerText = document.getElementById("timerText");
const timerFill = document.getElementById("timerFill");
const modeButtons = document.querySelectorAll(".mode-btn");

const challengeIcon = document.getElementById("challengeIcon");
const challengeName = document.getElementById("challengeName");
const challengeDescription = document.getElementById("challengeDescription");

const playerForm = document.getElementById("playerForm");
const playerSearch = document.getElementById("playerSearch");
const suggestions = document.getElementById("suggestions");
const modeHint   = document.getElementById("modeHint");
const surrenderBtn = document.getElementById("surrenderBtn");
const helpBtn = document.getElementById("helpBtn");


const baseTotal = document.getElementById("baseTotal");
const baseUpdated = document.getElementById("baseUpdated");
const baseLeagues = document.getElementById("baseLeagues");

const resultModal = document.getElementById("resultModal");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const shareBtn = document.getElementById("shareBtn");
const backToGamesBtn = document.getElementById("backToGamesBtn");

let PLAYERS = [];
let CLUBS = [];
let CURRENT_GAME = null;

let currentMode = "easy";
let selectedSlot = null;
let completedSlots = [];
let usedPlayers = [];
let score = 0;
let timeLeft = null;
let timerInterval = null;
let gameFinished = false;
let challengeCounter = 0;
let surrendering = false;

async function loadGameData() {
  // Chequear intento diario antes de cargar
  const dailyState = getDailyState();
  if (dailyState) {
    // Ya jugó hoy — mostrar estado bloqueado después de cargar datos mínimos
    try {
      const [res, resEscudos] = await Promise.all([
        fetch(`${DATA_URL}?v=${Date.now()}`),
        fetch(`${ESCUDOS_URL}?v=${Date.now()}`)
      ]);
      if (res.ok) {
        const payload = await res.json();
        PLAYERS = Array.isArray(payload) ? payload : (payload.jugadores || []);
        PLAYERS = PLAYERS.map(normalizePlayer).filter(p => p.nombre && p.slug && p.club);
        if (resEscudos.ok) ESCUDOS = await resEscudos.json();
      }
    } catch {}
    showDailyBlocked(dailyState);
    return;
  }
  try {
    const [res, resEscudos] = await Promise.all([
      fetch(`${DATA_URL}?v=${Date.now()}`),
      fetch(`${ESCUDOS_URL}?v=${Date.now()}`)
    ]);

    if (!res.ok) {
      throw new Error("No se pudo cargar jugadores_america.json desde el Worker.");
    }

    if (resEscudos.ok) {
      ESCUDOS = await resEscudos.json();
    }

    const payload = await res.json();

    PLAYERS = Array.isArray(payload) ? payload : (payload.jugadores || []);

    PLAYERS = PLAYERS
      .map(normalizePlayer)
      .filter(player => player.nombre && player.slug && player.club);

    if (!PLAYERS.length) {
      throw new Error("La base de jugadores está vacía.");
    }

    CLUBS = buildClubs();

    if (!CLUBS.length) {
      throw new Error("No hay clubes suficientes para generar el juego.");
    }

    renderBaseInfo(payload);
    initGame();

  } catch (error) {
    console.error(error);

    pitchFrame.innerHTML = `
      <div class="load-error">
        <strong>No se pudo cargar el juego</strong>
        <span>${error.message}</span>
      </div>
    `;

  }
}

function normalizePlayer(raw) {
  const position = String(raw.posicion || raw.position || "CM").toUpperCase();

  return {
    ...raw,
    id: raw.id || "",
    nombre: raw.nombre || raw.name || "",
    slug: raw.slug || slugify(raw.nombre || raw.name || ""),
    posicion: position,
    categoria: raw.categoria || positionGroup(position),
    club: raw.club || "Club desconocido",
    club_id: String(raw.club_id || "").trim(),
    club_slug: raw.club_slug || slugify(raw.club || ""),
    club_logo: raw.club_logo || "",
    // El nuevo JSON usa "pais" en lugar de "pais_club"
    pais_club: raw.pais_club || raw.pais || "",
    liga: raw.liga || "",
    league_slug: raw.league_slug || "",
    posicion_raw: raw.posicion_raw || ""
  };
}

function buildClubs() {
  const clubMap = new Map();

  PLAYERS.forEach(player => {
    if (!player.club) return;

    const key = player.club_slug || slugify(player.club);

    if (!clubMap.has(key)) {
      clubMap.set(key, {
        key,
        clubId: player.club_id,
        clubSlug: player.club_slug,
        name: player.club,
        country: player.pais_club || player.pais || "América",
        league: player.liga || "",
        logo: player.club_logo || "",
        players: []
      });
    }

    clubMap.get(key).players.push(player);
  });

  return [...clubMap.values()]
    .filter(club => club.players.length >= 8)
    .map(club => ({
      ...club,
      positions: getClubPositionSummary(club.players)
    }));
}

function getClubTier(club) {
  return CLUB_TIER[club.key] || 3;
}

function getCountryPriority(country) {
  return COUNTRY_PRIORITY[country] || 99;
}

function getClubPoolForCurrentMode() {
  if (currentMode === "easy" || currentMode === "normal") {
    return CLUBS.filter(club => getClubTier(club) === 1);
  }
  if (currentMode === "hard") {
    return CLUBS.filter(club => getClubTier(club) <= 2);
  }
  return CLUBS;
}

function getClubPositionSummary(players) {
  return {
    arqueros: players.filter(player => player.categoria === "arqueros").length,
    defensores: players.filter(player => player.categoria === "defensores").length,
    mediocampistas: players.filter(player => player.categoria === "mediocampistas").length,
    delanteros: players.filter(player => player.categoria === "delanteros").length
  };
}

function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9ñ]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function positionGroup(position) {
  const pos = String(position || "").toUpperCase();
  if (pos === "GK") return "arqueros";
  if (["CB","LB","RB"].includes(pos)) return "defensores";
  if (["CM","CDM","CAM","LM","RM"].includes(pos)) return "mediocampistas";
  return "delanteros";
}

function getPositionGroupLabel(position) {
  const group = positionGroup(position);

  if (group === "arqueros") return "Arquero";
  if (group === "defensores") return "Defensor";
  if (group === "mediocampistas") return "Mediocampista";
  return "Delantero";
}

function initGame() {
  stopTimer();

  CURRENT_GAME = generateChallenge();

  resetGameState();
  renderFormation();
  applyModeUi();
  selectRandomEmptySlot();
  startTimerIfNeeded();
  updateStatus();
}

function generateChallenge() {
  challengeCounter += 1;

  let formation = null;
  let slotChallenges = [];
  let safety = 0;

  do {
    formation = pickRandom(FORMATIONS);
    slotChallenges = generateSlotChallenges(formation);
    safety++;
  } while (slotChallenges.length !== 11 && safety < 200);

  if (slotChallenges.length !== 11) {
    throw new Error("No se pudieron elegir 11 equipos válidos de América.");
  }

  return {
    challengeNumber: challengeCounter,
    formationName: formation.name,
    rows: formation.rows,
    positions: formation.rows.flat(),
    slots: slotChallenges
  };
}

function generateSlotChallenges(formation) {
  const positions = formation.rows.flat();
  const usedClubKeys = new Set();
  const countryCount = new Map();

  const result = [];

  positions.forEach((position, index) => {
    const club = pickClubForPosition(position, usedClubKeys, countryCount);

    if (!club) {
      return;
    }

    usedClubKeys.add(club.key);
    countryCount.set(club.country, (countryCount.get(club.country) || 0) + 1);

    result.push({
      index,
      position,
      clubKey: club.key,
      clubId: club.clubId,
      clubSlug: club.clubSlug,
      clubName: club.name,
      clubLogo: club.logo,
      country: club.country,
      league: club.league
    });
  });

  if (result.length !== positions.length) {
    return [];
  }

  return result;
}

function pickClubForPosition(position, usedClubKeys, countryCount) {
  let pool = getClubPoolForCurrentMode();

  let candidates = pool.filter(club => {
    if (usedClubKeys.has(club.key)) return false;

    return clubHasCompatiblePlayer(club, position);
  });

  if (!candidates.length && (currentMode === "easy" || currentMode === "normal")) {
    candidates = CLUBS.filter(club => {
      if (usedClubKeys.has(club.key)) return false;
      if (getClubTier(club) > 2) return false;
      return clubHasCompatiblePlayer(club, position);
    });
  }

  if (!candidates.length && currentMode === "hard") {
    candidates = CLUBS.filter(club => {
      if (usedClubKeys.has(club.key)) return false;
      return clubHasCompatiblePlayer(club, position);
    });
  }

  if (!candidates.length) {
    return null;
  }

  const sorted = shuffleArray(candidates).sort((a, b) => {
    // 1. Balancear países: el que menos veces salió va primero
    const countA = countryCount.get(a.country) || 0;
    const countB = countryCount.get(b.country) || 0;
    if (countA !== countB) return countA - countB;

    // 2. Prioridad de liga: Argentina > Brasil > Chile > Uruguay > ...
    const prioA = getCountryPriority(a.country);
    const prioB = getCountryPriority(b.country);
    if (prioA !== prioB) return prioA - prioB;

    // 3. Dentro del mismo país: tier más bajo primero (más popular)
    if (currentMode !== "expert") {
      const tierDiff = getClubTier(a) - getClubTier(b);
      if (tierDiff !== 0) return tierDiff;
    }

    // 4. Experto: prioriza clubes más oscuros (menos jugadores)
    if (currentMode === "expert") return a.players.length - b.players.length;

    return 0;
  });

  return sorted[0];
}

function clubHasCompatiblePlayer(club, position) {
  return club.players.some(player => {
    return playerCanPlaySlot(player.posicion, position);
  });
}

// Zona vertical fija por rol (% desde arriba dentro del pitch-frame)
const ZONE_TOP = {
  "line-attack":       "10%",
  "line-mid-advanced": "24%",
  "line-mid":          "40%",
  "line-cdm":          "54%",
  "line-defense":      "67%",
  "line-gk":           "84%",
};

function getLineRole(row) {
  if (row.includes("GK"))                                        return "line-gk";
  if (row.some(p => ["CB","LB","RB"].includes(p)))               return "line-defense";
  if (row.every(p => ["CDM"].includes(p)))                       return "line-cdm";
  if (row.some(p => ["CDM","CM","LM","RM"].includes(p)))         return "line-mid";
  if (row.some(p => ["CAM"].includes(p)))                        return "line-mid-advanced";
  return "line-attack";
}

function renderFormation() {
  pitchFrame.innerHTML = "";

  let slotIndex = 0;

  CURRENT_GAME.rows.forEach((row, rowIndex) => {
    const role = getLineRole(row);
    const top  = ZONE_TOP[role] || (10 + rowIndex * 16) + "%";

    const line = document.createElement("div");
    line.className = [
      "line",
      `line-count-${row.length}`,
      role
    ].join(" ");

    // Posición absoluta fija según zona
    line.style.cssText = `
      position: absolute;
      left: 0; right: 0;
      top: ${top};
      transform: translateY(-50%);
    `;

    row.forEach(position => {
      const slotData = CURRENT_GAME.slots[slotIndex];

      const button = document.createElement("button");
      button.className = "position-slot mystery-slot";
      button.type = "button";
      button.disabled = true;

      button.dataset.position = position;
      button.dataset.index = slotIndex;
      button.dataset.clubKey = slotData.clubKey;
      button.dataset.clubName = slotData.clubName;
      button.dataset.country = slotData.country;

      button.innerHTML = `<span class="slot-position">${position}</span>`;

      line.appendChild(button);
      slotIndex++;
    });

    pitchFrame.appendChild(line);
  });
}

const POSITION_LABEL = {
  GK:  "Portero",
  CB:  "Defensa Central",
  LB:  "Defensa Lateral Izquierdo",
  RB:  "Defensa Lateral Derecho",
  CDM: "Centrocampista Defensivo",
  CM:  "Mediocampista Central",
  CAM: "Mediocampista Ofensivo",
  LM:  "Mediocampista Izquierdo",
  RM:  "Mediocampista Derecho",
  LW:  "Delantero Izquierdo",
  RW:  "Delantero Derecho",
  ST:  "Centro Delantero",
  SS:  "Segundo Delantero",
};

function renderChallengePanel() {
  if (!selectedSlot) {
    challengeIcon.src = "https://flagcdn.com/w40/un.png";
    challengeIcon.alt = "América";
    challengeName.textContent = "Preparando equipo...";
    challengeDescription.textContent =
      "El juego va a mostrar automáticamente el próximo club que te toca.";
    return;
  }

  const slotData = getSlotData(selectedSlot);
  const logo = getClubLogo(slotData);

  const positionLabel = POSITION_LABEL[normalizePosition(slotData.position)] || getPositionGroupLabel(slotData.position);

  challengeIcon.src = logo;
  challengeIcon.alt = `Escudo de ${slotData.clubName}`;

  challengeName.textContent = slotData.clubName;
  challengeDescription.textContent = `${slotData.position} · ${positionLabel}`;
}

function getClubLogo(slotData) {
  const slug = slotData.clubSlug || slotData.clubKey || "";
  if (slug && ESCUDOS[slug]) return ESCUDOS[slug];
  return slotData.clubLogo || getCountryFlagUrl(slotData.country);
}

function getCountryFlagUrl(country) {
  return `https://flagcdn.com/w40/${COUNTRY_FLAGS[country] || "un"}.png`;
}

function resetGameState() {
  selectedSlot = null;
  completedSlots = [];
  usedPlayers = [];
  score = 0;
  timeLeft = null;
  gameFinished = false;
  surrendering = false;

  resultModal.classList.add("hidden");
  hideFinalButtons();

  playerSearch.disabled = false;
  surrenderBtn.disabled = false;
  playerSearch.value = "";
  suggestions.innerHTML = "";
  suggestions.classList.remove("hidden");
}

function getSlots() {
  return document.querySelectorAll(".position-slot");
}

function getEmptySlots() {
  return Array.from(getSlots()).filter(slot => {
    return !slot.classList.contains("filled");
  });
}

function selectRandomEmptySlot() {
  if (gameFinished) return;

  const emptySlots = getEmptySlots();

  if (!emptySlots.length) {
    selectedSlot = null;
    renderChallengePanel();
    updateSearchPlaceholder();
    return;
  }

  getSlots().forEach(item => item.classList.remove("selected"));

  selectedSlot = pickRandom(emptySlots);
  selectedSlot.classList.add("selected");

  renderChallengePanel();
  updateSearchPlaceholder();
  renderSuggestions(playerSearch.value);
}

function getSlotData(slotOrIndex) {
  const index = typeof slotOrIndex === "number"
    ? slotOrIndex
    : Number(slotOrIndex.dataset.index);

  return CURRENT_GAME.slots[index];
}

function clearSelectedSlot() {
  selectedSlot = null;

  getSlots().forEach(item => item.classList.remove("selected"));

  suggestions.innerHTML = "";
  renderChallengePanel();
  updateSearchPlaceholder();
}

function updateSearchPlaceholder() {
  if (!selectedSlot) {
    playerSearch.placeholder = "El juego está preparando el próximo equipo...";
    return;
  }

  const slotData = getSlotData(selectedSlot);

  playerSearch.placeholder = `Jugador de ${slotData.clubName} para ${slotData.position}...`;
}

function normalizePosition(position) {
  return String(position || "").toUpperCase().trim();
}

function playerCanPlaySlot(playerPosition, slotPosition) {
  const playerPos = normalizePosition(playerPosition);
  const slotPos = normalizePosition(slotPosition);

  const compatibles = POSITION_COMPATIBILITY[slotPos] || [slotPos];

  return compatibles.includes(playerPos);
}

function findBestFreeSlotForPlayer(player) {
  const freeSlots = getEmptySlots();

  const compatibleSlots = freeSlots.filter(slot => {
    const slotData = getSlotData(slot);
    return (
      playerBelongsToSlotClub(player, slotData) &&
      playerCanPlaySlot(player.posicion, slotData.position)
    );
  });

  if (!compatibleSlots.length) return null;

  // Priorizar slot exacto (misma posición que el jugador)
  const exactSlot = compatibleSlots.find(slot => {
    const slotData = getSlotData(slot);
    return normalizePosition(slotData.position) === normalizePosition(player.posicion);
  });

  if (exactSlot) return exactSlot;

  // Si hay un único compatible, usarlo
  if (compatibleSlots.length === 1) return compatibleSlots[0];

  return null;
}

function playerBelongsToSlotClub(player, slotData) {
  if (slotData.clubId) {
    return String(player.club_id || "").trim() === String(slotData.clubId).trim();
  }

  return player.club === slotData.clubName;
}

function playerMatchesSearch(player, value) {
  const fullName = normalizeText(player.nombre);
  const lastName = normalizeText(player.nombre.split(" ").pop());
  const position = normalizeText(player.posicion);
  const club = normalizeText(player.club);

  return (
    fullName.includes(value) ||
    lastName.includes(value) ||
    position.includes(value) ||
    club.includes(value)
  );
}

function playerIsExactMatch(player, value) {
  const fullName = normalizeText(player.nombre);
  const lastName = normalizeText(player.nombre.split(" ").pop());

  return fullName === value || lastName === value;
}

function playerAlreadyUsed(player) {
  return usedPlayers.includes(player.slug);
}

function getPlayersForSlot(slot) {
  const slotData = getSlotData(slot);

  return PLAYERS.filter(player => {
    return (
      playerBelongsToSlotClub(player, slotData) &&
      playerCanPlaySlot(player.posicion, slotData.position) &&
      !playerAlreadyUsed(player)
    );
  });
}

function buildHint(nombre) {
  return nombre
    .split(" ")
    .filter(w => w.length > 0)
    .map(w => w[0] + "*".repeat(w.length - 1))
    .join(" ");
}

function renderSuggestions() {
  const mode = GAME_MODES[currentMode];

  suggestions.innerHTML = "";

  if (!mode.showHints || gameFinished) {
    suggestions.classList.add("hidden");
    return;
  }

  if (!selectedSlot) {
    suggestions.classList.add("hidden");
    return;
  }

  const candidates = getPlayersForSlot(selectedSlot);
  if (!candidates.length) {
    suggestions.classList.add("hidden");
    return;
  }

  const hint = buildHint(candidates[0].nombre);

  suggestions.classList.remove("hidden");
  suggestions.innerHTML = `
    <div class="suggestion-item hint-item-readonly">
      <strong class="hint-text">${hint}</strong>
      <span class="hint-badge">💡</span>
    </div>
  `;
}

function placePlayer(player, forcedSlot = null) {
  if (gameFinished) return;

  const targetSlot = forcedSlot || selectedSlot;

  if (!targetSlot) {
    showTemporaryPlaceholder("No hay posición activa para ese jugador");
    return;
  }

  const slotData = getSlotData(targetSlot);

  if (!playerBelongsToSlotClub(player, slotData)) {
    showTemporaryPlaceholder(`${player.nombre} no juega en ${slotData.clubName}`);
    return;
  }

  if (!playerCanPlaySlot(player.posicion, slotData.position)) {
    showTemporaryPlaceholder(`${player.nombre} no puede jugar de ${slotData.position}`);
    return;
  }

  // Si el slot no es exacto para este jugador pero existe uno exacto libre, redirigir
  const slotIsExact = normalizePosition(slotData.position) === normalizePosition(player.posicion);
  if (!slotIsExact && playerExactSlotExists(player)) {
    const bestSlot = findBestFreeSlotForPlayer(player);
    if (bestSlot && bestSlot !== targetSlot) {
      placePlayer(player, bestSlot);
      return;
    }
  }

  if (playerAlreadyUsed(player)) {
    showTemporaryPlaceholder("Ese jugador ya fue usado");
    return;
  }

  const logo = getClubLogo(slotData);

  targetSlot.classList.add("filled");
  targetSlot.classList.remove("selected");

  const posLabel = player.posicion_raw || getPositionGroupLabel(player.posicion);
  targetSlot.innerHTML = `
    <span class="slot-logo-wrap">
      <img class="slot-logo" src="${logo}" alt="${escapeHtml(slotData.clubName)}" loading="lazy" />
    </span>
    <span class="slot-player-name">${escapeHtml(player.nombre)}</span>
    <span class="slot-club-name">${escapeHtml(slotData.clubName)}</span>
    <span class="slot-pos-label">${escapeHtml(posLabel)}</span>
  `;

  completedSlots.push(Number(targetSlot.dataset.index));
  usedPlayers.push(player.slug);

  score += GAME_MODES[currentMode].points;

  selectedSlot = null;
  playerSearch.value = "";
  suggestions.innerHTML = "";

  updateStatus();

  if (completedSlots.length === CURRENT_GAME.positions.length) {
    finishGame("complete");
    return;
  }

  if (!surrendering) {
    selectRandomEmptySlot();
  }
}

function trySubmitSearch() {
  if (gameFinished) return;

  if (!selectedSlot) {
    selectRandomEmptySlot();
  }

  const value = normalizeText(playerSearch.value);

  if (!value) {
    renderSuggestions("");
    return;
  }

  // Buscar primero en el slot seleccionado
  let matches = getPlayersForSlot(selectedSlot).filter(player => {
    return playerMatchesSearch(player, value);
  });

  // Si no hay match en el slot actual, buscar en todos los slots libres
  if (!matches.length) {
    const allMatches = PLAYERS.filter(p => !playerAlreadyUsed(p) && playerMatchesSearch(p, value));
    if (allMatches.length) {
      // Intentar colocar en el slot correcto via findBestFreeSlotForPlayer
      const exactNameMatch = allMatches.find(p => playerIsExactMatch(p, value)) || (allMatches.length === 1 ? allMatches[0] : null);
      if (exactNameMatch) {
        const bestSlot = findBestFreeSlotForPlayer(exactNameMatch);
        if (bestSlot) {
          placePlayer(exactNameMatch, bestSlot);
          return;
        }
        showTemporaryPlaceholder(`${exactNameMatch.nombre} no tiene un casillero disponible`);
        return;
      }
    }
    if (GAME_MODES[currentMode].showHints) {
      renderSuggestions(playerSearch.value);
    } else {
      showTemporaryPlaceholder("No encontré un jugador compatible");
    }
    return;
  }

  const exactMatch = matches.find(player => {
    return playerIsExactMatch(player, value);
  });

  if (exactMatch) {
    placePlayer(exactMatch, selectedSlot);
    return;
  }

  if (matches.length === 1) {
    placePlayer(matches[0], selectedSlot);
    return;
  }

  if (GAME_MODES[currentMode].showHints) {
    renderSuggestions(playerSearch.value);
  } else {
    showTemporaryPlaceholder("Hay más de una coincidencia. Escribí mejor el nombre.");
  }
}

function showTemporaryPlaceholder(message) {
  const original = playerSearch.placeholder;

  playerSearch.value = "";
  playerSearch.placeholder = message;

  setTimeout(() => {
    if (!gameFinished) {
      updateSearchPlaceholder();
    } else {
      playerSearch.placeholder = original;
    }
  }, 1400);
}

function applyModeUi() {
  const mode = GAME_MODES[currentMode];

  if (modeHint) {
    modeHint.textContent = `${mode.help} Formación: ${CURRENT_GAME.formationName}`;
  }

  if (mode.showHints) {
    suggestions.classList.remove("hidden");
  } else {
    suggestions.classList.add("hidden");
    suggestions.innerHTML = "";
  }

  if (mode.timeLimit === null) {
    timeLeft = null;
    timerBar.classList.add("hidden");
    timerBar.classList.remove("urgent");
  } else {
    timeLeft = mode.timeLimit;
    timerText.textContent = formatTime(timeLeft);
    timerFill.style.width = "100%";
    timerBar.classList.remove("hidden", "urgent");
  }

  modeButtons.forEach(button => {
    button.disabled = false;
    button.classList.toggle("active", button.dataset.mode === currentMode);
  });
}

function startTimerIfNeeded() {
  const mode = GAME_MODES[currentMode];

  if (mode.timeLimit === null) return;

  timerInterval = setInterval(() => {
    if (gameFinished) {
      stopTimer();
      return;
    }

    timeLeft--;

    if (timeLeft <= 0) {
      timeLeft = 0;
      timerText.textContent = formatTime(timeLeft);
      timerFill.style.width = "0%";
      finishGame("time");
      return;
    }

    const pct = (timeLeft / mode.timeLimit) * 100;
    timerFill.style.width = pct + "%";
    timerText.textContent = formatTime(timeLeft);
    timerBar.classList.toggle("urgent", timeLeft <= 15);

  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateStatus() {
}

function finishGame(reason) {
  if (gameFinished) return;

  gameFinished = true;
  stopTimer();

  resultModal.classList.remove("hidden");
  showFinalButtons();

  modeButtons.forEach(button => {
    button.disabled = false;
  });

  getSlots().forEach(slot => {
    slot.disabled = true;
    slot.classList.remove("selected");
  });

  playerSearch.disabled = true;
  surrenderBtn.disabled = true;

  const resultEyebrow = document.getElementById("resultEyebrow");
  const resultChips = document.getElementById("resultChips");

  const modeLabel = GAME_MODES[currentMode].label;
  const completed = completedSlots.length;
  const total = CURRENT_GAME.positions.length;

  if (resultChips) {
    resultChips.innerHTML = `
      <span class="result-chip">Dificultad ${modeLabel}</span>
      <span class="result-chip">${CURRENT_GAME.formationName}</span>
      <span class="result-chip">${completed}/${total} completados</span>
      <span class="result-chip">${score} puntos</span>
    `;
  }

  // Guardar intento diario
  const won = reason === "win" || completedSlots.length === CURRENT_GAME.positions.length;
  saveDailyState(
    won ? "win" : reason,
    completedSlots.length,
    CURRENT_GAME.positions.length,
    GAME_MODES[currentMode].label
  );
  updateGlobalStats(won);

  if (reason === "surrender") {
    if (resultEyebrow) resultEyebrow.textContent = "PARTIDA TERMINADA";

    resultTitle.textContent = "Te rendiste";

    resultText.innerHTML =
      `Completaste <strong>${completed}</strong> de <strong>${total}</strong> casilleros. ` +
      `Puntaje final: <strong>${score}</strong>.`;

    return;
  }

  if (reason === "time") {
    if (resultEyebrow) resultEyebrow.textContent = "TIEMPO TERMINADO";

    resultTitle.textContent = "Se acabó el tiempo";

    resultText.innerHTML =
      `Completaste <strong>${completed}</strong> de <strong>${total}</strong> casilleros. ` +
      `Puntaje final: <strong>${score}</strong>.`;

    return;
  }

  if (resultEyebrow) resultEyebrow.textContent = "JUEGO COMPLETADO";

  resultTitle.textContent = "¡Felicitaciones!";

  resultText.innerHTML =
    `Lograste completar tu 11 de América. ` +
    `Puntaje final: <strong>${score}</strong>.`;
}
function surrenderGame() {
  if (gameFinished) return;

  surrendering = true;

  getSlots().forEach(slot => {
    if (slot.classList.contains("filled")) {
      return;
    }

    const candidates = getPlayersForSlot(slot);
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];

    if (candidate) {
      placePlayer(candidate, slot);
    }
  });

  surrendering = false;
  finishGame("surrender");
}

function getResultActions() {
  return resultModal.querySelector(".result-actions");
}

function showFinalButtons() {
  if (shareBtn) {
    shareBtn.classList.remove("hidden");
    shareBtn.style.display = "inline-flex";
    shareBtn.textContent = "Compartir";
  }

  if (backToGamesBtn) {
    backToGamesBtn.classList.remove("hidden");
    backToGamesBtn.style.display = "inline-flex";
    backToGamesBtn.textContent = "Volver a juegos";
    backToGamesBtn.href = "../../index.html#games";
  }

}

function hideFinalButtons() {
  if (shareBtn) {
    shareBtn.classList.remove("hidden");
    shareBtn.style.display = "inline-flex";
  }

  if (backToGamesBtn) {
    backToGamesBtn.classList.add("hidden");
    backToGamesBtn.style.display = "none";
  }
}

function showModeChangeModal(nextMode) {
  const modal = document.getElementById("modeChangeModal");

  if (!modal) return;

  const confirmBtn = document.getElementById("confirmModeChangeBtn");
  const cancelBtn = document.getElementById("cancelModeChangeBtn");

  modal.classList.remove("hidden");

  confirmBtn.onclick = () => {
    modal.classList.add("hidden");
    if (!getDailyState()) {
      currentMode = nextMode;
      initGame();
    }
  };

  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
  };
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  return `${min}:${String(sec).padStart(2, "0")}`;
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    const date = new Date(value);

    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (error) {
    return value;
  }
}

function renderBaseInfo(payload) {
  if (!baseTotal || !baseUpdated || !baseLeagues) {
    return;
  }

  const total = Array.isArray(payload)
    ? PLAYERS.length
    : payload.total || PLAYERS.length;

  // El nuevo JSON usa "fecha_generacion" en lugar de "actualizado"
  const updated = Array.isArray(payload)
    ? "-"
    : formatDateTime(payload.fecha_generacion || payload.actualizado);

  // El nuevo JSON no tiene "ligas"; derivamos países únicos desde PLAYERS
  const paises = Array.isArray(payload)
    ? []
    : [...new Set(PLAYERS.map(p => p.pais_club).filter(Boolean))].sort();

  const equipos = Array.isArray(payload)
    ? ""
    : (payload.equipos_procesados ? ` · ${payload.equipos_procesados} equipos` : "");

  baseTotal.textContent = `${total} jugadores${equipos}`;
  baseUpdated.textContent = updated;
  baseLeagues.textContent = paises.length ? paises.join(", ") : "-";
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffleArray(list) {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

modeButtons.forEach(button => {
  button.addEventListener("click", () => {
    const nextMode = button.dataset.mode;

    if (nextMode === currentMode) return;

    if (gameFinished) {
      currentMode = nextMode;
      initGame();
      return;
    }

    const hasProgress = completedSlots.length > 0;

    if (hasProgress) {
      showModeChangeModal(nextMode);
      return;
    }

    currentMode = nextMode;
    initGame();
  });
});

playerSearch.addEventListener("input", () => {
  renderSuggestions(playerSearch.value);
});

playerForm.addEventListener("submit", event => {
  event.preventDefault();
  trySubmitSearch();
});

surrenderBtn.addEventListener("click", surrenderGame);

shareBtn.addEventListener("click", async () => {
  const text = `Armé mi 11 América en Partidos.Hoy ⚽
Desafío: equipos de América
Modo: ${GAME_MODES[currentMode].label}
Formación: ${CURRENT_GAME.formationName}
Puntaje: ${score}`;

  if (navigator.share) {
    await navigator.share({
      title: "Armá 11 América",
      text
    });
  } else {
    await navigator.clipboard.writeText(text);
    alert("Resultado copiado al portapapeles");
  }
});

if (helpBtn) {
  helpBtn.addEventListener("click", () => {
    alert(
      "El juego muestra automáticamente una posición y un equipo de América. " +
      "Escribí un jugador actual de ese club y compatible con la posición marcada. " +
      "Al acertar, se desbloquea otra posición aleatoria. En Fácil aparecen sugerencias."
    );
  });
}

loadGameData();
