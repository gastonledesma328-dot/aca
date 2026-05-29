/* ================================
   FECHAS + FASES ELIMINATORIAS
   Diseño tipo tabla compacta estilo Promiedos.
   Agrupa por FECHA de torneo, no por día suelto.
   Ejemplo: Fecha 1 puede contener jue/vie/sáb/dom.
================================ */

(function () {
  const DATA_URL = "../data/competiciones.json";
  const TZ = "America/Argentina/Buenos_Aires";
  const PARTIDOS_POR_FECHA_LPF = 15;
  const FASES = [
    ["octavos", "Octavos de final"],
    ["cuartos", "Cuartos de final"],
    ["semis", "Semifinales"],
    ["final", "Final"],
  ];
  const FASE_LABEL = Object.fromEntries(FASES);
  const FASE_ORDER = Object.fromEntries(FASES.map(([key], index) => [key, index + 1]));
  const PLAYOFF_RANGES_APERTURA = [
    ["octavos", "2026-05-09", "2026-05-10"],
    ["cuartos", "2026-05-12", "2026-05-14"],
    ["semis", "2026-05-16", "2026-05-18"],
    ["final", "2026-05-23", "2026-05-25"],
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
        month: "2-digit",
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
    return src ? `<img class="season-team-logo" src="${escapeHtml(src)}" alt="" loading="lazy" />` : `<span class="season-team-logo"></span>`;
  }

  function nombre(team) {
    return team?.nombre_corto || team?.nombre || "Equipo";
  }

  function score(match) {
    const l = match?.local?.marcador;
    const v = match?.visitante?.marcador;
    if (l !== "" && l != null && v !== "" && v != null) return `${l} - ${v}`;
    return "-";
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
    return huboDefinicion ? `Penales ${local} - ${visitante}` : null;
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

  function firstDate(partidos) {
    return [...new Set((partidos || []).map((p) => fechaKey(p.fecha)).filter((k) => k && k !== "sin-fecha"))].sort()[0] || "sin-fecha";
  }

  function lastDate(partidos) {
    const keys = [...new Set((partidos || []).map((p) => fechaKey(p.fecha)).filter((k) => k && k !== "sin-fecha"))].sort();
    return keys[keys.length - 1] || "sin-fecha";
  }

  function rango(partidos) {
    const a = firstDate(partidos);
    const b = lastDate(partidos);
    if (a === "sin-fecha") return "A confirmar";
    if (a === b) return fechaCorta(a);
    return `${fechaCorta(a)} - ${fechaCorta(b)}`;
  }

  function fasePorFecha(match) {
    const k = fechaKey(match?.fecha);
    for (const [fase, desde, hasta] of PLAYOFF_RANGES_APERTURA) {
      if (k >= desde && k <= hasta) return fase;
    }
    return "";
  }

  function fasePartido(match) {
    const txt = String(match?.fase || "").toLowerCase();
    const detectada = FASES.find(([key]) => txt === key || txt.includes(key));
    return detectada ? detectada[0] : fasePorFecha(match);
  }

  function torneoPartido(match) {
    const k = fechaKey(match?.fecha);
    if (k >= "2026-07-01") return "clausura";
    return "apertura";
  }

  function crearItem(key, nombre, tipo, torneo, orden, partidos) {
    const clean = dedupe(partidos);
    return {
      key,
      nombre,
      tipo,
      torneo,
      orden,
      partidos: clean,
      firstDate: firstDate(clean),
      lastDate: lastDate(clean),
      dateLabel: rango(clean),
    };
  }

  function agregarFasesEspeciales(comp, grupos) {
    const fases = comp?.especial?.eliminatorias?.fases || {};
    FASES.forEach(([fase, title]) => {
      const partidos = dedupe(fases[fase] || []);
      if (!partidos.length) return;
      const key = `apertura-fase-${fase}`;
      const existentes = grupos.get(key)?.partidos || [];
      grupos.set(key, crearItem(key, `Apertura · ${title}`, "fase", "apertura", 500 + FASE_ORDER[fase], [...existentes, ...partidos]));
    });
  }

  function agregarFechasPorBloques(grupos, torneo, partidos) {
    const ordenados = dedupe(partidos).filter((match) => fechaKey(match.fecha) !== "sin-fecha");
    const labelTorneo = torneo === "clausura" ? "Clausura" : "Apertura";
    const baseOrden = torneo === "clausura" ? 1000 : 0;

    for (let i = 0; i < ordenados.length; i += PARTIDOS_POR_FECHA_LPF) {
      const bloque = ordenados.slice(i, i + PARTIDOS_POR_FECHA_LPF);
      if (!bloque.length) continue;
      const numero = Math.floor(i / PARTIDOS_POR_FECHA_LPF) + 1;
      const key = `${torneo}-fecha-${String(numero).padStart(2, "0")}`;
      grupos.set(key, crearItem(key, `${labelTorneo} · Fecha ${numero}`, "fecha", torneo, baseOrden + numero, bloque));
    }
  }

  function buildItems(comp) {
    const grupos = new Map();
    const regulares = { apertura: [], clausura: [] };
    const all = dedupe([
      ...(comp?.partidos?.todos || []),
      ...(comp?.partidos?.ultimos || []),
      ...(comp?.partidos?.proximos || []),
    ]);

    all.forEach((match) => {
      const fase = fasePartido(match);
      const torneo = torneoPartido(match);

      if (fase) {
        const key = `${torneo}-fase-${fase}`;
        const title = `${torneo === "clausura" ? "Clausura" : "Apertura"} · ${FASE_LABEL[fase] || "Fase"}`;
        const prev = grupos.get(key)?.partidos || [];
        grupos.set(key, crearItem(key, title, "fase", torneo, torneo === "clausura" ? 1500 + FASE_ORDER[fase] : 500 + FASE_ORDER[fase], [...prev, match]));
        return;
      }

      regulares[torneo].push(match);
    });

    agregarFechasPorBloques(grupos, "apertura", regulares.apertura);
    agregarFasesEspeciales(comp, grupos);
    agregarFechasPorBloques(grupos, "clausura", regulares.clausura);

    return [...grupos.values()].sort((a, b) => {
      if (a.orden !== b.orden) return a.orden - b.orden;
      return String(a.firstDate).localeCompare(String(b.firstDate));
    });
  }

  function estado(item) {
    const today = todayKey();
    if (item.firstDate <= today && item.lastDate >= today) return "En disputa";
    if (item.lastDate !== "sin-fecha" && item.lastDate < today) return item.tipo === "fase" ? "Fase anterior" : "Fecha anterior";
    return item.tipo === "fase" ? "Próxima fase" : "Próxima fecha";
  }

  function seleccionInicial(items) {
    const today = todayKey();
    const actual = items.find((item) => item.firstDate <= today && item.lastDate >= today);
    if (actual) return actual.key;
    const proxima = items.find((item) => item.firstDate >= today);
    return proxima?.key || items[items.length - 1]?.key || "";
  }

  function nombreFechaCorto(nombreItem) {
    return String(nombreItem || "")
      .replace(/^Apertura\s*·\s*/i, "")
      .replace(/^Clausura\s*·\s*/i, "")
      .trim()
      .toUpperCase();
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

  function marcadorConPenales(match) {
    const penales = penalesInfo(match);
    return `
      <span class="season-score-stack">
        ${penales ? `<span class="season-penalty-line">${escapeHtml(penales.replace("Penales ", "PEN "))}</span>` : ""}
        <strong class="season-score">${escapeHtml(score(match))}</strong>
      </span>`;
  }

  function renderPartido(match) {
    const local = match?.local?.equipo || {};
    const visitante = match?.visitante?.equipo || {};
    return `
      <div class="season-row">
        <div class="season-time">${escapeHtml(hora(match?.fecha))}</div>
        <div class="season-team season-home"><span>${escapeHtml(nombre(local))}</span>${logo(local)}</div>
        ${marcadorConPenales(match)}
        <div class="season-team season-away">${logo(visitante)}<span>${escapeHtml(nombre(visitante))}</span></div>
      </div>`;
  }

  function renderPartidosPorDia(partidos) {
    const grupos = new Map();
    dedupe(partidos).forEach((match) => {
      const key = fechaKey(match.fecha);
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
      box.innerHTML = `<p class="competition-empty">No hay fechas disponibles para esta competición.</p>`;
      return;
    }

    const index = indiceActual();
    const canPrev = index > 0;
    const canNext = index < state.items.length - 1;
    const options = state.items.map((x) => `<option value="${escapeHtml(x.key)}" ${x.key === item.key ? "selected" : ""}>${escapeHtml(x.nombre)} · ${escapeHtml(x.dateLabel)}</option>`).join("");

    box.innerHTML = `
      <div class="season-fixture-card">
        <h3 class="season-title">TEMPORADA</h3>
        <div class="season-nav">
          <button class="season-arrow" type="button" data-season-prev ${canPrev ? "" : "disabled"} aria-label="Fecha anterior">‹</button>
          <label class="season-select-wrap">
            <span>${escapeHtml(nombreFechaCorto(item.nombre))}▼</span>
            <select class="season-select" data-season-select aria-label="Seleccionar fecha o fase">
              ${options}
            </select>
          </label>
          <button class="season-arrow" type="button" data-season-next ${canNext ? "" : "disabled"} aria-label="Fecha siguiente">›</button>
        </div>
        <div class="season-table">
          <div class="season-rows">
            ${item.partidos.length ? renderPartidosPorDia(item.partidos) : `<div class="season-empty">No hay partidos cargados.</div>`}
          </div>
        </div>
      </div>`;
  }

  function style() {
    if (document.querySelector("#fechas-fases-style")) return;
    const s = document.createElement("style");
    s.id = "fechas-fases-style";
    s.textContent = `
      body[data-competition-id="liga-profesional"] [data-competition-section="fechas"] .competition-card-head{display:none!important;}
      body[data-competition-id="liga-profesional"] [data-competition-section="fechas"],
      body[data-competition-id="liga-profesional"] #competitionDatesList{background:transparent!important;border:0!important;padding:0!important;}
      .season-fixture-card{width:min(340px,100%);margin:0 auto;padding:14px 14px 16px;border-radius:0 0 12px 12px;background:#05391f;color:#fff;box-shadow:0 18px 36px rgba(0,0,0,.22);font-family:inherit;}
      .season-title{margin:0 0 22px;text-align:center;font-size:16px;line-height:1;font-weight:950;color:#fff;text-transform:uppercase;text-shadow:1px 1px 0 rgba(0,0,0,.55);}
      .season-nav{display:grid;grid-template-columns:38px minmax(0,1fr) 38px;align-items:center;gap:8px;margin-bottom:10px;}
      .season-arrow{width:34px;height:34px;border:0;background:transparent;color:#fff;font-size:34px;line-height:1;font-weight:400;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-shadow:1px 1px 0 rgba(0,0,0,.5);}
      .season-arrow:disabled{opacity:.28;cursor:not-allowed;}
      .season-select-wrap{position:relative;min-width:0;display:flex;align-items:center;justify-content:center;height:32px;cursor:pointer;}
      .season-select-wrap span{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-size:15px;font-weight:950;color:#fff;text-transform:uppercase;text-shadow:1px 1px 0 rgba(0,0,0,.55);}
      .season-select{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;}
      .season-table{border:1px solid rgba(255,255,255,.32);border-radius:6px;overflow:hidden;background:#062f1b;}
      .season-date-head{height:22px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid rgba(255,255,255,.32);background:#07391f;color:#fff;font-size:12px;font-weight:800;line-height:1;}
      .season-rows{display:grid;}
      .season-row{min-height:37px;display:grid;grid-template-columns:63px minmax(0,1fr) 36px minmax(0,1fr);align-items:center;border-bottom:1px solid rgba(255,255,255,.28);background:#06351e;}
      .season-row:last-child{border-bottom:0;}
      .season-time{height:100%;display:flex;align-items:center;justify-content:center;border-right:1px solid rgba(255,255,255,.28);font-size:12px;font-weight:950;color:#fff;}
      .season-team{min-width:0;display:flex;align-items:center;gap:4px;padding:0 6px;font-size:12px;font-weight:950;line-height:1.05;color:#fff;text-shadow:1px 1px 0 rgba(0,0,0,.45);}
      .season-team span{min-width:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
      .season-home{justify-content:flex-end;text-align:right;}
      .season-away{justify-content:flex-start;text-align:left;}
      .season-team-logo{width:16px!important;height:16px!important;flex:0 0 16px!important;object-fit:contain!important;border:0!important;background:transparent!important;box-shadow:none!important;border-radius:50%;}
      .season-score-stack{display:grid;justify-items:center;align-items:center;gap:1px;min-width:0;color:#fff;font-weight:950;text-align:center;}
      .season-score{display:block!important;min-width:0!important;padding:0!important;background:transparent!important;border-radius:0!important;box-shadow:none!important;color:#fff!important;font-size:14px!important;font-weight:950!important;text-shadow:1px 1px 0 rgba(0,0,0,.55)!important;}
      .season-penalty-line{display:inline-flex;align-items:center;justify-content:center;margin-bottom:1px;border-radius:999px;padding:2px 4px;color:#10351f;background:#f7d24c;border:1px solid rgba(255,226,101,.9);font-size:8px;font-weight:950;line-height:1;white-space:nowrap;box-shadow:0 2px 6px rgba(247,210,76,.18);}
      .season-empty{padding:16px;text-align:center;color:#d8ffe6;font-size:13px;font-weight:800;}
      @media (max-width:720px){
        .season-fixture-card{width:100%;max-width:340px;padding:14px 10px 16px;}
        .season-row{grid-template-columns:63px minmax(0,1fr) 34px minmax(0,1fr);}
        .season-team{font-size:11px;padding:0 5px;}
      }
    `;
    document.head.appendChild(s);
  }

  async function init(force = false) {
    const box = document.querySelector("#competitionDatesList");
    if (!box) return;
    document.querySelectorAll('[data-competition-tab="proximos"], [data-competition-section="proximos"]').forEach((el) => el.remove());
    const title = document.querySelector('[data-competition-section="fechas"] h2');
    if (title) title.textContent = "Temporada";
    const kicker = document.querySelector('[data-competition-section="fechas"] .competition-section-kicker');
    if (kicker) kicker.textContent = "Calendario";
    style();
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
    } catch (error) {
      box.innerHTML = `<p class="competition-empty">No se pudieron cargar las fechas y fases.</p>`;
    }
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-season-prev]")) return seleccionarPorIndice(indiceActual() - 1);
    if (event.target.closest("[data-season-next]")) return seleccionarPorIndice(indiceActual() + 1);
  });

  document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-season-select]");
    if (!select || !state) return;
    state.selected = select.value;
    render();
  });

  document.addEventListener("DOMContentLoaded", () => init(true));
  window.setTimeout(() => init(true), 900);
  window.setTimeout(() => init(false), 1800);
})();
