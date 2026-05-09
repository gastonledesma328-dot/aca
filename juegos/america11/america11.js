const DATA_URL = "https://partidoshoy-worker-jugadores-america.gastonledesma328.workers.dev/data/jugadores_america.json";

const formations = [
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

const baseChallenges = [
  {
    type: "america",
    value: "america",
    title: "Clubes de América",
    description: "Usá cualquier jugador que juegue actualmente en un club americano.",
    validate: player => Boolean(player.club)
  }
];

let players = [];
let challenges = [...baseChallenges];

let selectedFormation = formations[0];
let currentChallenge = challenges[0];

let slots = [];
let score = 0;
let challengeIndex = -1;
let formationIndex = -1;
let gameCompleted = false;

const pitch = document.getElementById("pitch");
const formationName = document.getElementById("formationName");
const filledCount = document.getElementById("filledCount");
const scoreEl = document.getElementById("score");
const playerInput = document.getElementById("playerInput");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const message = document.getElementById("message");
const surrenderBtn = document.getElementById("surrenderBtn");
const nextBtn = document.getElementById("nextBtn");
const changeChallengeBtn = document.getElementById("changeChallengeBtn");
const suggestions = document.getElementById("suggestions");

const challengeTitle = document.getElementById("challengeTitle");
const challengeDescription = document.getElementById("challengeDescription");
const baseTotal = document.getElementById("baseTotal");
const baseUpdated = document.getElementById("baseUpdated");
const baseLeagues = document.getElementById("baseLeagues");

const helpBtn = document.getElementById("helpBtn");
const helpModal = document.getElementById("helpModal");
const closeHelpBtn = document.getElementById("closeHelpBtn");

const completeModal = document.getElementById("completeModal");
const completeText = document.getElementById("completeText");
const shareBtn = document.getElementById("shareBtn");
const modalNextBtn = document.getElementById("modalNextBtn");

function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shuffle(array) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function positionGroup(pos) {
  const p = String(pos || "").toUpperCase();

  if (p === "GK") {
    return "arqueros";
  }

  if (["CB", "LB", "RB", "LWB", "RWB"].includes(p)) {
    return "defensores";
  }

  if (["CM", "CDM", "CAM", "LM", "RM"].includes(p)) {
    return "mediocampistas";
  }

  return "delanteros";
}

function canFit(player, slotPosition) {
  return player.categoria === positionGroup(slotPosition);
}

function getFreePositionsText() {
  const freePositions = slots
    .filter(slot => !slot.player)
    .map(slot => slot.position);

  if (!freePositions.length) {
    return "No quedan puestos libres.";
  }

  const uniquePositions = [...new Set(freePositions)];

  return `Puestos libres: ${uniquePositions.join(", ")}`;
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function buildSlots() {
  let index = 0;

  slots = selectedFormation.rows.flatMap(row =>
    row.map(position => ({
      id: index++,
      position,
      player: null
    }))
  );
}

function renderChallenge() {
  challengeTitle.textContent = currentChallenge.title;
  challengeDescription.textContent = currentChallenge.description;
}

function renderPitch() {
  pitch.innerHTML = "";

  let slotIndex = 0;

  selectedFormation.rows.forEach(row => {
    const rowEl = document.createElement("div");
    rowEl.className = "pitch-row";

    row.forEach(() => {
      const slot = slots[slotIndex];

      const slotEl = document.createElement("div");
      slotEl.className = `slot ${slot.player ? "filled" : ""}`.trim();

      if (slot.player) {
        slotEl.innerHTML = `
          <div>
            <small>${slot.position}</small>
            <strong>${slot.player.nombre}</strong>
            <span>${slot.player.club}</span>
          </div>
        `;
      } else {
        slotEl.innerHTML = `
          <div>
            <small>${slot.position}</small>
            <strong>Vacío</strong>
            <span>${currentChallenge.type === "country" ? currentChallenge.value : "Club de América"}</span>
          </div>
        `;
      }

      rowEl.appendChild(slotEl);
      slotIndex++;
    });

    pitch.appendChild(rowEl);
  });

  updateStats();
}

function updateStats() {
  const filled = slots.filter(slot => slot.player).length;

  filledCount.textContent = filled;
  scoreEl.textContent = score;
  formationName.textContent = selectedFormation.name;

  if (filled === 11 && !gameCompleted) {
    completeGame();
  }
}

function normalizePlayer(raw) {
  return {
    ...raw,
    nombre: raw.nombre || "",
    slug: raw.slug || slugify(raw.nombre),
    categoria: raw.categoria || "mediocampistas",
    posicion: raw.posicion || "CM",
    club: raw.club || "Club desconocido",
    pais_club: raw.pais_club || "",
    liga: raw.liga || "",
    league_slug: raw.league_slug || ""
  };
}

function buildChallenges() {
  const countries = [...new Set(players.map(player => player.pais_club).filter(Boolean))];

  const leagueMap = new Map();

  players.forEach(player => {
    if (player.league_slug && player.liga) {
      leagueMap.set(player.league_slug, {
        league_slug: player.league_slug,
        liga: player.liga
      });
    }
  });

  const countryChallenges = countries.map(country => ({
    type: "country",
    value: country,
    title: `Clubes de ${country}`,
    description: `Completá el 11 solo con jugadores que juegan actualmente en clubes de ${country}.`,
    validate: player => player.pais_club === country
  }));

  const leagueChallenges = [...leagueMap.values()].map(item => ({
    type: "league",
    value: item.league_slug,
    title: item.liga,
    description: `Completá el 11 solo con jugadores de ${item.liga}.`,
    validate: player => player.league_slug === item.league_slug
  }));

  challenges = shuffle([
    ...baseChallenges,
    ...countryChallenges,
    ...leagueChallenges
  ]);
}

function isValidForChallenge(player) {
  return currentChallenge.validate(player);
}

function findPlayer(name) {
  const target = slugify(name);

  if (!target) {
    return null;
  }

  // 1. Coincidencia exacta
  const exact = players.find(player => {
    return player.slug === target || slugify(player.nombre) === target;
  });

  if (exact) {
    return exact;
  }

  // 2. Coincidencia por nombre parcial, pero respetando el desafío actual
  const matches = players.filter(player => {
    const playerSlug = player.slug || slugify(player.nombre);

    return (
      isValidForChallenge(player) &&
      !playerAlreadyUsed(player) &&
      playerSlug.includes(target)
    );
  });

  // 3. Si hay una sola coincidencia clara, la usamos
  if (matches.length === 1) {
    return matches[0];
  }

  // 4. Si hay varias, no elegimos automáticamente
  return null;
}
function findMatches(query, limit = 8) {
  const target = slugify(query);

  if (target.length < 2) {
    return [];
  }

  const exactStart = [];
  const contains = [];

  players.forEach(player => {
    const name = player.slug || slugify(player.nombre);

    const valid =
      isValidForChallenge(player) &&
      !playerAlreadyUsed(player) &&
      name.includes(target);

    if (!valid) {
      return;
    }

    if (name.startsWith(target)) {
      exactStart.push(player);
    } else {
      contains.push(player);
    }
  });

  return [...exactStart, ...contains].slice(0, limit);
}

function playerAlreadyUsed(player) {
  return slots.some(slot => slot.player && slot.player.slug === player.slug);
}

function clearSuggestions() {
  suggestions.classList.add("hidden");
  suggestions.innerHTML = "";
}

function renderSuggestions(matches) {
  suggestions.innerHTML = "";

  matches.forEach(player => {
    const btn = document.createElement("button");

    btn.type = "button";
    btn.className = "suggestion";

    btn.innerHTML = `
      <strong>${player.nombre}</strong>
      <span>${player.club} · ${player.posicion} · ${player.pais_club}</span>
    `;

    btn.addEventListener("click", () => {
      addPlayerByName(player.nombre);
    });

    suggestions.appendChild(btn);
  });

  suggestions.classList.remove("hidden");
}
function addPlayerByName(name) {
  const value = String(name || "").trim();

  if (!value) {
    setMessage("Escribí el nombre de un jugador.", "error");
    return;
  }

  const player = findPlayer(value);

  if (!player) {
  const matches = findMatches(value, 6);

  if (matches.length) {
    setMessage(
      `Encontré ${matches.length} coincidencias. Tocá una sugerencia o escribí más específico.`,
      "warn"
    );

    renderSuggestions(matches);
  } else {
    setMessage("No encontré ese jugador para este desafío.", "error");
    clearSuggestions();
  }

  return;
}

  if (!isValidForChallenge(player)) {
  setMessage(
    `${player.nombre} juega en ${player.club} (${player.pais_club}), pero no cumple este desafío: ${currentChallenge.title}.`,
    "error"
  );

  clearSuggestions();
  return;
}

  if (playerAlreadyUsed(player)) {
    setMessage("Ese jugador ya está en tu equipo.", "error");
    clearSuggestions();
    return;
  }

  const freeSlot = slots.find(slot => {
  return !slot.player && canFit(player, slot.position);
});

if (!freeSlot) {
  setMessage(
    `${player.nombre} es ${player.posicion}, pero no hay lugar compatible. ${getFreePositionsText()}`,
    "error"
  );

  clearSuggestions();
  return;
}

  freeSlot.player = player;
  score += 100;
  playerInput.value = "";

  setMessage(`${player.nombre} agregado. Juega en ${player.club}.`, "ok");
  clearSuggestions();
  renderPitch();
}

function addPlayer() {
  addPlayerByName(playerInput.value);
}

function getCandidatesForSlot(slot) {
  return players.filter(player => {
    return (
      !playerAlreadyUsed(player) &&
      isValidForChallenge(player) &&
      canFit(player, slot.position)
    );
  });
}

function surrender() {
  const missingBefore = slots.filter(slot => !slot.player).length;

  slots.forEach(slot => {
    if (!slot.player) {
      const candidates = getCandidatesForSlot(slot);
      const candidate = candidates[Math.floor(Math.random() * candidates.length)];

      if (candidate) {
        slot.player = candidate;
      }
    }
  });

  const missingAfter = slots.filter(slot => !slot.player).length;

  if (missingAfter > 0) {
    setMessage(
      `Te rendiste. Se completaron algunos puestos, pero faltaron ${missingAfter} porque no hubo jugadores suficientes para este desafío.`,
      "warn"
    );
  } else {
    setMessage(`Te rendiste. Se completaron ${missingBefore} puestos con respuestas posibles.`, "warn");
  }

  clearSuggestions();
  renderPitch();
}

function pickNextFormation() {
  formationIndex = (formationIndex + 1) % formations.length;
  selectedFormation = formations[formationIndex];
}

function pickNextChallenge() {
  challengeIndex = (challengeIndex + 1) % challenges.length;
  currentChallenge = challenges[challengeIndex];
}

function challengeHasEnoughPlayers() {
  const available = players.filter(player => isValidForChallenge(player));
  const positions = selectedFormation.rows.flat();

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

function resetGame() {
  completeModal.classList.add("hidden");
  nextBtn.classList.add("hidden");

  gameCompleted = false;
  score = 0;

  let safety = 0;

  do {
    pickNextFormation();
    pickNextChallenge();
    safety++;
  } while (!challengeHasEnoughPlayers() && safety < 100);

  buildSlots();
  clearSuggestions();
  renderChallenge();
  setMessage("Nuevo desafío cargado. Completá tu 11.", "ok");
  renderPitch();
}

function completeGame() {
  gameCompleted = true;

  completeText.textContent =
    `Completaste el 11 en Armá 11 América. ` +
    `Desafío: ${currentChallenge.title}. ` +
    `Formación ${selectedFormation.name}. ` +
    `Puntaje final: ${score}. ` +
    `Podés jugar otro desafío ahora.`;

  completeModal.classList.remove("hidden");
  nextBtn.classList.remove("hidden");
}

async function shareGame() {
  const text =
    `Completé Armá 11 América: ${currentChallenge.title}, ` +
    `formación ${selectedFormation.name}, ${score} puntos.`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Armá 11 América",
        text
      });

      return;
    } catch (error) {}
  }

  try {
    await navigator.clipboard.writeText(text);
    setMessage("Resultado copiado para compartir.", "ok");
  } catch (error) {
    setMessage(text, "ok");
  }
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

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
    ? players.length
    : payload.total || players.length;

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


async function loadPlayers() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("No se pudo cargar el JSON");
    }

    const payload = await response.json();

players = Array.isArray(payload) ? payload : (payload.jugadores || []);

    players = players
      .map(normalizePlayer)
      .filter(player => player.nombre && player.slug && player.club);

    renderBaseInfo(payload);

    buildChallenges();

    if (!players.length) {
      throw new Error("La base de jugadores está vacía");
    }

    setMessage(`Base cargada: ${players.length} jugadores disponibles.`, "ok");
    resetGame();
  } catch (error) {
    console.error(error);

    setMessage(
      "Error cargando data/jugadores_america.json. Revisá la ruta o ejecutá el scraper.",
      "error"
    );

    buildSlots();
    renderChallenge();
    renderPitch();
  }
}

addPlayerBtn.addEventListener("click", addPlayer);

playerInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    addPlayer();
  }
});

playerInput.addEventListener("input", () => {
  const matches = findMatches(playerInput.value, 6);

  if (matches.length) {
    renderSuggestions(matches);
  } else {
    clearSuggestions();
  }
});

surrenderBtn.addEventListener("click", surrender);
nextBtn.addEventListener("click", resetGame);
modalNextBtn.addEventListener("click", resetGame);
changeChallengeBtn.addEventListener("click", resetGame);
shareBtn.addEventListener("click", shareGame);

helpBtn.addEventListener("click", () => {
  helpModal.classList.remove("hidden");
});

closeHelpBtn.addEventListener("click", () => {
  helpModal.classList.add("hidden");
});

helpModal.addEventListener("click", event => {
  if (event.target === helpModal) {
    helpModal.classList.add("hidden");
  }
});

completeModal.addEventListener("click", event => {
  if (event.target === completeModal) {
    completeModal.classList.add("hidden");
  }
});

selectedFormation = formations[0];
currentChallenge = baseChallenges[0];

buildSlots();
renderChallenge();
renderPitch();
loadPlayers();
