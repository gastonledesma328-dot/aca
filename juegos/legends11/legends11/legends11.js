const POSITIONS = [
  { id: "GK", label: "Arquero" },
  { id: "DEF", label: "Defensor" },
  { id: "MID", label: "Mediocampista" },
  { id: "FWD", label: "Delantero" }
];

const LEGENDS_BY_COUNTRY = [
  {
    id: "argentina",
    confederation: "CONMEBOL",
    country: "Argentina",
    flag: "🇦🇷",
    positions: {
      GK: [
        "Emiliano Martínez",
        "Ubaldo Fillol",
        "Sergio Goycochea",
        "Américo Tesoriere"
      ],
      DEF: [
        "Daniel Passarella",
        "Javier Zanetti",
        "Roberto Ayala",
        "Oscar Ruggeri",
        "Nicolás Otamendi",
        "José Luis Brown"
      ],
      MID: [
        "Diego Maradona",
        "Juan Román Riquelme",
        "Fernando Redondo",
        "Javier Mascherano",
        "Ángel Di María",
        "Pablo Aimar",
        "Ariel Ortega"
      ],
      FWD: [
        "Lionel Messi",
        "Gabriel Batistuta",
        "Mario Kempes",
        "Sergio Agüero",
        "Hernán Crespo",
        "Alfredo Di Stéfano",
        "Claudio Caniggia"
      ]
    }
  },
  {
    id: "brasil",
    confederation: "CONMEBOL",
    country: "Brasil",
    flag: "🇧🇷",
    positions: {
      GK: [
        "Cláudio Taffarel",
        "Dida",
        "Marcos",
        "Alisson Becker"
      ],
      DEF: [
        "Cafu",
        "Roberto Carlos",
        "Carlos Alberto",
        "Thiago Silva",
        "Lúcio",
        "Dani Alves",
        "Nilton Santos"
      ],
      MID: [
        "Pelé",
        "Zico",
        "Sócrates",
        "Kaká",
        "Ronaldinho",
        "Rivaldo",
        "Dunga"
      ],
      FWD: [
        "Ronaldo Nazário",
        "Romário",
        "Neymar",
        "Garrincha",
        "Bebeto",
        "Adriano",
        "Jairzinho"
      ]
    }
  },
  {
    id: "uruguay",
    confederation: "CONMEBOL",
    country: "Uruguay",
    flag: "🇺🇾",
    positions: {
      GK: [
        "Ladislao Mazurkiewicz",
        "Fernando Muslera",
        "Rodolfo Rodríguez"
      ],
      DEF: [
        "Diego Godín",
        "José Nasazzi",
        "Obdulio Varela",
        "Paolo Montero",
        "José Santamaría",
        "Maximiliano Pereira"
      ],
      MID: [
        "Enzo Francescoli",
        "Álvaro Recoba",
        "Pablo Bengoechea",
        "Rubén Sosa",
        "Juan Alberto Schiaffino",
        "Egidio Arévalo Ríos"
      ],
      FWD: [
        "Luis Suárez",
        "Edinson Cavani",
        "Diego Forlán",
        "Alcides Ghiggia",
        "Óscar Míguez",
        "Héctor Scarone"
      ]
    }
  },
  {
    id: "colombia",
    confederation: "CONMEBOL",
    country: "Colombia",
    flag: "🇨🇴",
    positions: {
      GK: [
        "René Higuita",
        "Óscar Córdoba",
        "David Ospina",
        "Faryd Mondragón"
      ],
      DEF: [
        "Iván Córdoba",
        "Mario Yepes",
        "Andrés Escobar",
        "Luis Amaranto Perea",
        "Cristian Zapata"
      ],
      MID: [
        "Carlos Valderrama",
        "James Rodríguez",
        "Freddy Rincón",
        "Leonel Álvarez",
        "Juan Cuadrado",
        "Macnelly Torres"
      ],
      FWD: [
        "Radamel Falcao",
        "Faustino Asprilla",
        "Carlos Bacca",
        "Teófilo Gutiérrez",
        "Arnoldo Iguarán",
        "Luis Díaz"
      ]
    }
  },
  {
    id: "chile",
    confederation: "CONMEBOL",
    country: "Chile",
    flag: "🇨🇱",
    positions: {
      GK: [
        "Claudio Bravo",
        "Roberto Rojas",
        "Sergio Livingstone",
        "Nelson Tapia"
      ],
      DEF: [
        "Elías Figueroa",
        "Gary Medel",
        "Mauricio Isla",
        "Gonzalo Jara",
        "Waldo Ponce"
      ],
      MID: [
        "Arturo Vidal",
        "Marcelo Salas",
        "Jorge Valdivia",
        "Charles Aránguiz",
        "David Pizarro",
        "Leonel Sánchez"
      ],
      FWD: [
        "Alexis Sánchez",
        "Iván Zamorano",
        "Eduardo Vargas",
        "Humberto Suazo",
        "Carlos Caszely",
        "Esteban Paredes"
      ]
    }
  },
  {
    id: "paraguay",
    confederation: "CONMEBOL",
    country: "Paraguay",
    flag: "🇵🇾",
    positions: {
      GK: [
        "José Luis Chilavert",
        "Justo Villar",
        "Roberto Fernández"
      ],
      DEF: [
        "Carlos Gamarra",
        "Celso Ayala",
        "Paulo Da Silva",
        "Denis Caniza",
        "Julio César Cáceres"
      ],
      MID: [
        "Julio César Romero",
        "Roberto Acuña",
        "Cristian Riveros",
        "Víctor Cáceres",
        "Miguel Almirón"
      ],
      FWD: [
        "Roque Santa Cruz",
        "José Saturnino Cardozo",
        "Salvador Cabañas",
        "Nelson Haedo Valdez",
        "Óscar Cardozo",
        "Arsenio Erico"
      ]
    }
  },
  {
    id: "peru",
    confederation: "CONMEBOL",
    country: "Perú",
    flag: "🇵🇪",
    positions: {
      GK: [
        "Ramón Quiroga",
        "Pedro Gallese",
        "Óscar Ibáñez"
      ],
      DEF: [
        "Héctor Chumpitaz",
        "Julio Meléndez",
        "Alberto Rodríguez",
        "Nolberto Solano",
        "Juan Reynoso"
      ],
      MID: [
        "Teófilo Cubillas",
        "César Cueto",
        "Roberto Chale",
        "Juan Carlos Oblitas",
        "Christian Cueva",
        "Yoshimar Yotún"
      ],
      FWD: [
        "Paolo Guerrero",
        "Claudio Pizarro",
        "Jefferson Farfán",
        "Hugo Sotil",
        "Teodoro Fernández",
        "André Carrillo"
      ]
    }
  },
  {
    id: "ecuador",
    confederation: "CONMEBOL",
    country: "Ecuador",
    flag: "🇪🇨",
    positions: {
      GK: [
        "José Francisco Cevallos",
        "Alexander Domínguez",
        "Hernán Galíndez"
      ],
      DEF: [
        "Iván Hurtado",
        "Ulises de la Cruz",
        "Giovanny Espinoza",
        "Neicer Reasco",
        "Pervis Estupiñán"
      ],
      MID: [
        "Álex Aguinaga",
        "Antonio Valencia",
        "Segundo Castillo",
        "Edison Méndez",
        "Christian Noboa",
        "Moisés Caicedo"
      ],
      FWD: [
        "Agustín Delgado",
        "Enner Valencia",
        "Felipe Caicedo",
        "Ángel Mena",
        "Jaime Iván Kaviedes"
      ]
    }
  },
  {
    id: "bolivia",
    confederation: "CONMEBOL",
    country: "Bolivia",
    flag: "🇧🇴",
    positions: {
      GK: [
        "Carlos Trucco",
        "José Carlo Fernández",
        "Romel Quiñónez"
      ],
      DEF: [
        "Marco Sandy",
        "Ronald Raldes",
        "Luis Cristaldo",
        "Miguel Ángel Rimba",
        "Juan Manuel Peña"
      ],
      MID: [
        "Marco Etcheverry",
        "Julio César Baldivieso",
        "Erwin Sánchez",
        "Ramiro Castillo",
        "Milton Melgar"
      ],
      FWD: [
        "Erwin Romero",
        "Joaquín Botero",
        "Marcelo Martins Moreno",
        "Víctor Agustín Ugarte",
        "William Ramallo"
      ]
    }
  },
  {
    id: "venezuela",
    confederation: "CONMEBOL",
    country: "Venezuela",
    flag: "🇻🇪",
    positions: {
      GK: [
        "Rafael Dudamel",
        "Renny Vega",
        "Wuilker Faríñez"
      ],
      DEF: [
        "Fernando Amorebieta",
        "Oswaldo Vizcarrondo",
        "Roberto Rosales",
        "José Manuel Rey",
        "Wilker Ángel"
      ],
      MID: [
        "Juan Arango",
        "Tomás Rincón",
        "Luis Manuel Seijas",
        "Yangel Herrera",
        "Jefferson Savarino"
      ],
      FWD: [
        "Salomón Rondón",
        "Josef Martínez",
        "Giancarlo Maldonado",
        "Miku",
        "Rómulo Otero"
      ]
    }
  }
];

const PLAYER_ALIASES = {
  "emiliano martinez": ["dibu", "dibu martinez", "emiliano martínez"],
  "ubaldo fillol": ["fillol", "pato fillol"],
  "sergio goycochea": ["goycochea"],
  "diego maradona": ["maradona", "diego armando maradona"],
  "juan roman riquelme": ["riquelme", "roman", "román", "roman riquelme", "román riquelme"],
  "angel di maria": ["di maria", "di maría", "fideo"],
  "lionel messi": ["messi", "leo", "leo messi"],
  "gabriel batistuta": ["batistuta", "bati", "batigol"],
  "sergio aguero": ["aguero", "agüero", "kun", "kun aguero", "kun agüero"],
  "alfredo di stefano": ["di stefano", "di stéfano"],
  "claudio caniggia": ["caniggia", "cani"],

  "pele": ["pelé", "pele"],
  "ronaldo nazario": ["ronaldo", "ronaldo nazário", "fenomeno", "el fenomeno", "el fenómeno"],
  "ronaldinho": ["dinho", "ronaldinho gaucho", "ronaldinho gaúcho"],
  "neymar": ["neymar jr", "neymar junior"],
  "romario": ["romário"],
  "garrincha": ["mane garrincha", "mané garrincha"],

  "luis suarez": ["suarez", "suárez", "luis suárez"],
  "edinson cavani": ["cavani"],
  "diego forlan": ["forlan", "forlán"],
  "enzo francescoli": ["francescoli", "el principe", "el príncipe"],
  "alvaro recoba": ["recoba", "chino recoba", "álvaro recoba"],
  "diego godin": ["godin", "godín"],

  "rene higuita": ["higuita", "rené higuita"],
  "carlos valderrama": ["valderrama", "el pibe", "pibe valderrama"],
  "james rodriguez": ["james", "james rodríguez"],
  "radamel falcao": ["falcao", "radamel falcao garcia", "radamel falcao garcía"],
  "faustino asprilla": ["asprilla", "tino asprilla"],
  "luis diaz": ["lucho diaz", "lucho díaz", "luis díaz"],

  "claudio bravo": ["bravo"],
  "elias figueroa": ["elías figueroa", "figueroa"],
  "arturo vidal": ["vidal", "king arturo"],
  "alexis sanchez": ["alexis", "alexis sánchez"],
  "ivan zamorano": ["zamorano", "bam bam", "iván zamorano"],
  "marcelo salas": ["salas", "matador", "el matador"],

  "jose luis chilavert": ["chilavert", "josé luis chilavert"],
  "carlos gamarra": ["gamarra"],
  "roque santa cruz": ["santa cruz"],
  "jose saturnino cardozo": ["cardozo", "josé saturnino cardozo"],
  "salvador cabanas": ["cabanas", "cabañas", "salvador cabañas"],
  "arsenio erico": ["erico", "érico"],

  "teofilo cubillas": ["cubillas", "teófilo cubillas"],
  "cesar cueto": ["cueto", "césar cueto"],
  "paolo guerrero": ["guerrero"],
  "claudio pizarro": ["pizarro"],
  "jefferson farfan": ["farfan", "farfán"],
  "hugo sotil": ["sotil"],

  "alex aguinaga": ["alex aguinaga", "álex aguinaga", "aguinaga"],
  "antonio valencia": ["valencia"],
  "agustin delgado": ["agustin delgado", "agustín delgado", "tin delgado"],
  "enner valencia": ["enner"],

  "marco etcheverry": ["etcheverry", "el diablo", "diablo etcheverry"],
  "julio cesar baldivieso": ["baldivieso", "julio césar baldivieso"],
  "marcelo martins moreno": ["marcelo moreno", "martins", "marcelo martins"],

  "juan arango": ["arango"],
  "salomon rondon": ["rondon", "rondón", "salomón rondón"],
  "josef martinez": ["josef", "josef martínez"],
  "tomas rincon": ["rincon", "rincón", "tomás rincón"]
};

let currentChallenge = null;
let correctCount = 0;
let attemptCount = 0;
let alreadySolved = false;

const countryFlagEl = document.getElementById("countryFlag");
const countryNameEl = document.getElementById("countryName");
const positionNameEl = document.getElementById("positionName");
const answerInput = document.getElementById("answerInput");
const checkBtn = document.getElementById("checkBtn");
const feedbackEl = document.getElementById("feedback");
const hintBtn = document.getElementById("hintBtn");
const newBtn = document.getElementById("newBtn");
const showBtn = document.getElementById("showBtn");
const answersPanel = document.getElementById("answersPanel");
const answersList = document.getElementById("answersList");
const correctCountEl = document.getElementById("correctCount");
const attemptCountEl = document.getElementById("attemptCount");
const countryCountEl = document.getElementById("countryCount");
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

function getValidPlayers(country, positionId) {
  return country.positions[positionId] || [];
}

function getValidAnswers(country, positionId) {
  const players = getValidPlayers(country, positionId);
  const answers = [];

  players.forEach((player) => {
    const normalizedPlayer = normalizeText(player);
    answers.push(normalizedPlayer);

    const aliases = PLAYER_ALIASES[normalizedPlayer] || [];
    aliases.forEach((alias) => {
      answers.push(normalizeText(alias));
    });
  });

  return [...new Set(answers)];
}

function isCorrectAnswer(input, country, positionId) {
  const answer = normalizeText(input);
  const validAnswers = getValidAnswers(country, positionId);

  return validAnswers.includes(answer);
}

function generateChallenge() {
  const country = getRandomItem(LEGENDS_BY_COUNTRY);

  const availablePositions = POSITIONS.filter((position) => {
    return getValidPlayers(country, position.id).length > 0;
  });

  const position = getRandomItem(availablePositions);

  return {
    country,
    position
  };
}

function renderChallenge() {
  currentChallenge = generateChallenge();
  alreadySolved = false;

  countryFlagEl.textContent = currentChallenge.country.flag;
  countryNameEl.textContent = currentChallenge.country.country;
  positionNameEl.textContent = currentChallenge.position.label;

  answerInput.value = "";
  answerInput.focus();

  setFeedback("", "");
  hideAnswers();
}

function setFeedback(message, type) {
  feedbackEl.textContent = message;
  feedbackEl.className = "feedback";

  if (type) {
    feedbackEl.classList.add(type);
  }
}

function updateStats() {
  correctCountEl.textContent = String(correctCount);
  attemptCountEl.textContent = String(attemptCount);
  countryCountEl.textContent = String(LEGENDS_BY_COUNTRY.length);
}

function checkAnswer() {
  if (!currentChallenge) return;

  const value = answerInput.value.trim();

  if (!value) {
    setFeedback("Escribí un jugador primero.", "warning");
    return;
  }

  if (alreadySolved) {
    setFeedback("Ya resolviste este desafío. Tocá “Nuevo desafío”.", "warning");
    return;
  }

  attemptCount += 1;

  const correct = isCorrectAnswer(
    value,
    currentChallenge.country,
    currentChallenge.position.id
  );

  if (correct) {
    correctCount += 1;
    alreadySolved = true;
    setFeedback("¡Correcto! Leyenda válida.", "success");
  } else {
    setFeedback("No cuenta para este país y posición. Probá otra.", "error");
  }

  updateStats();
}

function showHint() {
  if (!currentChallenge) return;

  const players = getValidPlayers(
    currentChallenge.country,
    currentChallenge.position.id
  );

  if (!players.length) return;

  const player = getRandomItem(players);
  const firstLetter = player.trim().charAt(0).toUpperCase();

  setFeedback(`Pista: una respuesta empieza con “${firstLetter}”.`, "warning");
}

function showAnswers() {
  if (!currentChallenge) return;

  const players = getValidPlayers(
    currentChallenge.country,
    currentChallenge.position.id
  );

  answersList.innerHTML = "";

  players.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = player;
    answersList.appendChild(li);
  });

  answersPanel.classList.remove("hidden");
}

function hideAnswers() {
  answersPanel.classList.add("hidden");
  answersList.innerHTML = "";
}

checkBtn.addEventListener("click", checkAnswer);

answerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    checkAnswer();
  }
});

hintBtn.addEventListener("click", showHint);
newBtn.addEventListener("click", renderChallenge);
showBtn.addEventListener("click", showAnswers);

helpBtn.addEventListener("click", () => {
  if (typeof helpDialog.showModal === "function") {
    helpDialog.showModal();
  }
});

closeHelpBtn.addEventListener("click", () => {
  helpDialog.close();
});

updateStats();
renderChallenge();
