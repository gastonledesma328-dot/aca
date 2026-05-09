const DATA_URL = "https://partidoshoy-worker-jugadores-america.gastonledesma328.workers.dev/data/jugadores_america.json";

const GAME_MODES = {
  easy: {
    label: "Fácil",
    showHints: true,
    timeLimit: null,
    points: 100,
    noRepeatClub: false,
    help: "Modo fácil: vas a ver sugerencias y podés repetir club."
  },
  normal: {
    label: "Normal",
    showHints: false,
    timeLimit: null,
    points: 150,
    noRepeatClub: true,
    help: "Modo normal: sin ayudas y sin repetir club."
  },
  hard: {
    label: "Difícil",
    showHints: false,
    timeLimit: 90,
    points: 200,
    noRepeatClub: true,
    help: "Modo difícil: sin ayudas, sin repetir club y con 90 segundos."
  },
  expert: {
    label: "Experto",
    showHints: false,
    timeLimit: 45,
    points: 300,
    noRepeatClub: true,
    help: "Modo experto: sin ayudas, sin repetir club y con 45 segundos."
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
let CHALLENGES = [];
let CURRENT_GAME = null;

let currentMode = "easy";
let selectedSlot = null;
let completedSlots = [];
let usedPlayers = [];
let usedClubs = [];
let score = 0;
let timeLeft = null;
let timerInterval = null;
let gameFinished = false;
let challengeCounter = 0;

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

    renderBaseInfo(payload);
    buildChallenges();
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
  return {
    ...raw,
    nombre: raw.nombre || raw.name || "",
    slug: raw.slug || slugify(raw.nombre || raw.name || ""),
    posicion: String(raw.posicion || raw.position || "CM").toUpperCase(),
    categoria: raw.categoria || positionGroup(raw.posicion || raw.position || "CM"),
    club: raw.club || "Club desconocido",
    pais_club: raw.pais_club || "",
    liga: raw.liga || "",
    league_slug: raw.league_slug || ""
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

function buildChallenges() {
  const baseChallenge = {
    type: "america",
    value: "america",
    title: "Clubes de América",
    description: "Completá el 11 con cualquier jugador actual de clubes americanos.",
    icon: "https://flagcdn.com/w40/un.png",
    validate: player => Boolean(player.club)
  };

  const countries = [...new Set(PLAYERS.map(player => player.pais_club).filter(Boolean))];

  const countryChallenges = countries.map(country => ({
    type: "country",
    value: country,
    title: `Clubes de ${country}`,
    description: `Completá el 11 solo con jugadores de clubes de ${country}.`,
    icon: `https://flagcdn.com/w40/${COUNTRY_FLAGS[country] || "un"}.png`,
    validate: player => player.pais_club === country
  }));

  const leagueMap = new Map();

  PLAYERS.forEach(player => {
    if (player.league_slug && player.liga) {
      leagueMap.set(player.league_slug, {
        league_slug: player.league_slug,
        liga: player.liga,
        pais_club: player.pais_club
      });
    }
  });

  const leagueChallenges = [...leagueMap.values()].map(item => ({
    type: "league",
    value: item.league_slug,
    title: item.liga,
    description: `Completá el 11 solo con jugadores de ${item.liga}.`,
    icon: `https://flagcdn.com/w40/${COUNTRY_FLAGS[item.pais_club] || "un"}.png`,
    validate: player => player.league_slug === item.league_slug
  }));

  CHALLENGES = shuffleArray([
    baseChallenge,
    ...countryChallenges,
    ...leagueChallenges
  ]);
}

function initGame() {
  stopTimer();

  CURRENT_GAME = generateChallenge();

  resetGameState();
  renderFormation();
  renderChallengePanel();
  applyModeUi();
  clearSelectedSlot();
  startTimerIfNeeded();
  updateStatus();
}

function generateChallenge() {
  challengeCounter += 1;

  let formation;
  let challenge;
  let safety = 0;

  do {
    formation = pickRandom(FORMATIONS);
    challenge = pickRandom(CHALLENGES);
    safety++;
  } while (!challengeHasEnoughPlayers(formation, challenge) && safety < 200);

  return {
    challengeNumber: challengeCounter,
    formationName: formation.name,
    rows: formation.rows,
    positions: formation.rows.flat(),
    challenge
  };
}

function challengeHasEnoughPlayers(formation, challenge) {
  const available = PLAYERS.filter(player => challenge.validate(player));
  const positions = formation.rows.flat();

  const needed = {
    arqueros: positions.filter(position => positionGroup(position) === "arqueros").length,
    defensores: positions.filter(position => positionGroup(position) === "defensores").length,
    mediocampistas: positions.filter(position => positionGroup(position) === "mediocampistas").length,
    delanteros: positions.filter(position => positionGroup(position) === "delanteros").length
  };

  return Object.keys(needed).every(group => {
    return available.filter(player => player.categoria === group).length >= needed[group];
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
      const button = document.createElement("button");
      button.className = "position-slot";
      button.type = "button";
      button.dataset.position = position;
      button.dataset.index = slotIndex;
      button.textContent = position;

      button.onclick = () => {
        selectSlot(button);
      };

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
  const challenge = CURRENT_GAME.challenge;

  challengeIcon.src = challenge.icon;
  challengeIcon.alt = challenge.title;
  challengeName.textContent = challenge.title;
  challengeDescription.textContent = challenge.description;
}

function resetGameState() {
  selectedSlot = null;
  completedSlots = [];
  usedPlayers = [];
  usedClubs = [];
  score = 0;
  gameFinished = false;

  resultModal.classList.add("hidden");
  hideFinalButtons();

  playerSearch.disabled = false;
  surrenderBtn.disabled = false;
  playerSearch.value = "";
  suggestions.innerHTML = "";
}

function getSlots() {
  return document.querySelectorAll(".position-slot");
}

function selectSlot(slot) {
  if (gameFinished) return;
  if (slot.classList.contains("filled")) return;

  getSlots().forEach(item => item.classList.remove("selected"));

  selectedSlot = slot;
  selectedSlot.classList.add("selected");

  updateSearchPlaceholder();
  renderSuggestions(playerSearch.value);

  const value = normalizeText(playerSearch.value);

  if (value) {
    trySubmitSearch();
  }
}

function clearSelectedSlot() {
  selectedSlot = null;

  getSlots().forEach(item => item.classList.remove("selected"));

  suggestions.innerHTML = "";
  updateSearchPlaceholder();
}

function updateSearchPlaceholder() {
  const challenge = CURRENT_GAME.challenge;

  playerSearch.placeholder = selectedSlot
    ? `Jugador válido para ${selectedSlot.dataset.position} en ${challenge.title}...`
    : `Elegí un casillero o escribí un jugador de ${challenge.title}...`;
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
  const freeSlots = Array.from(getSlots()).filter(slot => {
    return !slot.classList.contains("filled");
  });

  if (!freeSlots.length) return null;

  const exactSlot = freeSlots.find(slot => {
    return normalizePosition(slot.dataset.position) === normalizePosition(player.posicion);
  });

  if (exactSlot) return exactSlot;

  const compatibleSlots = freeSlots.filter(slot => {
    return playerCanPlaySlot(player.posicion, slot.dataset.position);
  });

  if (compatibleSlots.length === 1) {
    return compatibleSlots[0];
  }

  return null;
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

function playerAllowedByMode(player) {
  const mode = GAME_MODES[currentMode];

  if (!mode.noRepeatClub) {
    return true;
  }

  return !usedClubs.includes(player.club);
}

function playerAlreadyUsed(player) {
  return usedPlayers.includes(player.slug);
}

function getValidPlayersForCurrentChallenge() {
  return PLAYERS.filter(player => {
    return CURRENT_GAME.challenge.validate(player);
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

  const value = normalizeText(query);
  const selectedPosition = selectedSlot ? selectedSlot.dataset.position : "";

  const filtered = getValidPlayersForCurrentChallenge().filter(player => {
    if (playerAlreadyUsed(player)) return false;
    if (!playerAllowedByMode(player)) return false;

    if (selectedPosition && !playerCanPlaySlot(player.posicion, selectedPosition)) {
      return false;
    }

    if (!selectedPosition && !findBestFreeSlotForPlayer(player)) {
      return false;
    }

    if (!value) return true;

    return playerMatchesSearch(player, value);
  });

  if (!filtered.length) {
    suggestions.innerHTML = `
      <button class="suggestion-item" type="button">
        <div>
          <strong>No encontré ese jugador</strong>
          <span>Debe cumplir el desafío y tener casillero compatible.</span>
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
      const autoSlot = selectedSlot || findBestFreeSlotForPlayer(player);

      if (!autoSlot) {
        showTemporaryPlaceholder("Elegí un casillero compatible");
        return;
      }

      placePlayer(player, autoSlot);
    };

    suggestions.appendChild(button);
  });
}

function placePlayer(player, forcedSlot = null) {
  if (gameFinished) return;

  if (!CURRENT_GAME.challenge.validate(player)) {
    showTemporaryPlaceholder(`No cumple: ${CURRENT_GAME.challenge.title}`);
    return;
  }

  if (!playerAllowedByMode(player)) {
    showTemporaryPlaceholder(`Ya usaste ${player.club}`);
    return;
  }

  if (playerAlreadyUsed(player)) {
    showTemporaryPlaceholder("Ese jugador ya fue usado");
    return;
  }

  const targetSlot = forcedSlot || selectedSlot || findBestFreeSlotForPlayer(player);

  if (!targetSlot) {
    showTemporaryPlaceholder("Elegí un casillero compatible");
    return;
  }

  const slotPosition = targetSlot.dataset.position;

  if (!playerCanPlaySlot(player.posicion, slotPosition)) {
    showTemporaryPlaceholder(`${player.nombre} no puede jugar de ${slotPosition}`);
    return;
  }

  targetSlot.classList.add("filled");
  targetSlot.classList.remove("selected");

  targetSlot.innerHTML = `
    ${player.nombre}
    <small>${player.club} · ${player.posicion}</small>
  `;

  completedSlots.push(Number(targetSlot.dataset.index));
  usedPlayers.push(player.slug);
  usedClubs.push(player.club);

  score += GAME_MODES[currentMode].points;

  selectedSlot = null;
  playerSearch.value = "";
  suggestions.innerHTML = "";

  updateStatus();

  if (completedSlots.length === CURRENT_GAME.positions.length) {
    finishGame("complete");
    return;
  }

  clearSelectedSlot();
}

function trySubmitSearch() {
  if (gameFinished) return;

  const value = normalizeText(playerSearch.value);

  if (!value) {
    renderSuggestions("");
    return;
  }

  const matches = getValidPlayersForCurrentChallenge().filter(player => {
    if (playerAlreadyUsed(player)) return false;
    if (!playerAllowedByMode(player)) return false;

    if (selectedSlot && !playerCanPlaySlot(player.posicion, selectedSlot.dataset.position)) {
      return false;
    }

    if (!selectedSlot && !findBestFreeSlotForPlayer(player)) {
      return false;
    }

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
    const autoSlot = selectedSlot || findBestFreeSlotForPlayer(exactMatch);

    if (!autoSlot) {
      showTemporaryPlaceholder("Elegí un casillero compatible");
      return;
    }

    placePlayer(exactMatch, autoSlot);
    return;
  }

  if (matches.length === 1) {
    const autoSlot = selectedSlot || findBestFreeSlotForPlayer(matches[0]);

    if (!autoSlot) {
      showTemporaryPlaceholder("Elegí un casillero compatible");
      return;
    }

    placePlayer(matches[0], autoSlot);
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
    `Desafío: ${CURRENT_GAME.challenge.title}. Formación ${CURRENT_GAME.formationName}. ` +
    `Puntaje final: ${score}. Podés jugar otro desafío ahora.`;
}

function surrenderGame() {
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
Desafío: ${CURRENT_GAME.challenge.title}
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
    "Completá la formación con jugadores actuales de clubes americanos. " +
    "Podés elegir un casillero primero o escribir un jugador y dejar que el juego busque un puesto compatible. " +
    "En modo Fácil hay sugerencias. En Normal, Difícil y Experto no podés repetir club."
  );
});

loadGameData();
