/* ================================
   FECHAS — Calendario universal
   Funciona para todas las competiciones.
   Liga Pro: agrupa por Apertura/Clausura + jornadas.
   Resto: agrupa por jornada/round o por día de calendario.
================================ */

(function () {
  const DATA_URL = "../data/competiciones.json";
  const TZ = "America/Argentina/Buenos_Aires";
  const PARTIDOS_POR_FECHA_LPF = 15;  // default LPF, se sobreescribe con comp.partidos_por_fecha

  // Fases de eliminatorias (LPF y otras competiciones mixtas)
  const FASES_KNOCKOUT = [
    ["treintaidosavos", "Treintaidosavos"],
    ["dieciseisavos",   "Dieciseisavos"],
    ["octavos",         "Octavos de final"],
    ["cuartos",         "Cuartos de final"],
    ["semis",           "Semifinales"],
    ["semifinales",     "Semifinales"],
    ["final",           "Final"],
  ];
  const FASE_NOMBRE = Object.fromEntries(FASES_KNOCKOUT);
  const PALABRAS_FASE = FASES_KNOCKOUT.map(([k]) => k);

  let state = null;

  // ── Helpers de fecha ─────────────────────────────────────────────────────

  function idCompeticion() {
    return document.body?.dataset?.competitionId || new URLSearchParams(location.search).get("id") || "";
  }

  function escapeHtml(v) {
    return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  function fechaKey(value) {
    if (!value) return "sin-fecha";
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return "sin-fecha";
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(d);
      const g = (t) => parts.find(p => p.type === t)?.value || "";
      return `${g("year")}-${g("month")}-${g("day")}`;
    } catch { return String(value).slice(0,10) || "sin-fecha"; }
  }

  function todayKey() { return fechaKey(new Date()); }

  function fechaCorta(key) {
    if (!key || key === "sin-fecha") return "A confirmar";
    try {
      return new Intl.DateTimeFormat("es-AR", { weekday:"short", day:"2-digit", month:"2-digit" })
        .format(new Date(`${key}T12:00:00`)).replace(/\./g,"");
    } catch { return key; }
  }

  function hora(value) {
    if (!value) return "--:--";
    try {
      return new Intl.DateTimeFormat("es-AR", { hour:"2-digit", minute:"2-digit", timeZone: TZ }).format(new Date(value));
    } catch { return String(value).slice(11,16) || "--:--"; }
  }

  function rango(partidos) {
    const keys = [...new Set((partidos||[]).map(p => fechaKey(p.fecha)).filter(k => k && k !== "sin-fecha"))].sort();
    if (!keys.length) return "A confirmar";
    if (keys[0] === keys[keys.length-1]) return fechaCorta(keys[0]);
    return `${fechaCorta(keys[0])} - ${fechaCorta(keys[keys.length-1])}`;
  }

  function firstDate(partidos) {
    const keys = (partidos||[]).map(p => fechaKey(p.fecha)).filter(k => k && k !== "sin-fecha").sort();
    return keys[0] || "sin-fecha";
  }

  function lastDate(partidos) {
    const keys = (partidos||[]).map(p => fechaKey(p.fecha)).filter(k => k && k !== "sin-fecha").sort();
    return keys[keys.length-1] || "sin-fecha";
  }

  // ── Helpers de partidos ───────────────────────────────────────────────────

  function score(match) {
    const l = match?.local?.marcador;
    const v = match?.visitante?.marcador;
    if (l !== "" && l != null && v !== "" && v != null) return `${l} - ${v}`;
    return "-";
  }

  function logo(team) {
    const src = team?.logo || "";
    return src ? `<img class="season-team-logo" src="${escapeHtml(src)}" alt="" loading="lazy">` : `<span class="season-team-logo"></span>`;
  }

  function nombre(team) {
    return team?.nombre_corto || team?.nombre || "Equipo";
  }

  function keyPartido(m) {
    return m?.id || `${m?.local?.equipo?.nombre||""}|${m?.visitante?.equipo?.nombre||""}|${m?.fecha||""}`;
  }

  function dedupe(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : [])
      .filter(m => { const k = keyPartido(m); if (!m || seen.has(k)) return false; seen.add(k); return true; })
      .sort((a,b) => String(a.fecha||"").localeCompare(String(b.fecha||"")));
  }

  function penalesInfo(match) {
    const p = match?.penales || {};
    const l = p.local ?? match?.local?.penales;
    const v = p.visitante ?? match?.visitante?.penales;
    if (l == null || v == null || (l === 0 && v === 0)) return null;
    return `PEN ${l} - ${v}`;
  }

  // ── Detectar si una jornada/nombre es una fase knockout ───────────────────

  function esFase(texto) {
    if (!texto) return false;
    const t = String(texto).toLowerCase();
    return PALABRAS_FASE.some(f => t.includes(f));
  }

  function normalizarNombreFase(texto) {
    if (!texto) return null;
    const t = String(texto).toLowerCase();
    for (const [key, label] of FASES_KNOCKOUT) {
      if (t.includes(key)) return label;
    }
    return null;
  }

  // ── Detectar tipo de competición ──────────────────────────────────────────

  function esLigaProfesional(id) {
    return id === "liga-profesional";
  }

  function esPorJornada(comp) {
    // Competiciones donde los partidos vienen con número de jornada
    const todos = dedupe([
      ...(comp?.partidos?.todos || []),
      ...(comp?.partidos?.ultimos || []),
      ...(comp?.partidos?.proximos || []),
    ]);
    // Si más del 50% de los partidos tienen jornada numérica, agrupar por jornada
    const conJornada = todos.filter(m => m.jornada != null && Number.isFinite(Number(m.jornada)));
    return conJornada.length > todos.length * 0.5;
  }

  // ── Builders de items ─────────────────────────────────────────────────────

  function crearItem(key, nombre, tipo, orden, partidos) {
    const clean = dedupe(partidos);
    return { key, nombre, tipo, orden, partidos: clean, firstDate: firstDate(clean), lastDate: lastDate(clean), dateLabel: rango(clean) };
  }

  // Liga Profesional: agrupa por Apertura/Clausura en bloques de PARTIDOS_POR_FECHA_LPF
  function buildItemsLPF(comp) {
    const grupos = new Map();
    const regulares = { apertura: [], clausura: [] };

    const all = dedupe([
      ...(comp?.partidos?.todos || []),
      ...(comp?.partidos?.ultimos || []),
      ...(comp?.partidos?.proximos || []),
    ]);

    all.forEach(match => {
      const k = fechaKey(match?.fecha);
      const torneo = k >= "2026-07-01" ? "clausura" : "apertura";
      const labelTorneo = torneo === "clausura" ? "Clausura" : "Apertura";

      // Detectar si es fase knockout
      const nombreFase = normalizarNombreFase(match?.estado_tipo || match?.fase || "");
      if (nombreFase) {
        const key = `${torneo}-fase-${nombreFase.toLowerCase().replace(/\s/g,"-")}`;
        const prev = grupos.get(key)?.partidos || [];
        const orden = torneo === "clausura" ? 1500 : 500;
        grupos.set(key, crearItem(key, `${labelTorneo} · ${nombreFase}`, "fase", orden, [...prev, match]));
        return;
      }

      regulares[torneo].push(match);
    });

    // También agregar fases del especial si existen
    const fases = comp?.especial?.eliminatorias?.fases || {};
    ["apertura","clausura"].forEach(torneo => {
      const labelTorneo = torneo === "clausura" ? "Clausura" : "Apertura";
      const baseOrden = torneo === "clausura" ? 1500 : 500;
      FASES_KNOCKOUT.forEach(([fase, title], i) => {
        const ps = dedupe(fases[fase] || []);
        if (!ps.length) return;
        const key = `${torneo}-fase-${fase}`;
        const prev = grupos.get(key)?.partidos || [];
        grupos.set(key, crearItem(key, `${labelTorneo} · ${title}`, "fase", baseOrden + i, [...prev, ...ps]));
      });
    });

    // Agrupar regulares en bloques de N partidos
    ["apertura","clausura"].forEach(torneo => {
      const labelTorneo = torneo === "clausura" ? "Clausura" : "Apertura";
      const baseOrden = torneo === "clausura" ? 1000 : 0;
      const N = partidosPorFecha(comp);
      const ordenados = dedupe(regulares[torneo]).filter(m => fechaKey(m.fecha) !== "sin-fecha");
      for (let i = 0; i < ordenados.length; i += N) {
        const bloque = ordenados.slice(i, i + N);
        if (!bloque.length) continue;
        const num = Math.floor(i / PARTIDOS_POR_FECHA_LPF) + 1;
        const key = `${torneo}-fecha-${String(num).padStart(2,"0")}`;
        grupos.set(key, crearItem(key, `${labelTorneo} · Fecha ${num}`, "fecha", baseOrden + num, bloque));
      }
    });

    return [...grupos.values()].sort((a,b) => a.orden !== b.orden ? a.orden - b.orden : String(a.firstDate).localeCompare(String(b.firstDate)));
  }

  // Competiciones con jornada numérica: agrupa por número de jornada
  function buildItemsPorJornada(comp) {
    const grupos = new Map();
    const sinJornada = [];

    const all = dedupe([
      ...(comp?.partidos?.todos || []),
      ...(comp?.partidos?.ultimos || []),
      ...(comp?.partidos?.proximos || []),
    ]);

    all.forEach(match => {
      const j = match?.jornada;
      const nombreFase = normalizarNombreFase(match?.estado || match?.estado_tipo || "");

      if (nombreFase) {
        const key = `fase-${nombreFase.toLowerCase().replace(/\s/g,"-")}`;
        const prev = grupos.get(key)?.partidos || [];
        grupos.set(key, crearItem(key, nombreFase, "fase", 10000 + PALABRAS_FASE.findIndex(f => nombreFase.toLowerCase().includes(f)), [...prev, match]));
        return;
      }

      if (j != null && Number.isFinite(Number(j))) {
        const num = Number(j);
        const key = `jornada-${String(num).padStart(3,"0")}`;
        const prev = grupos.get(key)?.partidos || [];
        grupos.set(key, crearItem(key, `Fecha ${num}`, "fecha", num, [...prev, match]));
      } else {
        sinJornada.push(match);
      }
    });

    // Partidos sin jornada: agrupar por semana
    if (sinJornada.length) {
      const porSemana = new Map();
      sinJornada.forEach(match => {
        const k = fechaKey(match.fecha);
        if (k === "sin-fecha") return;
        const d = new Date(`${k}T12:00:00`);
        const day = d.getDay();
        const lunes = new Date(d);
        lunes.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        const semKey = fechaKey(lunes.toISOString());
        if (!porSemana.has(semKey)) porSemana.set(semKey, []);
        porSemana.get(semKey).push(match);
      });
      [...porSemana.entries()].sort().forEach(([semKey, ps], i) => {
        const key = `semana-${semKey}`;
        grupos.set(key, crearItem(key, `Semana del ${fechaCorta(semKey)}`, "fecha", 20000 + i, ps));
      });
    }

    return [...grupos.values()].sort((a,b) => a.orden !== b.orden ? a.orden - b.orden : String(a.firstDate).localeCompare(String(b.firstDate)));
  }

  // Competiciones sin jornada: agrupar por fecha de calendario (copa, supercopa, etc.)
  function buildItemsPorDia(comp) {
    const grupos = new Map();

    const all = dedupe([
      ...(comp?.partidos?.todos || []),
      ...(comp?.partidos?.ultimos || []),
      ...(comp?.partidos?.proximos || []),
    ]);

    all.forEach(match => {
      const nombreFase = normalizarNombreFase(match?.estado || match?.estado_tipo || "");
      if (nombreFase) {
        const key = `fase-${nombreFase.toLowerCase().replace(/\s/g,"-")}`;
        const prev = grupos.get(key)?.partidos || [];
        const orden = 10000 + PALABRAS_FASE.findIndex(f => nombreFase.toLowerCase().includes(f));
        grupos.set(key, crearItem(key, nombreFase, "fase", orden, [...prev, match]));
        return;
      }

      const k = fechaKey(match.fecha);
      if (k === "sin-fecha") return;
      const prev = grupos.get(k)?.partidos || [];
      grupos.set(k, crearItem(k, fechaCorta(k), "fecha", k.replace(/-/g,""), [...prev, match]));
    });

    return [...grupos.values()].sort((a,b) => String(a.firstDate||a.key).localeCompare(String(b.firstDate||b.key)));
  }

  function buildItems(comp) {
    const id = idCompeticion();
    if (esLigaProfesional(id)) return buildItemsLPF(comp);
    if (esPorJornada(comp))    return buildItemsPorJornada(comp);
    return buildItemsPorDia(comp);
  }

  // Devuelve cuántos partidos hay por jornada para esta competición
  function partidosPorFecha(comp) {
    return comp?.partidos_por_fecha || PARTIDOS_POR_FECHA_LPF;
  }

  // ── Selección inicial: fecha actual o próxima ─────────────────────────────

  function seleccionInicial(items) {
    const today = todayKey();
    const actual = items.find(x => x.firstDate <= today && x.lastDate >= today);
    if (actual) return actual.key;
    const proxima = items.find(x => x.firstDate >= today);
    return proxima?.key || items[items.length-1]?.key || "";
  }

  function indiceActual() {
    return Math.max(0, state?.items?.findIndex(x => x.key === state.selected) ?? 0);
  }

  function seleccionarPorIndice(next) {
    if (!state?.items?.length) return;
    state.selected = state.items[Math.max(0, Math.min(state.items.length-1, next))].key;
    render();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderPartido(match) {
    const local = match?.local?.equipo || {};
    const visitante = match?.visitante?.equipo || {};
    const penales = penalesInfo(match);
    return `
      <div class="season-row">
        <div class="season-time">${escapeHtml(hora(match?.fecha))}</div>
        <div class="season-team season-home"><span>${escapeHtml(nombre(local))}</span>${logo(local)}</div>
        <span class="season-score-stack">
          ${penales ? `<span class="season-penalty-line">${escapeHtml(penales)}</span>` : ""}
          <strong class="season-score">${escapeHtml(score(match))}</strong>
        </span>
        <div class="season-team season-away">${logo(visitante)}<span>${escapeHtml(nombre(visitante))}</span></div>
      </div>`;
  }

  function renderPartidosPorDia(partidos) {
    const grupos = new Map();
    dedupe(partidos).forEach(match => {
      const k = fechaKey(match.fecha);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(match);
    });
    return [...grupos.keys()].sort().map(k => `
      <div class="season-date-head">${escapeHtml(fechaCorta(k))}</div>
      ${grupos.get(k).map(renderPartido).join("")}
    `).join("");
  }

  function nombreCorto(item) {
    return String(item?.nombre || "")
      .replace(/^(Apertura|Clausura)\s*·\s*/i, "")
      .trim().toUpperCase();
  }

  function render() {
    const box = document.querySelector("#competitionDatesList");
    if (!box || !state) return;
    const item = state.items.find(x => x.key === state.selected) || state.items[0];
    if (!item) {
      box.innerHTML = `<p class="competition-empty">No hay fechas disponibles.</p>`;
      return;
    }
    const index = indiceActual();
    const options = state.items.map(x => `<option value="${escapeHtml(x.key)}" ${x.key===item.key?"selected":""}>${escapeHtml(x.nombre)} · ${escapeHtml(x.dateLabel)}</option>`).join("");

    box.innerHTML = `
      <div class="season-fixture-card">
        <h3 class="season-title">TEMPORADA</h3>
        <div class="season-nav">
          <button class="season-arrow" type="button" data-season-prev ${index > 0 ? "" : "disabled"} aria-label="Anterior">‹</button>
          <label class="season-select-wrap">
            <span>${escapeHtml(nombreCorto(item))}▼</span>
            <select class="season-select" data-season-select aria-label="Seleccionar fecha">
              ${options}
            </select>
          </label>
          <button class="season-arrow" type="button" data-season-next ${index < state.items.length-1 ? "" : "disabled"} aria-label="Siguiente">›</button>
        </div>
        <div class="season-table">
          <div class="season-rows">
            ${item.partidos.length ? renderPartidosPorDia(item.partidos) : `<div class="season-empty">No hay partidos cargados.</div>`}
          </div>
        </div>
      </div>`;
  }

  // ── Estilos ───────────────────────────────────────────────────────────────

  function injectStyle() {
    if (document.querySelector("#fechas-fases-style")) return;
    const s = document.createElement("style");
    s.id = "fechas-fases-style";
    s.textContent = `
      [data-competition-section="fechas"] .competition-card-head{display:none!important;}
      [data-competition-section="fechas"],#competitionDatesList{background:transparent!important;border:0!important;padding:0!important;}
      .season-fixture-card{width:min(340px,100%);margin:0 auto;padding:14px 14px 16px;border-radius:0 0 12px 12px;background:#05391f;color:#fff;box-shadow:0 18px 36px rgba(0,0,0,.22);font-family:inherit;}
      .season-title{margin:0 0 22px;text-align:center;font-size:16px;font-weight:950;color:#fff;text-transform:uppercase;text-shadow:1px 1px 0 rgba(0,0,0,.55);}
      .season-nav{display:grid;grid-template-columns:38px minmax(0,1fr) 38px;align-items:center;gap:8px;margin-bottom:10px;}
      .season-arrow{width:34px;height:34px;border:0;background:transparent;color:#fff;font-size:34px;font-weight:400;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-shadow:1px 1px 0 rgba(0,0,0,.5);}
      .season-arrow:disabled{opacity:.28;cursor:not-allowed;}
      .season-select-wrap{position:relative;min-width:0;display:flex;align-items:center;justify-content:center;height:32px;cursor:pointer;}
      .season-select-wrap span{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-size:15px;font-weight:950;color:#fff;text-transform:uppercase;text-shadow:1px 1px 0 rgba(0,0,0,.55);}
      .season-select{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;}
      .season-table{border:1px solid rgba(255,255,255,.32);border-radius:6px;overflow:hidden;background:#062f1b;}
      .season-date-head{height:22px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid rgba(255,255,255,.32);background:#07391f;color:#fff;font-size:12px;font-weight:800;}
      .season-rows{display:grid;}
      .season-row{min-height:37px;display:grid;grid-template-columns:63px minmax(0,1fr) 36px minmax(0,1fr);align-items:center;border-bottom:1px solid rgba(255,255,255,.28);background:#06351e;}
      .season-row:last-child{border-bottom:0;}
      .season-time{height:100%;display:flex;align-items:center;justify-content:center;border-right:1px solid rgba(255,255,255,.28);font-size:12px;font-weight:950;color:#fff;}
      .season-team{min-width:0;display:flex;align-items:center;gap:4px;padding:0 6px;font-size:12px;font-weight:950;color:#fff;text-shadow:1px 1px 0 rgba(0,0,0,.45);}
      .season-team span{min-width:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
      .season-home{justify-content:flex-end;text-align:right;}
      .season-away{justify-content:flex-start;text-align:left;}
      .season-team-logo{width:16px!important;height:16px!important;flex:0 0 16px!important;object-fit:contain!important;border:0!important;background:transparent!important;border-radius:50%;}
      .season-score-stack{display:grid;justify-items:center;align-items:center;gap:1px;min-width:0;color:#fff;font-weight:950;text-align:center;}
      .season-score{display:block!important;min-width:0!important;padding:0!important;background:transparent!important;border-radius:0!important;color:#fff!important;font-size:14px!important;font-weight:950!important;text-shadow:1px 1px 0 rgba(0,0,0,.55)!important;}
      .season-penalty-line{display:inline-flex;align-items:center;justify-content:center;margin-bottom:1px;border-radius:999px;padding:2px 4px;color:#10351f;background:#f7d24c;border:1px solid rgba(255,226,101,.9);font-size:8px;font-weight:950;white-space:nowrap;}
      .season-empty{padding:16px;text-align:center;color:#d8ffe6;font-size:13px;font-weight:800;}
      @media(max-width:720px){.season-fixture-card{width:100%;max-width:340px;padding:14px 10px 16px;}.season-row{grid-template-columns:63px minmax(0,1fr) 34px minmax(0,1fr);}.season-team{font-size:11px;padding:0 5px;}}
    `;
    document.head.appendChild(s);
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init(force = false) {
    const box = document.querySelector("#competitionDatesList");
    if (!box) return;

    // Limpiar tab de proximos (lo reemplaza Fechas)
    document.querySelectorAll('[data-competition-tab="proximos"],[data-competition-section="proximos"]').forEach(el => el.remove());

    const title = document.querySelector('[data-competition-section="fechas"] h2');
    if (title) title.textContent = "Temporada";
    const kicker = document.querySelector('[data-competition-section="fechas"] .competition-section-kicker');
    if (kicker) kicker.textContent = "Calendario";

    injectStyle();
    if (state && !force) return;

    try {
      const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      const id = idCompeticion();
      const comp = (data.competiciones || []).find(x => x.id === id || x.slug === id);
      if (!comp) throw new Error("Competición no encontrada");
      const items = buildItems(comp);
      if (!items.length) throw new Error("Sin fechas disponibles");
      state = { items, selected: seleccionInicial(items) };
      render();
    } catch (err) {
      box.innerHTML = `<p class="competition-empty">No hay fechas disponibles para esta competición.</p>`;
    }
  }

  // Eventos de navegación
  document.addEventListener("click", e => {
    if (e.target.closest("[data-season-prev]")) return seleccionarPorIndice(indiceActual() - 1);
    if (e.target.closest("[data-season-next]")) return seleccionarPorIndice(indiceActual() + 1);
  });

  document.addEventListener("change", e => {
    const sel = e.target.closest("[data-season-select]");
    if (!sel || !state) return;
    state.selected = sel.value;
    render();
  });

  document.addEventListener("DOMContentLoaded", () => init(true));
  window.setTimeout(() => init(true), 900);
  window.setTimeout(() => init(false), 1800);
})();
