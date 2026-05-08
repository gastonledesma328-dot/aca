const DAILY_GAME = {
  formationName: "3-5-2",
  slots: [
    {
      id: 0,
      position: "ST",
      country: "Noruega",
      flag: "🇳🇴",
      players: [
        { name: "Erling Haaland", club: "Manchester City" },
        { name: "Alexander Sørloth", club: "Atlético Madrid" }
      ]
    },
    {
      id: 1,
      position: "ST",
      country: "Inglaterra",
      flag: "🏴",
      players: [
        { name: "Harry Kane", club: "Bayern Munich" },
        { name: "Ollie Watkins", club: "Aston Villa" }
      ]
    },
    {
      id: 2,
      position: "CAM",
      country: "Portugal",
      flag: "🇵🇹",
      players: [
        { name: "Bruno Fernandes", club: "Manchester United" },
        { name: "Bernardo Silva", club: "Manchester City" }
      ]
    },
    {
      id: 3,
      position: "LM",
      country: "Japón",
      flag: "🇯🇵",
      players: [
        { name: "Kaoru Mitoma", club: "Brighton" },
        { name: "Takefusa Kubo", club: "Real Sociedad" }
      ]
    },
    {
      id: 4,
      position: "CDM",
      country: "España",
      flag: "🇪🇸",
      players: [
        { name: "Rodri", club: "Manchester City" },
        { name: "Martín Zubimendi", club: "Real Sociedad" }
      ]
    },
    {
      id: 5,
      position: "CDM",
      country: "Uruguay",
      flag: "🇺🇾",
      players: [
        { name: "Federico Valverde", club: "Real Madrid" },
        { name: "Manuel Ugarte", club: "Manchester United" }
      ]
    },
    {
      id: 6,
      position: "RM",
      country: "Alemania",
      flag: "🇩🇪",
      players: [
        { name: "Leroy Sané", club: "Galatasaray" },
        { name: "Serge Gnabry", club: "Bayern Munich" }
      ]
    },
    {
      id: 7,
      position: "CB",
      country: "Argentina",
      flag: "🇦🇷",
      players: [
        { name: "Cristian Romero", club: "Tottenham" },
        { name: "Nicolás Otamendi", club: "Benfica" }
      ]
    },
    {
      id: 8,
      position: "CB",
      country: "Brasil",
      flag: "🇧🇷",
      players: [
        { name: "Marquinhos", club: "PSG" },
        { name: "Gabriel Magalhães", club: "Arsenal" }
      ]
    },
    {
      id: 9,
      position: "CB",
      country: "Francia",
      flag: "🇫🇷",
      players: [
        { name: "William Saliba", club: "Arsenal" },
        { name: "Ibrahima Konaté", club: "Liverpool" }
      ]
    },
    {
      id: 10,
      position: "GK",
      country: "Italia",
      flag: "🇮🇹",
      players: [
        { name: "Gianluigi Donnarumma", club: "PSG" },
        { name: "Guglielmo Vicario", club: "Tottenham" }
      ]
    }
  ]
};

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

const slots = document.querySelectorAll(".position-slot");
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

let currentMode = "easy";
let selectedSlot = null;
let completedSlots = [];
let usedPlayers = [];
let score = 0;
let timeLeft = null;
let timerInterval = null;
let gameFinished = false;

function initGame() {
  stopTimer();

  selectedSlot = null;
  completedSlots = [];
  usedPlayers = [];
  score = 0;
  gameFinished = false;

  resultModal.classList.add("hidden");
  playerSearch.value = "";
  suggestions.innerHTML = "";

  slots.forEach((slot, index) => {
    const data = DAILY_GAME.slots[index];

    slot.dataset.index = index;
    slot.dataset.position = data.position;
    slot.dataset.country = data.country;
    slot.dataset.flag = data.flag;

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
  modeHint.textContent = mode.help;

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

  slots.forEach(item => item.classList.remove("selected"));

  selectedSlot = slot;
  selectedSlot.classList.add("selected");

  const data = getSlotData(slot);

  countryFlag.textContent = data.flag;
  countryName.textContent = data.country;

  playerSearch.value = "";
  playerSearch.placeholder = `Jugador de ${data.country} para ${data.position}...`;
  playerSearch.focus();

  renderSuggestions("");
}

function selectNextEmptySlot() {
  const next = Array.from(slots).find(slot => {
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
        <span>${data.flag} ${data.country} · ${data.position} · ${player.club}</span>
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
  resultText.textContent = `Completaste el 11 en modo ${GAME_MODES[currentMode].label}. Puntaje final: ${score}.`;
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
  const text = `Armé mi 11 en Partidos.Hoy ⚽\nModo: ${GAME_MODES[currentMode].label}\nFormación: ${DAILY_GAME.formationName}\nPuntaje: ${score}`;

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
  alert("Cada posición tiene un país indicado abajo. Escribí un jugador válido para ese país y esa posición. En modo fácil hay ayudas. En normal, difícil e imposible no hay ayudas.");
});

initGame();
