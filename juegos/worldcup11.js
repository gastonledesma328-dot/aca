let gameData = null;
let currentRound = 0;
let score = 0;
let selectedPlayers = [];
let formationSlots = [];

const formationEl = document.getElementById("formation");
const playersListEl = document.getElementById("playersList");
const countryTitleEl = document.getElementById("countryTitle");
const countryHelpEl = document.getElementById("countryHelp");
const roundTextEl = document.getElementById("roundText");
const scoreTextEl = document.getElementById("scoreText");
const resultBoxEl = document.getElementById("resultBox");
const finalScoreEl = document.getElementById("finalScore");

async function initGame() {
  try {
    const res = await fetch("../data/juegos-worldcup11.json?nocache=" + Date.now());
    gameData = await res.json();

    currentRound = 0;
    score = 0;
    selectedPlayers = [];
    formationSlots = gameData.formacion.map((pos, index) => ({
      id: index,
      posicion: pos,
      jugador: null
    }));

    renderFormation();
    renderRound();
    updateScore();

  } catch (error) {
    countryTitleEl.textContent = "No se pudo cargar el juego";
    countryHelpEl.textContent = "Revisá que exista data/juegos-worldcup11.json";
    console.error(error);
  }
}

function renderFormation() {
  formationEl.innerHTML = "";

  formationSlots.forEach((slot) => {
    const div = document.createElement("div");
    div.className = "slot" + (slot.jugador ? " filled" : "");

    if (slot.jugador) {
      div.innerHTML = `
        <div>
          ${slot.jugador.nombre}
          <small>${slot.posicion} · ${slot.jugador.pais}</small>
        </div>
      `;
    } else {
      div.textContent = slot.posicion;
    }

    formationEl.appendChild(div);
  });
}

function renderRound() {
  if (currentRound >= gameData.rondas.length || allSlotsFilled()) {
    finishGame();
    return;
  }

  const round = gameData.rondas[currentRound];

  countryTitleEl.textContent = `${round.bandera} ${round.pais}`;
  countryHelpEl.textContent = "Elegí un jugador para una posición libre.";
  roundTextEl.textContent = `${currentRound + 1}/${gameData.rondas.length}`;

  playersListEl.innerHTML = "";

  round.jugadores.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";

    card.innerHTML = `
      <strong>${player.nombre}</strong>
      <span>${player.posicion} · ${player.club}</span>
    `;

    card.onclick = () => selectPlayer({
      ...player,
      pais: round.pais,
      bandera: round.bandera
    });

    playersListEl.appendChild(card);
  });
}

function selectPlayer(player) {
  const freeSlot = formationSlots.find(slot => {
    return slot.posicion === player.posicion && slot.jugador === null;
  });

  if (!freeSlot) {
    alert(`No tenés lugar libre para ${player.posicion}`);
    return;
  }

  const alreadyUsedCountry = selectedPlayers.some(p => p.pais === player.pais);

  if (alreadyUsedCountry) {
    alert("Ya usaste un jugador de este país");
    return;
  }

  freeSlot.jugador = player;
  selectedPlayers.push(player);

  score += calculatePoints(player);

  currentRound++;

  renderFormation();
  updateScore();
  renderRound();
}

function calculatePoints(player) {
  let points = 100;

  if (player.posicion === "ARQ") points += 20;
  if (player.posicion === "DEF") points += 15;
  if (player.posicion === "MED") points += 25;
  if (player.posicion === "DEL") points += 30;

  return points;
}

function updateScore() {
  scoreTextEl.textContent = score;
}

function allSlotsFilled() {
  return formationSlots.every(slot => slot.jugador !== null);
}

function finishGame() {
  playersListEl.innerHTML = "";
  countryTitleEl.textContent = "Desafío terminado";
  countryHelpEl.textContent = "Este es tu 11 final.";

  resultBoxEl.classList.remove("hidden");
  finalScoreEl.textContent = `Puntaje final: ${score} puntos`;
}

function restartGame() {
  resultBoxEl.classList.add("hidden");
  initGame();
}

function shareResult() {
  const text = `Armé mi 11 Mundial en Partidos.Hoy ⚽\nPuntaje: ${score} puntos`;

  if (navigator.share) {
    navigator.share({
      title: "Armá tu 11 Mundial",
      text
    });
  } else {
    navigator.clipboard.writeText(text);
    alert("Resultado copiado al portapapeles");
  }
}

initGame();
