const DATA_URL = "https://partidoshoy-worker-jugadores-america.gastonledesma328.workers.dev/data/jugadores_america.json";

const GAME_MODES = {
  easy: {
    label: "Fácil",
    showHints: true,
    timeLimit: null,
    points: 100,
    help: "Modo fácil: salen clubes populares de América y vas a ver sugerencias."
  },
  normal: {
    label: "Normal",
    showHints: false,
    timeLimit: null,
    points: 150,
    help: "Modo normal: salen clubes populares, pero sin ayudas."
  },
  hard: {
    label: "Difícil",
    showHints: false,
    timeLimit: 90,
    points: 200,
    help: "Modo difícil: pueden salir clubes populares y clubes menos conocidos."
  },
  expert: {
    label: "Experto",
    showHints: false,
    timeLimit: 45,
    points: 300,
    help: "Modo experto: puede salir cualquier club de América."
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
    name: "4-4-2",
    rows: [
      ["ST", "ST"],
      ["LM", "CM", "CM", "RM"],
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
    name: "3-5-2",
    rows: [
      ["ST", "ST"],
      ["CAM"],
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
  },
  {
    name: "4-3-1-2",
    rows: [
      ["ST", "ST"],
      ["CAM"],
      ["CM", "CM", "CM"],
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
  }
];

const POSITION_COMPATIBILITY = {
  GK: ["GK"],

  RB: ["RB", "RWB"],
  CB: ["CB"],
  LB: ["LB", "LWB"],

  LWB: ["LWB", "LB", "LM"],
  RWB: ["RWB", "RB", "RM"],

  CDM: ["CDM", "CM"],
  CM: ["CM", "CDM", "CAM", "LM", "RM"],
  CAM: ["CAM", "CM"],

  LW: ["LW", "LM", "ST"],
  LM: ["LM", "LW", "CM"],

  RW: ["RW", "RM", "ST"],
  RM: ["RM", "RW", "CM"],

  ST: ["ST", "LW", "RW"]
};

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

const POPULAR_CLUB_NAMES = [
  // Argentina
  "Boca Juniors",
  "River Plate",
  "Racing Club",
  "Independiente",
  "San Lorenzo",
  "Estudiantes de La Plata",
  "Vélez Sarsfield",
  "Rosario Central",
  "Newell's Old Boys",

  // Brasil
  "Flamengo",
  "Fluminense",
  "Palmeiras",
  "Corinthians",
  "São Paulo",
  "Sao Paulo",
  "Santos",
  "Grêmio",
  "Gremio",
  "Internacional",
  "Atlético Mineiro",
  "Atletico Mineiro",
  "Cruzeiro",
  "Botafogo",
  "Vasco da Gama",

  // Uruguay
  "Peñarol",
  "Penarol",
  "Nacional",

  // Chile
  "Colo Colo",
  "Universidad de Chile",
  "Universidad Católica",
  "Universidad Catolica",

  // Colombia
  "Atlético Nacional",
  "Atletico Nacional",
  "Millonarios",
  "América de Cali",
  "America de Cali",
  "Deportivo Cali",
  "Junior",

  // México
  "América",
  "Club América",
  "Guadalajara",
  "Chivas",
  "Cruz Azul",
  "Pumas UNAM",
  "Tigres UANL",
  "Monterrey",
  "Pachuca",
  "Toluca",

  // MLS / Estados Unidos
  "Inter Miami CF",
  "Inter Miami",
  "LA Galaxy",
  "Los Angeles FC",
  "Seattle Sounders FC",
  "Atlanta United FC",
  "New York City FC",
  "New York Red Bulls"
];

const EXCLUDED_EASY_NORMAL_CLUB_NAMES = [
  "New York City FC",
  "NYCFC",

  "Guadalajara",
  "LA Galaxy",
  "Deportivo Cali",
  "Cruzeiro",

  "Vasco da Gama",

  "Santos Laguna",
  "Santos",

  "Atlanta United FC",
  "Atlanta United",

  "São Paulo",
  "Sao Paulo",

  "Seattle Sounders FC",
  "Seattle Sounders",

  "Pumas UNAM",
  "Pumas",

  "Toluca",

  "Millonarios",

  "Cruz Azul",

  "Grêmio",
  "Gremio",

  "América de Cali",
  "America de Cali"
];

const MEDIUM_CLUB_COUNTRIES = [
  "Argentina",
  "Brasil",
  "México",
  "Mexico",
  "Estados Unidos",
  "Uruguay",
  "Chile",
  "Colombia"
];

const pitchFrame = document.querySelector(".pitch-frame");
const modeButtons = document.querySelectorAll(".mode-btn");

const challengeIcon = document.getElementById("challengeIcon");
const challengeName = document.getElementById("challengeName");
const challengeDescription = document.getElementById("challengeDescription");

const playerForm = document.getElementById("playerForm");
const playerSearch = document.getElementById("playerSearch");
const suggestions = document.getElementById("suggestions");
const surrenderBtn = document.getElementById("surrenderBtn");
const helpBtn = document.getElementById("helpBtn");

const completedText = document.getElementById("completedText");
const scoreText = document.getElementById("scoreText");
const modeText = document.getElementById("modeText");
const timerText = document.getElementById("timerText");
const modeHint = document.getElementById("modeHint");

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
  try {
    const res = await fetch(`${DATA_URL}?v=${Date.now()}`);

    if (!res.ok) {
      throw new Error("No se pudo cargar jugadores_america.json desde el Worker.");
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

    modeHint.textContent = error.message;
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
    club_logo: raw.club_logo || "",
    pais_club: raw.pais_club || "",
    liga: raw.liga || "",
    league_slug: raw.league_slug || ""
  };
}

function buildClubs() {
  const clubMap = new Map();

  PLAYERS.forEach(player => {
    if (!player.club) return;

    const key = player.club_id || slugify(player.club);

    if (!clubMap.has(key)) {
      clubMap.set(key, {
        key,
        clubId: player.club_id,
        name: player.club,
        country: player.pais_club || "América",
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

function isPopularClub(club) {
  const clubName = normalizeText(club.name);

  const isExcluded = EXCLUDED_EASY_NORMAL_CLUB_NAMES.some(name => {
    return clubName === normalizeText(name);
  });

  if (isExcluded) {
    return false;
  }

  if (
    clubName === normalizeText("Santos") &&
    (club.country === "México" || club.country === "Mexico")
  ) {
    return false;
  }

  return POPULAR_CLUB_NAMES.some(name => {
    return clubName === normalizeText(name);
  });
}

function isMediumClub(club) {
  if (isPopularClub(club)) {
    return true;
  }

  if (!MEDIUM_CLUB_COUNTRIES.includes(club.country)) {
    return false;
  }

  return club.players.length >= 16;
}

function getClubPoolForCurrentMode() {
  if (currentMode === "easy" || currentMode === "normal") {
    return CLUBS.filter(club => isPopularClub(club));
  }

  if (currentMode === "hard") {
    return CLUBS.filter(club => isMediumClub(club));
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

  if (["CB", "LB", "RB", "LWB", "RWB"].includes(pos)) {
    return "defensores";
  }

  if (["CM", "CDM", "CAM", "LM", "RM"].includes(pos)) {
    return "mediocampistas";
  }

  return "delanteros";
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
      if (!isMediumClub(club)) return false;

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
    const countA = countryCount.get(a.country) || 0;
    const countB = countryCount.get(b.country) || 0;

    if (countA !== countB) {
      return countA - countB;
    }

    if (currentMode === "easy" || currentMode === "normal") {
      return Number(isPopularClub(b)) - Number(isPopularClub(a));
    }

    if (currentMode === "expert") {
      return a.players.length - b.players.length;
    }

    return b.players.length - a.players.length;
  });

  return sorted[0];
}

function clubHasCompatiblePlayer(club, position) {
  return club.players.some(player => {
    return playerCanPlaySlot(player.posicion, position);
  });
}

function renderFormation() {
  pitchFrame.innerHTML = "";

  let slotIndex = 0;
  const totalRows = CURRENT_GAME.rows.length;

  CURRENT_GAME.rows.forEach((row, rowIndex) => {
    const line = document.createElement("div");
    const lineRole = getLineRole(row, rowIndex, totalRows);

    line.className = [
      "line",
      "dynamic-line",
      `line-${rowIndex}`,
      `line-count-${row.length}`,
      lineRole
    ].join(" ");

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

      button.innerHTML = `
        <span class="slot-position">${position}</span>
      `;

      line.appendChild(button);
      slotIndex++;
    });

    pitchFrame.appendChild(line);
  });
}

function getLineRole(row, rowIndex, totalRows) {
  if (rowIndex === totalRows - 1 || row.includes("GK")) {
    return "line-gk";
  }

  if (row.some(position => ["CB", "LB", "RB", "LWB", "RWB"].includes(position))) {
    return "line-defense";
  }

  if (row.some(position => ["CDM", "CM", "LM", "RM"].includes(position))) {
    return "line-mid";
  }

  if (row.some(position => ["CAM"].includes(position))) {
    return "line-mid-advanced";
  }

  if (row.some(position => ["LW", "RW", "ST"].includes(position))) {
    return "line-attack";
  }

  return `line-${rowIndex}`;
}

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

  challengeIcon.src = logo;
  challengeIcon.alt = `Escudo de ${slotData.clubName}`;

  challengeName.textContent = slotData.clubName;
  challengeDescription.textContent =
    `${slotData.country || "América"} · ${slotData.league || "Liga"} · Buscá un jugador actual para ${slotData.position}.`;
}

function getClubLogo(slotData) {
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

  playerSearch.placeholder = `Jugador actual de ${slotData.clubName} para ${slotData.position}...`;
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

  if (compatibleSlots.length === 1) {
    return compatibleSlots[0];
  }

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

function renderSuggestions(query) {
  const mode = GAME_MODES[currentMode];

  if (!mode.showHints || gameFinished) {
    suggestions.innerHTML = "";
    suggestions.classList.add("hidden");
    return;
  }

  suggestions.innerHTML = "";
  suggestions.classList.remove("hidden");

  if (!selectedSlot) {
    selectRandomEmptySlot();
    return;
  }

  const value = normalizeText(query);

  const filtered = getPlayersForSlot(selectedSlot).filter(player => {
    if (!value) return true;

    return playerMatchesSearch(player, value);
  });

  if (!filtered.length) {
    const slotData = getSlotData(selectedSlot);

    suggestions.innerHTML = `
      <button class="suggestion-item" type="button">
        <div>
          <strong>No encontré ese jugador</strong>
          <span>Debe ser de ${slotData.clubName} y servir para ${slotData.position}.</span>
        </div>
        <span>-</span>
      </button>
    `;
    return;
  }

  filtered.slice(0, 6).forEach(player => {
    const button = document.createElement("button");
    button.className = "suggestion-item";
    button.type = "button";

    button.innerHTML = `
      <div>
        <strong>${player.nombre}</strong>
        <span>${player.club} · ${player.posicion} · ${player.pais_club}</span>
      </div>
      <span>Elegir</span>
    `;

    button.onclick = () => {
      placePlayer(player, selectedSlot);
    };

    suggestions.appendChild(button);
  });
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

  if (playerAlreadyUsed(player)) {
    showTemporaryPlaceholder("Ese jugador ya fue usado");
    return;
  }

  const logo = getClubLogo(slotData);

  targetSlot.classList.add("filled");
  targetSlot.classList.remove("selected");

  targetSlot.innerHTML = `
  <span class="slot-logo-wrap">
    <img class="slot-logo" src="${logo}" alt="${escapeHtml(slotData.clubName)}" loading="lazy" />
  </span>
  <span class="slot-player-name">${player.nombre}</span>
  <span class="slot-club-name">${slotData.clubName}</span>
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

  const matches = getPlayersForSlot(selectedSlot).filter(player => {
    return playerMatchesSearch(player, value);
  });

  if (!matches.length) {
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

  modeText.textContent = mode.label;

  modeHint.textContent =
    `${mode.help} Desafío #${CURRENT_GAME.challengeNumber} · Formación: ${CURRENT_GAME.formationName}`;

  if (mode.showHints) {
    suggestions.classList.remove("hidden");
  } else {
    suggestions.classList.add("hidden");
    suggestions.innerHTML = "";
  }

  if (mode.timeLimit === null) {
    timeLeft = null;
    timerText.textContent = "Sin límite";
  } else {
    timeLeft = mode.timeLimit;
    timerText.textContent = formatTime(timeLeft);
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
      finishGame("time");
      return;
    }

    timerText.textContent = formatTime(timeLeft);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateStatus() {
  completedText.textContent = `${completedSlots.length}/${CURRENT_GAME.positions.length}`;
  scoreText.textContent = score;
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

  if (reason === "surrender") {
    resultTitle.textContent = "Te rendiste";
    resultText.textContent =
      `Completaste ${completedSlots.length} de ${CURRENT_GAME.positions.length} casilleros. ` +
      `Modo ${GAME_MODES[currentMode].label}. Formación ${CURRENT_GAME.formationName}. ` +
      `Puntaje final: ${score}. Podés jugar otro desafío ahora.`;
    return;
  }

  if (reason === "time") {
    resultTitle.textContent = "Se terminó el tiempo";
    resultText.textContent =
      `Completaste ${completedSlots.length} de ${CURRENT_GAME.positions.length} casilleros. ` +
      `Modo ${GAME_MODES[currentMode].label}. Formación ${CURRENT_GAME.formationName}. ` +
      `Puntaje final: ${score}. Podés jugar otro desafío ahora.`;
    return;
  }

  resultTitle.textContent = "Equipo completado";
  resultText.textContent =
    `Completaste el 11 en modo ${GAME_MODES[currentMode].label}. ` +
    `Formación ${CURRENT_GAME.formationName}. Puntaje final: ${score}. ` +
    `Podés jugar otro desafío ahora.`;
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

function getOrCreateNextChallengeButton() {
  let nextBtn = document.getElementById("nextChallengeBtn");

  if (nextBtn) return nextBtn;

  const actions = getResultActions();

  if (!actions) return null;

  nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.id = "nextChallengeBtn";
  nextBtn.textContent = "Siguiente desafío";

  nextBtn.onclick = () => {
    initGame();
  };

  actions.appendChild(nextBtn);

  return nextBtn;
}

function showFinalButtons() {
  const nextBtn = getOrCreateNextChallengeButton();

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

  if (nextBtn) {
    nextBtn.classList.remove("hidden");
    nextBtn.style.display = "inline-flex";
    nextBtn.textContent = "Siguiente desafío";
  }
}

function hideFinalButtons() {
  const nextBtn = document.getElementById("nextChallengeBtn");

  if (nextBtn) {
    nextBtn.classList.add("hidden");
    nextBtn.style.display = "none";
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
    currentMode = nextMode;
    initGame();
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
  const total = Array.isArray(payload)
    ? PLAYERS.length
    : payload.total || PLAYERS.length;

  const updated = Array.isArray(payload)
    ? "-"
    : formatDateTime(payload.actualizado);

  const ligas = Array.isArray(payload)
    ? []
    : payload.ligas || [];

  baseTotal.textContent = `${total} jugadores`;
  baseUpdated.textContent = updated;

  if (ligas.length) {
    baseLeagues.textContent = ligas.map(liga => liga.pais_club).join(", ");
  } else {
    baseLeagues.textContent = "-";
  }
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

helpBtn.addEventListener("click", () => {
  alert(
    "El juego muestra automáticamente una posición y un equipo de América. " +
    "Escribí un jugador actual de ese club y compatible con la posición marcada. " +
    "Al acertar, se desbloquea otra posición aleatoria. En Fácil aparecen sugerencias."
  );
});

loadGameData();
