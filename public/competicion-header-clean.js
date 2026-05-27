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

  cuadro.style.display = obtenerTabActivaCompeticion() === "tabla" ? "" : "none";
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
      max-width: 100%;
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

function esNumeroPenales(valor) {
  return /^\d+$/.test(String(valor ?? "").trim());
}

function textoPenales(match) {
  if (!match) return "";

  const local = match.penales?.local || match.local?.penales || "";
  const visitante = match.penales?.visitante || match.visitante?.penales || "";

  // Solo mostramos penales si ESPN entrega marcador real de tanda para ambos equipos.
  // Si no se disputó por penales, o si solo aparece texto genérico, no se agrega nada.
  if (esNumeroPenales(local) && esNumeroPenales(visitante)) {
    return `Penales ${local} - ${visitante}`;
  }

  return "";
}

let penalesCache = null;
let penalesCargando = false;

async function cargarPenalesCompeticion() {
  if (penalesCache || penalesCargando) return penalesCache || [];

  const competitionId = obtenerCompetitionIdActual();
  if (!competitionId) return [];

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

  const section = document.querySelector('[data-competition-section="ultimos"]');
  if (!section) return;

  const ultimos = await cargarPenalesCompeticion();
  if (!Array.isArray(ultimos) || !ultimos.length) return;

  const cards = section.querySelectorAll(".competition-match");
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

function mantenimientoCompeticionSeguro() {
  limpiarCabezaCompeticion();
  iniciarControlCuadro();
  actualizarVisibilidadCuadro();
  aplicarPenalesUltimosResultados();
}

mantenimientoCompeticionSeguro();

document.addEventListener("click", (event) => {
  if (event.target.closest(".competition-tab")) {
    window.setTimeout(mantenimientoCompeticionSeguro, 0);
    window.setTimeout(mantenimientoCompeticionSeguro, 80);
    window.setTimeout(aplicarPenalesUltimosResultados, 250);
  }
});

let cleanHeaderTries = 0;
const cleanHeaderInterval = window.setInterval(() => {
  mantenimientoCompeticionSeguro();
  cleanHeaderTries += 1;

  if (cleanHeaderTries > 40) {
    window.clearInterval(cleanHeaderInterval);
  }
}, 150);
