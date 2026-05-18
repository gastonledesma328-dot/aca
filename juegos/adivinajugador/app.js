const DATA_URLS = [
  './jugadores.json',
  'jugadores.json',
  '/aca/adivinajugador/jugadores.json',
  '/adivinajugador/jugadores.json',
  '../adivinajugador/jugadores.json',
];
const MIN_CHARS = 4;

const DIFFICULTIES = {
  facil: {
    label: 'Fácil',
    maxTries: 8,
    autocomplete: true,
    help: 'Fácil: tenés lista de jugadores al escribir y 8 intentos.',
  },
  normal: {
    label: 'Normal',
    maxTries: 8,
    autocomplete: false,
    help: 'Normal: sin lista de jugadores al escribir. Tenés 8 intentos.',
  },
  dificil: {
    label: 'Difícil',
    maxTries: 5,
    autocomplete: false,
    help: 'Difícil: sin lista de jugadores y solo 5 intentos.',
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
let selectedDifficulty = 'facil';
let activeCategories = new Set(CATEGORIES.map((item) => item.key));

const $ = (id) => document.getElementById(id);

const els = {
  difficultyButtons: document.querySelectorAll('[data-difficulty]'),
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
  secretCompetition: $('secretCompetition'),
  resultModal: $('resultModal'),
  resultIcon: $('resultIcon'),
  resultKicker: $('resultKicker'),
  resultTitle: $('resultTitle'),
  resultText: $('resultText'),
  resultMeta: $('resultMeta'),
  resultNewGameBtn: $('resultNewGameBtn'),
  resultCloseBtn: $('resultCloseBtn'),
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

function getDifficulty() {
  return DIFFICULTIES[selectedDifficulty] || DIFFICULTIES.facil;
}

function getMaxTries() {
  return getDifficulty().maxTries;
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

function setDifficulty(mode) {
  selectedDifficulty = DIFFICULTIES[mode] ? mode : 'facil';

  els.difficultyButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.difficulty === selectedDifficulty);
  });

  updateDifficultyInfo();
  fillDatalist();
  updateCounters();

  if (finished) return;

  if (guesses.length >= getMaxTries()) {
    setMessage('Al cambiar a esta dificultad ya no te quedan intentos.', 'bad');
    showAnswer(false);
    return;
  }

  setMessage(`Dificultad: ${getDifficulty().label}. El jugador oculto sigue siendo el mismo.`, 'ok');
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

function updateDifficultyInfo() {
  const difficulty = getDifficulty();

  if (els.modeLabel) {
    els.modeLabel.textContent = `Dificultad: ${difficulty.label}`;
  }

  if (els.modeHelp) {
    els.modeHelp.textContent = difficulty.help;
  }

  if (difficulty.autocomplete) {
    els.playerInput.setAttribute('list', 'playersList');
    els.playerInput.placeholder = 'Ej: Messi, Mbappé, Neymar...';
  } else {
    els.playerInput.removeAttribute('list');
    els.playerInput.placeholder = 'Escribí el nombre sin ayuda...';
  }
}

function filterPool() {
  pool = allPlayers.filter((player) => getPlayerEra(player) === 'actual');
}

function fillDatalist() {
  els.playersList.innerHTML = '';

  if (!getDifficulty().autocomplete) return;

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
  updateDifficultyInfo();
  fillDatalist();
  secret = pickSecret();
  guesses = [];
  finished = false;

  els.guessesBody.innerHTML = '';
  closeResultModal();
  els.playerInput.value = '';
  els.playerInput.disabled = false;
  els.guessBtn.disabled = false;
  els.secretCompetition.textContent = secret ? secret.competicion : '?';

  renderTableHeader();
  updateCounters();
  setMessage('Elegí la dificultad, activá las pistas que quieras y probá un jugador.', '');
  els.playerInput.focus();
}

function updateCounters() {
  const maxTries = getMaxTries();
  const left = Math.max(0, maxTries - guesses.length);
  if (els.triesLeft) {
    els.triesLeft.textContent = String(left);
  }
  els.triesUsed.textContent = `${guesses.length}/${maxTries}`;
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
    if (getDifficulty().autocomplete) {
      return { error: 'Hay varios jugadores parecidos. Elegí uno de la lista o escribí más del nombre.' };
    }

    return { error: 'Hay varios jugadores parecidos. Escribí el nombre más completo.' };
  }

  return { error: 'No encontré ese jugador. Revisá el nombre o probá con otro jugador de la base.' };
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
  openResultModal(won);
}

function openResultModal(won) {
  if (!els.resultModal || !secret) return;

  const age = getAge(secret);
  const difficultyLabel = getDifficulty().label;
  const position = POS_LABELS[secret.posicion] || secret.posicion || '-';

  els.resultIcon.textContent = won ? '🏆' : '⚽';
  els.resultKicker.textContent = won ? 'Juego completado' : 'Fin del juego';
  els.resultTitle.textContent = won ? '¡Felicitaciones!' : 'Se terminaron los intentos';
  els.resultText.innerHTML = won
    ? `Lograste descubrir al jugador oculto: <strong>${secret.nombre}</strong>.`
    : `El jugador oculto era <strong>${secret.nombre}</strong>.`;

  els.resultMeta.innerHTML = [
    `Dificultad ${difficultyLabel}`,
    secret.pais || '-',
    secret.club || '-',
    secret.competicion || '-',
    position,
    `${age || '-'} años`,
    `${secret.altura || '-'} cm`,
  ]
    .map((item) => `<span>${item}</span>`)
    .join('');

  els.resultModal.classList.remove('hidden');
}

function closeResultModal() {
  if (!els.resultModal) return;
  els.resultModal.classList.add('hidden');
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
    setMessage('', '');
    showAnswer(true);
    return;
  }

  if (guesses.length >= getMaxTries()) {
    setMessage('', '');
    showAnswer(false);
    return;
  }

  setMessage('No era. Mirá las pistas y probá otro.', '');
}

async function fetchPlayersJson() {
  const errors = [];

  for (const url of DATA_URLS) {
    try {
      const separator = url.includes('?') ? '&' : '?';
      const response = await fetch(`${url}${separator}v=${Date.now()}`, { cache: 'no-store' });

      if (!response.ok) {
        errors.push(`${url}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        errors.push(`${url}: el JSON no es una lista`);
        continue;
      }

      return data;
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  throw new Error(errors.join(' | '));
}

async function loadPlayers() {
  try {
    const data = await fetchPlayersJson();

    allPlayers = data
      .filter((player) => player && player.nombre && player.club && player.competicion)
      .filter((player) => getPlayerEra(player) === 'actual')
      .map((player) => ({
        ...player,
        epoca: player.epoca || 'actual',
        altura: Number(player.altura || 0),
      }));

    if (!allPlayers.length) {
      throw new Error('jugadores.json cargó, pero no tiene jugadores válidos.');
    }

    updateCategoryButtons();
    startGame();
  } catch (error) {
    console.error(error);
    setMessage('No se pudo cargar jugadores.json. Revisá que exista en /aca/adivinajugador/jugadores.json y que el archivo se llame exactamente jugadores.json.', 'bad');
  }
}

els.guessBtn.addEventListener('click', submitGuess);
els.newGameBtn.addEventListener('click', startGame);
els.playerInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') submitGuess();
});

els.difficultyButtons.forEach((button) => {
  button.addEventListener('click', () => setDifficulty(button.dataset.difficulty));
});

els.categoryButtons.forEach((button) => {
  button.addEventListener('click', () => toggleCategory(button.dataset.category));
});

els.allCategoriesBtn.addEventListener('click', activateAllCategories);

if (els.resultNewGameBtn) {
  els.resultNewGameBtn.addEventListener('click', startGame);
}

if (els.resultCloseBtn) {
  els.resultCloseBtn.addEventListener('click', closeResultModal);
}

if (els.resultModal) {
  els.resultModal.addEventListener('click', (event) => {
    if (event.target === els.resultModal) closeResultModal();
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeResultModal();
});

loadPlayers();
