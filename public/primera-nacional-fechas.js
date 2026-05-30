(() => {
  const competitionId = document.body?.dataset?.competitionId || new URLSearchParams(window.location.search).get("id") || "";
  if (competitionId !== "primera-nacional") return;

  const DATA_URL = "../data/equipos_primera_nacional.json";
  const TZ = "America/Argentina/Buenos_Aires";
  const PARTIDOS_POR_FECHA = 18;
  let state = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fechaKey(value) {
    if (!value) return "sin-fecha";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value).slice(0, 10) || "sin-fecha";
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      const get = (type) => parts.find((part) => part.type === type)?.value || "";
      return `${get("year")}-${get("month")}-${get("day")}`;
    } catch (error) {
      return String(value).slice(0, 10) || "sin-fecha";
    }
  }

  function fechaCorta(key) {
    if (!key || key === "sin-fecha") return "A confirmar";
    try {
      return new Intl.DateTimeFormat("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(`${key}T12:00:00`)).replace(/\./g, "");
    } catch (error) {
      return key;
    }
  }

  function hora(value, horaTexto = "") {
    if (horaTexto && horaTexto !== "Ver horario") return horaTexto;
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

  function todayKey() {
    return fechaKey(new Date());
  }

  function logo(src) {
    return src
      ? `<img class="season-team-logo" src="${escapeHtml(src)}" alt="" loading="lazy" />`
      : `<span class="season-team-logo"></span>`;
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchKey(match) {
    if (match.id) return String(match.id);
    const names = [normalizeText(match.local), normalizeText(match.visitante)].sort().join("-");
    return `${fechaKey(match.fecha_iso || match.dia)}-${names}`;
  }

  function normalizeMatch(raw, tipo) {
    const fecha = raw?.fecha_iso || raw?.fecha || raw?.dia || "";
    const resultado = String(raw?.resultado || "");
    let marcadorLocal = raw?.marcador_local ?? "";
    let marcadorVisitante = raw?.marcador_visitante ?? "";

    if ((!marcadorLocal && !marcadorVisitante) && /^\s*\d+\s*-\s*\d+\s*$/.test(resultado)) {
      const [l, v] = resultado.split("-").map((x) => x.trim());
      marcadorLocal = l;
      marcadorVisitante = v;
    }

    return {
      id: raw?.id || "",
      tipo,
      fecha,
      fecha_iso: fecha,
      dia: raw?.dia || fechaKey(fecha),
      hora: raw?.hora || "",
      local: raw?.local || "Local",
      visitante: raw?.visitante || "Visitante",
      local_logo: raw?.local_logo || "",
      visitante_logo: raw?.visitante_logo || "",
      marcador_local: marcadorLocal,
      marcador_visitante: marcadorVisitante,
      estado: raw?.estado || (tipo === "resultado" ? "Final" : "Programado"),
    };
  }

  function collectMatches(equipos) {
    const map = new Map();

    (Array.isArray(equipos) ? equipos : []).forEach((equipo) => {
      (equipo?.resultados || []).forEach((match) => {
        const normalized = normalizeMatch(match, "resultado");
        map.set(matchKey(normalized), normalized);
      });
      (equipo?.proximosPartidos || []).forEach((match) => {
        const normalized = normalizeMatch(match, "proximo");
        map.set(matchKey(normalized), normalized);
      });
    });

    return [...map.values()].sort((a, b) => String(a.fecha_iso || a.dia).localeCompare(String(b.fecha_iso || b.dia)));
  }

  function firstDate(partidos) {
    return [...new Set((partidos || []).map((p) => fechaKey(p.fecha_iso || p.dia)).filter((k) => k && k !== "sin-fecha"))].sort()[0] || "sin-fecha";
  }

  function lastDate(partidos) {
    const keys = [...new Set((partidos || []).map((p) => fechaKey(p.fecha_iso || p.dia)).filter((k) => k && k !== "sin-fecha"))].sort();
    return keys[keys.length - 1] || "sin-fecha";
  }

  function rango(partidos) {
    const a = firstDate(partidos);
    const b = lastDate(partidos);
    if (a === "sin-fecha") return "A confirmar";
    if (a === b) return fechaCorta(a);
    return `${fechaCorta(a)} - ${fechaCorta(b)}`;
  }

  function buildItems(matches) {
    const sorted = [...matches].sort((a, b) => String(a.fecha_iso || a.dia).localeCompare(String(b.fecha_iso || b.dia)));
    const items = [];

    for (let i = 0; i < sorted.length; i += PARTIDOS_POR_FECHA) {
      const partidos = sorted.slice(i, i + PARTIDOS_POR_FECHA);
      if (!partidos.length) continue;
      const numero = Math.floor(i / PARTIDOS_POR_FECHA) + 1;
      items.push({
        key: `fecha-${String(numero).padStart(2, "0")}`,
        nombre: `Fecha ${numero}`,
        partidos,
        firstDate: firstDate(partidos),
        lastDate: lastDate(partidos),
        dateLabel: rango(partidos),
      });
    }

    return items;
  }

  function seleccionInicial(items) {
    const today = todayKey();
    const actual = items.find((item) => item.firstDate <= today && item.lastDate >= today);
    if (actual) return actual.key;
    const proxima = items.find((item) => item.firstDate >= today);
    return proxima?.key || items[items.length - 1]?.key || "";
  }

  function indiceActual() {
    return Math.max(0, state?.items?.findIndex((x) => x.key === state.selected) ?? 0);
  }

  function seleccionarPorIndice(nextIndex) {
    if (!state?.items?.length) return;
    const safe = Math.max(0, Math.min(state.items.length - 1, nextIndex));
    state.selected = state.items[safe].key;
    render();
  }

  function score(match) {
    const l = match?.marcador_local;
    const v = match?.marcador_visitante;
    if (l !== "" && l != null && v !== "" && v != null) return `${l} - ${v}`;
    return "-";
  }

  function renderPartido(match) {
    return `
      <div class="season-row">
        <div class="season-time">${escapeHtml(hora(match?.fecha_iso, match?.hora))}</div>
        <div class="season-team season-home"><span>${escapeHtml(match?.local || "Local")}</span>${logo(match?.local_logo)}</div>
        <strong class="season-score">${escapeHtml(score(match))}</strong>
        <div class="season-team season-away">${logo(match?.visitante_logo)}<span>${escapeHtml(match?.visitante || "Visitante")}</span></div>
      </div>`;
  }

  function renderPartidosPorDia(partidos) {
    const grupos = new Map();
    (partidos || []).forEach((match) => {
      const key = fechaKey(match.fecha_iso || match.dia);
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(match);
    });

    return [...grupos.keys()].sort().map((key) => `
      <div class="season-date-head">${escapeHtml(fechaCorta(key))}</div>
      ${grupos.get(key).map(renderPartido).join("")}
    `).join("");
  }

  function render() {
    const box = document.querySelector("#competitionDatesList");
    if (!box || !state) return;

    const item = state.items.find((x) => x.key === state.selected) || state.items[0];
    if (!item) {
      box.innerHTML = `<p class="competition-empty">No hay fechas disponibles para Primera Nacional.</p>`;
      return;
    }

    const index = indiceActual();
    const canPrev = index > 0;
    const canNext = index < state.items.length - 1;
    const options = state.items.map((x) => `<option value="${escapeHtml(x.key)}" ${x.key === item.key ? "selected" : ""}>${escapeHtml(x.nombre)} · ${escapeHtml(x.dateLabel)}</option>`).join("");

    box.innerHTML = `
      <div class="season-fixture-card pn-fixture-card">
        <h3 class="season-title">PRIMERA NACIONAL</h3>
        <div class="season-nav">
          <button class="season-arrow" type="button" data-pn-season-prev ${canPrev ? "" : "disabled"} aria-label="Fecha anterior">‹</button>
          <label class="season-select-wrap">
            <span>${escapeHtml(item.nombre.toUpperCase())}▼</span>
            <select class="season-select" data-pn-season-select aria-label="Seleccionar fecha">
              ${options}
            </select>
          </label>
          <button class="season-arrow" type="button" data-pn-season-next ${canNext ? "" : "disabled"} aria-label="Fecha siguiente">›</button>
        </div>
        <div class="season-table">
          <div class="season-rows">
            ${item.partidos.length ? renderPartidosPorDia(item.partidos) : `<div class="season-empty">No hay partidos cargados.</div>`}
          </div>
        </div>
      </div>`;
  }

  function injectStyles() {
    if (document.querySelector("#primera-nacional-fechas-style")) return;
    const s = document.createElement("style");
    s.id = "primera-nacional-fechas-style";
    s.textContent = `
      body[data-competition-id="primera-nacional"] [data-competition-section="fechas"] .competition-card-head{display:none!important;}
      body[data-competition-id="primera-nacional"] [data-competition-section="fechas"],
      body[data-competition-id="primera-nacional"] #competitionDatesList{background:transparent!important;border:0!important;padding:0!important;}
      body[data-competition-id="primera-nacional"] .pn-fixture-card{width:min(380px,100%);}
    `;
    document.head.appendChild(s);
  }

  async function init() {
    const box = document.querySelector("#competitionDatesList");
    if (!box) return;

    const title = document.querySelector('[data-competition-section="fechas"] h2');
    if (title) title.textContent = "Fechas";
    const kicker = document.querySelector('[data-competition-section="fechas"] .competition-section-kicker');
    if (kicker) kicker.textContent = "Fase de grupos";

    injectStyles();

    try {
      const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const equipos = await res.json();
      const matches = collectMatches(equipos);
      const items = buildItems(matches);
      state = { items, selected: seleccionInicial(items) };
      render();
    } catch (error) {
      box.innerHTML = `<p class="competition-empty">No se pudieron cargar las fechas de Primera Nacional.</p>`;
    }
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-pn-season-prev]")) return seleccionarPorIndice(indiceActual() - 1);
    if (event.target.closest("[data-pn-season-next]")) return seleccionarPorIndice(indiceActual() + 1);
  });

  document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-pn-season-select]");
    if (!select || !state) return;
    state.selected = select.value;
    render();
  });

  document.addEventListener("DOMContentLoaded", () => setTimeout(init, 350));
  window.setTimeout(init, 1200);
})();
