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

  setHtml(teamsGrid, teams
    .map((team) => `
      <article class="competition-team-card">
        ${teamLogo(team)}
        <span>${escapeHtml(teamName(team))}</span>
      </article>`)
    .join(""));
}

function renderBracketPhase(title, matches) {
  const content = Array.isArray(matches) && matches.length
    ? matches.map((match) => {
        const local = match.local?.equipo || {};
        const visitante = match.visitante?.equipo || {};
        const winner = match.ganador ? teamName(match.ganador) : "Por definirse";
        return `
          <article class="competition-bracket-match">
            <div class="competition-bracket-date">${escapeHtml(formatDate(match.fecha))}</div>
            <div class="competition-bracket-teams">
              <span>${teamLogo(local)} ${escapeHtml(teamName(local))}</span>
              <strong>${escapeHtml(matchScore(match))}</strong>
              <span>${teamLogo(visitante)} ${escapeHtml(teamName(visitante))}</span>
            </div>
            <div class="competition-bracket-winner">Pasa: <strong>${escapeHtml(winner)}</strong></div>
          </article>`;
      }).join("")
    : `<p class="competition-empty">Sin cruces cargados en ESPN.</p>`;

  return `
    <section class="competition-bracket-phase">
      <h3>${escapeHtml(title)}</h3>
      <div class="competition-bracket-list">${content}</div>
    </section>`;
}

function renderLigaProfesionalExtras(competition) {
  const especial = competition.especial || null;
  if (especial?.tipo !== "liga_profesional_argentina") return;

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
        <h2>Apertura, Clausura y cuadro final</h2>
      </div>
    </div>
    <div class="competition-lpf-info">
      <article><span>Torneo terminado</span><strong>${escapeHtml(especial.torneo_anterior || "Apertura")}</strong></article>
      <article><span>Torneo siguiente</span><strong>${escapeHtml(especial.torneo_actual || "Clausura")}</strong></article>
      <article><span>Formato</span><strong>Zonas + Playoffs</strong></article>
    </div>
    <div class="competition-bracket">
      ${renderBracketPhase("Octavos", fases.octavos || [])}
      ${renderBracketPhase("Cuartos", fases.cuartos || [])}
      ${renderBracketPhase("Semifinales", fases.semis || [])}
      ${renderBracketPhase("Final", fases.final || [])}
    </div>
    <p class="competition-empty">${escapeHtml(especial.eliminatorias?.nota || "Los cruces se actualizan cuando ESPN los publica en el scoreboard.")}</p>
  `;

  const grid = document.querySelector(".competition-grid");
  if (grid) {
    grid.insertBefore(card, grid.firstChild);
  }
}

function setActiveTab(tab) {
  tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.competitionTab === tab));
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
