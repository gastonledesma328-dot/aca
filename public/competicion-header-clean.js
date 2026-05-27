function limpiarCabezaCompeticion() {
  const summary = document.querySelector("#competitionSummary");
  const updated = document.querySelector("#competitionUpdated");
  const subtitle = document.querySelector("#competitionHeroSubtitle");

  if (summary) {
    summary.innerHTML = "";
    summary.style.display = "none";
  }

  if (updated) {
    updated.textContent = "";
    updated.style.display = "none";
  }

  if (subtitle) {
    subtitle.textContent = subtitle.textContent
      .replace(/\s*·\s*Fuente:\s*.*$/i, "")
      .replace(/^\s*Fuente:\s*.*$/i, "")
      .trim();
  }
}

function obtenerTabActivaCompeticion() {
  const active = document.querySelector(".competition-tab.active");
  return active?.dataset?.competitionTab || "tabla";
}

function actualizarVisibilidadCuadro() {
  const cuadro = document.querySelector("#competitionLigaProfesionalExtras");
  if (!cuadro) return;

  const tabActiva = obtenerTabActivaCompeticion();
  cuadro.style.display = tabActiva === "tabla" ? "" : "none";
}

function iniciarControlCuadro() {
  document.querySelectorAll(".competition-tab").forEach((button) => {
    if (button.dataset.bracketVisibilityBound === "1") return;
    button.dataset.bracketVisibilityBound = "1";

    button.addEventListener("click", () => {
      window.setTimeout(actualizarVisibilidadCuadro, 0);
      window.setTimeout(actualizarVisibilidadCuadro, 80);
      window.setTimeout(aplicarPenalesUltimosResultados, 120);
    });
  });

  actualizarVisibilidadCuadro();
}

function asegurarEstiloPenales() {
  if (document.querySelector("#competition-penales-style")) return;

  const style = document.createElement("style");
  style.id = "competition-penales-style";
  style.textContent = `
    .competition-penalty-result {
      width: max-content;
      justify-self: center;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      color: #173520;
      background: #f6d431;
      padding: 3px 9px;
      font-size: 10px;
      font-weight: 950;
      letter-spacing: -0.01em;
      text-transform: uppercase;
      box-shadow: 0 5px 12px rgba(0, 0, 0, 0.14);
    }
  `;
  document.head.appendChild(style);
}

function obtenerCompetitionIdActual() {
  return document.body?.dataset?.competitionId || new URLSearchParams(window.location.search).get("id") || "";
}

function textoPenales(match) {
  if (!match) return "";

  const local = match.penales?.local || match.local?.penales || "";
  const visitante = match.penales?.visitante || match.visitante?.penales || "";

  if (local !== "" && visitante !== "") {
    return `Penales ${local} - ${visitante}`;
  }

  if (match.penales?.texto) {
    return match.penales.texto;
  }

  if (match.penales?.definicion) {
    return "Definido por penales";
  }

  return "";
}

let penalesCache = null;
let penalesCargando = false;

async function cargarPenalesCompeticion() {
  if (penalesCache || penalesCargando) return penalesCache;

  const competitionId = obtenerCompetitionIdActual();
  if (!competitionId) return null;

  penalesCargando = true;

  try {
    const response = await fetch(`../data/competiciones.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const competition = (data.competiciones || []).find((item) => item.id === competitionId || item.slug === competitionId);
    penalesCache = competition?.partidos?.ultimos || [];
  } catch (error) {
    penalesCache = [];
  } finally {
    penalesCargando = false;
  }

  return penalesCache;
}

async function aplicarPenalesUltimosResultados() {
  asegurarEstiloPenales();

  const ultimos = await cargarPenalesCompeticion();
  if (!Array.isArray(ultimos) || !ultimos.length) return;

  const cards = document.querySelectorAll('[data-competition-section="ultimos"] .competition-match');
  cards.forEach((card, index) => {
    if (card.dataset.penalesAplicados === "1") return;

    const label = textoPenales(ultimos[index]);
    if (!label) return;

    const marcador = card.querySelector(".competition-match-teams");
    if (!marcador) return;

    const pill = document.createElement("div");
    pill.className = "competition-penalty-result";
    pill.textContent = label;
    marcador.parentNode.insertBefore(pill, marcador);
    card.dataset.penalesAplicados = "1";
  });
}

function mantenimientoCompeticion() {
  limpiarCabezaCompeticion();
  iniciarControlCuadro();
  actualizarVisibilidadCuadro();
  aplicarPenalesUltimosResultados();
}

mantenimientoCompeticion();

let cleanHeaderTries = 0;
const cleanHeaderInterval = window.setInterval(() => {
  mantenimientoCompeticion();
  cleanHeaderTries += 1;

  if (cleanHeaderTries > 80) {
    window.clearInterval(cleanHeaderInterval);
  }
}, 100);

const cleanHeaderObserver = new MutationObserver(() => mantenimientoCompeticion());
cleanHeaderObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
