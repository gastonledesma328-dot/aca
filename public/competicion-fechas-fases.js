/* ================================
   FECHAS + FASES ELIMINATORIAS
   Orden correcto:
   - Apertura: Fecha 1, 2, 3...
   - Playoffs Apertura: Octavos, cuartos, semifinales, final
   - Clausura: Fecha 1, 2, 3...
   - Si hay penales, muestra la definición arriba del marcador
================================ */

(function () {
  const DATA_URL = "../data/competiciones.json";
  const TZ = "America/Argentina/Buenos_Aires";
  const FASES = [
    ["octavos", "Octavos de final"],
    ["cuartos", "Cuartos de final"],
    ["semis", "Semifinales"],
    ["final", "Final"],
  ];

  let state = null;

  function idCompeticion() {
    return document.body?.dataset?.competitionId || new URLSearchParams(location.search).get("id") || "";
  }

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
      if (Number.isNaN(d.getTime())) return "sin-fecha";
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

  function todayKey() {
    return fechaKey(new Date());
  }

  function fechaCorta(key) {
    if (!key || key === "sin-fecha") return "A confirmar";
    try {
      return new Intl.DateTimeFormat("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(new Date(`${key}T12:00:00`)).replace(/\./g, "");
    } catch (error) {
      return key;
    }
  }

  function hora(value) {
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

  function logo(team) {
    const src = team?.logo || "";
    return src ? `<img class="competition-team-logo" src="${escapeHtml(src)}" alt="" loading="lazy" />` : `<span class="competition-team-logo"></span>`;
  }

  function nombre(team) {
    return team?.nombre || team?.nombre_corto || "Equipo";
  }

  function score(match) {
    const l = match?.local?.marcador;
    const v = match?.visitante?.marcador;
    if (l !== "" && l != null && v !== "" && v != null) return `${l} - ${v}`;
    return "vs";
  }

  function numeroValido(value) {
    if (value === "" || value == null || value === false) return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function textoIndicaPenales(match) {
    const txt = [
      match?.estado,
      match?.estado_tipo,
      match?.clasificacion_texto,
      match?.penales?.texto,
      match?.status?.description,
      match?.status?.detail,
      match?.status?.shortDetail,
    ].filter(Boolean).join(" ").toLowerCase();
    return /penal|penales|penalty|penalties|shootout|tanda/.test(txt);
  }

  function penalesInfo(match) {
    const penales = match?.penales || {};
    const local = numeroValido(penales.local ?? match?.local?.penales ?? match?.local_penales ?? match?.homePenaltyScore ?? match?.shootoutLocal);
    const visitante = numeroValido(penales.visitante ?? match?.visitante?.penales ?? match?.visitante_penales ?? match?.awayPenaltyScore ?? match?.shootoutVisitante);

    if (local === null || visitante === null) return null;
    if (local === 0 && visitante === 0) return null;

    const huboDefinicion = penales.definicion === true || textoIndicaPenales(match) || local !== visitante;
    if (!huboDefinicion) return null;

    return `Penales ${local} - ${visitante}`;
  }

  function keyPartido(match) {
    return match?.id || `${match?.local?.equipo?.nombre || ""}|${match?.visitante?.equipo?.nombre || ""}|${match?.fecha || ""}`;
  }

  function dedupe(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : [])
      .filter((match) => {
        const key = keyPartido(match);
        if (!match || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
  }

  function rango(partidos) {
    const keys = [...new Set((partidos || []).map((p) => fechaKey(p.fecha)).filter((k) => k && k !== "sin-fecha"))].sort();
    if (!keys.length) return "A confirmar";
    if (keys.length === 1) return fechaCorta(keys[0]);
    return `${fechaCorta(keys[0])} - ${fechaCorta(keys[keys.length - 1])}`;
  }

  function firstDate(partidos) {
    return [...new Set((partidos || []).map((p) => fechaKey(p.fecha)).filter((k) => k && k !== "sin-fecha"))].sort()[0] || "sin-fecha";
  }

  function nombreConTorneo(torneo, nombre) {
    if (torneo === "apertura") return `Apertura · ${nombre}`;
    if (torneo === "clausura") return `Clausura · ${nombre}`;
    return nombre;
  }

  function fechasRegulares(comp) {
    const out = [];
    const fechas = comp?.especial?.fechas || {};

    ["apertura", "clausura"].forEach((torneo) => {
      (Array.isArray(fechas[torneo]) ? fechas[torneo] : []).forEach((item, index) => {
        const partidos = dedupe(item?.partidos || []);
        if (!partidos.length) return;
        const nombreBase = item?.nombre || `Fecha ${index + 1}`;
        const n = Number(String(nombreBase).match(/(\d+)/)?.[1] || index + 1);

        out.push({
          key: `${torneo}-fecha-${String(n).padStart(2, "0")}`,
          nombre: nombreConTorneo(torneo, nombreBase),
          tipo: "fecha",
          torneo,
          orden: torneo === "apertura" ? n : 100 + n,
          partidos,
          firstDate: firstDate(partidos),
          dateLabel: rango(partidos),
        });
      });
    });

    return out;
  }

  function fasesEliminatorias(comp) {
    const out = [];
    const fases = comp?.especial?.eliminatorias?.fases || {};

    FASES.forEach(([key, title], index) => {
      const partidos = dedupe(fases[key] || []);
      if (!partidos.length) return;
      out.push({
        key: `fase-${key}`,
        nombre: title,
        tipo: "fase",
        torneo: "playoffs",
        orden: 40 + index,
        partidos,
        firstDate: firstDate(partidos),
        dateLabel: rango(partidos),
      });
    });

    return out;
  }

  function fallbackPorPartidos(comp) {
    const all = dedupe([
      ...(comp?.partidos?.todos || []),
      ...(comp?.partidos?.ultimos || []),
      ...(comp?.partidos?.proximos || []),
    ]);
    const grupos = new Map();

    all.forEach((match) => {
      const faseTxt = String(match?.fase || "").toLowerCase();
      const fase = FASES.find(([k]) => faseTxt === k || faseTxt.includes(k));
      const num = Number(match?.fecha_numero || match?.jornada || match?.round || match?.week || 0);
      const key = fase ? `fase-${fase[0]}` : num > 0 ? `fecha-${String(num).padStart(2, "0")}` : `dia-${fechaKey(match.fecha)}`;
      const nombre = fase ? fase[1] : num > 0 ? `Fecha ${num}` : fechaCorta(fechaKey(match.fecha));
      const orden = fase ? 40 + FASES.findIndex(([k]) => k === fase[0]) : num > 0 ? num : 200;

      if (!grupos.has(key)) grupos.set(key, { key, nombre, tipo: fase ? "fase" : "fecha", orden, partidos: [] });
      grupos.get(key).partidos.push(match);
    });

    return [...grupos.values()].map((item) => ({
      ...item,
      partidos: dedupe(item.partidos),
      firstDate: firstDate(item.partidos),
      dateLabel: rango(item.partidos),
    }));
  }

  function buildItems(comp) {
    const items = [...fechasRegulares(comp), ...fasesEliminatorias(comp)];
    const finalItems = items.length ? items : fallbackPorPartidos(comp);
    return finalItems.sort((a, b) => {
      if (a.orden !== b.orden) return a.orden - b.orden;
      return String(a.firstDate).localeCompare(String(b.firstDate));
    });
  }

  function estado(item) {
    const today = todayKey();
    const dates = [...new Set(item.partidos.map((p) => fechaKey(p.fecha)).filter((k) => k !== "sin-fecha"))].sort();
    if (dates.includes(today)) return "En disputa";
    if (dates.length && dates[dates.length - 1] < today) return item.tipo === "fase" ? "Fase anterior" : "Fecha anterior";
    return item.tipo === "fase" ? "Próxima fase" : "Próxima fecha";
  }

  function seleccionInicial(items) {
    const today = todayKey();
    const enDisputa = items.find((item) => item.partidos.some((p) => fechaKey(p.fecha) === today));
    if (enDisputa) return enDisputa.key;
    const proxima = items.find((item) => (item.firstDate || "") >= today);
    if (proxima) return proxima.key;
    return items[items.length - 1]?.key || "";
  }

  function marcadorConPenales(match) {
    const penales = penalesInfo(match);
    return `
      <span class="competition-score-stack">
        ${penales ? `<span class="competition-penalty-line">${escapeHtml(penales)}</span>` : ""}
        <strong class="competition-score">${escapeHtml(score(match))}</strong>
      </span>`;
  }

  function renderPartido(match) {
    const local = match?.local?.equipo || {};
    const visitante = match?.visitante?.equipo || {};
    const estado = match?.estado || (match?.completado ? "Finalizado" : "Programado");
    return `
      <article class="competition-date-match">
        <div class="competition-date-match-time">
          <strong>${escapeHtml(hora(match?.fecha))}</strong>
          <span>${escapeHtml(estado)}</span>
        </div>
        <div class="competition-date-match-teams">
          <span class="competition-match-team">${logo(local)}<span>${escapeHtml(nombre(local))}</span></span>
          ${marcadorConPenales(match)}
          <span class="competition-match-team">${logo(visitante)}<span>${escapeHtml(nombre(visitante))}</span></span>
        </div>
      </article>`;
  }

  function render() {
    const box = document.querySelector("#competitionDatesList");
    if (!box || !state) return;

    const item = state.items.find((x) => x.key === state.selected) || state.items[0];
    if (!item) {
      box.innerHTML = `<p class="competition-empty">No hay fechas disponibles para esta competición.</p>`;
      return;
    }

    const mini = state.items.map((x) => `
      <button class="competition-mini-date ${x.key === item.key ? "is-selected" : ""} ${x.tipo === "fase" ? "is-knockout" : ""} ${estado(x) === "En disputa" ? "is-today" : ""}" type="button" data-fechas-fases-key="${escapeHtml(x.key)}">
        <span>${escapeHtml(x.nombre)}</span>
        <em>${escapeHtml(x.dateLabel)}</em>
        <strong>${escapeHtml(x.partidos.length)}</strong>
      </button>`).join("");

    box.innerHTML = `
      <div class="competition-dates-panel fechas-fases-panel">
        <div class="competition-dates-toolbar">
          <div>
            <span>${item.tipo === "fase" ? "Fase seleccionada" : "Fecha seleccionada"}</span>
            <strong>${escapeHtml(item.nombre)}</strong>
            <em>${escapeHtml(item.dateLabel)}</em>
          </div>
          <small>${escapeHtml(estado(item))}</small>
        </div>
        <div class="competition-mini-calendar" aria-label="Seleccionar fecha o fase">
          ${mini}
        </div>
        <section class="competition-date-group">
          <div class="competition-date-head">
            <span>${escapeHtml(estado(item))}</span>
            <strong>${escapeHtml(item.nombre)} · ${escapeHtml(item.dateLabel)}</strong>
          </div>
          <div class="competition-date-matches">
            ${item.partidos.length ? item.partidos.map(renderPartido).join("") : `<p class="competition-empty">No hay partidos cargados.</p>`}
          </div>
        </section>
      </div>`;
  }

  function style() {
    if (document.querySelector("#fechas-fases-style")) return;
    const s = document.createElement("style");
    s.id = "fechas-fases-style";
    s.textContent = `
      .competition-mini-date.is-knockout{background:linear-gradient(180deg,rgba(32,109,65,.98),rgba(11,77,46,.98))!important;border-color:rgba(246,210,76,.55)!important;}
      .competition-mini-date.is-knockout strong{background:#f7d24c!important;color:#442500!important;}
      .competition-mini-date span{text-align:center!important;}
      .competition-mini-date em{display:block;color:#baff78;font-style:normal;font-size:10px;font-weight:900;text-align:center;}
      .competition-score-stack{display:inline-grid;justify-items:center;align-items:center;gap:4px;min-width:72px;}
      .competition-penalty-line{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:3px 8px;color:#442500;background:#f7d24c;border:1px solid rgba(255,226,101,.9);font-size:10px;font-weight:950;line-height:1;white-space:nowrap;box-shadow:0 4px 10px rgba(247,210,76,.2);}
      .competition-score-stack .competition-score{display:inline-flex!important;align-items:center!important;justify-content:center!important;}
    `;
    document.head.appendChild(s);
  }

  async function init(force = false) {
    const box = document.querySelector("#competitionDatesList");
    if (!box) return;

    document.querySelectorAll('[data-competition-tab="proximos"], [data-competition-section="proximos"]').forEach((el) => el.remove());

    const title = document.querySelector('[data-competition-section="fechas"] h2');
    if (title) title.textContent = "Fechas, fases y partidos";
    const kicker = document.querySelector('[data-competition-section="fechas"] .competition-section-kicker');
    if (kicker) kicker.textContent = "Calendario completo";

    if (state && !force) return;

    try {
      const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      const id = idCompeticion();
      const comp = (data.competiciones || []).find((x) => x.id === id || x.slug === id);
      if (!comp) throw new Error("No se encontró la competición");
      const items = buildItems(comp);
      state = { items, selected: seleccionInicial(items) };
      render();
      style();
    } catch (error) {
      box.innerHTML = `<p class="competition-empty">No se pudieron cargar las fechas y fases.</p>`;
    }
  }

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-fechas-fases-key]");
    if (!btn || !state) return;
    state.selected = btn.dataset.fechasFasesKey;
    render();
  });

  document.addEventListener("DOMContentLoaded", () => init(true));
  window.setTimeout(() => init(true), 900);
  window.setTimeout(() => init(false), 1800);
})();
