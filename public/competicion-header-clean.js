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
      window.setTimeout(corregirOrdenBracketLigaProfesional, 180);
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

  const localNum = Number(local);
  const visitanteNum = Number(visitante);

  if (
    esNumeroPenales(local) &&
    esNumeroPenales(visitante) &&
    (localNum > 0 || visitanteNum > 0) &&
    localNum !== visitanteNum
  ) {
    return `Penales ${local} - ${visitante}`;
  }

  return "";
}

let penalesCache = null;
let penalesCargando = false;
let competicionCache = null;
let competicionCargando = false;

async function cargarCompeticionActual() {
  if (competicionCache || competicionCargando) return competicionCache;

  const competitionId = obtenerCompetitionIdActual();
  if (!competitionId) return null;

  competicionCargando = true;

  try {
    const response = await fetch(`../data/competiciones.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    competicionCache = (data.competiciones || []).find((item) => item.id === competitionId || item.slug === competitionId) || null;
  } catch (error) {
    competicionCache = null;
  } finally {
    competicionCargando = false;
  }

  return competicionCache;
}

async function cargarPenalesCompeticion() {
  if (penalesCache || penalesCargando) return penalesCache || [];

  const competition = await cargarCompeticionActual();
  penalesCache = competition?.partidos?.ultimos || [];
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
    const oldPill = card.querySelector(".competition-penalty-result");
    const label = textoPenales(ultimos[index]);

    if (!label) {
      if (oldPill) oldPill.remove();
      card.dataset.penalesAplicados = "";
      return;
    }

    if (oldPill) {
      oldPill.textContent = label;
      card.dataset.penalesAplicados = "1";
      return;
    }

    const marcador = card.querySelector(".competition-match-teams");
    if (!marcador) return;

    const pill = document.createElement("div");
    pill.className = "competition-penalty-result";
    pill.textContent = label;
    marcador.parentNode.insertBefore(pill, marcador);
    card.dataset.penalesAplicados = "1";
  });
}

function normalizarTextoBracket(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamKey(team) {
  if (!team) return "";
  return String(team.id || team.slug || normalizarTextoBracket(team.nombre || team.nombre_corto || ""));
}

function teamNameBracket(team) {
  return team?.nombre || team?.nombre_corto || "Por definir";
}

function teamLogoBracket(team) {
  const logo = team?.logo || "";
  return logo
    ? `<img class="competition-team-logo" src="${logo.replace(/"/g, "&quot;")}" alt="" loading="lazy" />`
    : `<span class="competition-team-logo"></span>`;
}

function equiposDelPartido(match) {
  return [match?.local?.equipo, match?.visitante?.equipo].filter(Boolean);
}

function ganadorDelPartido(match) {
  if (match?.ganador) return match.ganador;
  if (match?.local?.ganador) return match.local.equipo;
  if (match?.visitante?.ganador) return match.visitante.equipo;
  return null;
}

function keysEsperadasDesdePrevios(prevMatches) {
  const keys = [];
  (prevMatches || []).forEach((match) => {
    const winner = ganadorDelPartido(match);
    if (winner) {
      const key = teamKey(winner);
      if (key) keys.push(key);
      return;
    }

    equiposDelPartido(match).forEach((team) => {
      const key = teamKey(team);
      if (key) keys.push(key);
    });
  });
  return [...new Set(keys)];
}

function matchContieneKey(match, key) {
  return equiposDelPartido(match).some((team) => teamKey(team) === key);
}

function ordenarFasePorLlaves(prevOrdered, phaseMatches, slots) {
  const remaining = Array.isArray(phaseMatches) ? [...phaseMatches] : [];
  const ordered = [];

  for (let slot = 0; slot < slots; slot += 1) {
    const prevPair = prevOrdered.slice(slot * 2, slot * 2 + 2);
    const expected = keysEsperadasDesdePrevios(prevPair);

    let foundIndex = -1;
    if (expected.length) {
      foundIndex = remaining.findIndex((match) => expected.filter((key) => matchContieneKey(match, key)).length >= Math.min(2, expected.length));
      if (foundIndex < 0) {
        foundIndex = remaining.findIndex((match) => expected.some((key) => matchContieneKey(match, key)));
      }
    }

    if (foundIndex < 0) foundIndex = remaining.findIndex((match) => !match.empty);
    ordered.push(foundIndex >= 0 ? remaining.splice(foundIndex, 1)[0] : { empty: true });
  }

  return ordered;
}

function normalizePhaseMatchesBracket(matches, slots) {
  const list = Array.isArray(matches) ? matches.slice(0, slots) : [];
  while (list.length < slots) list.push({ empty: true });
  return list;
}

function ordenarFasesEliminacion(fases) {
  const octavos = normalizePhaseMatchesBracket(fases.octavos || [], 8);
  const cuartos = ordenarFasePorLlaves(octavos, fases.cuartos || [], 4);
  const semis = ordenarFasePorLlaves(cuartos, fases.semis || [], 2);
  const final = ordenarFasePorLlaves(semis, fases.final || [], 1);
  return { octavos, cuartos, semis, final };
}

function renderBracketTeamRowFix(team, score, winner) {
  const empty = !team || (!team.nombre && !team.nombre_corto && !team.logo);
  return `
    <div class="competition-bracket-team-row ${winner ? "is-winner" : ""} ${empty ? "is-empty-team" : ""}">
      <span class="competition-bracket-team-name">
        ${empty ? `<span class="competition-team-logo"></span>` : teamLogoBracket(team)}
        <span>${empty ? "Por definir" : teamNameBracket(team)}</span>
      </span>
      <span class="competition-bracket-team-score">${score == null ? "" : String(score)}</span>
    </div>`;
}

function renderBracketMatchFix(match, phaseKey) {
  const local = match?.local?.equipo || null;
  const visitante = match?.visitante?.equipo || null;
  return `
    <article class="competition-bracket-match ${match?.empty ? "is-empty" : ""}">
      ${phaseKey === "final" && !match?.empty ? `<span class="competition-bracket-badge">🏆 Final</span>` : ""}
      ${renderBracketTeamRowFix(local, match?.local?.marcador, match?.local?.ganador)}
      ${renderBracketTeamRowFix(visitante, match?.visitante?.marcador, match?.visitante?.ganador)}
    </article>`;
}

function renderBracketPhaseFix(key, title, matches) {
  return `
    <section class="competition-bracket-phase" data-phase="${key}">
      <h3>${title}</h3>
      <div class="competition-bracket-list">
        ${matches.map((match) => renderBracketMatchFix(match, key)).join("")}
      </div>
    </section>`;
}

async function corregirOrdenBracketLigaProfesional() {
  if (obtenerCompetitionIdActual() !== "liga-profesional") return;

  const tournament = document.querySelector(".competition-bracket-tournament");
  if (!tournament || tournament.dataset.llavesCorregidas === "1") return;

  const competition = await cargarCompeticionActual();
  const fases = competition?.especial?.eliminatorias?.fases;
  if (!fases) return;

  const ordered = ordenarFasesEliminacion(fases);
  tournament.innerHTML = `
    ${renderBracketPhaseFix("octavos", "Octavos de final", ordered.octavos)}
    ${renderBracketPhaseFix("cuartos", "Cuartos de final", ordered.cuartos)}
    ${renderBracketPhaseFix("semis", "Semifinales", ordered.semis)}
    ${renderBracketPhaseFix("final", "Final", ordered.final)}
  `;
  tournament.dataset.llavesCorregidas = "1";
}

function mantenimientoCompeticionSeguro() {
  limpiarCabezaCompeticion();
  iniciarControlCuadro();
  actualizarVisibilidadCuadro();
  aplicarPenalesUltimosResultados();
  corregirOrdenBracketLigaProfesional();
}

mantenimientoCompeticionSeguro();

document.addEventListener("click", (event) => {
  if (event.target.closest(".competition-tab")) {
    window.setTimeout(mantenimientoCompeticionSeguro, 0);
    window.setTimeout(mantenimientoCompeticionSeguro, 80);
    window.setTimeout(aplicarPenalesUltimosResultados, 250);
    window.setTimeout(corregirOrdenBracketLigaProfesional, 300);
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
