const DATA_URL = "../data/worldcup11-players.json";
const STORAGE_PREFIX = "partidos_hoy_worldcup11_played_";

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

const pitchFrame = document.querySelector(".pitch-frame");
const modeButtons = document.querySelectorAll(".mode-btn");

const countryFlag = document.getElementById("countryFlag");
const countryName = document.getElementById("countryName");
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
const restartBtn = document.getElementById("restartBtn");

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
        <span>Revisá que exista data/worldcup11-players.json</span>
      </div>
    `;

    modeHint.textContent = "Error cargando datos del juego.";
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

function hasPlayedToday() {
  return localStorage.getItem(getTodayStorageKey()) === "true";
}

function savePlayedToday() {
  localStorage.setItem(getTodayStorageKey(), "true");
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

function generateDailyGame() {
  const todayKey = getTodayKey();
  const seed = createSeedFromString(`partidos-hoy-worldcup11-${todayKey}`);
  const random = seededRandom(seed);

  const formation = pickRandom(GAME_DATA.formations, random);
  const flatPositions = formation.rows.flat();
  const totalSlots = flatPositions.length;

  const availableCountries = GAME_DATA.countries.filter(country => {
    return Array.isArray(country.players) && country.players.length > 0;
  });

  let shuffledCountries = shuffleArray(availableCountries, random);
  const rounds = [];

  while (rounds.length < totalSlots) {
    if (!shuffledCountries.length) {
      shuffledCountries = shuffleArray(availableCountries, random);
    }

    const country = shuffledCountries.shift();

    rounds.push({
      country: country.country,
      flagCode: country.flagCode,
      dt: country.dt || "",
      players: shuffleArray(country.players, random)
    });
  }

  return {
    date: todayKey,
    formationName: formation.name,
    rows: formation.rows,
    positions: flatPositions,
    rounds
  };
}

function getSlots() {
  return document.querySelectorAll(".position-slot");
}

function renderFormation() {
  pitchFrame.innerHTML = "";

  let slotIndex = 0;

  DAILY_GAME.rows.forEach((row, rowIndex) => {
    const line = document.createElement("div");
    line.className = `line dynamic-line line-${rowIndex}`;

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

function initGame() {
  stopTimer();

  DAILY_GAME = generateDailyGame();

  selectedSlot = null;
  completedSlots = [];
  usedPlayers = [];
  score = 0;
  gameFinished = false;
  currentRoundIndex = 0;
  dailyAttemptLocked = hasPlayedToday();

  resultModal.classList.add("hidden");
  restartBtn.style.display = "";
  playerSearch.disabled = false;
  surrenderBtn.disabled = false;
  playerSearch.value = "";
  suggestions.innerHTML = "";

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

  if (dailyAttemptLocked) {
    lockGameForToday();
    return;
  }

  clearSelectedSlot();
  updateCountryPanel();
  startTimerIfNeeded();
  updateStatus();
}

function applyModeUi() {
  const mode = GAME_MODES[currentMode];

  modeText.textContent = mode.label;
  modeHint.textContent = `${mode.help} Desafío diario: ${DAILY_GAME.date} · Formación: ${DAILY_GAME.formationName}`;

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

function updateCountryPanel() {
  const round = getCurrentRound();

  if (!round) {
    countryFlag.src = "https://flagcdn.com/w40/un.png";
    countryFlag.alt = "Desafío finalizado";
    countryName.textContent = "Desafío finalizado";
    return;
  }

  countryFlag.src = `https://flagcdn.com/w40/${round.flagCode}.png`;
  countryFlag.alt = `Bandera de ${round.country}`;
  countryName.textContent = round.country;

  playerSearch.placeholder = selectedSlot
    ? `Jugador de ${round.country} para colocar en ${selectedSlot.dataset.position}...`
    : `Elegí un casillero y escribí un jugador de ${round.country}...`;
}

function selectSlot(slot) {
  if (dailyAttemptLocked) return;
  if (gameFinished) return;
  if (slot.classList.contains("filled")) return;

  getSlots().forEach(item => item.classList.remove("selected"));

  selectedSlot = slot;
  selectedSlot.classList.add("selected");

  updateCountryPanel();
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
  updateCountryPanel();
}

function normalizePosition(position) {
  const pos = String(position || "").toUpperCase().trim();

  const map = {
    ARQ: "GK",
    GK: "GK",

    DEF: "DEF",
    CB: "CB",
    LB: "LB",
    RB: "RB",

    MED: "MED",
    CM: "CM",
    CDM: "CDM",
    CAM: "CAM",
    LM: "LM",
    RM: "RM",

    DEL: "DEL",
    ST: "ST",
    LW: "LW",
    RW: "RW"
  };

  return map[pos] || pos;
}

function playerCanPlaySlot(playerPosition, slotPosition) {
  const playerPos = normalizePosition(playerPosition);
  const slotPos = normalizePosition(slotPosition);

  if (playerPos === slotPos) return true;

  const groups = {
    GK: ["GK", "ARQ"],

    CB: ["CB", "DEF"],
    LB: ["LB", "DEF"],
    RB: ["RB", "DEF"],

    CM: ["CM", "MED", "CDM", "CAM"],
    CDM: ["CDM", "CM", "MED"],
    CAM: ["CAM", "CM", "MED"],

    LM: ["LM", "LW", "MED"],
    RM: ["RM", "RW", "MED"],

    ST: ["ST", "DEL"],
    LW: ["LW", "DEL"],
    RW: ["RW", "DEL"]
  };

  return (groups[slotPos] || [slotPos]).includes(playerPos);
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

  if (!round) return;

  const value = normalizeText(query);
  const selectedPosition = selectedSlot ? selectedSlot.dataset.position : "";

  const filtered = round.players.filter(player => {
    if (usedPlayers.includes(player.name)) return false;

    if (selectedPosition && !playerCanPlaySlot(player.position, selectedPosition)) {
      return false;
    }

    if (!value) return true;

    const text = normalizeText(`${player.name} ${player.club} ${player.position}`);
    return text.includes(value);
  });

  if (!filtered.length) {
    const msg = selectedSlot
      ? `Debe ser de ${round.country} y servir para ${selectedSlot.dataset.position}`
      : `Debe ser de ${round.country}`;

    suggestions.innerHTML = `
      <button class="suggestion-item" type="button">
        <strong>No encontré ese jugador</strong>
        <span>${msg}</span>
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
        <strong>${player.name}</strong>
        <span>${round.country} · ${player.position} · ${player.club}</span>
      </div>
      <span>Elegir</span>
    `;

    button.onclick = () => {
      if (!selectedSlot) {
        showTemporaryPlaceholder("Primero elegí un casillero del campo");
        return;
      }

      placePlayer(player);
    };

    suggestions.appendChild(button);
  });
}

function placePlayer(player) {
  if (gameFinished) return;

  if (!selectedSlot) {
    showTemporaryPlaceholder("Primero elegí un casillero del campo");
    return;
  }

  const round = getCurrentRound();

  if (!round) return;

  const slotPosition = selectedSlot.dataset.position;

  if (!playerCanPlaySlot(player.position, slotPosition)) {
    showTemporaryPlaceholder(`${player.name} no puede jugar de ${slotPosition}`);
    return;
  }

  if (!hasPlayedToday()) {
    savePlayedToday();
  }

  if (usedPlayers.includes(player.name)) {
    alert("Ese jugador ya fue usado.");
    return;
  }

  selectedSlot.classList.add("filled");
  selectedSlot.classList.remove("selected");

  selectedSlot.innerHTML = `
    ${player.name}
    <small>${player.position}</small>
  `;

  completedSlots.push(Number(selectedSlot.dataset.index));
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

  clearSelectedSlot();
}

function calculatePoints() {
  if (currentMode === "easy") return 100;
  if (currentMode === "normal") return 150;
  if (currentMode === "hard") return 200;
  if (currentMode === "impossible") return 300;
  return 100;
}

function trySubmitSearch() {
  if (dailyAttemptLocked && hasPlayedToday()) return;
  if (gameFinished) return;

  if (!selectedSlot) {
    showTemporaryPlaceholder("Primero elegí un casillero del campo");
    return;
  }

  const round = getCurrentRound();
  const value = normalizeText(playerSearch.value);

  if (!round) return;

  if (!value) {
    renderSuggestions("");
    return;
  }

  const slotPosition = selectedSlot.dataset.position;

  const matches = round.players.filter(player => {
    if (usedPlayers.includes(player.name)) return false;

    if (!playerCanPlaySlot(player.position, slotPosition)) {
      return false;
    }

    const fullName = normalizeText(player.name);
    const lastName = normalizeText(player.name.split(" ").pop());
    const club = normalizeText(player.club);
    const position = normalizeText(player.position);

    return (
      fullName.includes(value) ||
      lastName.includes(value) ||
      club.includes(value) ||
      position.includes(value)
    );
  });

  if (!matches.length) {
    if (GAME_MODES[currentMode].showHints) {
      renderSuggestions(playerSearch.value);
    } else {
      showTemporaryPlaceholder(`No coincide con ${round.country} / ${slotPosition}`);
    }
    return;
  }

  const exactMatch = matches.find(player => {
    const fullName = normalizeText(player.name);
    const lastName = normalizeText(player.name.split(" ").pop());

    return fullName === value || lastName === value;
  });

  if (exactMatch) {
    placePlayer(exactMatch);
    return;
  }

  if (matches.length === 1) {
    placePlayer(matches[0]);
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

function lockGameForToday() {
  gameFinished = true;
  stopTimer();

  getSlots().forEach(slot => {
    slot.disabled = true;
    slot.classList.remove("selected");
  });

  modeButtons.forEach(button => {
    button.disabled = true;
  });

  playerSearch.disabled = true;
  surrenderBtn.disabled = true;
  suggestions.innerHTML = "";

  countryFlag.src = "https://flagcdn.com/w40/un.png";
  countryFlag.alt = "Desafío bloqueado";
  countryName.textContent = "Ya jugaste hoy";

  completedText.textContent = "0/11";
  scoreText.textContent = "0";
  timerText.textContent = "Mañana";

  resultTitle.textContent = "Ya usaste tu intento diario";
  resultText.textContent = "Este desafío permite una sola oportunidad por día. Volvé mañana para jugar una nueva alineación.";
  restartBtn.style.display = "none";
  resultModal.classList.remove("hidden");
}

function finishGame(reason) {
  if (gameFinished) return;

  if (!hasPlayedToday()) {
    savePlayedToday();
  }

  gameFinished = true;
  stopTimer();

  resultModal.classList.remove("hidden");
  restartBtn.style.display = "none";

  modeButtons.forEach(button => {
    button.disabled = true;
  });

  getSlots().forEach(slot => {
    slot.disabled = true;
    slot.classList.remove("selected");
  });

  playerSearch.disabled = true;
  surrenderBtn.disabled = true;

  if (reason === "surrender") {
    resultTitle.textContent = "Te rendiste";
    resultText.textContent = `Completaste ${completedSlots.length} de ${DAILY_GAME.positions.length} casilleros. Puntaje final: ${score}. Volvé mañana para otro desafío.`;
    return;
  }

  if (reason === "time") {
    resultTitle.textContent = "Se terminó el tiempo";
    resultText.textContent = `Completaste ${completedSlots.length} de ${DAILY_GAME.positions.length} casilleros en modo ${GAME_MODES[currentMode].label}. Puntaje final: ${score}. Volvé mañana para otro desafío.`;
    return;
  }

  resultTitle.textContent = "Equipo completado";
  resultText.textContent = `Completaste el 11 en modo ${GAME_MODES[currentMode].label}. Formación ${DAILY_GAME.formationName}. Puntaje final: ${score}. Volvé mañana para otro desafío.`;
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  return `${min}:${String(sec).padStart(2, "0")}`;
}

modeButtons.forEach(button => {
  button.addEventListener("click", () => {
    if (dailyAttemptLocked || hasPlayedToday()) {
      lockGameForToday();
      return;
    }

    currentMode = button.dataset.mode;
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
  if (!hasPlayedToday()) {
    savePlayedToday();
  }

  finishGame("surrender");
});

shareBtn.addEventListener("click", async () => {
  const text = `Armé mi 11 diario en Partidos.Hoy ⚽
Fecha: ${DAILY_GAME.date}
Modo: ${GAME_MODES[currentMode].label}
Formación: ${DAILY_GAME.formationName}
Puntaje: ${score}`;

  if (navigator.share) {
    await navigator.share({
      title: "Armá tu 11 Mundial",
      text
    });
  } else {
    await navigator.clipboard.writeText(text);
    alert("Resultado copiado al portapapeles");
  }
});

restartBtn.addEventListener("click", () => {
  lockGameForToday();
});

helpBtn.addEventListener("click", () => {
  alert("Cada ronda muestra un país. Elegí un casillero libre y escribí un jugador de ese país que pueda jugar en esa posición. Tenés una sola oportunidad diaria.");
});

loadGameData();
