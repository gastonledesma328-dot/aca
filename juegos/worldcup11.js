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

const slots = document.querySelectorAll(".position-slot");
const countryFlag = document.getElementById("countryFlag");
const countryName = document.getElementById("countryName");
const playerForm = document.getElementById("playerForm");
const playerSearch = document.getElementById("playerSearch");
const suggestions = document.getElementById("suggestions");
const surrenderBtn = document.getElementById("surrenderBtn");
const helpBtn = document.getElementById("helpBtn");
const completedText = document.getElementById("completedText");
const scoreText = document.getElementById("scoreText");
const formationText = document.getElementById("formationText");
const resultModal = document.getElementById("resultModal");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const shareBtn = document.getElementById("shareBtn");
const restartBtn = document.getElementById("restartBtn");

let selectedSlot = null;
let completedSlots = [];
let usedPlayers = [];
let score = 0;

function initGame() {
  selectedSlot = null;
  completedSlots = [];
  usedPlayers = [];
  score = 0;

  formationText.textContent = DAILY_GAME.formationName;
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
    slot.innerHTML = `
      ${data.position}
      <small>${data.flag} ${data.country}</small>
    `;

    slot.onclick = () => {
      selectSlot(slot);
    };
  });

  selectNextEmptySlot();
  updateStatus();
}

function selectSlot(slot) {
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
  suggestions.innerHTML = "";

  if (!selectedSlot) return;

  const data = getSlotData(selectedSlot);
  const value = normalizeText(query);

  let filtered = data.players.filter(player => {
    if (usedPlayers.includes(player.name)) return false;

    if (!value) return true;

    const text = normalizeText(`${player.name} ${player.club}`);
    return text.includes(value);
  });

  if (!filtered.length) {
    suggestions.innerHTML = `
      <button class="suggestion-item" type="button">
        <strong>No encontré ese jugador</strong>
        <span>Debe ser de ${data.country} y jugar como ${data.position}</span>
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
    <small>${data.flag} ${data.country} · ${data.position}</small>
  `;

  completedSlots.push(data.id);
  usedPlayers.push(player.name);
  score += 100;

  selectedSlot = null;
  playerSearch.value = "";
  suggestions.innerHTML = "";

  updateStatus();

  if (completedSlots.length === DAILY_GAME.slots.length) {
    finishGame(false);
    return;
  }

  selectNextEmptySlot();
}

function trySubmitSearch() {
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
    renderSuggestions(playerSearch.value);
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

  renderSuggestions(playerSearch.value);
}

function updateStatus() {
  completedText.textContent = `${completedSlots.length}/${DAILY_GAME.slots.length}`;
  scoreText.textContent = score;
}

function finishGame(bySurrender) {
  resultModal.classList.remove("hidden");

  if (bySurrender) {
    resultTitle.textContent = "Te rendiste";
    resultText.textContent = `Completaste ${completedSlots.length} de ${DAILY_GAME.slots.length} posiciones. Puntaje final: ${score}.`;
  } else {
    resultTitle.textContent = "Equipo completado";
    resultText.textContent = `Completaste el 11 con la formación ${DAILY_GAME.formationName}. Puntaje final: ${score}.`;
  }
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

playerSearch.addEventListener("input", () => {
  renderSuggestions(playerSearch.value);
});

playerForm.addEventListener("submit", event => {
  event.preventDefault();
  trySubmitSearch();
});

surrenderBtn.addEventListener("click", () => {
  finishGame(true);
});

shareBtn.addEventListener("click", async () => {
  const text = `Armé mi 11 en Partidos.Hoy ⚽\nFormación: ${DAILY_GAME.formationName}\nPuntaje: ${score}`;

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
  alert("Cada posición tiene un país. Escribí un jugador válido de ese país para completar el casillero seleccionado.");
});

initGame();
