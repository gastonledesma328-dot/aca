/* ================================
   FECHAS APERTURA / CLAUSURA - LPF
================================ */

(function () {
  const DATA_URL_FECHAS = "../data/competiciones.json";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    if (!value) return "A confirmar";
    try {
      return new Intl.DateTimeFormat("es-AR", {
        weekday: "short",
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

  function teamName(team) {
    return team?.nombre || team?.nombre_corto || "Equipo";
  }

  function teamLogo(team) {
    const logo = team?.logo || "";
    return logo
      ? `<img class="competition-team-logo" src="${escapeHtml(logo)}" alt="" loading="lazy" />`
      : `<span class="competition-team-logo"></span>`;
  }

  function matchScore(match) {
    const localScore = match?.local?.marcador;
    const awayScore = match?.visitante?.marcador;
    if (localScore !== "" && awayScore !== "") return `${localScore} - ${awayScore}`;
    return "vs";
  }

  function ensureDatesStyles() {
    if (document.querySelector("#competition-fechas-style")) return;

    const style = document.createElement("style");
    style.id = "competition-fechas-style";
    style.textContent = `
      .competition-dates-switch {
        display: flex;
        gap: 8px;
        padding: 12px 12px 0;
        overflow-x: auto;
      }

      .competition-dates-switch button {
        min-height: 34px;
        border: 0;
        border-radius: 999px;
        color: rgba(240, 250, 244, 0.78);
        background: rgba(255, 255, 255, 0.07);
        padding: 0 14px;
        font-size: 11px;
        font-weight: 950;
        text-transform: uppercase;
        cursor: pointer;
      }

      .competition-dates-switch button.active {
        color: #173520;
        background: #5fcf80;
      }

      .competition-dates-groups {
        display: grid;
        gap: 10px;
        padding: 12px;
      }

      .competition-date-round {
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.035);
      }

      .competition-date-round-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        color: #baff78;
        background: rgba(95, 207, 128, 0.08);
        font-size: 12px;
        font-weight: 950;
        text-transform: uppercase;
      }

      .competition-date-round-head span {
        color: rgba(240, 250, 244, 0.58);
        font-size: 10px;
      }

      .competition-date-matches {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 8px;
        padding: 10px;
      }

      .competition-date-match {
        display: grid;
        gap: 8px;
        border-radius: 12px;
        color: #173520;
        background: #f2f7f3;
        padding: 10px;
      }

      .competition-date-match-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        color: rgba(24, 46, 34, 0.62);
        font-size: 10px;
        font-weight: 950;
        text-transform: uppercase;
      }

      .competition-date-match-teams {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: 8px;
        font-size: 11px;
        font-weight: 950;
      }

      .competition-date-team {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .competition-date-team:first-child {
        justify-content: flex-end;
        text-align: right;
      }

      .competition-date-team span:last-child {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .competition-date-score {
        min-width: 46px;
        border-radius: 8px;
        color: #fff;
        background: #1e3a2f;
        padding: 5px 7px;
        text-align: center;
        font-weight: 950;
      }
    `;
    document.head.appendChild(style);
  }

  function currentCompetitionId() {
    return document.body?.dataset?.competitionId || new URLSearchParams(window.location.search).get("id") || "";
  }

  function ensureDatesTabAndSection() {
    const tabs = document.querySelector(".competition-tabs");
    const grid = document.querySelector(".competition-grid");
    if (!tabs || !grid) return null;

    let tab = document.querySelector('[data-competition-tab="fechas"]');
    if (!tab) {
      const reference = document.querySelector('[data-competition-tab="proximos"]');
      tab = document.createElement("button");
      tab.className = "competition-tab";
      tab.type = "button";
      tab.dataset.competitionTab = "fechas";
      tab.textContent = "Fechas";
      tabs.insertBefore(tab, reference || null);
      tab.addEventListener("click", () => {
        document.querySelectorAll(".competition-tab").forEach((button) => {
          button.classList.toggle("active", button.dataset.competitionTab === "fechas");
        });
        document.querySelectorAll(".competition-section").forEach((section) => {
          section.classList.toggle("hidden", section.dataset.competitionSection !== "fechas");
        });
      });
    }

    let section = document.querySelector('[data-competition-section="fechas"]');
    if (!section) {
      section = document.createElement("article");
      section.className = "competition-card competition-section hidden";
      section.dataset.competitionSection = "fechas";
      section.innerHTML = `
        <div class="competition-card-head">
          <div>
            <p class="competition-section-kicker">Calendario</p>
            <h2>Fechas Apertura / Clausura</h2>
          </div>
        </div>
        <div class="competition-list" id="competitionDatesList"></div>
      `;
      const proximos = document.querySelector('[data-competition-section="proximos"]');
      grid.insertBefore(section, proximos || null);
    }

    return section.querySelector("#competitionDatesList");
  }

  function renderMatch(match) {
    const local = match.local?.equipo || {};
    const visitante = match.visitante?.equipo || {};

    return `
      <article class="competition-date-match">
        <div class="competition-date-match-top">
          <span>${escapeHtml(formatDate(match.fecha))}</span>
          <span>${escapeHtml(match.estado || "Programado")}</span>
        </div>
        <div class="competition-date-match-teams">
          <span class="competition-date-team">${teamLogo(local)}<span>${escapeHtml(teamName(local))}</span></span>
          <strong class="competition-date-score">${escapeHtml(matchScore(match))}</strong>
          <span class="competition-date-team">${teamLogo(visitante)}<span>${escapeHtml(teamName(visitante))}</span></span>
        </div>
      </article>
    `;
  }

  function renderRound(round) {
    const partidos = Array.isArray(round.partidos) ? round.partidos : [];
    return `
      <section class="competition-date-round">
        <div class="competition-date-round-head">
          <strong>${escapeHtml(round.nombre || "Fecha")}</strong>
          <span>${partidos.length} partido/s</span>
        </div>
        <div class="competition-date-matches">
          ${partidos.length ? partidos.map(renderMatch).join("") : `<p class="competition-empty">Sin partidos cargados.</p>`}
        </div>
      </section>
    `;
  }

  function renderTournament(container, fechas, torneo) {
    const list = Array.isArray(fechas?.[torneo]) ? fechas[torneo] : [];
    const title = torneo === "apertura" ? "Apertura" : "Clausura";

    if (!list.length) {
      container.innerHTML = `
        <div class="competition-dates-switch">
          <button type="button" data-torneo="apertura" class="${torneo === "apertura" ? "active" : ""}">Apertura</button>
          <button type="button" data-torneo="clausura" class="${torneo === "clausura" ? "active" : ""}">Clausura</button>
        </div>
        <p class="competition-empty">ESPN todavía no publicó fechas del ${title} en el scoreboard de Liga Profesional.</p>
      `;
    } else {
      container.innerHTML = `
        <div class="competition-dates-switch">
          <button type="button" data-torneo="apertura" class="${torneo === "apertura" ? "active" : ""}">Apertura</button>
          <button type="button" data-torneo="clausura" class="${torneo === "clausura" ? "active" : ""}">Clausura</button>
        </div>
        <div class="competition-dates-groups">
          ${list.map(renderRound).join("")}
        </div>
      `;
    }

    container.querySelectorAll("[data-torneo]").forEach((button) => {
      button.addEventListener("click", () => renderTournament(container, fechas, button.dataset.torneo));
    });
  }

  async function initDates() {
    if (currentCompetitionId() !== "liga-profesional") return;

    ensureDatesStyles();
    const container = ensureDatesTabAndSection();
    if (!container) return;

    container.innerHTML = `<p class="competition-empty">Cargando fechas desde ESPN...</p>`;

    try {
      const response = await fetch(`${DATA_URL_FECHAS}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const competition = (data.competiciones || []).find((item) => item.id === "liga-profesional" || item.slug === "arg.1");
      const fechas = competition?.especial?.fechas || {};
      const initial = fechas.clausura?.length ? "clausura" : "apertura";
      renderTournament(container, fechas, initial);
    } catch (error) {
      container.innerHTML = `<p class="competition-empty">No se pudieron cargar las fechas. Ejecutá el workflow Generar competiciones ESPN.</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", initDates);
  window.setTimeout(initDates, 500);
})();
