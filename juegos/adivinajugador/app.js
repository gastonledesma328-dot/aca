const DATA_URL = './jugadores.json';
const MAX_TRIES = 8;
const MIN_CHARS = 4;

const ERA_MODES = {
  actual: {
    label: 'Actualidad',
    help: 'Pregunta con datos actuales. Cambiar este botón NO cambia el jugador oculto.',
  },
  pasado: {
    label: 'Pasado',
    help: 'Modo de pregunta pasado. La base sigue usando jugadores actuales, no retirados.',
  },
  mixto: {
    label: 'Mixto',
    help: 'Mezcla de preguntas, manteniendo el mismo jugador oculto.',
  },
};

const CATEGORIES = [
  { key: 'pais', label: 'País', type: 'text' },
  { key: 'club', label: 'Club', type: 'text' },
  { key: 'competicion', label: 'Liga', type: 'text' },
  { key: 'posicion', label: 'Posición', type: 'position' },
  { key: 'edad', label: 'Edad', type: 'number', closeRange: 2, suffix: '' },
  { key: 'altura', label: 'Altura', type: 'number', closeRange: 3, suffix: ' cm' },
];

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
let selectedEra = 'actual';
let activeCategories = new Set(CATEGORIES.map((item) => item.key));

const $ = (id) => document.getElementById(id);

const els = {
  eraButtons: document.querySelectorAll('[data-era]'),
  categoryButtons: document.querySelectorAll('[data-category]'),
  modeLabel: $('modeLabel'),
  modeHelp: $('modeHelp'),
  triesLeft: $('triesLeft'),
  triesUsed: $('triesUsed'),
  playerInput: $('playerInput'),
  playersList: $('playersList'),
  guessBtn: $('guessBtn'),
  newGameBtn: $('newGameBtn'),
  allCategoriesBtn: $('allCategoriesBtn'),
  message: $('message'),
  tableHead: $('tableHead'),
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

function getPlayerEra(player) {
  return normalizeText(player.epoca || player.tipo || 'actual');
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

function getValue(player, key) {
  if (key === 'edad') return getAge(player);
  return player[key];
}

function displayValue(player, category) {
  const value = getValue(player, category.key);

  if (category.type === 'position') {
    return POS_LABELS[value] || value || '-';
  }

  if (category.type === 'number') {
    return value ? `${value}${category.suffix || ''}` : '-';
  }

  return value || '-';
}

function playerLabel(player) {
  return `${player.nombre} · ${player.club} · ${player.competicion}`;
}

function setMessage(text, type = '') {
  els.message.textContent = text;
  els.message.className = `message ${type}`.trim();
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function setEra(mode) {
  selectedEra = ERA_MODES[mode] ? mode : 'actual';

  els.eraButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.era === selectedEra);
  });

  updateModeInfo();
  setMessage(`Modo de pregunta: ${ERA_MODES[selectedEra].label}. El jugador oculto sigue siendo el mismo.`, 'ok');
}

function toggleCategory(key) {
  if (!key) return;

  if (activeCategories.has(key)) {
    if (activeCategories.size === 1) {
      setMessage('Dejá al menos una pista activa.', 'warn');
      return;
    }
    activeCategories.delete(key);
  } else {
    activeCategories.add(key);
  }

  updateCategoryButtons();
  renderTableHeader();
  rerenderGuesses();
}

function activateAllCategories() {
  activeCategories = new Set(CATEGORIES.map((item) => item.key));
  updateCategoryButtons();
  renderTableHeader();
  rerenderGuesses();
  setMessage('Activé todas las pistas.', 'ok');
}

function updateCategoryButtons() {
  els.categoryButtons.forEach((button) => {
    button.classList.toggle('active', activeCategories.has(button.dataset.category));
  });
}

function updateModeInfo() {
  const mode = ERA_MODES[selectedEra] || ERA_MODES.actual;
  els.modeLabel.textContent = `Modo: ${mode.label}`;
  els.modeHelp.textContent = mode.help;
}

function filterPool() {
  // Siempre usamos futbolistas actuales.
  // Los botones Actualidad / Pasado / Mixto cambian el tipo de pregunta,
  // pero NO reinician ni cambian el jugador oculto.
  pool = allPlayers.filter((player) => getPlayerEra(player) === 'actual');
  updateModeInfo();
  els.playersCount.textContent = String(pool.length);
}

function fillDatalist() {
  els.playersList.innerHTML = '';

  shuffle(pool)
    .slice(0, 450)
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

  renderTableHeader();
  updateCounters();
  setMessage('Elegí el modo de pregunta, activá las pistas que quieras y probá un jugador. Cambiar el modo no cambia el oculto.', '');
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

  return { error: 'No encontré ese jugador en este modo. Probá cambiar a Mixto o revisar el nombre.' };
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

function resultPill(text, className) {
  return `<span class="result-pill ${className}">${text}</span>`;
}

function getCategoryResult(player, category) {
  if (category.type === 'number') {
    const result = compareNumber(getValue(player, category.key), getValue(secret, category.key), category.closeRange || 2);
    return resultPill(`${result.text}${category.suffix || ''}`, result.className);
  }

  const value = displayValue(player, category);
  const targetValue = getValue(secret, category.key);
  const playerValue = getValue(player, category.key);
  const good = compareText(playerValue, targetValue);

  return resultPill(value, good ? 'good' : 'bad');
}

function getActiveCategories() {
  return CATEGORIES.filter((category) => activeCategories.has(category.key));
}

function renderTableHeader() {
  const ths = ['<th>Jugador</th>'];

  getActiveCategories().forEach((category) => {
    ths.push(`<th>${category.label}</th>`);
  });

  els.tableHead.innerHTML = `<tr>${ths.join('')}</tr>`;
}

function renderGuess(player) {
  const tds = [`<td class="player-cell">${player.nombre}</td>`];

  getActiveCategories().forEach((category) => {
    tds.push(`<td>${getCategoryResult(player, category)}</td>`);
  });

  const tr = document.createElement('tr');
  tr.innerHTML = tds.join('');
  els.guessesBody.prepend(tr);
}

function rerenderGuesses() {
  els.guessesBody.innerHTML = '';
  [...guesses].reverse().forEach(renderGuess);
}

function showAnswer(won) {
  finished = true;
  els.playerInput.disabled = true;
  els.guessBtn.disabled = true;

  const age = getAge(secret);
  const modeLabel = ERA_MODES[selectedEra]?.label || 'Actualidad';

  els.answerCard.classList.remove('hidden');
  els.answerCard.innerHTML = `
    <h2>${won ? '¡Correcto!' : 'Se terminaron los intentos'}</h2>
    <p>El jugador era <strong>${secret.nombre}</strong>.</p>
    <p>Modo ${modeLabel} · ${secret.pais} · ${secret.club} · ${secret.competicion} · ${POS_LABELS[secret.posicion] || secret.posicion} · ${age} años · ${secret.altura} cm</p>
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

  setMessage('No era. Mirá las pistas y probá otro.', '');
}

async function loadPlayers() {
  try {
    const response = await fetch(`${DATA_URL}?v=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    allPlayers = data
      .filter((player) => player && player.nombre && player.club && player.competicion)
      .filter((player) => getPlayerEra(player) === 'actual')
      .map((player) => ({
        ...player,
        epoca: player.epoca || 'actual',
        altura: Number(player.altura || 0),
      }));

    updateCategoryButtons();
    startGame();
  } catch (error) {
    console.error(error);
    setMessage('No se pudo cargar jugadores.json. Revisá que esté dentro de /adivinajugador/.', 'bad');
  }
}

els.guessBtn.addEventListener('click', submitGuess);
els.newGameBtn.addEventListener('click', startGame);
els.playerInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') submitGuess();
});

els.eraButtons.forEach((button) => {
  button.addEventListener('click', () => setEra(button.dataset.era));
});

els.categoryButtons.forEach((button) => {
  button.addEventListener('click', () => toggleCategory(button.dataset.category));
});

els.allCategoriesBtn.addEventListener('click', activateAllCategories);

loadPlayers();
