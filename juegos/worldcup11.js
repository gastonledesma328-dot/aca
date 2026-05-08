const FORMATIONS = [
  {
    name: "3-5-2",
    rows: [
      ["ST", "ST"],
      ["CAM"],
      ["LM", "CDM", "CDM", "RM"],
      ["CB", "CB", "CB"],
      ["GK"]
    ]
  },
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
  }
];

const PLAYER_POOL = [
  {
    country: "Argentina",
    flagCode: "ar",
    players: [
      { name: "Emiliano Martínez", position: "GK", club: "Aston Villa" },
      { name: "Cristian Romero", position: "CB", club: "Tottenham" },
      { name: "Nicolás Otamendi", position: "CB", club: "Benfica" },
      { name: "Nahuel Molina", position: "RB", club: "Atlético Madrid" },
      { name: "Nicolás Tagliafico", position: "LB", club: "Lyon" },
      { name: "Rodrigo De Paul", position: "CM", club: "Inter Miami" },
      { name: "Enzo Fernández", position: "CM", club: "Chelsea" },
      { name: "Alexis Mac Allister", position: "CM", club: "Liverpool" },
      { name: "Lionel Messi", position: "RW", club: "Inter Miami" },
      { name: "Lautaro Martínez", position: "ST", club: "Inter" },
      { name: "Julián Álvarez", position: "ST", club: "Atlético Madrid" }
    ]
  },
  {
    country: "Brasil",
    flagCode: "br",
    players: [
      { name: "Alisson", position: "GK", club: "Liverpool" },
      { name: "Ederson", position: "GK", club: "Manchester City" },
      { name: "Marquinhos", position: "CB", club: "PSG" },
      { name: "Gabriel Magalhães", position: "CB", club: "Arsenal" },
      { name: "Danilo", position: "RB", club: "Flamengo" },
      { name: "Guilherme Arana", position: "LB", club: "Atlético Mineiro" },
      { name: "Casemiro", position: "CDM", club: "Manchester United" },
      { name: "Bruno Guimarães", position: "CM", club: "Newcastle" },
      { name: "Lucas Paquetá", position: "CAM", club: "West Ham" },
      { name: "Vinícius Jr", position: "LW", club: "Real Madrid" },
      { name: "Rodrygo", position: "RW", club: "Real Madrid" },
      { name: "Richarlison", position: "ST", club: "Tottenham" }
    ]
  },
  {
    country: "Francia",
    flagCode: "fr",
    players: [
      { name: "Mike Maignan", position: "GK", club: "AC Milan" },
      { name: "William Saliba", position: "CB", club: "Arsenal" },
      { name: "Ibrahima Konaté", position: "CB", club: "Liverpool" },
      { name: "Jules Koundé", position: "RB", club: "Barcelona" },
      { name: "Theo Hernández", position: "LB", club: "AC Milan" },
      { name: "Aurélien Tchouaméni", position: "CDM", club: "Real Madrid" },
      { name: "Eduardo Camavinga", position: "CM", club: "Real Madrid" },
      { name: "Antoine Griezmann", position: "CAM", club: "Atlético Madrid" },
      { name: "Kylian Mbappé", position: "LW", club: "Real Madrid" },
      { name: "Ousmane Dembélé", position: "RW", club: "PSG" },
      { name: "Marcus Thuram", position: "ST", club: "Inter" }
    ]
  },
  {
    country: "España",
    flagCode: "es",
    players: [
      { name: "Unai Simón", position: "GK", club: "Athletic Club" },
      { name: "Dani Carvajal", position: "RB", club: "Real Madrid" },
      { name: "Aymeric Laporte", position: "CB", club: "Al Nassr" },
      { name: "Pau Cubarsí", position: "CB", club: "Barcelona" },
      { name: "Alejandro Grimaldo", position: "LB", club: "Bayer Leverkusen" },
      { name: "Rodri", position: "CDM", club: "Manchester City" },
      { name: "Pedri", position: "CM", club: "Barcelona" },
      { name: "Fabián Ruiz", position: "CM", club: "PSG" },
      { name: "Dani Olmo", position: "CAM", club: "Barcelona" },
      { name: "Nico Williams", position: "LW", club: "Athletic Club" },
      { name: "Lamine Yamal", position: "RW", club: "Barcelona" },
      { name: "Álvaro Morata", position: "ST", club: "Galatasaray" }
    ]
  },
  {
    country: "Alemania",
    flagCode: "de",
    players: [
      { name: "Manuel Neuer", position: "GK", club: "Bayern Munich" },
      { name: "Antonio Rüdiger", position: "CB", club: "Real Madrid" },
      { name: "Jonathan Tah", position: "CB", club: "Bayern Munich" },
      { name: "Joshua Kimmich", position: "RB", club: "Bayern Munich" },
      { name: "David Raum", position: "LB", club: "RB Leipzig" },
      { name: "Leon Goretzka", position: "CM", club: "Bayern Munich" },
      { name: "Florian Wirtz", position: "CAM", club: "Liverpool" },
      { name: "Jamal Musiala", position: "CAM", club: "Bayern Munich" },
      { name: "Leroy Sané", position: "RM", club: "Galatasaray" },
      { name: "Serge Gnabry", position: "RW", club: "Bayern Munich" },
      { name: "Kai Havertz", position: "ST", club: "Arsenal" }
    ]
  },
  {
    country: "Portugal",
    flagCode: "pt",
    players: [
      { name: "Diogo Costa", position: "GK", club: "Porto" },
      { name: "Rúben Dias", position: "CB", club: "Manchester City" },
      { name: "António Silva", position: "CB", club: "Benfica" },
      { name: "João Cancelo", position: "RB", club: "Al Hilal" },
      { name: "Nuno Mendes", position: "LB", club: "PSG" },
      { name: "Vitinha", position: "CM", club: "PSG" },
      { name: "Bruno Fernandes", position: "CAM", club: "Manchester United" },
      { name: "Bernardo Silva", position: "RM", club: "Manchester City" },
      { name: "Rafael Leão", position: "LW", club: "AC Milan" },
      { name: "Pedro Neto", position: "RW", club: "Chelsea" },
      { name: "Cristiano Ronaldo", position: "ST", club: "Al Nassr" }
    ]
  },
  {
    country: "Japón",
    flagCode: "jp",
    players: [
      { name: "Zion Suzuki", position: "GK", club: "Parma" },
      { name: "Ko Itakura", position: "CB", club: "Ajax" },
      { name: "Takehiro Tomiyasu", position: "CB", club: "Arsenal" },
      { name: "Hiroki Ito", position: "CB", club: "Bayern Munich" },
      { name: "Wataru Endo", position: "CDM", club: "Liverpool" },
      { name: "Ao Tanaka", position: "CM", club: "Leeds United" },
      { name: "Daichi Kamada", position: "CAM", club: "Crystal Palace" },
      { name: "Takefusa Kubo", position: "RW", club: "Real Sociedad" },
      { name: "Kaoru Mitoma", position: "LM", club: "Brighton" },
      { name: "Ritsu Doan", position: "RM", club: "Freiburg" },
      { name: "Ayase Ueda", position: "ST", club: "Feyenoord" }
    ]
  },
  {
    country: "Uruguay",
    flagCode: "uy",
    players: [
      { name: "Sergio Rochet", position: "GK", club: "Internacional" },
      { name: "José María Giménez", position: "CB", club: "Atlético Madrid" },
      { name: "Ronald Araújo", position: "CB", club: "Barcelona" },
      { name: "Mathías Olivera", position: "LB", club: "Napoli" },
      { name: "Manuel Ugarte", position: "CDM", club: "Manchester United" },
      { name: "Federico Valverde", position: "CM", club: "Real Madrid" },
      { name: "Rodrigo Bentancur", position: "CM", club: "Tottenham" },
      { name: "Giorgian De Arrascaeta", position: "CAM", club: "Flamengo" },
      { name: "Facundo Pellistri", position: "RW", club: "Panathinaikos" },
      { name: "Darwin Núñez", position: "ST", club: "Liverpool" },
      { name: "Luis Suárez", position: "ST", club: "Inter Miami" }
    ]
  },
  {
    country: "Inglaterra",
    flagCode: "gb-eng",
    players: [
      { name: "Jordan Pickford", position: "GK", club: "Everton" },
      { name: "John Stones", position: "CB", club: "Manchester City" },
      { name: "Marc Guéhi", position: "CB", club: "Crystal Palace" },
      { name: "Kyle Walker", position: "RB", club: "Burnley" },
      { name: "Luke Shaw", position: "LB", club: "Manchester United" },
      { name: "Declan Rice", position: "CDM", club: "Arsenal" },
      { name: "Jude Bellingham", position: "CAM", club: "Real Madrid" },
      { name: "Phil Foden", position: "CAM", club: "Manchester City" },
      { name: "Bukayo Saka", position: "RW", club: "Arsenal" },
      { name: "Anthony Gordon", position: "LW", club: "Newcastle" },
      { name: "Harry Kane", position: "ST", club: "Bayern Munich" }
    ]
  },
  {
    country: "Noruega",
    flagCode: "no",
    players: [
      { name: "Ørjan Nyland", position: "GK", club: "Sevilla" },
      { name: "Leo Østigård", position: "CB", club: "Rennes" },
      { name: "Julian Ryerson", position: "RB", club: "Borussia Dortmund" },
      { name: "Sander Berge", position: "CM", club: "Fulham" },
      { name: "Martin Ødegaard", position: "CAM", club: "Arsenal" },
      { name: "Antonio Nusa", position: "LW", club: "RB Leipzig" },
      { name: "Oscar Bobb", position: "RW", club: "Manchester City" },
      { name: "Erling Haaland", position: "ST", club: "Manchester City" },
      { name: "Alexander Sørloth", position: "ST", club: "Atlético Madrid" }
    ]
  },
  {
    country: "Italia",
    flagCode: "it",
    players: [
      { name: "Gianluigi Donnarumma", position: "GK", club: "PSG" },
      { name: "Guglielmo Vicario", position: "GK", club: "Tottenham" },
      { name: "Alessandro Bastoni", position: "CB", club: "Inter" },
      { name: "Riccardo Calafiori", position: "CB", club: "Arsenal" },
      { name: "Federico Dimarco", position: "LB", club: "Inter" },
      { name: "Giovanni Di Lorenzo", position: "RB", club: "Napoli" },
      { name: "Nicolò Barella", position: "CM", club: "Inter" },
      { name: "Sandro Tonali", position: "CM", club: "Newcastle" },
      { name: "Federico Chiesa", position: "LW", club: "Liverpool" },
      { name: "Domenico Berardi", position: "RW", club: "Sassuolo" },
      { name: "Moise Kean", position: "ST", club: "Fiorentina" }
    ]
  }
];

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

let DAILY_GAME = null;
let currentMode = "easy";
let selectedSlot = null;
let completedSlots = [];
let usedPlayers = [];
let score = 0;
let timeLeft = null;
let timerInterval = null;
let gameFinished = false;

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

function getPlayersByPosition(countryData, position) {
  return countryData.players.filter(player => player.position === position);
}

function getValidCountriesForPosition(position) {
  return PLAYER_POOL.filter(countryData => {
    return getPlayersByPosition(countryData, position).length > 0;
  });
}

function generateDailyGame() {
  const todayKey = getTodayKey();
  const seed = createSeedFromString(`partidos-hoy-worldcup11-${todayKey}`);
  const random = seededRandom(seed);

  const formation = pickRandom(FORMATIONS, random);

  const flatPositions = formation.rows.flat();
  const usedCountries = new Set();

  const slots = flatPositions.map((position, index) => {
    let validCountries = getValidCountriesForPosition(position);

    const unusedCountries = validCountries.filter(countryData => {
      return !usedCountries.has(countryData.country);
    });

    if (unusedCountries.length > 0) {
      validCountries = unusedCountries;
    }

    const countryData = pickRandom(validCountries, random);
    usedCountries.add(countryData.country);

    const possiblePlayers = shuffleArray(
      getPlayersByPosition(countryData, position),
      random
    );

    return {
      id: index,
      position,
      country: countryData.country,
      flagCode: countryData.flagCode,
      players: possiblePlayers
    };
  });

  return {
    date: todayKey,
    formationName: formation.name,
    rows: formation.rows,
    slots
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

  resultModal.classList.add("hidden");
  playerSearch.value = "";
  suggestions.innerHTML = "";

  renderFormation();

  const slots = getSlots();

  slots.forEach((slot, index) => {
    const data = DAILY_GAME.slots[index];

    slot.dataset.index = index;
    slot.dataset.position = data.position;
    slot.dataset.country = data.country;
    slot.dataset.flagCode = data.flagCode;

    slot.classList.remove("filled", "selected");
    slot.innerHTML = data.position;

    slot.onclick = () => {
      selectSlot(slot);
    };
  });

  applyModeUi();
  selectNextEmptySlot();
  startTimerIfNeeded();
  updateStatus();
}

function applyModeUi() {
  const mode = GAME_MODES[currentMode];

  modeText.textContent = mode.label;
  modeHint.textContent = `${mode.help} Desafío diario: ${DAILY_GAME.date} · Formación: ${DAILY_GAME.formationName}`;

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

function selectSlot(slot) {
  if (gameFinished) return;
  if (slot.classList.contains("filled")) return;

  getSlots().forEach(item => item.classList.remove("selected"));

  selectedSlot = slot;
  selectedSlot.classList.add("selected");

  const data = getSlotData(slot);

  countryFlag.src = `https://flagcdn.com/w40/${data.flagCode}.png`;
  countryFlag.alt = `Bandera de ${data.country}`;
  countryName.textContent = data.country;

  playerSearch.value = "";
  playerSearch.placeholder = `Jugador de ${data.country} para ${data.position}...`;
  playerSearch.focus();

  renderSuggestions("");
}

function selectNextEmptySlot() {
  const next = Array.from(getSlots()).find(slot => {
    return !slot.classList.contains("filled");
  });

  if (next) {
    selectSlot(next);
  }
}

function getSlotData(slot) {
  const index = Number(slot.dataset.index);
  return DAILY_GAME.slots[index];
}

function renderSuggestions(query) {
  const mode = GAME_MODES[currentMode];

  if (!mode.showHints) {
    suggestions.innerHTML = "";
    return;
  }

  suggestions.innerHTML = "";

  if (!selectedSlot) return;

  const data = getSlotData(selectedSlot);
  const value = normalizeText(query);

  const filtered = data.players.filter(player => {
    if (usedPlayers.includes(player.name)) return false;

    if (!value) return true;

    const text = normalizeText(`${player.name} ${player.club}`);
    return text.includes(value);
  });

  if (!filtered.length) {
    suggestions.innerHTML = `
      <button class="suggestion-item" type="button">
        <strong>No encontré ese jugador</strong>
        <span>Debe coincidir con ${data.country} y ${data.position}</span>
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
        <span>${data.country} · ${data.position} · ${player.club}</span>
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
  if (!selectedSlot) return;

  const data = getSlotData(selectedSlot);

  if (usedPlayers.includes(player.name)) {
    alert("Ese jugador ya fue usado.");
    return;
  }

  selectedSlot.classList.add("filled");
  selectedSlot.classList.remove("selected");

  selectedSlot.innerHTML = `
    ${player.name}
    <small>${data.position}</small>
  `;

  completedSlots.push(data.id);
  usedPlayers.push(player.name);
  score += calculatePoints();

  selectedSlot = null;
  playerSearch.value = "";
  suggestions.innerHTML = "";

  updateStatus();

  if (completedSlots.length === DAILY_GAME.slots.length) {
    finishGame("complete");
    return;
  }

  selectNextEmptySlot();
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

  if (!selectedSlot) {
    selectNextEmptySlot();
    return;
  }

  const data = getSlotData(selectedSlot);
  const value = normalizeText(playerSearch.value);

  if (!value) {
    renderSuggestions("");
    return;
  }

  const matches = data.players.filter(player => {
    if (usedPlayers.includes(player.name)) return false;

    const fullName = normalizeText(player.name);
    const lastName = normalizeText(player.name.split(" ").pop());
    const club = normalizeText(player.club);

    return (
      fullName.includes(value) ||
      lastName.includes(value) ||
      club.includes(value)
    );
  });

  if (!matches.length) {
    if (GAME_MODES[currentMode].showHints) {
      renderSuggestions(playerSearch.value);
    } else {
      showTemporaryPlaceholder(`No coincide con ${data.country} / ${data.position}`);
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
    if (!gameFinished && selectedSlot) {
      const data = getSlotData(selectedSlot);
      playerSearch.placeholder = `Jugador de ${data.country} para ${data.position}...`;
    } else {
      playerSearch.placeholder = original;
    }
  }, 1400);
}

function updateStatus() {
  completedText.textContent = `${completedSlots.length}/${DAILY_GAME.slots.length}`;
  scoreText.textContent = score;
}

function finishGame(reason) {
  if (gameFinished) return;

  gameFinished = true;
  stopTimer();

  resultModal.classList.remove("hidden");

  if (reason === "surrender") {
    resultTitle.textContent = "Te rendiste";
    resultText.textContent = `Completaste ${completedSlots.length} de ${DAILY_GAME.slots.length} posiciones. Puntaje final: ${score}.`;
    return;
  }

  if (reason === "time") {
    resultTitle.textContent = "Se terminó el tiempo";
    resultText.textContent = `Completaste ${completedSlots.length} de ${DAILY_GAME.slots.length} posiciones en modo ${GAME_MODES[currentMode].label}. Puntaje final: ${score}.`;
    return;
  }

  resultTitle.textContent = "Equipo completado";
  resultText.textContent = `Completaste el 11 en modo ${GAME_MODES[currentMode].label}. Formación ${DAILY_GAME.formationName}. Puntaje final: ${score}.`;
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
  initGame();
});

helpBtn.addEventListener("click", () => {
  alert("Cada día se genera una formación distinta con países y jugadores distintos. En modo fácil hay ayudas. En normal, difícil e imposible no hay ayudas.");
});

initGame();
