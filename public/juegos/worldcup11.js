const DATA_URL = "../data/worldcup11-players.json";

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
  RB: ["RB", "RWB", "CB"],
  CB: ["CB", "RB", "LB", "CDM"],
  LB: ["LB", "LWB", "CB"],
  LWB: ["LWB", "LB", "LM", "LW"],
  RWB: ["RWB", "RB", "RM", "RW"],
  CDM: ["CDM", "CM", "CB"],
  CM: ["CM", "CDM", "CAM", "LM", "RM"],
  CAM: ["CAM", "CM", "LW", "RW", "ST"],
  LW: ["LW", "LM", "ST", "CAM"],
  LM: ["LM", "LW", "CM", "LWB"],
  RW: ["RW", "RM", "ST", "CAM"],
  RM: ["RM", "RW", "CM", "RWB"],
  ST: ["ST", "CF", "LW", "RW", "CAM"]
};

const POPULAR_COUNTRIES = [
  "Argentina", "Brasil", "Francia", "España", "Alemania", "Inglaterra", "Italia", "Portugal",
  "Países Bajos", "Holanda", "Uruguay", "Colombia", "Bélgica", "México", "Estados Unidos",
  "Paraguay", "Ecuador", "Perú", "Venezuela", "Chile"
];

const LESS_KNOWN_COUNTRIES = [
  "Marruecos", "Croacia", "República Checa", "Chequia", "Corea del Sur", "Serbia", "Suiza",
  "Austria", "Dinamarca", "Suecia", "Noruega", "Polonia", "Turquía", "Senegal", "Ghana",
  "Nigeria", "Costa de Marfil", "Camerún", "Argelia", "Túnez", "Australia", "Canadá",
  "Gales", "Escocia", "Ucrania"
];

const FALLBACK_POSITION_SEQUENCE = [
  "GK", "RB", "CB", "CB", "LB", "CDM", "CM", "CAM", "LW", "RW", "ST",
  "GK", "CB", "LB", "RB", "CM", "CDM", "CAM", "LM", "RM", "ST", "LW", "RW"
];

const PLAYER_POSITION_OVERRIDES = {
  "manuel neuer": "GK",
  "alexander nubel": "GK",
  "marc andre ter stegen": "GK",
  "emiliano martinez": "GK",
  "dibu martinez": "GK",
  "alisson": "GK",
  "ederson": "GK",
  "thibaut courtois": "GK",
  "unai simon": "GK",
  "jordan pickford": "GK",
  "mike maignan": "GK",
  "diogo costa": "GK",
  "sergio rochet": "GK",
  "david ospina": "GK",
  "guillermo ochoa": "GK",
  "antonio rudiger": "CB",
  "jonathan tah": "CB",
  "malick thiaw": "CB",
  "cristian romero": "CB",
  "lisandro martinez": "CB",
  "nicolas otamendi": "CB",
  "marquinhos": "CB",
  "gabriel magalhaes": "CB",
  "eder militao": "CB",
  "william saliba": "CB",
  "dayot upamecano": "CB",
  "ibrahima konate": "CB",
  "virgil van dijk": "CB",
  "ruben dias": "CB",
  "ronald araujo": "CB",
  "jules kounde": "RB",
  "achraf hakimi": "RB",
  "dani carvajal": "RB",
  "trent alexander arnold": "RB",
  "reece james": "RB",
  "joao cancelo": "RB",
  "nahuel molina": "RB",
  "kyle walker": "RB",
  "david raum": "LB",
  "nuno mendes": "LB",
  "theo hernandez": "LB",
  "alphonso davies": "LB",
  "marcos acuna": "LB",
  "nicolas tagliafico": "LB",
  "alejandro grimaldo": "LB",
  "andy robertson": "LB",
  "rodrigo de paul": "CM",
  "enzo fernandez": "CM",
  "alexis mac allister": "CM",
  "leandro paredes": "CDM",
  "rodri": "CDM",
  "declan rice": "CDM",
  "joshua kimmich": "CDM",
  "leon goretzka": "CM",
  "frenkie de jong": "CM",
  "toni kroos": "CM",
  "ilkay gundogan": "CM",
  "bruno guimaraes": "CM",
  "federico valverde": "CM",
  "jude bellingham": "CAM",
  "jamal musiala": "CAM",
  "florian wirtz": "CAM",
  "pedri": "CM",
  "gavi": "CM",
  "bruno fernandes": "CAM",
  "kevin de bruyne": "CAM",
  "antoine griezmann": "CAM",
  "lionel messi": "RW",
  "angel di maria": "RW",
  "vinicius junior": "LW",
  "rodrygo": "RW",
  "neymar": "LW",
  "raphinha": "RW",
  "lamine yamal": "RW",
  "nico williams": "LW",
  "kylian mbappe": "LW",
  "ousmane dembele": "RW",
  "leroy sane": "RW",
  "bukayo saka": "RW",
  "phil foden": "RW",
  "heung min son": "LW",
  "mohamed salah": "RW",
  "luis diaz": "LW",
  "khvicha kvaratskhelia": "LW",
  "cristiano ronaldo": "ST",
  "harry kane": "ST",
  "erling haaland": "ST",
  "lautaro martinez": "ST",
  "julian alvarez": "ST",
  "robert lewandowski": "ST",
  "kai havertz": "ST",
  "deniz undav": "ST",
  "nick woltemade": "ST",
  "maximilian beier": "ST",
  "alvaro morata": "ST",
  "romelu lukaku": "ST",
  "darwin nunez": "ST",
  "luis suarez": "ST",
  "radamel falcao": "ST",
  "santiago gimenez": "ST"
};

const pitchFrame = document.querySelector(".pitch-frame");
const modeButtons = document.querySelectorAll(".mode-btn");
const countryFlag = document.getElementById("countryFlag");
const countryName = document.getElementById("countryName");
const countryRole = document.getElementById("countryRole");
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
let completedSlots = [];
let usedPlayers = [];
let score = 0;
let timeLeft = null;
let timerInterval = null;
let gameFinished = false;
let currentRoundIndex = 0;
let challengeIndex = 0;

async function loadGameData() {
  try {
    const res = await fetch(`${DATA_URL}?v=${Date.now()}`);

    if (!res.ok) {
      throw new Error(`No se pudo cargar ${DATA_URL}`);
    }

    GAME_DATA = await res.json();

    if (!Array.isArray(GAME_DATA.formations) || !Array.isArray(GAME_DATA.countries)) {
      throw new Error("El JSON no tiene formations o countries válidos.");
    }

    sanitizeGameData();
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

function sanitizeGameData() {
  GAME_DATA.countries = GAME_DATA.countries
    .filter(country => country && Array.isArray(country.players) && country.players.length > 0)
    .map(repairCountryPlayers);
}

function repairCountryPlayers(country) {
  const players = country.players
    .filter(player => player && player.name)
    .map(player => ({
      ...player,
      position: normalizePosition(player.position || "CM"),
      originalPosition: player.position || ""
    }));

  const uniquePositions = new Set(players.map(player => player.position).filter(Boolean));
  const hasEnoughShape = ["GK", "CB", "ST"].every(position => {
    return players.some(player => playerCanPlaySlot(player.position, position));
  });

  const looksBroken = players.length >= 8 && (uniquePositions.size <= 2 || !hasEnoughShape);

  const repairedPlayers = players.map((player, index) => {
    const inferred = inferPlayerPosition(player, index, looksBroken);

    return {
      ...player,
      position: inferred
    };
  });

  return {
    ...country,
    players: repairedPlayers
  };
}

function inferPlayerPosition(player, index, forceFallback = false) {
  const normalizedName = normalizeText(player.name);
  const override = PLAYER_POSITION_OVERRIDES[normalizedName];

  if (override) {
    return override;
  }

  const current = normalizePosition(player.position);

  if (!forceFallback && POSITION_COMPATIBILITY[current]) {
    return current;
  }

  return FALLBACK_POSITION_SEQUENCE[index % FALLBACK_POSITION_SEQUENCE.length];
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function normalizeCountryName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function countryNameIsInList(countryName, list) {
  const normalizedCountry = normalizeCountryName(countryName);
  return list.some(item => normalizeCountryName(item) === normalizedCountry);
}

function getCountryPools() {
  const availableCountries = GAME_DATA.countries.filter(country => {
    return Array.isArray(country.players) && country.players.length > 0;
  });

  const popularCountries = availableCountries.filter(country => {
    return countryNameIsInList(country.country, POPULAR_COUNTRIES);
  });

  const lessKnownCountries = availableCountries.filter(country => {
    return countryNameIsInList(country.country, LESS_KNOWN_COUNTRIES);
  });

  const otherCountries = availableCountries.filter(country => {
    const isPopular = countryNameIsInList(country.country, POPULAR_COUNTRIES);
    const isLessKnown = countryNameIsInList(country.country, LESS_KNOWN_COUNTRIES);
    return !isPopular && !isLessKnown;
  });

  return { availableCountries, popularCountries, lessKnownCountries, otherCountries };
}

function getLessKnownCountForMode() {
  if (currentMode === "hard") return 2;
  if (currentMode === "impossible") return 1;
  return 0;
}

function normalizePosition(position) {
  const pos = String(position || "").toUpperCase().trim();

  const aliases = {
    G: "GK",
    PORTERO: "GK",
    ARQUERO: "GK",
    GOALKEEPER: "GK",
    DEFENDER: "CB",
    DEFENSA: "CB",
    MIDFIELDER: "CM",
    MEDIOCAMPISTA: "CM",
    FORWARD: "ST",
    DELANTERO: "ST",
    ATTACKER: "ST",
    CF: "ST"
  };

  return aliases[pos] || pos;
}

function playerCanPlaySlot(playerPosition, slotPosition) {
  const playerPos = normalizePosition(playerPosition);
  const slotPos = normalizePosition(slotPosition);
  const compatibles = POSITION_COMPATIBILITY[slotPos] || [slotPos];
  return compatibles.includes(playerPos);
}

function countryHasCompatiblePlayer(country, position) {
  if (!country || !Array.isArray(country.players)) return false;
  return country.players.some(player => playerCanPlaySlot(player.position, position));
}

function buildCountriesForCurrentMode(positions, random) {
  const { availableCountries, popularCountries, lessKnownCountries, otherCountries } = getCountryPools();
  const totalSlots = positions.length;
  const lessKnownTarget = Math.min(getLessKnownCountForMode(), lessKnownCountries.length, totalSlots);
  const lessKnownIndexes = new Set(
    shuffleArray(Array.from({ length: totalSlots }, (_, index) => index), random).slice(0, lessKnownTarget)
  );

  const usedCountries = new Set();
  const selectedCountries = [];

  function countryAlreadyUsed(country) {
    return usedCountries.has(normalizeCountryName(country.country));
  }

  function canUseCountryForPosition(country, position) {
    return country && !countryAlreadyUsed(country) && countryHasCompatiblePlayer(country, position);
  }

  function pickCountryForPosition(position, pools) {
    for (const pool of pools) {
      const selected = shuffleArray(pool, random).find(country => canUseCountryForPosition(country, position));
      if (selected) return selected;
    }
    return null;
  }

  positions.forEach((position, index) => {
    const preferredPools = lessKnownIndexes.has(index)
      ? [lessKnownCountries, popularCountries, otherCountries, availableCountries]
      : [popularCountries, otherCountries, lessKnownCountries, availableCountries];

    const selectedCountry = pickCountryForPosition(position, preferredPools);

    if (!selectedCountry) {
      throw new Error(`No hay país disponible con jugador compatible para la posición ${position}.`);
    }

    usedCountries.add(normalizeCountryName(selectedCountry.country));
    selectedCountries.push(selectedCountry);
  });

  return selectedCountries;
}

function generateDailyGame() {
  const todayKey = getTodayKey();
  const seed = createSeedFromString(`partidos-hoy-worldcup11-${todayKey}-challenge-${challengeIndex}-mode-${currentMode}`);
  const random = seededRandom(seed);
  const { availableCountries } = getCountryPools();

  const validFormations = GAME_DATA.formations.filter(formation => {
    const flatPositions = formation.rows.flat();

    if (availableCountries.length < flatPositions.length) return false;

    return flatPositions.every(position => {
      return availableCountries.some(country => countryHasCompatiblePlayer(country, position));
    });
  });

  if (!validFormations.length) {
    throw new Error("No hay formaciones válidas: faltan países con jugadores compatibles para algunas posiciones.");
  }

  const formation = pickRandom(validFormations, random);
  const flatPositions = formation.rows.flat();
  const selectedCountries = buildCountriesForCurrentMode(flatPositions, random);

  const roundsInBoardOrder = selectedCountries.map((country, index) => {
    const position = flatPositions[index];
    const compatiblePlayers = country.players.filter(player => playerCanPlaySlot(player.position, position));

    return {
      country: country.country,
      flagCode: country.flagCode,
      dt: country.dt || "",
      position,
      players: shuffleArray(compatiblePlayers, random)
    };
  });

  return {
    date: todayKey,
    challengeNumber: challengeIndex + 1,
    formationName: formation.name,
    rows: formation.rows,
    positions: flatPositions,
    rounds: shuffleArray(roundsInBoardOrder, random)
  };
}

function getSlots() {
  return document.querySelectorAll(".position-slot");
}

function getLineRole(row, rowIndex, totalRows) {
  if (rowIndex === totalRows - 1 || row.includes("GK")) return "line-gk";
  if (row.some(position => ["CB", "LB", "RB", "LWB", "RWB"].includes(position))) return "line-defense";
  if (row.some(position => ["CDM", "CM", "LM", "RM"].includes(position))) return "line-mid";
  if (row.some(position => ["CAM"].includes(position))) return "line-mid-advanced";
  if (row.some(position => ["LW", "RW", "ST"].includes(position))) return "line-attack";
  return `line-${rowIndex}`;
}

function renderFormation() {
  pitchFrame.innerHTML = "";
  let slotIndex = 0;
  const totalRows = DAILY_GAME.rows.length;

  DAILY_GAME.rows.forEach((row, rowIndex) => {
    const line = document.createElement("div");
    line.className = [
      "line",
      "dynamic-line",
      `line-${rowIndex}`,
      `line-count-${row.length}`,
      getLineRole(row, rowIndex, totalRows)
    ].join(" ");

    row.forEach(position => {
      const button = document.createElement("button");
      button.className = "position-slot";
      button.type = "button";
      button.dataset.position = position;
      button.dataset.index = slotIndex;
      button.textContent = position;
      button.disabled = true;
      button.onclick = null;
      line.appendChild(button);
      slotIndex++;
    });

    pitchFrame.appendChild(line);
  });
}

function initGame() {
  stopTimer();
  DAILY_GAME = generateDailyGame();
  completedSlots = [];
  usedPlayers = [];
  score = 0;
  gameFinished = false;
  currentRoundIndex = 0;

  resultModal.classList.add("hidden");
  hideFinalButtons();
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
    slot.disabled = true;
    slot.innerHTML = position;
    slot.onclick = null;
  });

  applyModeUi();
  updateCountryPanel();
  startTimerIfNeeded();
  updateStatus();
}

function applyModeUi() {
  const mode = GAME_MODES[currentMode];
  modeText.textContent = mode.label;
  modeHint.textContent = `${mode.help} Desafío #${DAILY_GAME.challengeNumber} · Formación: ${DAILY_GAME.formationName}`;

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

function getCurrentRound() {
  return DAILY_GAME.rounds[currentRoundIndex];
}

function getActivePositionForRound() {
  const round = getCurrentRound();
  return round?.position || DAILY_GAME.positions[currentRoundIndex] || "";
}

function findSlotForActivePosition(position) {
  if (!position) return null;
  const freeSlots = Array.from(getSlots()).filter(slot => !slot.classList.contains("filled"));
  return freeSlots.find(slot => normalizePosition(slot.dataset.position) === normalizePosition(position)) || null;
}

function updateCountryPanel() {
  const round = getCurrentRound();

  if (!round) {
    countryFlag.src = "https://flagcdn.com/w160/un.png";
    countryFlag.srcset = "";
    countryFlag.alt = "Desafío finalizado";
    countryName.textContent = "Desafío finalizado";
    if (countryRole) countryRole.textContent = "Sin posición";
    return;
  }

  const positionToShow = getActivePositionForRound();
  countryFlag.src = `https://flagcdn.com/w160/${round.flagCode}.png`;
  countryFlag.srcset = `https://flagcdn.com/w80/${round.flagCode}.png 1x, https://flagcdn.com/w160/${round.flagCode}.png 2x, https://flagcdn.com/w320/${round.flagCode}.png 3x`;
  countryFlag.alt = `Bandera de ${round.country}`;
  countryName.textContent = round.country;

  if (countryRole) {
    countryRole.textContent = positionToShow ? `${positionToShow} · ${getPositionLabel(positionToShow)}` : "Sin posición";
  }

  playerSearch.placeholder = positionToShow
    ? `Jugador de ${round.country} para ${positionToShow}...`
    : `Jugador de ${round.country}...`;
}

function selectSlot() {
  return;
}

function getPositionLabel(position) {
  const labels = {
    GK: "Arquero",
    RB: "Lateral derecho",
    CB: "Defensor central",
    LB: "Lateral izquierdo",
    LWB: "Carrilero izquierdo",
    RWB: "Carrilero derecho",
    CDM: "Mediocampista defensivo",
    CM: "Mediocampista",
    CAM: "Mediapunta",
    LM: "Volante izquierdo",
    RM: "Volante derecho",
    LW: "Extremo izquierdo",
    RW: "Extremo derecho",
    ST: "Delantero"
  };
  return labels[position] || "Jugador";
}

function getPlayerNameParts(playerName) {
  return normalizeText(playerName).split(" ").filter(Boolean);
}

function getPlayerAliases(player) {
  return Array.isArray(player.aliases) ? player.aliases.map(normalizeText).filter(Boolean) : [];
}

function playerMatchesSearch(player, value) {
  const cleanValue = normalizeText(value);
  const fullName = normalizeText(player.name);
  const nameParts = getPlayerNameParts(player.name);
  const aliases = getPlayerAliases(player);
  return fullName.includes(cleanValue) || nameParts.some(part => part.includes(cleanValue)) || aliases.some(alias => alias.includes(cleanValue) || cleanValue.includes(alias));
}

function isStrongPlayerMatch(player, value) {
  const cleanValue = normalizeText(value);
  if (cleanValue.length < 4) return false;

  const fullName = normalizeText(player.name);
  const nameParts = getPlayerNameParts(player.name);
  const aliases = getPlayerAliases(player);

  return fullName === cleanValue || nameParts.includes(cleanValue) || aliases.includes(cleanValue);
}

function renderSuggestions(query) {
  const mode = GAME_MODES[currentMode];
  if (!mode.showHints) {
    suggestions.innerHTML = "";
    return;
  }

  suggestions.innerHTML = "";
  const round = getCurrentRound();
  if (!round) return;

  const value = normalizeText(query);
  const activePosition = getActivePositionForRound();
  const filtered = round.players.filter(player => {
    if (usedPlayers.includes(player.name)) return false;
    if (activePosition && !playerCanPlaySlot(player.position, activePosition)) return false;
    if (!value) return true;
    return playerMatchesSearch(player, value);
  });

  if (!filtered.length) {
    suggestions.innerHTML = `
      <button class="suggestion-item" type="button">
        <strong>No encontré ese jugador</strong>
        <span>Debe ser de ${round.country} y servir para ${activePosition}</span>
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
        <span>${round.country} · ${player.position}</span>
      </div>
      <span>Elegir</span>
    `;

    button.onclick = () => {
      const autoSlot = findSlotForActivePosition(activePosition);
      if (!autoSlot) {
        showTemporaryPlaceholder("No hay casillero disponible para esta posición");
        return;
      }
      placePlayer(player, autoSlot);
    };

    suggestions.appendChild(button);
  });
}

function placePlayer(player, forcedSlot = null) {
  if (gameFinished) return;
  const round = getCurrentRound();
  if (!round) return;

  const activePosition = getActivePositionForRound();
  const targetSlot = forcedSlot || findSlotForActivePosition(activePosition);

  if (!targetSlot) {
    showTemporaryPlaceholder("No hay casillero disponible para esta posición");
    return;
  }

  const slotPosition = targetSlot.dataset.position;
  if (!playerCanPlaySlot(player.position, slotPosition)) {
    showTemporaryPlaceholder(`${player.name} no puede jugar de ${slotPosition}`);
    return;
  }

  if (usedPlayers.includes(player.name)) {
    alert("Ese jugador ya fue usado.");
    return;
  }

  targetSlot.classList.add("filled");
  targetSlot.classList.remove("selected");
  targetSlot.innerHTML = `
    <span class="slot-flag">
      <img src="https://flagcdn.com/w160/${round.flagCode}.png" srcset="https://flagcdn.com/w80/${round.flagCode}.png 1x, https://flagcdn.com/w160/${round.flagCode}.png 2x, https://flagcdn.com/w320/${round.flagCode}.png 3x" alt="${round.country}" loading="lazy">
    </span>
    <span class="slot-player">${player.name}</span>
    <span class="slot-country">${round.country}</span>
  `;

  completedSlots.push(Number(targetSlot.dataset.index));
  usedPlayers.push(player.name);
  score += calculatePoints();
  currentRoundIndex++;
  playerSearch.value = "";
  suggestions.innerHTML = "";
  updateStatus();

  if (completedSlots.length === DAILY_GAME.positions.length) {
    finishGame("complete");
    return;
  }

  updateCountryPanel();
  renderSuggestions("");
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
  const value = normalizeText(playerSearch.value);
  const activePosition = getActivePositionForRound();
  if (!round) return;

  if (!value) {
    renderSuggestions("");
    return;
  }

  if (value.length < 4) {
    if (GAME_MODES[currentMode].showHints) {
      renderSuggestions(playerSearch.value);
    } else {
      showTemporaryPlaceholder("Escribí al menos 4 letras del jugador");
    }
    return;
  }

  const matches = round.players.filter(player => {
    if (usedPlayers.includes(player.name)) return false;
    if (activePosition && !playerCanPlaySlot(player.position, activePosition)) return false;
    return playerMatchesSearch(player, value);
  });

  if (!matches.length) {
    if (GAME_MODES[currentMode].showHints) {
      renderSuggestions(playerSearch.value);
    } else {
      showTemporaryPlaceholder(`No coincide con ${round.country} / ${activePosition}`);
    }
    return;
  }

  const strongMatches = matches.filter(player => isStrongPlayerMatch(player, value));

  if (strongMatches.length === 1) {
    const autoSlot = findSlotForActivePosition(activePosition);
    if (!autoSlot) {
      showTemporaryPlaceholder("No hay casillero disponible para esta posición");
      return;
    }
    placePlayer(strongMatches[0], autoSlot);
    return;
  }

  if (strongMatches.length > 1) {
    if (GAME_MODES[currentMode].showHints) {
      renderSuggestions(playerSearch.value);
    } else {
      showTemporaryPlaceholder("Hay más de una coincidencia. Escribí mejor el nombre.");
    }
    return;
  }

  if (GAME_MODES[currentMode].showHints) {
    renderSuggestions(playerSearch.value);
  } else {
    showTemporaryPlaceholder("Escribí el nombre más completo del jugador");
  }
}

function showTemporaryPlaceholder(message) {
  const original = playerSearch.placeholder;
  playerSearch.value = "";
  playerSearch.placeholder = message;

  setTimeout(() => {
    if (!gameFinished) {
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
    challengeIndex++;
    initGame();
  };

  actions.appendChild(nextBtn);
  return nextBtn;
}

function showFinalButtons() {
  const nextBtn = getOrCreateNextChallengeButton();
  if (nextBtn) {
    nextBtn.classList.remove("hidden");
    nextBtn.style.display = "inline-flex";
  }

  if (backToGamesBtn) {
    backToGamesBtn.classList.remove("hidden");
    backToGamesBtn.style.display = "inline-flex";
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
  if (!modal) {
    currentMode = nextMode;
    initGame();
    return;
  }

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
      challengeIndex++;
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
  const text = `Armé mi 11 en Partidos.Hoy ⚽\nDesafío: #${DAILY_GAME.challengeNumber}\nModo: ${GAME_MODES[currentMode].label}\nFormación: ${DAILY_GAME.formationName}\nPuntaje: ${score}`;

  if (navigator.share) {
    await navigator.share({ title: "Armá tu 11 Mundial", text });
  } else {
    await navigator.clipboard.writeText(text);
    alert("Resultado copiado al portapapeles");
  }
});

helpBtn.addEventListener("click", () => {
  alert("Cada ronda tiene una posición fija. Escribí un jugador del país indicado que pueda jugar en esa posición. El juego lo coloca automáticamente en el casillero correcto. Al terminar, podés jugar otro desafío con nueva formación y países rotados.");
});

loadGameData();
