const DATA_URL = './jugadores.json';
const MAX_TRIES = 8;
const MIN_CHARS = 4;

const MODES = {
  all: {
    label: 'Todos',
    leagues: null,
  },
  easy: {
    label: 'Fácil - Europa top',
    leagues: ['Premier League', 'Serie A', 'Bundesliga', 'LaLiga', 'Ligue 1'],
  },
  normal: {
    label: 'Normal - Europa + Sudamérica',
    leagues: ['Premier League', 'Serie A', 'Bundesliga', 'LaLiga', 'Ligue 1', 'Brasileirão', 'Liga Profesional Argentina', 'Eredivisie'],
  },
  hard: {
    label: 'Difícil - Todas las ligas',
    leagues: null,
  },
};

const POS_LABELS = {
  GK: 'Arquero',
  CB: 'Defensa central',
  LB: 'Lateral izquierdo',
  RB: 'Lateral derecho',
  CDM: 'Mediocentro defensivo',
  CM: 'Mediocampista',
  CAM: 'Enganche',
  LW: 'Extremo izquierdo',
  RW: 'Extremo derecho',
  ST: 'Delantero',
};

let allPlayers = [];
let pool = [];
let secret = null;
let guesses = [];
let finished = false;

const $ = (id) => document.getElementById(id);

const els = {
  modeSelect: $('modeSelect'),
  modeLabel: $('modeLabel'),
  triesLeft: $('triesLeft'),
  triesUsed: $('triesUsed'),
  playerInput: $('playerInput'),
  playersList: $('playersList'),
  guessBtn: $('guessBtn'),
  newGameBtn: $('newGameBtn'),
  message: $('message'),
  guessesBody: $('guessesBody'),
  answerCard: $('answerCard'),
  secretCompetition: $('secretCompetition'),
  playersCount: $('playersCount'),
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getAge(player) {
  if (typeof player.edad === 'number') return player.edad;
  if (!player.nacimiento) return 0;

  const birth = new Date(`${player.nacimiento}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
}

function playerLabel(player) {
  return `${player.nombre} · ${player.club}`;
}

function setMessage(text, type = '') {
  els.message.textContent = text;
  els.message.className = `message ${type}`.trim();
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function filterPool() {
  const mode = MODES[els.modeSelect.value] || MODES.all;

  pool = allPlayers.filter((player) => {
    if (!mode.leagues) return true;
    return mode.leagues.includes(player.competicion);
  });

  els.modeLabel.textContent = `Modo: ${mode.label}`;
  els.playersCount.textContent = String(pool.length);
}

function fillDatalist() {
  els.playersList.innerHTML = '';

  shuffle(pool)
    .slice(0, 350)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .forEach((player) => {
      const option = document.createElement('option');
      option.value = player.nombre;
      option.label = playerLabel(player);
      els.playersList.appendChild(option);
    });
}

function pickSecret() {
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function startGame() {
  filterPool();
  fillDatalist();
  secret = pickSecret();
  guesses = [];
  finished = false;

  els.guessesBody.innerHTML = '';
  els.answerCard.classList.add('hidden');
  els.answerCard.innerHTML = '';
  els.playerInput.value = '';
  els.playerInput.disabled = false;
  els.guessBtn.disabled = false;
  els.secretCompetition.textContent = secret ? secret.competicion : '?';

  updateCounters();
  setMessage('Escribí mínimo 4 letras. Si hay una coincidencia clara, el juego la toma.', '');
  els.playerInput.focus();
}

function updateCounters() {
  const left = MAX_TRIES - guesses.length;
  els.triesLeft.textContent = String(left);
  els.triesUsed.textContent = `${guesses.length}/${MAX_TRIES}`;
}

function findPlayerByInput(input) {
  const raw = String(input || '').trim();
  const q = normalizeText(raw);

  if (q.length < MIN_CHARS) {
    return { error: `Escribí al menos ${MIN_CHARS} letras.` };
  }

  const exact = pool.find((player) => normalizeText(player.nombre) === q);
  if (exact) return { player: exact };

  const matches = pool.filter((player) => {
    const name = normalizeText(player.nombre);
    return name.includes(q) || q.includes(name);
  });

  if (matches.length === 1) return { player: matches[0] };

  if (matches.length > 1) {
    return { error: 'Hay varios jugadores parecidos. Escribí un poco más del nombre.' };
  }

  return { error: 'No encontré ese jugador en la base.' };
}

function compareText(value, target) {
  return normalizeText(value) === normalizeText(target);
}

function compareNumber(value, target, closeRange = 2) {
  const a = Number(value);
  const b = Number(target);

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { className: 'bad', text: '-' };
  }

  if (a === b) return { className: 'good', text: String(a) };

  const diff = Math.abs(a - b);
  const arrow = a < b ? '⬆️' : '⬇️';

  if (diff <= closeRange) {
    return { className: 'close', text: `${a} ${arrow}` };
  }

  return { className: 'bad', text: `${a} ${arrow}` };
}

function resultPill(text, isGood, extraClass = '') {
  const className = extraClass || (isGood ? 'good' : 'bad');
  return `<span class="result-pill ${className}">${text}</span>`;
}

function renderGuess(player) {
  const age = getAge(player);
  const secretAge = getAge(secret);
  const ageResult = compareNumber(age, secretAge, 2);
  const heightResult = compareNumber(player.altura, secret.altura, 3);

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="player-cell">${player.nombre}</td>
    <td>${resultPill(player.pais, compareText(player.pais, secret.pais))}</td>
    <td>${resultPill(player.club, compareText(player.club, secret.club))}</td>
    <td>${resultPill(player.competicion, compareText(player.competicion, secret.competicion))}</td>
    <td>${resultPill(POS_LABELS[player.posicion] || player.posicion, compareText(player.posicion, secret.posicion))}</td>
    <td>${resultPill(ageResult.text, ageResult.className === 'good', ageResult.className)}</td>
    <td>${resultPill(`${heightResult.text} cm`, heightResult.className === 'good', heightResult.className)}</td>
  `;

  els.guessesBody.prepend(tr);
}

function showAnswer(won) {
  finished = true;
  els.playerInput.disabled = true;
  els.guessBtn.disabled = true;

  const age = getAge(secret);
  els.answerCard.classList.remove('hidden');
  els.answerCard.innerHTML = `
    <h2>${won ? '¡Correcto!' : 'Se terminaron los intentos'}</h2>
    <p>El jugador era <strong>${secret.nombre}</strong>.</p>
    <p>${secret.pais} · ${secret.club} · ${secret.competicion} · ${POS_LABELS[secret.posicion] || secret.posicion} · ${age} años · ${secret.altura} cm</p>
  `;
}

function submitGuess() {
  if (finished || !secret) return;

  const result = findPlayerByInput(els.playerInput.value);

  if (result.error) {
    setMessage(result.error, 'warn');
    return;
  }

  const player = result.player;
  const key = normalizeText(player.nombre);

  if (guesses.some((item) => normalizeText(item.nombre) === key)) {
    setMessage('Ese jugador ya lo probaste.', 'warn');
    return;
  }

  guesses.push(player);
  renderGuess(player);
  updateCounters();
  els.playerInput.value = '';

  if (normalizeText(player.nombre) === normalizeText(secret.nombre)) {
    setMessage('¡Lo sacaste! Bien ahí.', 'ok');
    showAnswer(true);
    return;
  }

  if (guesses.length >= MAX_TRIES) {
    setMessage('No quedan intentos.', 'bad');
    showAnswer(false);
    return;
  }

  setMessage('No era. Usá las pistas y probá otro.', '');
}

async function loadPlayers() {
  try {
    const response = await fetch(`${DATA_URL}?v=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    allPlayers = data
      .filter((player) => player && player.nombre && player.club && player.competicion)
      .map((player) => ({ ...player, altura: Number(player.altura || 0) }));

    startGame();
  } catch (error) {
    console.error(error);
    setMessage('No se pudo cargar jugadores.json. Revisá que esté dentro de /adivinajugador/.', 'bad');
  }
}

els.guessBtn.addEventListener('click', submitGuess);
els.newGameBtn.addEventListener('click', startGame);
els.modeSelect.addEventListener('change', startGame);
els.playerInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') submitGuess();
});

loadPlayers();
