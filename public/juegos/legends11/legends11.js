const DATA_URL = "../data/legends11-players.json";
const STORAGE_PREFIX    = "partidos_hoy_legends11_played_";
const STATE_KEY         = "partidos_hoy_legends11_state";

const GAME_MODES = {
  easy: {
    label: "Fácil",
    showHints: true,
    timeLimit: null,
    popularity: 1,        // solo jugadores muy conocidos
    help: "Jugadores populares · Con pista de iniciales."
  },
  normal: {
    label: "Normal",
    showHints: false,
    timeLimit: null,
    popularity: 1,        // solo jugadores muy conocidos, sin pistas
    help: "Jugadores populares · Sin ayudas."
  },
  hard: {
    label: "Difícil",
    showHints: false,
    timeLimit: 90,
    popularity: 2,        // jugadores menos conocidos
    help: "Menos conocidos · Sin ayudas · 90 seg."
  },
  impossible: {
    label: "Imposible",
    showHints: false,
    timeLimit: 60,
    popularity: null,     // todos los jugadores
    help: "Todos los jugadores · Sin ayudas · 60 seg."
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
const timerBar  = document.getElementById("timerBar");
const timerFill = document.getElementById("timerFill");
const modeHint  = document.getElementById("modeHint");
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
let pendingSlots = [];
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

function saveState() {
  if (!DAILY_GAME) return;
  const state = {
    challengeId:    DAILY_GAME.date + "_" + DAILY_GAME.challengeNumber,
    dailyGame:      DAILY_GAME,
    mode:           currentMode,
    completedSlots: completedSlots,
    usedPlayers:    usedPlayers,
    pendingSlots:   pendingSlots,
    score:          score,
    timeLeft:       timeLeft
  };
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch(e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}

function clearState() {
  try { localStorage.removeItem(STATE_KEY); } catch(e) {}
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

  const modePop = GAME_MODES[currentMode].popularity; // 1, 2 o null

  // Clonar países filtrando jugadores según popularidad del modo
  const availableCountries = GAME_DATA.countries
    .map(country => ({
      ...country,
      players: country.players.filter(p =>
        modePop === null ||          // imposible: todos
        modePop === 2 ||             // difícil: todos (1 y 2)
        p.popularity === 1           // fácil/normal: solo populares
      )
    }))
    .filter(country => Array.isArray(country.players) && country.players.length > 0);

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

    const allCompatible = country.players.filter(player =>
      playerCanPlaySlot(player.position, requiredPosition)
    );

    // En modo difícil preferir jugadores poco conocidos (popularity=2)
    const preferredPool = modePop === 2
      ? allCompatible.filter(p => p.popularity === 2)
      : allCompatible;

    const compatiblePlayers = preferredPool.length > 0 ? preferredPool : allCompatible;

    // Elegir exactamente 1 jugador para este casillero
    const chosenPlayer = pickRandom(compatiblePlayers, random);

    return {
      country: country.country,
      flagCode: country.flagCode,
      flagEmoji: country.flagEmoji || "",
      dt: country.dt || "",
      requiredPosition,
      player: chosenPlayer,
      players: [chosenPlayer]
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
  const rows = DAILY_GAME.rows;
  const totalRows = rows.length;

  // Agregar clase rows-N al frame para que el CSS distribuya correctamente
  pitchFrame.className = pitchFrame.className.replace(/rows-\d/g, "").trim();
  pitchFrame.classList.add("rows-" + totalRows);

  rows.forEach((row, rowIndex) => {
    const line = document.createElement("div");
    line.className = "line line-row-" + rowIndex + " line-count-" + row.length;

    row.forEach(position => {
      const button = document.createElement("button");
      button.className = "position-slot";
      button.type = "button";
      button.dataset.position = position;
      button.dataset.index = slotIndex;
      button.textContent = position;
      button.onclick = () => { selectSlot(button); };
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
  attemptStartedThisSession = false;

  // Orden aleatorio de los 11 slots
  const total = DAILY_GAME ? DAILY_GAME.rounds.length : 11;
  pendingSlots = Array.from({ length: total }, (_, i) => i)
    .sort(() => Math.random() - 0.5);
  currentRoundIndex = pendingSlots[0];

  resultModal.classList.add("hidden");
  hideFinalButtons();

  playerSearch.disabled = false;
  surrenderBtn.disabled = false;
  playerSearch.value = "";
  suggestions.innerHTML = "";
}

function restoreFilledSlots() {
  const slots = Array.from(getSlots());
  completedSlots.forEach(slotIndex => {
    const round = DAILY_GAME.rounds[slotIndex];
    const player = round ? round.player : null;
    const slot = slots.find(s => Number(s.dataset.index) === slotIndex);
    if (!slot || !round || !player) return;

    slot.classList.add("filled");
    slot.classList.remove("selected");
    slot.innerHTML = `
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
  });
}

function initGame() {
  stopTimer();

  const saved = loadState();
  const freshGame = generateDailyGame();

  // Restaurar si el desafío guardado coincide con el generado Y es el mismo modo
  if (
    saved &&
    saved.challengeId === freshGame.date + "_" + freshGame.challengeNumber &&
    saved.mode === currentMode
  ) {
    DAILY_GAME      = saved.dailyGame;
    completedSlots  = saved.completedSlots  || [];
    usedPlayers     = saved.usedPlayers     || [];
    pendingSlots    = saved.pendingSlots    || [];
    score           = saved.score           || 0;
    timeLeft        = saved.timeLeft        != null ? saved.timeLeft : null;
    currentRoundIndex = pendingSlots.length > 0 ? pendingSlots[0] : -1;
    gameFinished    = false;
    dailyAttemptLocked = false;
    selectedSlot    = null;

    resultModal.classList.add("hidden");
    hideFinalButtons();
    playerSearch.disabled = false;
    surrenderBtn.disabled = false;
    playerSearch.value = "";
    suggestions.innerHTML = "";

    renderFormation();
    restoreFilledSlots();
    applyModeUi();
    // Restaurar tiempo: no reiniciar el timer con el tiempo original,
    // sino con el timeLeft guardado
    if (timeLeft !== null) {
      timerText.textContent = formatTime(timeLeft);
      timerFill.style.width = ((timeLeft / GAME_MODES[currentMode].timeLimit) * 100) + "%";
      timerBar.classList.remove("hidden", "urgent");
      timerBar.classList.toggle("urgent", timeLeft <= 15);
      startTimerIfNeeded();
    }
    updateCountryPanel();
    updateStatus();
    return;
  }

  DAILY_GAME = freshGame;

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
  modeHint.textContent = `${mode.help} Formación: ${DAILY_GAME.formationName}`;

  if (mode.showHints && !dailyAttemptLocked) {
    suggestions.classList.remove("hidden");
    setTimeout(() => renderSuggestions(""), 0);
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
      timerText.textContent = formatTime(0);
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

  if (GAME_MODES[currentMode].showHints && !dailyAttemptLocked) {
    setTimeout(() => renderSuggestions(""), 0);
  }
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

// Convierte un nombre en pista de iniciales: "Lionel Messi" → "L****** M****"
function buildHint(name) {
  return name.split(" ").map(word =>
    word.length > 0 ? word[0] + "*".repeat(word.length - 1) : ""
  ).join(" ");
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

  const target = round.player;
  const hint = buildHint(target.name);

  // Mostrar solo la pista de iniciales — sin botón clickeable ni "Elegir"
  const item = document.createElement("div");
  item.className = "suggestion-item hint-item-readonly";
  item.innerHTML = `
    <strong>${escapeHTML(hint)}</strong>
    <span class="hint-badge">💡</span>
  `;
  suggestions.appendChild(item);
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

  // Avanzar al siguiente slot pendiente (orden aleatorio)
  pendingSlots = pendingSlots.filter(i => !completedSlots.includes(i));
  currentRoundIndex = pendingSlots.length > 0 ? pendingSlots[0] : -1;

  selectedSlot = null;
  playerSearch.value = "";
  suggestions.innerHTML = "";

  saveState();
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

  // Solo hay 1 jugador válido por casillero
  const target = round.player;

  if (!playerMatchesSearch(target, value)) {
    if (GAME_MODES[currentMode].showHints) {
      renderSuggestions(playerSearch.value);
    } else {
      showTemporaryPlaceholder(`No es la leyenda correcta para ${round.country} · ${requiredPosition}`);
    }
    return;
  }

  if (playerIsExactMatch(target, value)) {
    placePlayer(target);
    return;
  }

  if (playerCanAutocompleteSafely(target, value)) {
    placePlayer(target);
    return;
  }

  if (GAME_MODES[currentMode].showHints) {
    renderSuggestions(playerSearch.value);
  } else {
    showTemporaryPlaceholder("Escribí un poco más del nombre");
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
    clearState();
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

if (helpBtn) {
  helpBtn.addEventListener("click", () => {
    alert("El juego muestra un país y una posición. Escribí una leyenda de ese país para esa posición y presioná Enter. El jugador se coloca automáticamente en la cancha. No alcanza con escribir 1 o 2 letras: tenés que escribir mejor el nombre. Al terminar, podés jugar otro desafío con nueva formación y países rotados.");
  });
}

loadGameData();
