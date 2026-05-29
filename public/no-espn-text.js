/* ================================
   PERSONALIZACIONES COMPETICIÓN
   - Oculta texto visible con ESPN
   - Mueve Próximos partidos a Fechas
   - Permite seleccionar fechas anteriores y futuras
   - Mantiene estilos de equipos/títulos
================================ */

(function () {
  const ESPN_REGEX = /ESPN/gi;
  const DATA_URL = "../data/competiciones.json";
  const TZ = "America/Argentina/Buenos_Aires";

  let fechasState = null;
  let fechasCargadasPara = "";
  let usuarioSeleccionoFecha = false;

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
    node.nodeValue = limpiarTexto(node.nodeValue);
  }

  function limpiarAtributos(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    ["title", "aria-label", "alt", "placeholder"].forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value && /ESPN/i.test(value)) element.setAttribute(attr, limpiarTexto(value));
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

  function limpiarTodo() {
    limpiarElemento(document.body || document.documentElement);
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
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "sin-fecha";
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
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

  function todayKey() {
    return fechaKey(new Date());
  }

  function fechaCorta(value) {
    if (!value || value === "sin-fecha") return "A confirmar";
    try {
      const date = new Date(`${value}T12:00:00`);
      return new Intl.DateTimeFormat("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(date).replace(/\./g, "");
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
        timeZone: TZ,
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

  function matchKey(match) {
    return match?.id || `${match?.local?.equipo?.nombre || ""}|${match?.visitante?.equipo?.nombre || ""}|${match?.fecha || ""}`;
  }

  function dedupeMatches(list) {
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach((match) => {
      const key = matchKey(match);
      if (!match || seen.has(key)) return;
      seen.add(key);
      out.push(match);
    });
    return out.sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
  }

  function mergePartidos(partidos) {
    return dedupeMatches([
      ...(Array.isArray(partidos?.todos) ? partidos.todos : []),
      ...(Array.isArray(partidos?.ultimos) ? partidos.ultimos : []),
      ...(Array.isArray(partidos?.proximos) ? partidos.proximos : []),
    ]);
  }

  function numeroFecha(match, fallbackIndex = null) {
    const value = match?.fecha_numero ?? match?.jornada ?? match?.round ?? match?.week;
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
    return fallbackIndex;
  }

  function labelRangoFecha(matches) {
    const keys = [...new Set((matches || []).map((match) => fechaKey(match.fecha)).filter(Boolean))].filter((key) => key !== "sin-fecha").sort();
    if (!keys.length) return "A confirmar";
    if (keys.length === 1) return fechaCorta(keys[0]);
    return `${fechaCorta(keys[0])} - ${fechaCorta(keys[keys.length - 1])}`;
  }

  function firstDateKey(matches) {
    return [...new Set((matches || []).map((match) => fechaKey(match.fecha)).filter((key) => key && key !== "sin-fecha"))].sort()[0] || "sin-fecha";
  }

  function buildJornadasFromEspecial(competition) {
    const fechas = competition?.especial?.fechas || {};
    const bloques = [];

    ["apertura", "clausura"].forEach((torneo) => {
      (Array.isArray(fechas[torneo]) ? fechas[torneo] : []).forEach((item, index) => {
        const partidos = dedupeMatches(item?.partidos || []);
        if (!partidos.length) return;

        const nombre = item?.nombre || `Fecha ${index + 1}`;
        const numeroMatch = String(nombre).match(/(\d+)/);
        const numero = numeroMatch ? Number(numeroMatch[1]) : index + 1;
        const key = `${torneo}-fecha-${String(numero).padStart(2, "0")}`;

        bloques.push({
          key,
          numero,
          torneo,
          nombre,
          partidos,
          firstDate: firstDateKey(partidos),
          dateLabel: labelRangoFecha(partidos),
        });
      });
    });

    return bloques;
  }

  function buildJornadasFromPartidos(partidos) {
    const grupos = new Map();
    const sorted = dedupeMatches(partidos);

    sorted.forEach((match) => {
      const num = numeroFecha(match, null);
      const key = num ? `fecha-${String(num).padStart(2, "0")}` : `dia-${fechaKey(match.fecha)}`;
      if (!grupos.has(key)) {
        grupos.set(key, {
          key,
          numero: num || null,
          torneo: "",
          nombre: num ? `Fecha ${num}` : fechaCorta(fechaKey(match.fecha)),
          partidos: [],
          firstDate: fechaKey(match.fecha),
          dateLabel: "",
        });
      }
      grupos.get(key).partidos.push(match);
    });

    return [...grupos.values()]
      .map((jornada) => ({
        ...jornada,
        partidos: dedupeMatches(jornada.partidos),
        firstDate: firstDateKey(jornada.partidos),
        dateLabel: labelRangoFecha(jornada.partidos),
      }))
      .sort((a, b) => {
        if (a.numero && b.numero && a.numero !== b.numero) return a.numero - b.numero;
        return String(a.firstDate).localeCompare(String(b.firstDate));
      });
  }

  function buildJornadas(competition) {
    const fromEspecial = buildJornadasFromEspecial(competition);
    if (fromEspecial.length) {
      return fromEspecial.sort((a, b) => {
        if (a.torneo !== b.torneo) return a.torneo === "apertura" ? -1 : 1;
        return (a.numero || 0) - (b.numero || 0);
      });
    }
    return buildJornadasFromPartidos(mergePartidos(competition?.partidos || {}));
  }

  function estadoJornada(jornada) {
    const today = todayKey();
    const dates = [...new Set(jornada.partidos.map((match) => fechaKey(match.fecha)).filter((key) => key !== "sin-fecha"))].sort();
    if (dates.includes(today)) return "En disputa";
    if (dates.length && dates[dates.length - 1] < today) return "Fecha anterior";
    return "Próxima fecha";
  }

  function seleccionarJornadaInicial(jornadas) {
    const today = todayKey();
    const enDisputa = jornadas.find((jornada) => jornada.partidos.some((match) => fechaKey(match.fecha) === today));
    if (enDisputa) return enDisputa.key;

    const proxima = jornadas.find((jornada) => (jornada.firstDate || "") >= today);
    if (proxima) return proxima.key;

    return jornadas[jornadas.length - 1]?.key || "";
  }

  function renderMatchFecha(match) {
    const local = match?.local?.equipo || {};
    const visitante = match?.visitante?.equipo || {};
    const estado = match?.estado || (match?.completado ? "Finalizado" : "Programado");

    return `
      <article class="competition-date-match">
        <div class="competition-date-match-time">
          <strong>${escapeHtml(horaPartido(match?.fecha))}</strong>
          <span>${escapeHtml(estado)}</span>
        </div>
        <div class="competition-date-match-teams">
          <span class="competition-match-team">${teamLogo(local)}<span>${escapeHtml(teamName(local))}</span></span>
          <strong class="competition-score">${escapeHtml(scoreText(match))}</strong>
          <span class="competition-match-team">${teamLogo(visitante)}<span>${escapeHtml(teamName(visitante))}</span></span>
        </div>
      </article>`;
  }

  function renderFechasSeleccionadas() {
    const container = document.querySelector("#competitionDatesList");
    if (!container || !fechasState) return;

    const { jornadas, selected } = fechasState;
    const jornada = jornadas.find((item) => item.key === selected) || jornadas[0];
    if (!jornada) {
      container.innerHTML = `<p class="competition-empty">No hay fechas disponibles para esta competición.</p>`;
      return;
    }

    const miniCalendario = jornadas.map((item) => `
      <button class="competition-mini-date ${item.key === jornada.key ? "is-selected" : ""} ${estadoJornada(item) === "En disputa" ? "is-today" : ""}" type="button" data-jornada-key="${escapeHtml(item.key)}">
        <span>${escapeHtml(item.nombre)}</span>
        <em>${escapeHtml(item.dateLabel)}</em>
        <strong>${escapeHtml(item.partidos.length)}</strong>
      </button>`).join("");

    container.innerHTML = `
      <div class="competition-dates-panel">
        <div class="competition-dates-toolbar">
          <div>
            <span>Fecha seleccionada</span>
            <strong>${escapeHtml(jornada.nombre)}</strong>
            <em>${escapeHtml(jornada.dateLabel)}</em>
          </div>
          <small>${escapeHtml(estadoJornada(jornada))}</small>
        </div>
        <div class="competition-mini-calendar" aria-label="Seleccionar fecha">
          ${miniCalendario}
        </div>
        <section class="competition-date-group" id="${escapeHtml(jornada.key)}">
          <div class="competition-date-head">
            <span>${escapeHtml(estadoJornada(jornada))}</span>
            <strong>${escapeHtml(jornada.nombre)} · ${escapeHtml(jornada.dateLabel)}</strong>
          </div>
          <div class="competition-date-matches">
            ${jornada.partidos.length ? jornada.partidos.map(renderMatchFecha).join("") : `<p class="competition-empty">No hay partidos cargados para esta fecha.</p>`}
          </div>
        </section>
      </div>`;
  }

  async function renderizarFechas() {
    const container = document.querySelector("#competitionDatesList");
    if (!container) return;

    const cardTitle = document.querySelector('[data-competition-section="fechas"] h2');
    if (cardTitle) cardTitle.textContent = "Fechas y partidos";

    const kicker = document.querySelector('[data-competition-section="fechas"] .competition-section-kicker');
    if (kicker) kicker.textContent = "Calendario completo";

    try {
      const currentId = competitionId();
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const competition = (data.competiciones || []).find((item) => item.id === currentId || item.slug === currentId);
      if (!competition) throw new Error("No se encontró la competición");

      const jornadas = buildJornadas(competition);
      const keys = jornadas.map((item) => item.key);
      const previousSelected = fechasState?.selected;
      const keepSelected = usuarioSeleccionoFecha && previousSelected && keys.includes(previousSelected);

      fechasState = {
        jornadas,
        selected: keepSelected ? previousSelected : seleccionarJornadaInicial(jornadas),
      };
      fechasCargadasPara = currentId;
      renderFechasSeleccionadas();
    } catch (error) {
      container.innerHTML = `<p class="competition-empty">No se pudieron cargar las fechas.</p>`;
    }
  }

  function aplicarEstilos() {
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
        color: #442500 !important;
        text-shadow: none !important;
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
      }

      .competition-dates-panel {
        display: grid;
        gap: 16px;
      }

      .competition-dates-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(21, 93, 55, 0.96), rgba(10, 62, 38, 0.96));
        border: 1px solid rgba(95, 207, 128, 0.35);
      }

      .competition-dates-toolbar span {
        display: block;
        color: #9fb3a8;
        font-size: 11px;
        font-weight: 950;
        text-transform: uppercase;
      }

      .competition-dates-toolbar strong {
        display: block;
        color: #ffffff;
        font-size: 18px;
        margin-top: 2px;
      }

      .competition-dates-toolbar em {
        display: block;
        color: #baff78;
        font-style: normal;
        font-size: 12px;
        font-weight: 900;
        margin-top: 2px;
      }

      .competition-dates-toolbar small {
        color: #173520;
        background: #5fcf80;
        border-radius: 999px;
        padding: 7px 10px;
        font-size: 12px;
        font-weight: 950;
        white-space: nowrap;
      }

      .competition-mini-calendar {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        padding: 2px 2px 8px;
        scrollbar-width: thin;
      }

      .competition-mini-date {
        min-width: 116px;
        min-height: 76px;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 3px;
        color: #eaffef;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(21, 93, 55, 0.98), rgba(8, 62, 38, 0.98));
        border: 1px solid rgba(95, 207, 128, 0.35);
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
        cursor: pointer;
      }

      .competition-mini-date span {
        font-size: 12px;
        font-weight: 950;
        color: #ffffff;
        text-transform: uppercase;
      }

      .competition-mini-date em {
        color: #baff78;
        font-style: normal;
        font-size: 10px;
        font-weight: 900;
      }

      .competition-mini-date strong {
        min-width: 24px;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        color: #173520;
        background: #5fcf80;
        font-size: 12px;
        font-weight: 950;
      }

      .competition-mini-date.is-today {
        border-color: rgba(186, 255, 120, 0.65);
      }

      .competition-mini-date.is-selected {
        border-color: rgba(186, 255, 120, 0.95);
        box-shadow: 0 0 0 2px rgba(186, 255, 120, 0.18), 0 12px 24px rgba(0, 0, 0, 0.22);
        transform: translateY(-1px);
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
        grid-template-columns: 74px minmax(0, 1fr);
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
        display: grid;
        justify-items: center;
        gap: 3px;
      }

      .competition-date-match-time strong {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        min-height: 32px;
        border-radius: 999px;
        color: #173520;
        background: #5fcf80;
        font-size: 12px;
        font-weight: 950;
        padding: 0 10px;
      }

      .competition-date-match-time span {
        color: #9fb3a8;
        font-size: 10px;
        font-weight: 900;
        text-align: center;
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

        .competition-dates-toolbar {
          align-items: flex-start;
          flex-direction: column;
        }

        .competition-date-match {
          grid-template-columns: 1fr;
        }

        .competition-date-match-time {
          width: fit-content;
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

  function initPersonalizaciones(forceReload = false) {
    quitarTabProximos();
    limpiarTodo();
    aplicarEstilos();

    const id = competitionId();
    const shouldLoad = forceReload || !fechasState || fechasCargadasPara !== id;
    if (shouldLoad) renderizarFechas();
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".competition-mini-date[data-jornada-key]");
    if (!button || !fechasState) return;
    usuarioSeleccionoFecha = true;
    fechasState.selected = button.dataset.jornadaKey;
    renderFechasSeleccionadas();
  });

  document.addEventListener("DOMContentLoaded", () => initPersonalizaciones(true));
  initPersonalizaciones(false);
  window.setTimeout(() => initPersonalizaciones(false), 250);
  window.setTimeout(() => initPersonalizaciones(false), 1000);
  window.setTimeout(() => initPersonalizaciones(false), 2500);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(limpiarElemento);
      if (mutation.type === "characterData") limpiarNodoTexto(mutation.target);
    });
    quitarTabProximos();
    aplicarEstilos();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
