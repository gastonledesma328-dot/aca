/* ================================
   OCULTAR TEXTO VISIBLE CON ESPN
================================ */

(function () {
  const ESPN_REGEX = /ESPN/gi;
  const DATA_URL = "../data/competiciones.json";

  function limpiarTexto(value) {
    return String(value || "")
      .replace(/\s*·\s*Fuente:\s*[^·\n\r]*ESPN[^·\n\r]*/gi, "")
      .replace(/^\s*Fuente:\s*[^·\n\r]*ESPN[^·\n\r]*$/gi, "")
      .replace(/\s*desde\s+ESPN\s*/gi, " ")
      .replace(/\s*de\s+ESPN\s*/gi, " ")
      .replace(/\s*con\s+ESPN\s*/gi, " ")
      .replace(/ESPN\s*API/gi, "")
      .replace(ESPN_REGEX, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+·\s*$/g, "")
      .replace(/^\s*·\s+/g, "")
      .trim();
  }

  function limpiarNodoTexto(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    if (!ESPN_REGEX.test(node.nodeValue || "")) return;

    const limpio = limpiarTexto(node.nodeValue);
    node.nodeValue = limpio;
  }

  function limpiarAtributos(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

    ["title", "aria-label", "alt", "placeholder"].forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value && /ESPN/i.test(value)) {
        element.setAttribute(attr, limpiarTexto(value));
      }
    });
  }

  function limpiarElemento(root) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      limpiarNodoTexto(root);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    limpiarAtributos(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;

    while (node) {
      if (node.nodeType === Node.TEXT_NODE) limpiarNodoTexto(node);
      if (node.nodeType === Node.ELEMENT_NODE) limpiarAtributos(node);
      node = walker.nextNode();
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function competitionId() {
    return document.body?.dataset?.competitionId || new URLSearchParams(window.location.search).get("id") || "";
  }

  function fechaKey(value) {
    if (!value) return "sin-fecha";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "sin-fecha";
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);
      const get = (type) => parts.find((part) => part.type === type)?.value || "";
      return `${get("year")}-${get("month")}-${get("day")}`;
    } catch (error) {
      return String(value).slice(0, 10) || "sin-fecha";
    }
  }

  function fechaCorta(value) {
    if (!value || value === "sin-fecha") return "A confirmar";
    try {
      const date = new Date(`${value}T12:00:00`);
      return new Intl.DateTimeFormat("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(date).replace(".", "");
    } catch (error) {
      return value;
    }
  }

  function horaPartido(value) {
    if (!value) return "--:--";
    try {
      return new Intl.DateTimeFormat("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(value));
    } catch (error) {
      return String(value).slice(11, 16) || "--:--";
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

  function scoreText(match) {
    const local = match?.local?.marcador;
    const visitante = match?.visitante?.marcador;
    if (local !== "" && local != null && visitante !== "" && visitante != null) return `${local} - ${visitante}`;
    return "vs";
  }

  function quitarTabProximos() {
    document.querySelectorAll('[data-competition-tab="proximos"], [data-competition-section="proximos"]').forEach((node) => node.remove());
  }

  function renderMatchFecha(match) {
    const local = match?.local?.equipo || {};
    const visitante = match?.visitante?.equipo || {};
    return `
      <article class="competition-date-match">
        <div class="competition-date-match-time">${escapeHtml(horaPartido(match?.fecha))}</div>
        <div class="competition-date-match-teams">
          <span class="competition-match-team">${teamLogo(local)}<span>${escapeHtml(teamName(local))}</span></span>
          <strong class="competition-score">${escapeHtml(scoreText(match))}</strong>
          <span class="competition-match-team">${teamLogo(visitante)}<span>${escapeHtml(teamName(visitante))}</span></span>
        </div>
      </article>`;
  }

  function renderFechasHtml(matches) {
    const proximos = (Array.isArray(matches) ? matches : [])
      .filter((match) => match && !match.completado)
      .sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));

    if (!proximos.length) {
      return `<p class="competition-empty">No hay próximos partidos disponibles para esta competición.</p>`;
    }

    const grupos = new Map();
    proximos.forEach((match) => {
      const key = fechaKey(match.fecha);
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(match);
    });

    const keys = [...grupos.keys()].sort();
    const miniCalendario = keys.slice(0, 10).map((key, index) => `
      <a class="competition-mini-date ${index === 0 ? "is-next" : ""}" href="#fecha-${escapeHtml(key)}">
        <span>${escapeHtml(fechaCorta(key))}</span>
        <strong>${escapeHtml(grupos.get(key).length)}</strong>
      </a>`).join("");

    const fechas = keys.map((key, index) => `
      <section class="competition-date-group" id="fecha-${escapeHtml(key)}">
        <div class="competition-date-head">
          <span>${index === 0 ? "Próxima fecha" : "Fecha"}</span>
          <strong>${escapeHtml(fechaCorta(key))}</strong>
        </div>
        <div class="competition-date-matches">
          ${grupos.get(key).map(renderMatchFecha).join("")}
        </div>
      </section>`).join("");

    return `
      <div class="competition-dates-panel">
        <div class="competition-mini-calendar">
          ${miniCalendario}
        </div>
        ${fechas}
      </div>`;
  }

  async function renderizarFechasProximas() {
    const container = document.querySelector("#competitionDatesList");
    if (!container) return;

    const cardTitle = document.querySelector('[data-competition-section="fechas"] h2');
    if (cardTitle) cardTitle.textContent = "Próximos partidos por fecha";

    const kicker = document.querySelector('[data-competition-section="fechas"] .competition-section-kicker');
    if (kicker) kicker.textContent = "Calendario";

    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const comp = (data.competiciones || []).find((item) => item.id === competitionId() || item.slug === competitionId());
      if (!comp) throw new Error("No se encontró la competición");
      container.innerHTML = renderFechasHtml(comp.partidos?.proximos || []);
    } catch (error) {
      container.innerHTML = `<p class="competition-empty">No se pudieron cargar las fechas próximas.</p>`;
    }
  }

  function mejorarVisibilidadTitulosCero() {
    if (document.querySelector("#competition-zero-titles-style")) return;

    const style = document.createElement("style");
    style.id = "competition-zero-titles-style";
    style.textContent = `
      body[data-competition-id="liga-profesional"] [data-competition-tab="proximos"],
      body[data-competition-id="liga-profesional"] [data-competition-section="proximos"] {
        display: none !important;
      }

      body[data-competition-id="liga-profesional"] .competition-teams-grid {
        grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)) !important;
        gap: 12px !important;
        align-items: stretch !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card {
        min-height: 104px !important;
        height: auto !important;
        display: grid !important;
        grid-template-columns: 46px minmax(0, 1fr) !important;
        align-items: center !important;
        gap: 14px !important;
        padding: 16px 18px !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card > .competition-team-logo {
        width: 44px !important;
        height: 44px !important;
        justify-self: center !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card-main {
        min-width: 0 !important;
        width: 100% !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto !important;
        align-items: center !important;
        gap: 14px !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card-name {
        min-width: 0 !important;
        overflow: visible !important;
        text-overflow: unset !important;
        white-space: normal !important;
        line-height: 1.15 !important;
        display: block !important;
        -webkit-line-clamp: unset !important;
        -webkit-box-orient: unset !important;
        text-align: left !important;
        word-break: normal !important;
        overflow-wrap: anywhere !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles {
        min-width: 66px !important;
        height: 32px !important;
        justify-self: end !important;
        align-self: center !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 5px !important;
        padding: 0 10px !important;
        border-radius: 999px !important;
        font-weight: 950 !important;
        letter-spacing: -0.2px !important;
        position: relative !important;
        overflow: visible !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles::before {
        content: "🏆" !important;
        display: inline-block !important;
        font-size: 14px !important;
        line-height: 1 !important;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3)) !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles::after {
        content: none !important;
        display: none !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles small {
        display: none !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles strong {
        font-size: 14px !important;
        line-height: 1 !important;
        text-align: center !important;
        color: #442500 !important;
        text-shadow: none !important;
        position: relative !important;
        z-index: 1 !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.has-titles {
        color: #442500 !important;
        background: linear-gradient(180deg, #f7d24c 0%, #e0a91b 100%) !important;
        border: 1px solid rgba(255, 226, 101, 0.9) !important;
        box-shadow: 0 6px 14px rgba(224, 169, 27, 0.28), inset 0 -1px 0 rgba(93, 57, 0, 0.18) !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.no-titles {
        min-width: 54px !important;
        color: #fff6c7 !important;
        background: linear-gradient(180deg, rgba(132, 91, 19, 0.92), rgba(71, 45, 9, 0.92)) !important;
        border: 1px solid rgba(255, 216, 107, 0.45) !important;
        box-shadow: none !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.no-titles strong {
        color: #fff6c7 !important;
        text-shadow: none !important;
      }

      .competition-dates-panel {
        display: grid;
        gap: 16px;
      }

      .competition-mini-calendar {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        padding: 2px 2px 8px;
        scrollbar-width: thin;
      }

      .competition-mini-date {
        min-width: 92px;
        min-height: 58px;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 4px;
        color: #eaffef;
        text-decoration: none;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(21, 93, 55, 0.98), rgba(8, 62, 38, 0.98));
        border: 1px solid rgba(95, 207, 128, 0.35);
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
      }

      .competition-mini-date span {
        font-size: 11px;
        font-weight: 900;
        color: #baff78;
        text-transform: uppercase;
      }

      .competition-mini-date strong {
        min-width: 26px;
        height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        color: #173520;
        background: #5fcf80;
        font-size: 13px;
        font-weight: 950;
      }

      .competition-mini-date.is-next {
        border-color: rgba(186, 255, 120, 0.7);
        box-shadow: 0 0 0 1px rgba(186, 255, 120, 0.12), 0 12px 24px rgba(0, 0, 0, 0.22);
      }

      .competition-date-group {
        border-radius: 18px;
        overflow: hidden;
        border: 1px solid rgba(95, 207, 128, 0.26);
        background: rgba(5, 35, 23, 0.38);
      }

      .competition-date-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        background: rgba(14, 82, 50, 0.82);
        border-bottom: 1px solid rgba(95, 207, 128, 0.22);
      }

      .competition-date-head span {
        color: #9fb3a8;
        font-size: 11px;
        font-weight: 950;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .competition-date-head strong {
        color: #ffffff;
        font-size: 15px;
      }

      .competition-date-matches {
        display: grid;
        gap: 10px;
        padding: 12px;
      }

      .competition-date-match {
        display: grid;
        grid-template-columns: 58px minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        padding: 12px;
        border-radius: 16px;
        color: #eaffef;
        background: linear-gradient(180deg, rgba(21, 93, 55, 0.96), rgba(10, 62, 38, 0.96));
        border: 1px solid rgba(95, 207, 128, 0.35);
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
      }

      .competition-date-match-time {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        min-height: 32px;
        border-radius: 999px;
        color: #173520;
        background: #5fcf80;
        font-size: 12px;
        font-weight: 950;
      }

      .competition-date-match-teams {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: 10px;
      }

      .competition-date-match-teams .competition-match-team {
        min-width: 0;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: #ffffff;
        font-weight: 900;
      }

      .competition-date-match-teams .competition-match-team:last-child {
        justify-content: flex-end;
        text-align: right;
      }

      @media (max-width: 720px) {
        body[data-competition-id="liga-profesional"] .competition-teams-grid {
          grid-template-columns: 1fr !important;
        }

        body[data-competition-id="liga-profesional"] .competition-team-card {
          grid-template-columns: 42px minmax(0, 1fr) !important;
          min-height: 96px !important;
          padding: 14px 14px !important;
        }

        body[data-competition-id="liga-profesional"] .competition-team-card-main {
          gap: 10px !important;
        }

        .competition-date-match {
          grid-template-columns: 1fr;
        }

        .competition-date-match-time {
          width: fit-content;
          padding: 0 12px;
        }

        .competition-date-match-teams {
          grid-template-columns: 1fr;
        }

        .competition-date-match-teams .competition-score {
          width: fit-content;
          justify-self: center;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function limpiarTodo() {
    limpiarElemento(document.body || document.documentElement);
  }

  function initPersonalizaciones() {
    quitarTabProximos();
    limpiarTodo();
    mejorarVisibilidadTitulosCero();
    renderizarFechasProximas();
  }

  document.addEventListener("DOMContentLoaded", initPersonalizaciones);
  initPersonalizaciones();
  window.setTimeout(initPersonalizaciones, 250);
  window.setTimeout(initPersonalizaciones, 1000);
  window.setTimeout(initPersonalizaciones, 2500);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(limpiarElemento);
      if (mutation.type === "characterData") limpiarNodoTexto(mutation.target);
    });
    quitarTabProximos();
    mejorarVisibilidadTitulosCero();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
