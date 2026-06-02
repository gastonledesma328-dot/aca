/* =========================================================
   COPA ARGENTINA \u2014 Cuadro de Fases del Torneo
   Carga copa_argentina_bracket.json y renderiza el bracket
   completo: 32avos \u2192 16avos \u2192 Octavos \u2192 Cuartos \u2192 Semis \u2192 Final
   ========================================================= */

(function () {
  "use strict";

  const DATA_URL = "/data/copa_argentina_bracket.json";
  const TZ = "America/Argentina/Buenos_Aires";

  const FASES = [
    { key: "treintaidosavos", label: "32avos de Final",   slots: 32 },
    { key: "dieciseisavos",   label: "16avos de Final",   slots: 16 },
    { key: "octavos",         label: "Octavos de Final",  slots: 8  },
    { key: "cuartos",         label: "Cuartos de Final",  slots: 4  },
    { key: "semis",           label: "Semifinales",       slots: 2  },
    { key: "final",           label: "Final",             slots: 1  },
  ];

  // -------------------------------------------------------
  // Utilidades
  // -------------------------------------------------------

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fechaCorta(iso) {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("es-AR", {
        weekday: "short", day: "2-digit", month: "2-digit",
        timeZone: TZ,
      }).format(new Date(iso)).replace(/\./g, "");
    } catch (_) { return iso.slice(0, 10); }
  }

  function logo(team) {
    const src = team?.logo || "";
    return src
      ? `<img class="ca-logo" src="${esc(src)}" alt="" loading="lazy">`
      : `<span class="ca-logo ca-logo-empty"></span>`;
  }

  function nombre(team) {
    return esc(team?.nombre_corto || team?.nombre || "Por definir");
  }

  // -------------------------------------------------------
  // Render de un partido
  // -------------------------------------------------------

  function renderPartido(p, fasKey) {
    const isEmpty = !p || p.empty;
    if (isEmpty) {
      return `
        <article class="ca-match ca-match--empty">
          <div class="ca-team ca-team--tbd"><span class="ca-logo ca-logo-empty"></span><span>Por definir</span></div>
          <div class="ca-vs">-</div>
          <div class="ca-team ca-team--tbd"><span class="ca-logo ca-logo-empty"></span><span>Por definir</span></div>
        </article>`;
    }

    const local = p.local || {};
    const visit = p.visitante || {};
    const fecha = fechaCorta(p.fecha_iso || (p.fecha ? p.fecha + "T12:00:00" : ""));
    const completado = p.completado;
    const winL = local.ganador === true;
    const winV = visit.ganador === true;

    // Scores
    const scoreL = completado && local.marcador !== "" && local.marcador != null ? esc(local.marcador) : "";
    const scoreV = completado && visit.marcador !== "" && visit.marcador != null ? esc(visit.marcador) : "";

    // Penalty badge
    const penBadge = p.penaltis ? `<span class="ca-pen-badge">pen.</span>` : "";

    // Final badge
    const esFinal = fasKey === "final";

    return `
      <article class="ca-match${completado ? " ca-match--done" : ""}${esFinal ? " ca-match--final" : ""}">
        ${esFinal ? `<div class="ca-final-badge">\u2605 GRAN FINAL</div>` : ""}
        ${fecha ? `<div class="ca-match-date">${esc(fecha)}</div>` : ""}
        <div class="ca-teams">
          <div class="ca-team ${winL ? "ca-team--winner" : completado ? "ca-team--loser" : ""}">
            ${logo(local)}
            <span class="ca-team-name">${nombre(local)}</span>
            ${scoreL !== "" ? `<span class="ca-score ${winL ? "ca-score--winner" : ""}">${scoreL}</span>` : ""}
          </div>
          ${penBadge}
          <div class="ca-team ${winV ? "ca-team--winner" : completado ? "ca-team--loser" : ""}">
            ${logo(visit)}
            <span class="ca-team-name">${nombre(visit)}</span>
            ${scoreV !== "" ? `<span class="ca-score ${winV ? "ca-score--winner" : ""}">${scoreV}</span>` : ""}
          </div>
        </div>
        ${p.estadio ? `<div class="ca-estadio">${esc(p.estadio.split(",")[0])}</div>` : ""}
      </article>`;
  }

  // -------------------------------------------------------
  // Render de una fase
  // -------------------------------------------------------

  function renderFase(fase, partidos, campeon) {
    const lista = (partidos || []).slice();
    // Pad to slots with empty
    while (lista.length < fase.slots) lista.push({ empty: true });

    const completados = partidos.filter(p => p.completado).length;
    const total = partidos.length;
    const badge = total > 0 ? `<span class="ca-fase-badge">${completados}/${total}</span>` : "";

    // Special campeon card for final
    const esFinal = fase.key === "final";
    const campeonCard = (esFinal && campeon)
      ? `<div class="ca-campeon-card">
          <img class="ca-campeon-logo" src="${esc(campeon.logo)}" alt="" loading="lazy">
          <div class="ca-campeon-label">Campe\u00f3n</div>
          <div class="ca-campeon-nombre">${esc(campeon.nombre)}</div>
        </div>`
      : "";

    return `
      <section class="ca-fase" data-fase="${esc(fase.key)}">
        <div class="ca-fase-header">
          <h3>${esc(fase.label)}</h3>${badge}
        </div>
        ${campeonCard}
        <div class="ca-fase-list">
          ${lista.map(p => renderPartido(p, fase.key)).join("")}
        </div>
      </section>`;
  }

  // -------------------------------------------------------
  // Estilos
  // -------------------------------------------------------

  function injectStyles() {
    if (document.getElementById("ca-bracket-styles")) return;
    const s = document.createElement("style");
    s.id = "ca-bracket-styles";
    s.textContent = `
/* === Copa Argentina Bracket === */
#copa-argentina-bracket {
  font-family: inherit;
  padding: 0 0 24px;
}
.ca-bracket-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid rgba(255,255,255,.1);
}
.ca-bracket-title { font-size: 15px; font-weight: 900; color: #eaffef; }
.ca-bracket-season { font-size: 12px; color: rgba(186,255,120,.7); font-weight: 600; }

/* Scroll container */
.ca-bracket-scroll {
  overflow-x: auto;
  padding: 16px 12px 8px;
  -webkit-overflow-scrolling: touch;
}
.ca-bracket-stages {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-width: max-content;
}

/* Fase column */
.ca-fase {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}
.ca-fase[data-fase="treintaidosavos"] { width: 160px; }
.ca-fase[data-fase="dieciseisavos"]   { width: 160px; }
.ca-fase[data-fase="octavos"]         { width: 168px; }
.ca-fase[data-fase="cuartos"]         { width: 168px; }
.ca-fase[data-fase="semis"]           { width: 172px; }
.ca-fase[data-fase="final"]           { width: 180px; }

.ca-fase-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px 8px;
  position: sticky; top: 0;
  background: rgba(5,40,22,.95);
  z-index: 2;
  border-radius: 6px 6px 0 0;
}
.ca-fase-header h3 {
  font-size: 11px; font-weight: 900;
  text-transform: uppercase; letter-spacing: .05em;
  color: rgba(186,255,120,.9); margin: 0;
}
.ca-fase-badge {
  font-size: 10px; font-weight: 800;
  background: rgba(95,207,128,.2);
  color: rgb(95,207,128);
  border-radius: 99px; padding: 1px 6px;
  border: 1px solid rgba(95,207,128,.3);
}
.ca-fase-list { display: flex; flex-direction: column; gap: 5px; }

/* Match card */
.ca-match {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px;
  padding: 7px 9px;
  transition: border-color .15s;
}
.ca-match:hover { border-color: rgba(95,207,128,.4); }
.ca-match--done { background: rgba(255,255,255,.06); }
.ca-match--empty {
  border-style: dashed;
  border-color: rgba(255,255,255,.08);
  background: transparent;
  padding: 10px 9px;
  display: flex; flex-direction: column; gap: 4px;
}
.ca-match--final {
  border-color: rgba(247,210,76,.5);
  background: rgba(247,210,76,.06);
}
.ca-match--final:hover { border-color: rgba(247,210,76,.8); }

.ca-final-badge {
  font-size: 10px; font-weight: 900; text-align: center;
  color: rgb(247,210,76); letter-spacing: .06em; margin-bottom: 5px;
}
.ca-match-date {
  font-size: 10px; color: rgba(186,255,120,.55);
  font-weight: 700; margin-bottom: 4px; text-align: right;
}
.ca-teams { display: flex; flex-direction: column; gap: 4px; }
.ca-team {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 800; color: #eaffef;
}
.ca-team--winner { color: #fff; }
.ca-team--loser  { opacity: .5; }
.ca-team--tbd    { color: rgba(255,255,255,.3); font-style: italic; }

.ca-logo {
  width: 16px; height: 16px;
  object-fit: contain; flex-shrink: 0; border-radius: 50%;
}
.ca-logo-empty {
  display: inline-block; width: 16px; height: 16px;
  background: rgba(255,255,255,.08); border-radius: 50%; flex-shrink: 0;
}
.ca-team-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ca-score {
  font-size: 13px; font-weight: 950; color: rgba(255,255,255,.6);
  flex-shrink: 0; min-width: 14px; text-align: right;
}
.ca-score--winner { color: #fff; }

.ca-pen-badge {
  font-size: 9px; font-weight: 800;
  background: rgba(247,210,76,.15); color: rgb(247,210,76);
  border: 1px solid rgba(247,210,76,.4); border-radius: 4px;
  padding: 1px 4px; align-self: center; text-align: center;
}
.ca-estadio {
  font-size: 9px; color: rgba(255,255,255,.3);
  margin-top: 4px; text-align: right; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}

/* Campeon card */
.ca-campeon-card {
  display: flex; flex-direction: column; align-items: center;
  gap: 6px; padding: 12px 8px;
  background: linear-gradient(135deg, rgba(247,210,76,.15), rgba(95,207,128,.08));
  border: 1px solid rgba(247,210,76,.4);
  border-radius: 10px; margin-bottom: 6px;
}
.ca-campeon-logo { width: 44px; height: 44px; object-fit: contain; filter: drop-shadow(0 2px 6px rgba(0,0,0,.5)); }
.ca-campeon-label {
  font-size: 10px; font-weight: 900; text-transform: uppercase;
  letter-spacing: .1em; color: rgb(247,210,76);
}
.ca-campeon-nombre {
  font-size: 13px; font-weight: 900; color: #fff; text-align: center; line-height: 1.2;
}

/* Info footer */
.ca-bracket-info {
  display: flex; flex-wrap: wrap; gap: 8px;
  padding: 12px 20px 4px;
}
.ca-bracket-info article {
  display: flex; flex-direction: column; gap: 2px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 8px; padding: 8px 12px;
  min-width: 120px; flex: 1;
}
.ca-bracket-info span { font-size: 10px; color: rgba(255,255,255,.45); font-weight: 600; }
.ca-bracket-info strong { font-size: 12px; color: #eaffef; font-weight: 800; }

/* Empty state */
.ca-empty { padding: 24px; text-align: center; color: rgba(255,255,255,.4); font-size: 13px; }

@media (max-width: 640px) {
  .ca-fase[data-fase="treintaidosavos"],
  .ca-fase[data-fase="dieciseisavos"] { width: 148px; }
  .ca-fase[data-fase="octavos"],
  .ca-fase[data-fase="cuartos"] { width: 152px; }
  .ca-bracket-scroll { padding: 12px 8px 8px; }
}
`;
    document.head.appendChild(s);
  }

  // -------------------------------------------------------
  // Render principal
  // -------------------------------------------------------

  function render(data) {
    const fases = data.fases || {};
    const campeon = data.campeon || null;
    const season = data.season || "";

    // Calculate total completed
    let totalPartidos = 0, totalCompletados = 0;
    for (const fase of FASES) {
      const list = fases[fase.key] || [];
      totalPartidos += list.length;
      totalCompletados += list.filter(p => p.completado).length;
    }

    // Only show fases that have data
    const fasesConDatos = FASES.filter(f => (fases[f.key] || []).length > 0);
    if (fasesConDatos.length === 0) {
      return `<div class="ca-empty">No se encontraron datos de Copa Argentina ${season}.<br>Los datos se actualizan autom\u00E1ticamente.</div>`;
    }

    return `
      <div class="ca-bracket-header">
        <span class="ca-bracket-title">Copa Argentina ${esc(season)}</span>
        <span class="ca-bracket-season">${totalCompletados} de ${totalPartidos} partidos jugados</span>
      </div>
      <div class="ca-bracket-info">
        <article><span>Formato</span><strong>Eliminaci\u00F3n directa</strong></article>
        <article><span>Fases</span><strong>${esc(fasesConDatos.length)} rondas</strong></article>
        <article><span>Premio</span><strong>Copa Libertadores</strong></article>
        ${campeon ? `<article><span>Campe\u00f3n</span><strong>${esc(campeon.nombre)}</strong></article>` : ""}
      </div>
      <div class="ca-bracket-scroll">
        <div class="ca-bracket-stages">
          ${fasesConDatos.map(fase => renderFase(fase, fases[fase.key] || [], campeon)).join("")}
        </div>
      </div>`;
  }

  // -------------------------------------------------------
  // Init
  // -------------------------------------------------------

  function isCopaPage() {
    const id = document.body?.dataset?.competitionId || "";
    return id === "copa-argentina" || id.includes("copa") || window.location.href.includes("copa-argentina");
  }

  async function init() {
    if (!isCopaPage()) return;

    // Find or create the container \u2014 insert into the tabla section
    let container = document.getElementById("copa-argentina-bracket");
    if (!container) {
      const tablaSection = document.querySelector('[data-competition-section="tabla"]');
      if (!tablaSection) return;

      // Replace or prepend
      container = document.createElement("div");
      container.id = "copa-argentina-bracket";
      tablaSection.insertBefore(container, tablaSection.firstChild);
    }

    injectStyles();
    container.innerHTML = `<div class="ca-empty">Cargando cuadro de Copa Argentina\u2026</div>`;

    try {
      const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      container.innerHTML = render(data);
    } catch (err) {
      console.error("Copa Argentina bracket error:", err);
      container.innerHTML = `<div class="ca-empty">No se pudo cargar el cuadro.<br><small>${esc(err.message)}</small></div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  window.setTimeout(init, 800);
  window.setTimeout(init, 2000);
})();
