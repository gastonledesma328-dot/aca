const DATA_URL = "../../data/jugadores_america.json";

const formations = [
  {
    name: "4-3-3",
    rows: [
      ["LW", "ST", "RW"],
      ["CM", "CM", "CM"],
      ["LB", "CB", "CB", "RB"],
      ["GK"]
    ]
  }
];

let players = [];
let selectedFormation = formations[0];
let slots = [];
let score = 0;

const pitch = document.getElementById("pitch");
const formationName = document.getElementById("formationName");
const filledCount = document.getElementById("filledCount");
const scoreEl = document.getElementById("score");
const playerInput = document.getElementById("playerInput");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const message = document.getElementById("message");
const surrenderBtn = document.getElementById("surrenderBtn");
const nextBtn = document.getElementById("nextBtn");

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

function positionGroup(pos) {
  const p = String(pos || "").toUpperCase();

  if (p === "GK") return "arqueros";

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

function renderPitch() {
  pitch.innerHTML = "";

  let slotIndex = 0;

  selectedFormation.rows.forEach(row => {
    const rowEl = document.createElement("div");
    rowEl.className = "pitch-row";

    row.forEach(() => {
      const slot = slots[slotIndex];
      const slotEl = document.createElement("div");
      slotEl.className = "slot";

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
            <span>Club de América</span>
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

  if (filled === 11) {
    completeGame();
  }
}

function findPlayer(name) {
  const target = slugify(name);

  return players.find(player => {
    return player.slug === target || slugify(player.nombre) === target;
  });
}

function playerAlreadyUsed(player) {
  return slots.some(slot => slot.player && slot.player.slug === player.slug);
}

function addPlayer() {
  const value = playerInput.value.trim();

  if (!value) {
    setMessage("Escribí el nombre de un jugador.", "error");
    return;
  }

  const player = findPlayer(value);

  if (!player) {
    setMessage("No encontré ese jugador en la base de América.", "error");
    return;
  }

  if (playerAlreadyUsed(player)) {
    setMessage("Ese jugador ya está en tu equipo.", "error");
    return;
  }

  const freeSlot = slots.find(slot => !slot.player && canFit(player, slot.position));

  if (!freeSlot) {
    setMessage(`No hay lugar compatible para ${player.nombre}.`, "error");
    return;
  }

  freeSlot.player = player;
  score += 100;
  playerInput.value = "";

  setMessage(`${player.nombre} agregado. Juega en ${player.club}.`, "ok");
  renderPitch();
}

function surrender() {
  const missing = slots.filter(slot => !slot.player).length;

  setMessage(`Te rendiste. Te faltaron ${missing} puestos.`, "error");

  slots.forEach(slot => {
    if (!slot.player) {
      const candidate = players.find(player => {
        return !playerAlreadyUsed(player) && canFit(player, slot.position);
      });

      if (candidate) {
        slot.player = candidate;
      }
    }
  });

  renderPitch();
}

function resetGame() {
  selectedFormation = formations[0];
  buildSlots();
  score = 0;
  completeModal.classList.add("hidden");
  nextBtn.classList.add("hidden");
  setMessage("Nuevo desafío cargado. Completá tu 11.", "ok");
  renderPitch();
}

function completeGame() {
  completeText.textContent = `Completaste el 11 de América. Formación ${selectedFormation.name}. Puntaje final: ${score}.`;
  completeModal.classList.remove("hidden");
  nextBtn.classList.remove("hidden");
}

async function shareGame() {
  const text = `Completé Armá 11 América en Partidos.Hoy con ${score} puntos.`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Armá 11 América",
        text
      });
      return;
    } catch (error) {}
  }

  await navigator.clipboard.writeText(text);
  setMessage("Resultado copiado para compartir.", "ok");
}

async function loadPlayers() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("No se pudo cargar el JSON");
    }

    players = await response.json();

    players = players.map(player => ({
      ...player,
      slug: player.slug || slugify(player.nombre)
    }));

    setMessage(`Base cargada: ${players.length} jugadores disponibles.`, "ok");
    resetGame();
  } catch (error) {
    console.error(error);
    setMessage("Error cargando data/jugadores_america.json. Revisá la ruta.", "error");
    buildSlots();
    renderPitch();
  }
}

addPlayerBtn.addEventListener("click", addPlayer);

playerInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    addPlayer();
  }
});

surrenderBtn.addEventListener("click", surrender);
nextBtn.addEventListener("click", resetGame);
modalNextBtn.addEventListener("click", resetGame);
shareBtn.addEventListener("click", shareGame);

helpBtn.addEventListener("click", () => helpModal.classList.remove("hidden"));
closeHelpBtn.addEventListener("click", () => helpModal.classList.add("hidden"));

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

loadPlayers();
