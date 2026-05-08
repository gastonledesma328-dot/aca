const DAILY_GAME = {
  formationName: "3-5-2",
  country: {
    name: "Japón",
    flag: "🇯🇵"
  },
  positions: [
    "ST", "ST",
    "CAM",
    "LM", "CDM", "CDM", "RM",
    "CB", "CB", "CB",
    "GK"
  ],
  players: [
    {
      name: "Takefusa Kubo",
      position: "CAM",
      club: "Real Sociedad"
    },
    {
      name: "Kaoru Mitoma",
      position: "LM",
      club: "Brighton"
    },
    {
      name: "Ritsu Doan",
      position: "RM",
      club: "Freiburg"
    },
    {
      name: "Wataru Endo",
      position: "CDM",
      club: "Liverpool"
    },
    {
      name: "Ao Tanaka",
      position: "CDM",
      club: "Leeds United"
    },
    {
      name: "Daichi Kamada",
      position: "CAM",
      club: "Crystal Palace"
    },
    {
      name: "Takumi Minamino",
      position: "ST",
      club: "Monaco"
    },
    {
      name: "Ayase Ueda",
      position: "ST",
      club: "Feyenoord"
    },
    {
      name: "Kyogo Furuhashi",
      position: "ST",
      club: "Birmingham City"
    },
    {
      name: "Ko Itakura",
      position: "CB",
      club: "Borussia Mönchengladbach"
    },
    {
      name: "Takehiro Tomiyasu",
      position: "CB",
      club: "Arsenal"
    },
    {
      name: "Hiroki Ito",
      position: "CB",
      club: "Bayern Munich"
    },
    {
      name: "Zion Suzuki",
      position: "GK",
      club: "Parma"
    },
    {
      name: "Daiya Maekawa",
      position: "GK",
      club: "Vissel Kobe"
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
let usedPlayers = [];
let score = 0;
let surrendered = false;

function initGame() {
  countryFlag.textContent = DAILY_GAME.country.flag;
  countryName.textContent = DAILY_GAME.country.name;
  formationText.textContent = DAILY_GAME.formationName;

  slots.forEach((slot, index) => {
    slot.dataset.index = index;
    slot.dataset.originalLabel = slot.dataset.position;
    slot.innerHTML = slot.dataset.position;
    slot.classList.remove("filled", "selected");

    slot.addEventListener("click", () => {
      selectSlot(slot);
    });
  });

  selectedSlot = null;
  usedPlayers = [];
  score = 0;
  surrendered = false;

  playerSearch.value = "";
  suggestions.innerHTML = "";

  resultModal.classList.add("hidden");

  updateStatus();
}

function selectSlot(slot) {
  if (slot.classList.contains("filled")) return;

  slots.forEach(item => item.classList.remove("selected"));

  selectedSlot = slot;
  selectedSlot.classList.add("selected");

  playerSearch.focus();
  renderSuggestions(playerSearch.value);
}

function renderSuggestions(query) {
  const value = normalizeText(query);

  suggestions.innerHTML = "";

  if (!selectedSlot) {
    suggestions.innerHTML = `
      <button class="suggestion-item" type="button">
        <strong>Primero elegí una posición del campo</strong>
        <span>GK, CB, CDM, LM, RM, CAM o ST</span>
      </button>
    `;
    return;
  }

  const position = selectedSlot.dataset.position;

  const filtered = DAILY_GAME.players
    .filter(player => player.position === position)
    .filter(player => !usedPlayers.includes(player.name))
    .filter(player => {
      if (!value) return true;
      return normalizeText(player.name).includes(value);
    })
    .slice(0, 5);

  if (!filtered.length) {
    suggestions.innerHTML = `
      <button class="suggestion-item" type="button">
        <strong>No encontré jugador para ${position}</strong>
        <span>Probá otro nombre o posición</span>
      </button>
    `;
    return;
  }

  filtered.forEach(player => {
    const button = document.createElement("button");
    button.className = "suggestion-item";
    button.type = "button";

    button.innerHTML = `
      <div>
        <strong>${player.name}</strong>
        <span>${player.position} · ${player.club}</span>
      </div>
      <span>Elegir</span>
    `;

    button.addEventListener("click", () => {
      placePlayer(player);
    });

    suggestions.appendChild(button);
  });
}

function placePlayer(player) {
  if (!selectedSlot) {
    alert("Primero elegí una posición del campo.");
    return;
  }

  const slotPosition = selectedSlot.dataset.position;

  if (player.position !== slotPosition) {
    alert(`Ese jugador no corresponde a ${slotPosition}.`);
    return;
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

  usedPlayers.push(player.name);
  score += 100;

  selectedSlot = null;
  playerSearch.value = "";
  suggestions.innerHTML = "";

  updateStatus();

  if (usedPlayers.length === slots.length) {
    finishGame(false);
  }
}

function updateStatus() {
  completedText.textContent = `${usedPlayers.length}/${slots.length}`;
  scoreText.textContent = score;
}

function finishGame(bySurrender) {
  surrendered = bySurrender;

  resultModal.classList.remove("hidden");

  if (bySurrender) {
    resultTitle.textContent = "Te rendiste";
    resultText.textContent = `Completaste ${usedPlayers.length} de ${slots.length} posiciones. Puntaje final: ${score}.`;
  } else {
    resultTitle.textContent = "Equipo completado";
    resultText.textContent = `Completaste el 11 de ${DAILY_GAME.country.name}. Puntaje final: ${score}.`;
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

  const query = normalizeText(playerSearch.value);

  if (!query) return;

  const position = selectedSlot ? selectedSlot.dataset.position : "";

  const player = DAILY_GAME.players.find(item => {
    return (
      normalizeText(item.name).includes(query) &&
      item.position === position &&
      !usedPlayers.includes(item.name)
    );
  });

  if (!player) {
    renderSuggestions(playerSearch.value);
    return;
  }

  placePlayer(player);
});

surrenderBtn.addEventListener("click", () => {
  finishGame(true);
});

shareBtn.addEventListener("click", async () => {
  const text = `Armé mi 11 de ${DAILY_GAME.country.name} en Partidos.Hoy ⚽\nPuntaje: ${score}\nFormación: ${DAILY_GAME.formationName}`;

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
  alert("Elegí una posición del campo, buscá un jugador japonés compatible y completá el 11. La bandera blanca sirve para rendirse.");
});

initGame();
