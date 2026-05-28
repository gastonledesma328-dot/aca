const DATA_URL = "../data/competiciones.json";
const params = new URLSearchParams(window.location.search);
const COMPETITION_ID = document.body.dataset.competitionId || params.get("id") || "";

const pageTitle = document.querySelector("#competitionPageTitle");
const heroTitle = document.querySelector("#competitionHeroTitle");
const heroSubtitle = document.querySelector("#competitionHeroSubtitle");
const updated = document.querySelector("#competitionUpdated");
const summary = document.querySelector("#competitionSummary");
const tableBody = document.querySelector("#competitionTableBody");
const nextList = document.querySelector("#competitionNextList");
const lastList = document.querySelector("#competitionLastList");
const teamsGrid = document.querySelector("#competitionTeamsGrid");
const tabButtons = document.querySelectorAll(".competition-tab");
const sections = document.querySelectorAll(".competition-section");

const BRACKET_PHASES = [
  { key: "octavos", title: "Octavos de final", slots: 8 },
  { key: "cuartos", title: "Cuartos de final", slots: 4 },
  { key: "semis", title: "Semifinales", slots: 2 },
  { key: "final", title: "Final", slots: 1 },
];

function setText(element, value) {
  if (element) element.textContent = value;
}

function setHtml(element, value) {
  if (element) element.innerHTML = value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date(value));
  } catch (error) {
    return String(value).slice(0, 16).replace("T", " ");
  }
}

function teamLogo(team) {
  const logo = team?.logo || "";
  return logo
    ? `<img class="competition-team-logo" src="${escapeHtml(logo)}" alt="" loading="lazy" />`
    : `<span class="competition-team-logo"></span>`;
}

function teamName(team) {
  return team?.nombre || team?.nombre_corto || "Equipo";
}

function teamTitles(team) {
  const direct = team?.titulos_primera_division;
  const nested = team?.titulos?.primera_division ?? team?.titulos?.liga ?? team?.titulos?.total;
  const value = direct ?? nested;

  if (value === "" || value == null || Number.isNaN(Number(value))) {
    return 0;
  }

  return Number(value);
}

function isLigaProfesionalPage(competition) {
  return competition?.id === "liga-profesional" || competition?.slug === "arg.1" || competition?.especial?.tipo === "liga_profesional_argentina";
}

function teamTitlesHtml(team, competition) {
  if (!isLigaProfesionalPage(competition)) return "";

  const titles = teamTitles(team);
  const label = titles === 1 ? "campeonato de Primera" : "campeonatos de Primera";

  return `
    <span class="competition-team-titles ${titles > 0 ? "has-titles" : "no-titles"}">
      <strong>${escapeHtml(titles)}</strong>
      <small>${escapeHtml(label)}</small>
    </span>`;
}

function renderSummary(competition) {
  const resumen = competition.resumen || {};
  const especial = competition.especial || null;
  const extra = especial?.tipo === "liga_profesional_argentina"
    ? [["Formato", "Apertura/Clausura"], ["Anual", especial.tabla_anual?.length || 0]]
    : [];

  setHtml(summary, [
    ["Equipos", resumen.equipos ?? competition.equipos?.length ?? 0],
    ["Tabla", resumen.posiciones ?? competition.tabla?.length ?? 0],
    ["Próximos", resumen.proximos ?? competition.partidos?.proximos?.length ?? 0],
    ["Últimos", resumen.ultimos ?? competition.partidos?.ultimos?.length ?? 0],
    ...extra,
  ]
    .map(([label, value]) => `<article class="competition-stat-box"><span>${label}</span><strong>${escapeHtml(value)}</strong></article>`)
    .join(""));
}

function groupedTableRows(tabla) {
  const groups = new Map();
  (tabla || []).forEach((row) => {
    const group = row.grupo || "General";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(row);
  });
  return groups;
}

function tableRowsHtml(rows, forceGroupName = "") {
  let html = "";
  (rows || []).forEach((row, index) => {
    const stats = row.stats || {};
    const equipo = row.equipo || {};
    html += `
      <tr>
        <td>${escapeHtml(stats.posicion || index + 1)}</td>
        <td class="team-cell">
          <span class="competition-team-inline">
            ${teamLogo(equipo)}
            <span>${escapeHtml(teamName(equipo))}</span>
          </span>
        </td>
        <td>${escapeHtml(stats.pj)}</td>
        <td>${escapeHtml(stats.g)}</td>
        <td>${escapeHtml(stats.e)}</td>
        <td>${escapeHtml(stats.p)}</td>
        <td>${escapeHtml(stats.gf)}</td>
        <td>${escapeHtml(stats.gc)}</td>
        <td>${escapeHtml(stats.dg)}</td>
        <td><strong>${escapeHtml(stats.pts)}</strong></td>
      </tr>`;
  });
  return html || `<tr><td colspan="10" class="team-cell">No hay datos disponibles para ${escapeHtml(forceGroupName || "esta tabla")}.</td></tr>`;
}

function tableHtml(title, rows, note = "") {
  return `
    <article class="competition-subtable">
      <div class="competition-subtable-head">
        <strong>${escapeHtml(title)}</strong>
        ${note ? `<span>${escapeHtml(note)}</span>` : ""}
      </div>
      <div class="competition-table-wrap">
        <table class="competition-table">
          <thead>
            <tr>
              <th>#</th><th class="team-cell">Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th>
            </tr>
          </thead>
          <tbody>${tableRowsHtml(rows, title)}</tbody>
        </table>
      </div>
    </article>`;
}

function renderTable(competition) {
  const especial = competition.especial || null;

  if (especial?.tipo === "liga_profesional_argentina") {
    const zonaA = especial.zonas?.a || [];
    const zonaB = especial.zonas?.b || [];
    const anual = especial.tabla_anual || [];
    const notaAnual = especial.tabla_anual_estimado
      ? "estimada con los datos disponibles de ESPN"
      : "tabla anual desde ESPN";

    setHtml(tableBody, `
      <tr>
        <td colspan="10" class="competition-special-cell">
          <div class="competition-special-tables">
            ${tableHtml("Zona A", zonaA)}
            ${tableHtml("Zona B", zonaB)}
            ${tableHtml("Tabla anual", anual, notaAnual)}
          </div>
        </td>
      </tr>
    `);
    return;
  }

  const tabla = Array.isArray(competition.tabla) ? competition.tabla : [];

  if (!tabla.length) {
    setHtml(tableBody, `<tr><td colspan="10" class="team-cell">No hay tabla disponible desde ESPN para esta competición.</td></tr>`);
    return;
  }

  const groups = groupedTableRows(tabla);
  let html = "";

  groups.forEach((rows, groupName) => {
    const showGroup = groups.size > 1 && groupName && groupName !== "General";
    if (showGroup) {
      html += `<tr><td colspan="10" class="competition-group-title">${escapeHtml(groupName)}</td></tr>`;
    }
    html += tableRowsHtml(rows, groupName);
  });

  setHtml(tableBody, html);
}

function matchScore(match) {
  const localScore = match?.local?.marcador;
  const awayScore = match?.visitante?.marcador;
  if (localScore !== "" && awayScore !== "") return `${localScore} - ${awayScore}`;
  return "vs";
}

function renderMatch(match) {
  const local = match.local?.equipo || {};
  const visitante = match.visitante?.equipo || {};

  return `
    <article class="competition-match">
      <div class="competition-match-top">
        <span>${escapeHtml(formatDate(match.fecha))}</span>
        <span>${escapeHtml(match.estado || "Programado")}</span>
      </div>
      <div class="competition-match-teams">
        <span class="competition-match-team">${teamLogo(local)}<span>${escapeHtml(teamName(local))}</span></span>
        <strong class="competition-score">${escapeHtml(matchScore(match))}</strong>
        <span class="competition-match-team">${teamLogo(visitante)}<span>${escapeHtml(teamName(visitante))}</span></span>
      </div>
    </article>`;
}

function renderMatches(container, matches, emptyText) {
  if (!container) return;

  if (!Array.isArray(matches) || !matches.length) {
    setHtml(container, `<p class="competition-empty">${escapeHtml(emptyText)}</p>`);
    return;
  }

  setHtml(container, matches.map(renderMatch).join(""));
}

function renderTeams(competition) {
  const teams = Array.isArray(competition.equipos) ? competition.equipos : [];

  if (!teams.length) {
    setHtml(teamsGrid, `<p class="competition-empty">No hay equipos disponibles desde ESPN para esta competición.</p>`);
    return;
  }

  const sortedTeams = [...teams].sort((a, b) => {
    if (!isLigaProfesionalPage(competition)) {
      return teamName(a).localeCompare(teamName(b), "es");
    }

    const diff = teamTitles(b) - teamTitles(a);
    if (diff !== 0) return diff;

    return teamName(a).localeCompare(teamName(b), "es");
  });

  setHtml(teamsGrid, sortedTeams
    .map((team) => `
      <article class="competition-team-card">
        ${teamLogo(team)}
        <span class="competition-team-card-main">
          <span class="competition-team-card-name">${escapeHtml(teamName(team))}</span>
          ${teamTitlesHtml(team, competition)}
        </span>
      </article>`)
    .join(""));
}

function injectBracketStyles() {
  if (document.querySelector("#competition-bracket-final-style")) return;

  const style = document.createElement("style");
  style.id = "competition-bracket-final-style";
  style.textContent = `
    .competition-bracket {
      width: 100%;
      overflow-x: auto;
      padding: 0 14px 14px;
    }

    .competition-bracket-tournament {
      min-width: 980px;
      display: grid;
      grid-template-columns: 1.15fr 1fr 0.9fr 0.85fr;
      gap: 18px;
      align-items: stretch;
      padding: 8px 0 2px;
    }

    .competition-bracket-phase {
      position: relative;
      min-width: 0;
      border-radius: 0;
      background: linear-gradient(180deg, rgba(20, 73, 45, 0.92), rgba(12, 57, 35, 0.92));
      overflow: visible;
      padding: 0 8px 8px;
    }

    .competition-bracket-phase::after {
      content: "";
      position: absolute;
      top: 38px;
      right: -10px;
      bottom: 12px;
      width: 1px;
      background: rgba(150, 255, 158, 0.12);
    }

    .competition-bracket-phase:last-child::after {
      display: none;
    }

    .competition-bracket-phase h3 {
      margin: 0 0 8px;
      padding: 0;
      min-height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      border: 0;
      font-size: 11px;
      font-weight: 950;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      text-align: center;
    }

    .competition-bracket-list {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 0;
    }

    .competition-bracket-phase[data-phase="octavos"] .competition-bracket-list {
      justify-content: flex-start;
    }

    .competition-bracket-phase[data-phase="cuartos"] .competition-bracket-list {
      justify-content: space-around;
      padding-block: 28px;
    }

    .competition-bracket-phase[data-phase="semis"] .competition-bracket-list {
      justify-content: space-around;
      padding-block: 88px;
    }

    .competition-bracket-phase[data-phase="final"] .competition-bracket-list {
      justify-content: center;
      padding-block: 170px;
    }

    .competition-bracket-match {
      position: relative;
      display: grid;
      gap: 0;
      border-radius: 4px;
      color: #eaffef;
      background: rgba(0, 111, 47, 0.82);
      border: 1px solid rgba(105, 255, 133, 0.16);
      padding: 0;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
    }

    .competition-bracket-match:not(.is-empty)::after {
      content: "";
      position: absolute;
      right: -18px;
      top: 50%;
      width: 18px;
      height: 1px;
      background: rgba(186, 255, 120, 0.38);
    }

    .competition-bracket-phase[data-phase="final"] .competition-bracket-match::after {
      display: none;
    }

    .competition-bracket-date,
    .competition-bracket-winner {
      display: none;
    }

    .competition-bracket-team-row {
      min-height: 25px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 26px;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      color: #ffffff;
      font-size: 11px;
      font-weight: 900;
    }

    .competition-bracket-team-row + .competition-bracket-team-row {
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }

    .competition-bracket-team-row.is-winner {
      color: #fff36c;
      background: rgba(45, 170, 70, 0.45);
    }

    .competition-bracket-team-row.is-empty-team {
      color: rgba(255, 255, 255, 0.4);
      background: rgba(255, 255, 255, 0.04);
    }

    .competition-bracket-team-name {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 5px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .competition-bracket-team-name img,
    .competition-bracket-team-name .competition-team-logo {
      width: 15px;
      height: 15px;
      flex: 0 0 15px;
      border-radius: 50%;
      object-fit: contain;
      background: rgba(255, 255, 255, 0.95);
    }

    .competition-bracket-team-score {
      justify-self: end;
      min-width: 18px;
      text-align: right;
      color: inherit;
      font-size: 11px;
      font-weight: 950;
    }

    .competition-bracket-badge {
      position: absolute;
      top: -11px;
      right: -8px;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      border-radius: 999px;
      color: #173520;
      background: #f6d431;
      padding: 2px 7px;
      font-size: 8px;
      font-weight: 950;
      text-transform: uppercase;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
    }

    .competition-bracket-placeholder-note {
      margin: 8px 14px 0;
      color: rgba(240, 250, 244, 0.62);
      font-size: 11px;
      font-weight: 800;
    }

    @media (max-width: 760px) {
      .competition-bracket-tournament {
        min-width: 860px;
        gap: 12px;
      }

      .competition-bracket-team-row {
        font-size: 10px;
      }
    }
  `;
  document.head.appendChild(style);
}

function asScore(value) {
  return value === "" || value == null ? "" : String(value);
}

function isWinner(match, side) {
  return match?.[side]?.ganador === true;
}

function renderBracketTeamRow(team, score, winner, emptyText = "Por definir") {
  const isEmpty = !team || (!team.nombre && !team.nombre_corto && !team.logo);
  return `
    <div class="competition-bracket-team-row ${winner ? "is-winner" : ""} ${isEmpty ? "is-empty-team" : ""}">
      <span class="competition-bracket-team-name">
        ${isEmpty ? `<span class="competition-team-logo"></span>` : teamLogo(team)}
        <span>${escapeHtml(isEmpty ? emptyText : teamName(team))}</span>
      </span>
      <span class="competition-bracket-team-score">${escapeHtml(asScore(score))}</span>
    </div>`;
}

function normalizePhaseMatches(matches, slots) {
  const list = Array.isArray(matches) ? matches.slice(0, slots) : [];
  while (list.length < slots) {
    list.push({ empty: true });
  }
  return list;
}

function renderBracketMatch(match, phaseKey) {
  const local = match?.local?.equipo || null;
  const visitante = match?.visitante?.equipo || null;
  const localScore = match?.local?.marcador;
  const awayScore = match?.visitante?.marcador;
  const showFinalBadge = phaseKey === "final" && !match?.empty;

  return `
    <article class="competition-bracket-match ${match?.empty ? "is-empty" : ""}">
      ${showFinalBadge ? `<span class="competition-bracket-badge">🏆 Final</span>` : ""}
      ${renderBracketTeamRow(local, localScore, isWinner(match, "local"))}
      ${renderBracketTeamRow(visitante, awayScore, isWinner(match, "visitante"))}
    </article>`;
}

function renderBracketPhase(phase, matches) {
  const slots = normalizePhaseMatches(matches, phase.slots);
  return `
    <section class="competition-bracket-phase" data-phase="${escapeHtml(phase.key)}">
      <h3>${escapeHtml(phase.title)}</h3>
      <div class="competition-bracket-list">
        ${slots.map((match) => renderBracketMatch(match, phase.key)).join("")}
      </div>
    </section>`;
}

function renderLigaProfesionalExtras(competition) {
  const especial = competition.especial || null;
  if (especial?.tipo !== "liga_profesional_argentina") return;

  injectBracketStyles();

  const existing = document.querySelector("#competitionLigaProfesionalExtras");
  if (existing) existing.remove();

  const fases = especial.eliminatorias?.fases || {};
  const card = document.createElement("article");
  card.className = "competition-card competition-lpf-extras";
  card.id = "competitionLigaProfesionalExtras";
  card.innerHTML = `
    <div class="competition-card-head">
      <div>
        <p class="competition-section-kicker">Liga Profesional</p>
        <h2>Cuadro de enfrentamientos</h2>
      </div>
    </div>
    <div class="competition-lpf-info">
      <article><span>Torneo terminado</span><strong>${escapeHtml(especial.torneo_anterior || "Apertura")}</strong></article>
      <article><span>Torneo siguiente</span><strong>${escapeHtml(especial.torneo_actual || "Clausura")}</strong></article>
      <article><span>Formato</span><strong>16 equipos · Eliminación directa</strong></article>
    </div>
    <div class="competition-bracket">
      <div class="competition-bracket-tournament">
        ${BRACKET_PHASES.map((phase) => renderBracketPhase(phase, fases[phase.key] || [])).join("")}
      </div>
    </div>
    <p class="competition-bracket-placeholder-note">${escapeHtml(especial.eliminatorias?.nota || "Los cruces se actualizan cuando ESPN los publica en el scoreboard.")}</p>
  `;

  const grid = document.querySelector(".competition-grid");
  if (grid) {
    grid.insertBefore(card, grid.firstChild);
  }
}

function setActiveTab(tab) {
  tabButtons.forEach((button) => button.classList.toggle("active", button.datasetCompetitionTab === tab || button.dataset.competitionTab === tab));
  sections.forEach((section) => section.classList.toggle("hidden", section.dataset.competitionSection !== tab));
}

function renderCompetition(competition) {
  const title = competition.nombre_largo || competition.nombre || "Competición";
  document.title = `${title} | Partidos Hoy`;

  setText(pageTitle, title);
  setText(heroTitle, title);
  setText(heroSubtitle, `${competition.pais || competition.grupo || "Fútbol"} · Temporada ${competition.season || "actual"} · Fuente: ${competition.fuente || "ESPN API"}`);
  setText(updated, `Actualizado: ${formatDate(competition.actualizado)}`);

  renderSummary(competition);
  renderTable(competition);
  renderLigaProfesionalExtras(competition);
  renderMatches(nextList, competition.partidos?.proximos, "No hay próximos partidos disponibles para esta competición.");
  renderMatches(lastList, competition.partidos?.ultimos, "No hay últimos resultados disponibles para esta competición.");
  renderTeams(competition);
}

async function init() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.competitionTab));
  });

  try {
    const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const competitions = Array.isArray(data.competiciones) ? data.competiciones : [];
    const competition = competitions.find((item) => item.id === COMPETITION_ID || item.slug === COMPETITION_ID);

    if (!competition) {
      throw new Error(`No se encontró la competición: ${COMPETITION_ID}`);
    }

    renderCompetition(competition);
    setActiveTab("tabla");
  } catch (error) {
    setText(heroTitle, "No se pudo cargar la competición");
    setText(heroSubtitle, error.message);
    setText(updated, "Actualizando...");
    setHtml(summary, "");
    setHtml(tableBody, `<tr><td colspan="10" class="team-cell">Ejecutá el workflow Generar competiciones ESPN para crear public/data/competiciones.json.</td></tr>`);
    setActiveTab("tabla");
  }
}

init();
