const DATA_URL = "../data/legends11-players.json";
const STORAGE_PREFIX = "partidos_hoy_legends11_played_";

const GAME_MODES = {
  easy: {
    label: "Fácil",
    showHints: true,
    timeLimit: null,
    help: "Modo fácil: vas a ver sugerencias disponibles."
  },
  normal: {
    label: "Normal",
    showHints: false,
    timeLimit: null,
    help: "Modo normal: sin ayudas y sin tiempo en contra."
  },
  hard: {
    label: "Difícil",
    showHints: false,
    timeLimit: 90,
    help: "Modo difícil: sin ayudas y con 90 segundos."
  },
  impossible: {
    label: "Imposible",
    showHints: false,
    timeLimit: 30,
    help: "Modo imposible: sin ayudas y con 30 segundos."
  }
};

const POSITION_COMPATIBILITY = {
  GK: ["GK"],

  RB: ["RB", "RWB"],
  CB: ["CB"],
  LB: ["LB", "LWB"],

  LWB: ["LWB", "LB", "LM"],
  RWB: ["RWB", "RB", "RM"],

  CDM: ["CDM", "CM"],
  CM: ["CM", "CDM", "CAM"],
  CAM: ["CAM", "CM"],

  LW: ["LW", "LM"],
  LM: ["LM", "LW", "CM"],

  RW: ["RW", "RM"],
  RM: ["RM", "RW", "CM"],

  ST: ["ST"]
};

const POSITION_LABELS = {
  GK: "Arquero",
  RB: "Lateral derecho",
  CB: "Defensor central",
  LB: "Lateral izquierdo",
  LWB: "Carrilero izquierdo",
  RWB: "Carrilero derecho",
  CDM: "Mediocentro defensivo",
  CM: "Mediocampista",
  CAM: "Enganche",
  LW: "Extremo izquierdo",
  LM: "Volante izquierdo",
  RW: "Extremo derecho",
  RM: "Volante derecho",
  ST: "Delantero"
};

const MIN_SEARCH_CHARS = 3;
const SAFE_AUTOCOMPLETE_CHARS = 5;

const pitchFrame = document.querySelector(".pitch-frame");
const modeButtons = document.querySelectorAll(".mode-btn");

const countryFlag = document.getElementById("countryFlag");
const countryName = document.getElementById("countryName");
const positionName = document.getElementById("positionName");
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
const resultModal = document.getElementById("resultModal");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const shareBtn = document.getElementById("shareBtn");
const backToGamesBtn = document.getElementById("backToGamesBtn");

let GAME_DATA = null;
let DAILY_GAME = null;

let currentMode = "easy";
let selectedSlot = null;
let completedSlots = [];
let usedPlayers = [];
let score = 0;
let timeLeft = null;
let timerInterval = null;
let gameFinished = false;
let dailyAttemptLocked = false;
let currentRoundIndex = 0;
let attemptStartedThisSession = false;
let challengeCounter = 0;

async function loadGameData() {
  try {
    const res = await fetch(`${DATA_URL}?v=${Date.now()}`);

    if (!res.ok) {
      throw new Error(`No se pudo cargar ${DATA_URL}`);
    }

    GAME_DATA = await res.json();

    if (!GAME_DATA.formations || !GAME_DATA.countries) {
      throw new Error("El JSON no tiene formations o countries.");
    }

    initGame();

  } catch (error) {
    console.error(error);

    pitchFrame.innerHTML = `
      <div class="load-error">
        <strong>No se pudo cargar el juego</strong>
        <span>${escapeHTML(error.message)}</span>
      </div>
    `;

    modeHint.textContent = error.message;
  }
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayStorageKey() {
  return `${STORAGE_PREFIX}${getTodayKey()}`;
}

function getFlagUrl(flagCode, size = 80) {
  if (!flagCode) return "https://flagcdn.com/w80/un.png";
  return `https://flagcdn.com/w${size}/${flagCode}.png`;
}

function escapeHTML(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/*
  Límite diario quitado.
  El juego no se bloquea nunca.
*/
function hasPlayedToday() {
  return false;
}

/*
  Ya no guarda bloqueo diario.
*/
function savePlayedToday() {
  attemptStartedThisSession = true;
}

function createSeedFromString(text) {
  let seed = 0;

  for (let i = 0; i < text.length; i++) {
    seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  }

  return seed;
}

function seededRandom(seed) {
  let value = seed;

  return function () {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom(list, random) {
  return list[Math.floor(random() * list.length)];
}

function shuffleArray(list, random) {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

/*
  Genera una partida nueva cada vez.
  Rota formación, países y jugadores.
  Además, cada país elegido debe tener al menos un jugador compatible
  con la posición que toca.
*/
function generateDailyGame() {
  const todayKey = getTodayKey();

  challengeCounter += 1;

  const seed = createSeedFromString(
    `partidos-hoy-legends11-${todayKey}-${Date.now()}-${Math.random()}-${challengeCounter}`
  );

  const random = seededRandom(seed);

  const availableCountries = GAME_DATA.countries.filter(country => {
    return Array.isArray(country.players) && country.players.length > 0;
  });

  const validFormations = GAME_DATA.formations.filter(formation => {
    const flatPositions = formation.rows.flat();

    return flatPositions.every(position => {
      return availableCountries.some(country => {
        return country.players.some(player => {
          return playerCanPlaySlot(player.position, position);
        });
      });
    });
  });

  if (!validFormations.length) {
    throw new Error("No hay formaciones válidas: faltan jugadores por posición en el JSON.");
  }

  const formation = pickRandom(validFormations, random);
  const flatPositions = formation.rows.flat();

  const selectedCountries = [];
  const usedCountryNames = new Set();

  flatPositions.forEach(position => {
    let compatibleCountries = availableCountries.filter(country => {
      if (usedCountryNames.has(country.country)) return false;

      return country.players.some(player => {
        return playerCanPlaySlot(player.position, position);
      });
    });

    /*
      Si no alcanza sin repetir país, permitimos repetir país,
      pero siempre respetando que tenga jugador compatible.
    */
    if (!compatibleCountries.length) {
      compatibleCountries = availableCountries.filter(country => {
        return country.players.some(player => {
          return playerCanPlaySlot(player.position, position);
        });
      });
    }

    if (!compatibleCountries.length) {
      throw new Error(`No hay países con jugadores para la posición ${position}.`);
    }

    const chosenCountry = pickRandom(compatibleCountries, random);

    selectedCountries.push(chosenCountry);
    usedCountryNames.add(chosenCountry.country);
  });

  const rounds = selectedCountries.map((country, index) => {
    const requiredPosition = flatPositions[index];

    const compatiblePlayers = country.players.filter(player => {
      return playerCanPlaySlot(player.position, requiredPosition);
    });

    return {
      country: country.country,
      flagCode: country.flagCode,
      flagEmoji: country.flagEmoji || "",
      dt: country.dt || "",
      requiredPosition,
      players: shuffleArray(compatiblePlayers, random)
    };
  });

  return {
    date: todayKey,
    challengeNumber: challengeCounter,
    formationName: formation.name,
    rows: formation.rows,
    positions: flatPositions,
    rounds
  };
}

function getSlots() {
  return document.querySelectorAll(".position-slot");
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

function renderFormation() {
  pitchFrame.innerHTML = "";

  let slotIndex = 0;
  const totalRows = DAILY_GAME.rows.length;

  DAILY_GAME.rows.forEach((row, rowIndex) => {
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

function resetGameState() {
  selectedSlot = null;
  completedSlots = [];
  usedPlayers = [];
  score = 0;
  gameFinished = false;
  dailyAttemptLocked = false;
  currentRoundIndex = 0;
  attemptStartedThisSession = false;

  resultModal.classList.add("hidden");
  hideFinalButtons();

  playerSearch.disabled = false;
  surrenderBtn.disabled = false;
  playerSearch.value = "";
  suggestions.innerHTML = "";
}

function initGame() {
  stopTimer();

  DAILY_GAME = generateDailyGame();

  resetGameState();

  renderFormation();

  getSlots().forEach((slot, index) => {
    const position = DAILY_GAME.positions[index];

    slot.dataset.index = index;
    slot.dataset.position = position;

    slot.classList.remove("filled", "selected");
    slot.disabled = false;
    slot.innerHTML = position;

    slot.onclick = () => {
      selectSlot(slot);
    };
  });

  applyModeUi();
  updateCountryPanel();
  startTimerIfNeeded();
  updateStatus();
}

function startNewRandomChallenge() {
  initGame();
}

function applyModeUi() {
  const mode = GAME_MODES[currentMode];

  modeText.textContent = mode.label;
  modeHint.textContent = `${mode.help} Desafío #${DAILY_GAME.challengeNumber} · Formación: ${DAILY_GAME.formationName}`;

  if (mode.showHints && !dailyAttemptLocked) {
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

  if (dailyAttemptLocked) return;
  if (mode.timeLimit === null) return;

  savePlayedToday();

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

function getCurrentRound() {
  return DAILY_GAME.rounds[currentRoundIndex];
}

function getCurrentRequiredPosition() {
  const round = getCurrentRound();

  if (round && round.requiredPosition) {
    return round.requiredPosition;
  }

  return DAILY_GAME.positions[currentRoundIndex];
}

function getCurrentTargetSlot() {
  return Array.from(getSlots()).find(slot => {
    return Number(slot.dataset.index) === currentRoundIndex && !slot.classList.contains("filled");
  });
}

function highlightCurrentSlot() {
  getSlots().forEach(slot => slot.classList.remove("selected"));

  const targetSlot = getCurrentTargetSlot();

  if (targetSlot) {
    targetSlot.classList.add("selected");
  }
}

function updateCountryPanel() {
  const round = getCurrentRound();
  const requiredPosition = getCurrentRequiredPosition();

  if (!round || !requiredPosition) {
    countryFlag.src = getFlagUrl("un", 80);
    countryFlag.alt = "Desafío finalizado";
    countryName.textContent = "Desafío finalizado";

    if (positionName) {
      positionName.textContent = "";
    }

    return;
  }

  countryFlag.src = getFlagUrl(round.flagCode, 80);
  countryFlag.alt = `Bandera de ${round.country}`;
  countryName.textContent = round.country;

  if (positionName) {
    positionName.textContent = `${requiredPosition} · ${POSITION_LABELS[requiredPosition] || requiredPosition}`;
  }

  playerSearch.placeholder = `Leyenda de ${round.country} para ${requiredPosition}...`;

  highlightCurrentSlot();
}

function selectSlot(slot) {
  if (dailyAttemptLocked) return;
  if (gameFinished) return;
  if (slot.classList.contains("filled")) return;

  highlightCurrentSlot();
  playerSearch.focus();

  const requiredPosition = getCurrentRequiredPosition();

  if (requiredPosition) {
    showTemporaryPlaceholder(`Ahora toca ${requiredPosition}`);
  }
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

function playerMatchesSearch(player, value) {
  const fullName = normalizeText(player.name);
  const lastName = normalizeText(player.name.split(" ").pop());
  const position = normalizeText(player.position);
  const aliases = Array.isArray(player.aliases) ? player.aliases.map(normalizeText) : [];

  return (
    fullName.includes(value) ||
    lastName.includes(value) ||
    position.includes(value) ||
    aliases.some(alias => alias.includes(value) || value.includes(alias))
  );
}

function playerIsExactMatch(player, value) {
  const fullName = normalizeText(player.name);
  const lastName = normalizeText(player.name.split(" ").pop());
  const aliases = Array.isArray(player.aliases) ? player.aliases.map(normalizeText) : [];

  return fullName === value || lastName === value || aliases.includes(value);
}

function playerCanAutocompleteSafely(player, value) {
  const fullName = normalizeText(player.name);
  const lastName = normalizeText(player.name.split(" ").pop());
  const aliases = Array.isArray(player.aliases) ? player.aliases.map(normalizeText) : [];

  const fullNameOk =
    fullName.startsWith(value) &&
    value.length >= Math.min(SAFE_AUTOCOMPLETE_CHARS, fullName.length);

  const lastNameOk =
    lastName.startsWith(value) &&
    value.length >= Math.min(SAFE_AUTOCOMPLETE_CHARS, lastName.length);

  const aliasOk = aliases.some(alias => {
    return (
      alias.startsWith(value) &&
      value.length >= Math.min(SAFE_AUTOCOMPLETE_CHARS, alias.length)
    );
  });

  return fullNameOk || lastNameOk || aliasOk;
}

function renderSuggestions(query) {
  const mode = GAME_MODES[currentMode];

  if (dailyAttemptLocked) return;

  if (!mode.showHints) {
    suggestions.innerHTML = "";
    return;
  }

  suggestions.innerHTML = "";

  const round = getCurrentRound();
  const requiredPosition = getCurrentRequiredPosition();

  if (!round || !requiredPosition) return;

  const value = normalizeText(query);

  if (value && value.length < MIN_SEARCH_CHARS) {
    suggestions.innerHTML = `
      <button class="suggestion-item" type="button">
        <strong>Escribí al menos ${MIN_SEARCH_CHARS} letras</strong>
        <span>${escapeHTML(round.country)} · ${escapeHTML(requiredPosition)}</span>
      </button>
    `;
    return;
  }

  const filtered = round.players.filter(player => {
    if (usedPlayers.includes(player.name)) return false;

    if (!playerCanPlaySlot(player.position, requiredPosition)) {
      return false;
    }

    if (!value) return true;

    return playerMatchesSearch(player, value);
  });

  if (!filtered.length) {
    suggestions.innerHTML = `
      <button class="suggestion-item" type="button">
        <strong>No encontré esa leyenda</strong>
        <span>${escapeHTML(round.country)} · Debe servir para ${escapeHTML(requiredPosition)}</span>
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
        <strong>${escapeHTML(player.name)}</strong>
        <span>${escapeHTML(round.country)} · ${escapeHTML(player.position)}</span>
      </div>
      <span>Elegir</span>
    `;

    button.onclick = () => {
      placePlayer(player);
    };

    suggestions.appendChild(button);
  });
}

function placePlayer(player) {
  if (gameFinished) return;

  const round = getCurrentRound();
  const requiredPosition = getCurrentRequiredPosition();
  const targetSlot = getCurrentTargetSlot();

  if (!round || !requiredPosition || !targetSlot) return;

  if (!playerCanPlaySlot(player.position, requiredPosition)) {
    showTemporaryPlaceholder(`${player.name} no sirve para ${requiredPosition}`);
    return;
  }

  savePlayedToday();

  if (usedPlayers.includes(player.name)) {
    alert("Esa leyenda ya fue usada.");
    return;
  }

  targetSlot.classList.add("filled");
  targetSlot.classList.remove("selected");

  targetSlot.innerHTML = `
    <span class="slot-flag">
      <img
        src="${getFlagUrl(round.flagCode, 40)}"
        alt="${escapeHTML(round.country)}"
        loading="lazy"
        onerror="this.style.display='none'; this.parentElement.textContent='${round.flagEmoji || "🏳️"}';"
      />
    </span>
    <strong class="slot-player">${escapeHTML(player.name)}</strong>
    <small class="slot-country">${escapeHTML(round.country)}</small>
  `;

  completedSlots.push(Number(targetSlot.dataset.index));
  usedPlayers.push(player.name);
  score += calculatePoints();

  currentRoundIndex++;

  selectedSlot = null;
  playerSearch.value = "";
  suggestions.innerHTML = "";

  updateStatus();

  if (completedSlots.length === DAILY_GAME.positions.length) {
    finishGame("complete");
    return;
  }

  updateCountryPanel();
}

function calculatePoints() {
  if (currentMode === "easy") return 100;
  if (currentMode === "normal") return 150;
  if (currentMode === "hard") return 200;
  if (currentMode === "impossible") return 300;
  return 100;
}

function trySubmitSearch() {
  if (gameFinished) return;

  const round = getCurrentRound();
  const requiredPosition = getCurrentRequiredPosition();
  const value = normalizeText(playerSearch.value);

  if (!round || !requiredPosition) return;

  if (!value) {
    renderSuggestions("");
    return;
  }

  if (value.length < MIN_SEARCH_CHARS) {
    showTemporaryPlaceholder(`Escribí al menos ${MIN_SEARCH_CHARS} letras`);
    return;
  }

  const matches = round.players.filter(player => {
    if (usedPlayers.includes(player.name)) return false;

    if (!playerCanPlaySlot(player.position, requiredPosition)) {
      return false;
    }

    return playerMatchesSearch(player, value);
  });

  if (!matches.length) {
    if (GAME_MODES[currentMode].showHints) {
      renderSuggestions(playerSearch.value);
    } else {
      showTemporaryPlaceholder(`No encontré una leyenda de ${round.country} para ${requiredPosition}`);
    }

    return;
  }

  const exactMatch = matches.find(player => {
    return playerIsExactMatch(player, value);
  });

  if (exactMatch) {
    placePlayer(exactMatch);
    return;
  }

  if (matches.length === 1) {
    const candidate = matches[0];

    if (playerCanAutocompleteSafely(candidate, value)) {
      placePlayer(candidate);
      return;
    }

    if (GAME_MODES[currentMode].showHints) {
      renderSuggestions(playerSearch.value);
    } else {
      showTemporaryPlaceholder("Escribí un poco más del nombre");
    }

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
    if (!gameFinished && !dailyAttemptLocked) {
      updateCountryPanel();
    } else {
      playerSearch.placeholder = original;
    }
  }, 1400);
}

function updateStatus() {
  completedText.textContent = `${completedSlots.length}/${DAILY_GAME.positions.length}`;
  scoreText.textContent = score;
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
    startNewRandomChallenge();
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

function lockGameForToday() {
  gameFinished = false;
  dailyAttemptLocked = false;
}

function finishGame(reason) {
  if (gameFinished) return;

  savePlayedToday();

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
    resultText.textContent = `Completaste ${completedSlots.length} de ${DAILY_GAME.positions.length} casilleros. Puntaje final: ${score}. Podés jugar otro desafío ahora.`;
    return;
  }

  if (reason === "time") {
    resultTitle.textContent = "Se terminó el tiempo";
    resultText.textContent = `Completaste ${completedSlots.length} de ${DAILY_GAME.positions.length} casilleros en modo ${GAME_MODES[currentMode].label}. Puntaje final: ${score}. Podés jugar otro desafío ahora.`;
    return;
  }

  resultTitle.textContent = "Equipo completado";
  resultText.textContent = `Completaste el 11 en modo ${GAME_MODES[currentMode].label}. Formación ${DAILY_GAME.formationName}. Puntaje final: ${score}. Podés jugar otro desafío ahora.`;
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

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  return `${min}:${String(sec).padStart(2, "0")}`;
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

surrenderBtn.addEventListener("click", () => {
  finishGame("surrender");
});

shareBtn.addEventListener("click", async () => {
  const text = `Armé mi 11 de Leyendas en Partidos.Hoy ⚽
Desafío: #${DAILY_GAME.challengeNumber}
Modo: ${GAME_MODES[currentMode].label}
Formación: ${DAILY_GAME.formationName}
Puntaje: ${score}`;

  if (navigator.share) {
    await navigator.share({
      title: "Armá tu 11 de Leyendas",
      text
    });
  } else {
    await navigator.clipboard.writeText(text);
    alert("Resultado copiado al portapapeles");
  }
});

helpBtn.addEventListener("click", () => {
  alert("El juego muestra un país y una posición. Escribí una leyenda de ese país para esa posición y presioná Enter. El jugador se coloca automáticamente en la cancha. No alcanza con escribir 1 o 2 letras: tenés que escribir mejor el nombre. Al terminar, podés jugar otro desafío con nueva formación y países rotados.");
});

loadGameData();
