const FORMATIONS = [
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
  },
  {
    name: "5-3-2",
    rows: [
      ["ST", "ST"],
      ["CM", "CM", "CM"],
      ["LWB", "CB", "CB", "CB", "RWB"],
      ["GK"]
    ]
  }
];

const POSITION_GROUPS = {
  GK: ["GK"],
  DEF: ["CB", "LB", "RB", "LWB", "RWB"],
  MID: ["CDM", "CM", "CAM", "LM", "RM"],
  FWD: ["LW", "RW", "ST", "CF"]
};

const POSITION_LABELS = {
  GK: "Arquero",
  CB: "Defensor central",
  LB: "Lateral izquierdo",
  RB: "Lateral derecho",
  LWB: "Carrilero izquierdo",
  RWB: "Carrilero derecho",
  CDM: "Mediocentro defensivo",
  CM: "Mediocampista",
  CAM: "Enganche",
  LM: "Volante izquierdo",
  RM: "Volante derecho",
  LW: "Extremo izquierdo",
  RW: "Extremo derecho",
  ST: "Delantero",
  CF: "Segundo delantero"
};

const LEGENDS_BY_COUNTRY = [
  {
    id: "argentina",
    confederation: "CONMEBOL",
    country: "Argentina",
    flag: "🇦🇷",
    positions: {
      GK: ["Emiliano Martínez", "Ubaldo Fillol", "Sergio Goycochea", "Américo Tesoriere"],
      DEF: ["Daniel Passarella", "Javier Zanetti", "Roberto Ayala", "Oscar Ruggeri", "Nicolás Otamendi", "José Luis Brown"],
      MID: ["Diego Maradona", "Juan Román Riquelme", "Fernando Redondo", "Javier Mascherano", "Ángel Di María", "Pablo Aimar", "Ariel Ortega"],
      FWD: ["Lionel Messi", "Gabriel Batistuta", "Mario Kempes", "Sergio Agüero", "Hernán Crespo", "Alfredo Di Stéfano", "Claudio Caniggia"]
    }
  },
  {
    id: "brasil",
    confederation: "CONMEBOL",
    country: "Brasil",
    flag: "🇧🇷",
    positions: {
      GK: ["Cláudio Taffarel", "Dida", "Marcos", "Alisson Becker"],
      DEF: ["Cafu", "Roberto Carlos", "Carlos Alberto", "Thiago Silva", "Lúcio", "Dani Alves", "Nilton Santos"],
      MID: ["Pelé", "Zico", "Sócrates", "Kaká", "Ronaldinho", "Rivaldo", "Dunga"],
      FWD: ["Ronaldo Nazário", "Romário", "Neymar", "Garrincha", "Bebeto", "Adriano", "Jairzinho"]
    }
  },
  {
    id: "uruguay",
    confederation: "CONMEBOL",
    country: "Uruguay",
    flag: "🇺🇾",
    positions: {
      GK: ["Ladislao Mazurkiewicz", "Fernando Muslera", "Rodolfo Rodríguez"],
      DEF: ["Diego Godín", "José Nasazzi", "Obdulio Varela", "Paolo Montero", "José Santamaría", "Maximiliano Pereira"],
      MID: ["Enzo Francescoli", "Álvaro Recoba", "Pablo Bengoechea", "Rubén Sosa", "Juan Alberto Schiaffino", "Egidio Arévalo Ríos"],
      FWD: ["Luis Suárez", "Edinson Cavani", "Diego Forlán", "Alcides Ghiggia", "Óscar Míguez", "Héctor Scarone"]
    }
  },
  {
    id: "colombia",
    confederation: "CONMEBOL",
    country: "Colombia",
    flag: "🇨🇴",
    positions: {
      GK: ["René Higuita", "Óscar Córdoba", "David Ospina", "Faryd Mondragón"],
      DEF: ["Iván Córdoba", "Mario Yepes", "Andrés Escobar", "Luis Amaranto Perea", "Cristian Zapata"],
      MID: ["Carlos Valderrama", "James Rodríguez", "Freddy Rincón", "Leonel Álvarez", "Juan Cuadrado", "Macnelly Torres"],
      FWD: ["Radamel Falcao", "Faustino Asprilla", "Carlos Bacca", "Teófilo Gutiérrez", "Arnoldo Iguarán", "Luis Díaz"]
    }
  },
  {
    id: "chile",
    confederation: "CONMEBOL",
    country: "Chile",
    flag: "🇨🇱",
    positions: {
      GK: ["Claudio Bravo", "Roberto Rojas", "Sergio Livingstone", "Nelson Tapia"],
      DEF: ["Elías Figueroa", "Gary Medel", "Mauricio Isla", "Gonzalo Jara", "Waldo Ponce"],
      MID: ["Arturo Vidal", "Marcelo Salas", "Jorge Valdivia", "Charles Aránguiz", "David Pizarro", "Leonel Sánchez"],
      FWD: ["Alexis Sánchez", "Iván Zamorano", "Eduardo Vargas", "Humberto Suazo", "Carlos Caszely", "Esteban Paredes"]
    }
  },
  {
    id: "paraguay",
    confederation: "CONMEBOL",
    country: "Paraguay",
    flag: "🇵🇾",
    positions: {
      GK: ["José Luis Chilavert", "Justo Villar", "Roberto Fernández"],
      DEF: ["Carlos Gamarra", "Celso Ayala", "Paulo Da Silva", "Denis Caniza", "Julio César Cáceres"],
      MID: ["Julio César Romero", "Roberto Acuña", "Cristian Riveros", "Víctor Cáceres", "Miguel Almirón"],
      FWD: ["Roque Santa Cruz", "José Saturnino Cardozo", "Salvador Cabañas", "Nelson Haedo Valdez", "Óscar Cardozo", "Arsenio Erico"]
    }
  },
  {
    id: "peru",
    confederation: "CONMEBOL",
    country: "Perú",
    flag: "🇵🇪",
    positions: {
      GK: ["Ramón Quiroga", "Pedro Gallese", "Óscar Ibáñez"],
      DEF: ["Héctor Chumpitaz", "Julio Meléndez", "Alberto Rodríguez", "Nolberto Solano", "Juan Reynoso"],
      MID: ["Teófilo Cubillas", "César Cueto", "Roberto Chale", "Juan Carlos Oblitas", "Christian Cueva", "Yoshimar Yotún"],
      FWD: ["Paolo Guerrero", "Claudio Pizarro", "Jefferson Farfán", "Hugo Sotil", "Teodoro Fernández", "André Carrillo"]
    }
  },
  {
    id: "ecuador",
    confederation: "CONMEBOL",
    country: "Ecuador",
    flag: "🇪🇨",
    positions: {
      GK: ["José Francisco Cevallos", "Alexander Domínguez", "Hernán Galíndez"],
      DEF: ["Iván Hurtado", "Ulises de la Cruz", "Giovanny Espinoza", "Neicer Reasco", "Pervis Estupiñán"],
      MID: ["Álex Aguinaga", "Antonio Valencia", "Segundo Castillo", "Edison Méndez", "Christian Noboa", "Moisés Caicedo"],
      FWD: ["Agustín Delgado", "Enner Valencia", "Felipe Caicedo", "Ángel Mena", "Jaime Iván Kaviedes"]
    }
  },
  {
    id: "bolivia",
    confederation: "CONMEBOL",
    country: "Bolivia",
    flag: "🇧🇴",
    positions: {
      GK: ["Carlos Trucco", "José Carlo Fernández", "Romel Quiñónez"],
      DEF: ["Marco Sandy", "Ronald Raldes", "Luis Cristaldo", "Miguel Ángel Rimba", "Juan Manuel Peña"],
      MID: ["Marco Etcheverry", "Julio César Baldivieso", "Erwin Sánchez", "Ramiro Castillo", "Milton Melgar"],
      FWD: ["Erwin Romero", "Joaquín Botero", "Marcelo Martins Moreno", "Víctor Agustín Ugarte", "William Ramallo"]
    }
  },
  {
    id: "venezuela",
    confederation: "CONMEBOL",
    country: "Venezuela",
    flag: "🇻🇪",
    positions: {
      GK: ["Rafael Dudamel", "Renny Vega", "Wuilker Faríñez"],
      DEF: ["Fernando Amorebieta", "Oswaldo Vizcarrondo", "Roberto Rosales", "José Manuel Rey", "Wilker Ángel"],
      MID: ["Juan Arango", "Tomás Rincón", "Luis Manuel Seijas", "Yangel Herrera", "Jefferson Savarino"],
      FWD: ["Salomón Rondón", "Josef Martínez", "Giancarlo Maldonado", "Miku", "Rómulo Otero"]
    }
  }
];

const PLAYER_ALIASES = {
  "emiliano martinez": ["dibu", "dibu martinez", "emiliano martínez"],
  "ubaldo fillol": ["fillol", "pato fillol"],
  "diego maradona": ["maradona", "diego armando maradona"],
  "juan roman riquelme": ["riquelme", "roman", "román", "roman riquelme", "román riquelme"],
  "angel di maria": ["di maria", "di maría", "fideo"],
  "lionel messi": ["messi", "leo messi"],
  "gabriel batistuta": ["batistuta", "bati", "batigol"],
  "sergio aguero": ["aguero", "agüero", "kun", "kun aguero", "kun agüero"],
  "alfredo di stefano": ["di stefano", "di stéfano"],
  "claudio caniggia": ["caniggia"],
  "pele": ["pelé", "pele"],
  "ronaldo nazario": ["ronaldo", "ronaldo nazário", "fenomeno", "el fenomeno", "fenómeno"],
  "ronaldinho": ["dinho", "ronaldinho gaucho", "ronaldinho gaúcho"],
  "neymar": ["neymar jr", "neymar junior"],
  "romario": ["romário"],
  "mane garrincha": ["garrincha", "mané garrincha"],
  "luis suarez": ["suarez", "suárez", "luis suárez"],
  "edinson cavani": ["cavani"],
  "diego forlan": ["forlan", "forlán"],
  "enzo francescoli": ["francescoli", "el principe", "el príncipe"],
  "alvaro recoba": ["recoba", "chino recoba", "álvaro recoba"],
  "diego godin": ["godin", "godín"],
  "rene higuita": ["higuita", "rené higuita"],
  "carlos valderrama": ["valderrama", "el pibe", "pibe valderrama"],
  "james rodriguez": ["james", "james rodríguez"],
  "radamel falcao": ["falcao"],
  "faustino asprilla": ["asprilla", "tino asprilla"],
  "luis diaz": ["lucho diaz", "lucho díaz", "luis díaz"],
  "claudio bravo": ["bravo"],
  "elias figueroa": ["elías figueroa", "figueroa"],
  "arturo vidal": ["vidal", "king arturo"],
  "alexis sanchez": ["alexis", "alexis sánchez"],
  "ivan zamorano": ["zamorano", "bam bam", "iván zamorano"],
  "marcelo salas": ["salas", "matador", "el matador"],
  "jose luis chilavert": ["chilavert", "josé luis chilavert"],
  "jose saturnino cardozo": ["cardozo", "josé saturnino cardozo"],
  "salvador cabanas": ["cabanas", "cabañas", "salvador cabañas"],
  "teofilo cubillas": ["cubillas", "teófilo cubillas"],
  "cesar cueto": ["cueto", "césar cueto"],
  "paolo guerrero": ["guerrero"],
  "claudio pizarro": ["pizarro"],
  "jefferson farfan": ["farfan", "farfán"],
  "alex aguinaga": ["alex aguinaga", "álex aguinaga", "aguinaga"],
  "agustin delgado": ["agustin delgado", "agustín delgado", "tin delgado"],
  "marco etcheverry": ["etcheverry", "diablo etcheverry"],
  "julio cesar baldivieso": ["baldivieso", "julio césar baldivieso"],
  "marcelo martins moreno": ["marcelo moreno", "martins", "marcelo martins"],
  "juan arango": ["arango"],
  "salomon rondon": ["rondon", "rondón", "salomón rondón"],
  "josef martinez": ["josef", "josef martínez"],
  "tomas rincon": ["rincon", "rincón", "tomás rincón"]
};

let selectedFormation = FORMATIONS[0];
let slots = [];
let activeSlotId = null;
let correctCount = 0;
let attemptCount = 0;

const formationSelect = document.getElementById("formationSelect");
const formationBoard = document.getElementById("formationBoard");
const filledCountEl = document.getElementById("filledCount");
const correctCountEl = document.getElementById("correctCount");
const attemptCountEl = document.getElementById("attemptCount");
const newChallengeBtn = document.getElementById("newChallengeBtn");
const clearBtn = document.getElementById("clearBtn");
const answerDialog = document.getElementById("answerDialog");
const answerForm = document.getElementById("answerForm");
const closeDialogBtn = document.getElementById("closeDialogBtn");
const dialogCountryFlag = document.getElementById("dialogCountryFlag");
const dialogTitle = document.getElementById("dialogTitle");
const dialogSubtitle = document.getElementById("dialogSubtitle");
const answerInput = document.getElementById("answerInput");
const feedback = document.getElementById("feedback");
const hintBtn = document.getElementById("hintBtn");
const showAnswersBtn = document.getElementById("showAnswersBtn");
const validAnswersBox = document.getElementById("validAnswersBox");
const validAnswersList = document.getElementById("validAnswersList");
const helpBtn = document.getElementById("helpBtn");
const helpDialog = document.getElementById("helpDialog");
const closeHelpBtn = document.getElementById("closeHelpBtn");

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getPositionGroup(position) {
  for (const [group, positions] of Object.entries(POSITION_GROUPS)) {
    if (positions.includes(position)) return group;
  }

  return "MID";
}

function getPlayersForSlot(country, position) {
  const group = getPositionGroup(position);
  return country.positions[group] || [];
}

function getValidAnswers(country, position) {
  const players = getPlayersForSlot(country, position);
  const answers = [];

  players.forEach((player) => {
    const normalized = normalizeText(player);
    answers.push(normalized);

    const aliases = PLAYER_ALIASES[normalized] || [];
    aliases.forEach((alias) => answers.push(normalizeText(alias)));
  });

  return [...new Set(answers)];
}

function isValidAnswer(input, slot) {
  const answer = normalizeText(input);
  const validAnswers = getValidAnswers(slot.country, slot.position);

  return validAnswers.includes(answer);
}

function getCanonicalPlayer(input, slot) {
  const answer = normalizeText(input);
  const players = getPlayersForSlot(slot.country, slot.position);

  for (const player of players) {
    const normalized = normalizeText(player);
    const aliases = (PLAYER_ALIASES[normalized] || []).map(normalizeText);

    if (answer === normalized || aliases.includes(answer)) {
      return player;
    }
  }

  return input.trim();
}

function buildSlots() {
  const flatPositions = selectedFormation.rows.flat();
  const countries = shuffle(LEGENDS_BY_COUNTRY);

  slots = flatPositions.map((position, index) => {
    const country = countries[index % countries.length];

    return {
      id: `slot-${index}`,
      position,
      country,
      player: "",
      solved: false
    };
  });
}

function renderFormationOptions() {
  formationSelect.innerHTML = "";

  FORMATIONS.forEach((formation, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = formation.name;
    formationSelect.appendChild(option);
  });
}

function renderBoard() {
  formationBoard.innerHTML = "";

  let slotIndex = 0;

  selectedFormation.rows.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "formation-row";

    row.forEach(() => {
      const slot = slots[slotIndex];
      const button = document.createElement("button");

      button.type = "button";
      button.className = `player-slot${slot.solved ? " filled" : ""}`;
      button.dataset.slotId = slot.id;

      button.innerHTML = `
        <span class="slot-country">${slot.country.flag} ${slot.country.country}</span>
        <span class="slot-position">${slot.position}</span>
        ${
          slot.solved
            ? `<strong class="slot-name">${slot.player}</strong>`
            : `<span class="slot-placeholder">Elegir leyenda</span>`
        }
      `;

      button.addEventListener("click", () => openSlot(slot.id));

      rowEl.appendChild(button);
      slotIndex += 1;
    });

    formationBoard.appendChild(rowEl);
  });

  updateStats();
}

function updateStats() {
  const filled = slots.filter((slot) => slot.solved).length;

  filledCountEl.textContent = String(filled);
  correctCountEl.textContent = String(correctCount);
  attemptCountEl.textContent = String(attemptCount);
}

function setFeedback(message, type = "") {
  feedback.textContent = message;
  feedback.className = "feedback";

  if (type) feedback.classList.add(type);
}

function openSlot(slotId) {
  const slot = slots.find((item) => item.id === slotId);
  if (!slot) return;

  activeSlotId = slotId;

  dialogCountryFlag.textContent = slot.country.flag;
  dialogTitle.textContent = `${slot.country.country} · ${POSITION_LABELS[slot.position] || slot.position}`;
  dialogSubtitle.textContent = `Buscá una leyenda válida para ${slot.country.country} en posición ${slot.position}.`;

  answerInput.value = slot.player || "";
  setFeedback("", "");
  hideValidAnswers();

  if (typeof answerDialog.showModal === "function") {
    answerDialog.showModal();
    setTimeout(() => answerInput.focus(), 80);
  }
}

function closeAnswerDialog() {
  answerDialog.close();
}

function checkActiveAnswer() {
  const slot = slots.find((item) => item.id === activeSlotId);
  if (!slot) return;

  const value = answerInput.value.trim();

  if (!value) {
    setFeedback("Escribí una leyenda primero.", "warning");
    return;
  }

  attemptCount += 1;

  if (!isValidAnswer(value, slot)) {
    setFeedback("No cuenta para ese país y esa posición.", "error");
    updateStats();
    return;
  }

  const canonical = getCanonicalPlayer(value, slot);

  slot.player = canonical;
  slot.solved = true;

  correctCount += 1;

  setFeedback("¡Correcto! Casillero completado.", "success");
  renderBoard();
  updateStats();

  setTimeout(() => {
    if (answerDialog.open) closeAnswerDialog();
  }, 520);
}

function showHint() {
  const slot = slots.find((item) => item.id === activeSlotId);
  if (!slot) return;

  const players = getPlayersForSlot(slot.country, slot.position);
  if (!players.length) return;

  const randomPlayer = getRandomItem(players);
  setFeedback(`Pista: una respuesta empieza con “${randomPlayer[0].toUpperCase()}”.`, "warning");
}

function showValidAnswers() {
  const slot = slots.find((item) => item.id === activeSlotId);
  if (!slot) return;

  const players = getPlayersForSlot(slot.country, slot.position);

  validAnswersList.innerHTML = "";

  players.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = player;
    validAnswersList.appendChild(li);
  });

  validAnswersBox.classList.remove("hidden");
}

function hideValidAnswers() {
  validAnswersBox.classList.add("hidden");
  validAnswersList.innerHTML = "";
}

function newChallenge() {
  correctCount = 0;
  attemptCount = 0;
  buildSlots();
  renderBoard();
}

function clearChallenge() {
  slots = slots.map((slot) => ({
    ...slot,
    player: "",
    solved: false
  }));

  correctCount = 0;
  attemptCount = 0;
  renderBoard();
}

formationSelect.addEventListener("change", () => {
  selectedFormation = FORMATIONS[Number(formationSelect.value)] || FORMATIONS[0];
  newChallenge();
});

newChallengeBtn.addEventListener("click", newChallenge);
clearBtn.addEventListener("click", clearChallenge);

answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  checkActiveAnswer();
});

closeDialogBtn.addEventListener("click", closeAnswerDialog);
hintBtn.addEventListener("click", showHint);
showAnswersBtn.addEventListener("click", showValidAnswers);

helpBtn.addEventListener("click", () => {
  if (typeof helpDialog.showModal === "function") {
    helpDialog.showModal();
  }
});

closeHelpBtn.addEventListener("click", () => {
  helpDialog.close();
});

renderFormationOptions();
newChallenge();
