(() => {
  const competitionId = document.body?.dataset?.competitionId || new URLSearchParams(window.location.search).get("id") || "";
  if (competitionId !== "primera-nacional") return;

  const COMPETICIONES_URL = "../data/competiciones.json";
  const EQUIPOS_PN_URL = "../data/equipos_primera_nacional.json";

  const ZONA_A_TEAMS = new Set([
    "deportivo moron",
    "ciudad de bolivar",
    "los andes",
    "colon",
    "ferro carril oeste",
    "ferro",
    "godoy cruz",
    "deportivo madryn",
    "almirante brown",
    "san miguel",
    "mitre",
    "mitre sde",
    "mitre sd e",
    "defensores de belgrano",
    "estudiantes ba",
    "estudiantes buenos aires",
    "estudiantes de buenos aires",
    "san telmo",
    "racing c",
    "racing cordoba",
    "racing de cordoba",
    "acassuso",
    "all boys",
    "central norte",
    "central norte s",
    "chaco for ever"
  ]);

  const ZONA_B_TEAMS = new Set([
    "gimnasia y esgrima j",
    "gimnasia jujuy",
    "gimnasia y esgrima de jujuy",
    "atlanta",
    "tristan suarez",
    "ferrocarril midland",
    "midland",
    "atletico de rafaela",
    "atletico rafaela",
    "san martin t",
    "san martin tucuman",
    "san martin de tucuman",
    "san martin sj",
    "san martin san juan",
    "san martin de san juan",
    "deportivo maipu",
    "nueva chicago",
    "chacarita juniors",
    "chacarita",
    "patronato",
    "temperley",
    "gimnasia y tiro",
    "gimnasia y tiro s",
    "colegiales",
    "agropecuario",
    "guemes",
    "guemes sde",
    "quilmes",
    "almagro"
  ]);

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeTeamKey(value) {
    return normalizeText(value)
      .replace(/^club atletico /, "")
      .replace(/^club /, "")
      .replace(/^ca /, "")
      .replace(/\bsd e\b/g, "sde")
      .replace(/\s+/g, " ")
      .trim();
  }

  function teamName(team) {
    return team?.nombre || team?.nombre_corto || team?.displayName || team?.name || "Equipo";
  }

  function teamLogo(team) {
    const logo = team?.logo || "";
    return logo
      ? `<img class="competition-team-logo" src="${escapeHtml(logo)}" alt="" loading="lazy" />`
      : `<span class="competition-team-logo"></span>`;
  }

  function numberValue(value, fallback = 999) {
    const cleaned = String(value ?? "")
      .replace("−", "-")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }

  function isZonaA(group) {
    const g = normalizeText(group);
    return g.includes("zona a") || g.includes("grupo a") || g.includes("group a") || g.includes("zone a") || g.endsWith(" a") || g === "a";
  }

  function isZonaB(group) {
    const g = normalizeText(group);
    return g.includes("zona b") || g.includes("grupo b") || g.includes("group b") || g.includes("zone b") || g.endsWith(" b") || g === "b";
  }

  function teamZone(row) {
    const explicit = row?.grupo || row?.zona || row?.stats?.zona || "";
    if (isZonaA(explicit)) return "A";
    if (isZonaB(explicit)) return "B";

    const name = normalizeTeamKey(teamName(row?.equipo || {}));
    if (ZONA_A_TEAMS.has(name)) return "A";
    if (ZONA_B_TEAMS.has(name)) return "B";

    for (const key of ZONA_A_TEAMS) {
      if (name === key || name.includes(key) || key.includes(name)) return "A";
    }
    for (const key of ZONA_B_TEAMS) {
      if (name === key || name.includes(key) || key.includes(name)) return "B";
    }

    return "";
  }

  function sortRows(rows) {
    rows.sort((a, b) => {
      const pa = numberValue(a?.stats?.posicion);
      const pb = numberValue(b?.stats?.posicion);
      if (pa !== pb) return pa - pb;
      const pts = numberValue(b?.stats?.pts, 0) - numberValue(a?.stats?.pts, 0);
      if (pts !== 0) return pts;
      const dg = numberValue(b?.stats?.dg, 0) - numberValue(a?.stats?.dg, 0);
      if (dg !== 0) return dg;
      const gf = numberValue(b?.stats?.gf, 0) - numberValue(a?.stats?.gf, 0);
      if (gf !== 0) return gf;
      return teamName(a?.equipo).localeCompare(teamName(b?.equipo), "es");
    });
    return rows;
  }

  function fixPositions(rows) {
    return rows.map((row, index) => {
      const cloned = { ...row, stats: { ...(row?.stats || {}) } };
      if (!cloned.stats.posicion || cloned.stats.posicion === "-") cloned.stats.posicion = String(index + 1);
      return cloned;
    });
  }

  function classifyRows(tabla) {
    const zonaA = [];
    const zonaB = [];
    const allRows = Array.isArray(tabla) ? tabla.filter(Boolean) : [];

    allRows.forEach((row) => {
      const zone = teamZone(row);
      if (zone === "A") zonaA.push(row);
      else if (zone === "B") zonaB.push(row);
    });

    return {
      zonaA: fixPositions(sortRows([...zonaA])),
      zonaB: fixPositions(sortRows([...zonaB])),
    };
  }

  function rowFromEquipo(equipo) {
    const generales = equipo?.estadisticasGenerales || {};
    const zona = equipo?.zona || generales?.zona || "";
    return {
      grupo: zona,
      zona,
      equipo: {
        id: equipo?.espn_id || equipo?.id || "",
        nombre: equipo?.nombre || "Equipo",
        nombre_corto: equipo?.nombre_corto || equipo?.nombre || "Equipo",
        logo: equipo?.logo || "",
      },
      stats: {
        posicion: generales?.posicionZona || equipo?.posicionZona || generales?.posicion || "-",
        pj: generales?.partidos || generales?.pj || "-",
        g: generales?.ganados || generales?.g || "-",
        e: generales?.empatados || generales?.e || "-",
        p: generales?.perdidos || generales?.p || "-",
        gf: generales?.golesFavor || generales?.gf || "-",
        gc: generales?.golesContra || generales?.gc || "-",
        dg: generales?.diferenciaGol || generales?.dg || "-",
        pts: generales?.puntos || generales?.pts || "-",
      },
    };
  }

  function rowsHaveFreshStats(rows) {
    if (!Array.isArray(rows) || !rows.length) return false;
    return rows.some((row) => {
      const stats = row?.stats || {};
      return ["pj", "g", "e", "p", "gf", "gc", "dg", "pts"].some((key) => {
        const value = stats[key];
        return value !== undefined && value !== null && value !== "" && value !== "-";
      });
    });
  }

  function destinoFor(position, totalRows) {
    if (position === 1) return { code: "final", label: "Final", description: "1° Final" };
    if (position >= 2 && position <= 8) return { code: "playoff", label: "Playoffs", description: "2° al 8° Playoffs" };
    if (totalRows >= 2 && position >= totalRows - 1) return { code: "descenso", label: "Descenso", description: "Últimos 2 Descenso" };
    return { code: "permanencia", label: "Permanece", description: "Permanece" };
  }

  function rowHtml(row, index, totalRows) {
    const stats = row?.stats || {};
    const equipo = row?.equipo || {};
    const position = numberValue(stats.posicion, index + 1);
    const destino = destinoFor(position, totalRows);

    return `
      <tr class="pn-row pn-row-${escapeHtml(destino.code)}">
        <td><strong>${escapeHtml(position)}</strong></td>
        <td class="team-cell">
          <span class="competition-team-inline">
            ${teamLogo(equipo)}
            <span>${escapeHtml(teamName(equipo))}</span>
          </span>
        </td>
        <td>${escapeHtml(stats.pj ?? "-")}</td>
        <td>${escapeHtml(stats.g ?? "-")}</td>
        <td>${escapeHtml(stats.e ?? "-")}</td>
        <td>${escapeHtml(stats.p ?? "-")}</td>
        <td>${escapeHtml(stats.gf ?? "-")}</td>
        <td>${escapeHtml(stats.gc ?? "-")}</td>
        <td>${escapeHtml(stats.dg ?? "-")}</td>
        <td><strong>${escapeHtml(stats.pts ?? "-")}</strong></td>
      </tr>`;
  }

  function zoneDestinosFooterHtml() {
    return `
      <div class="pn-zone-footer" aria-label="Destinos de la zona">
        <span class="pn-destino pn-destino-final">1° Final</span>
        <span class="pn-destino pn-destino-playoff">2° al 8° Playoffs</span>
        <span class="pn-destino pn-destino-descenso">Últimos 2 Descenso</span>
      </div>`;
  }

  function zoneTableHtml(title, rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    return `
      <article class="competition-subtable primera-nacional-zone-card">
        <div class="competition-subtable-head primera-nacional-zone-head">
          <strong>${escapeHtml(title)}</strong>
          <span>Fase de grupos</span>
        </div>
        <div class="competition-table-wrap">
          <table class="competition-table primera-nacional-table">
            <thead>
              <tr>
                <th>#</th><th class="team-cell">Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th>
              </tr>
            </thead>
            <tbody>
              ${safeRows.length ? safeRows.map((row, index) => rowHtml(row, index, safeRows.length)).join("") : `<tr><td colspan="10" class="team-cell">No hay datos disponibles para ${escapeHtml(title)}.</td></tr>`}
            </tbody>
          </table>
        </div>
        ${zoneDestinosFooterHtml()}
      </article>`;
  }

  function injectStyles() {
    if (document.querySelector("#primera-nacional-tabla-style")) return;
    const style = document.createElement("style");
    style.id = "primera-nacional-tabla-style";
    style.textContent = `
      .primera-nacional-format-box { display: grid; gap: 12px; padding: 8px 0; }
      .primera-nacional-zones { display:grid; gap:16px; }
      .primera-nacional-zone-head strong { color:#fff; font-size:18px; }
      .pn-row-final { background:rgba(255,220,80,.14); box-shadow:inset 4px 0 0 #ffd447; }
      .pn-row-playoff { background:rgba(65,180,255,.10); box-shadow:inset 4px 0 0 #55c6ff; }
      .pn-row-descenso { background:rgba(255,75,75,.13); box-shadow:inset 4px 0 0 #ff5c5c; }
      .pn-zone-footer { display:flex; flex-wrap:wrap; gap:7px; align-items:center; padding:10px 12px 12px; border-top:1px solid rgba(255,255,255,.08); background:rgba(0,0,0,.08); }
      .pn-zone-footer::before { content:"Destinos:"; color:rgba(232,255,238,.72); font-size:10px; font-weight:950; text-transform:uppercase; letter-spacing:.04em; margin-right:2px; }
      .pn-destino { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:4px 8px; font-size:10px; font-weight:950; text-transform:uppercase; letter-spacing:.02em; white-space:nowrap; }
      .pn-destino-final { color:#2b2500; background:#ffd447; }
      .pn-destino-playoff { color:#022337; background:#55c6ff; }
      .pn-destino-descenso { color:#fff; background:#e33f3f; }
      @media (max-width:760px){ .pn-zone-footer{gap:5px;padding:8px;} .pn-destino{font-size:8.5px;padding:3px 6px;} .pn-zone-footer::before{width:100%;margin-bottom:1px;} }
    `;
    document.head.appendChild(style);
  }

  function renderPrimeraNacionalTable(rowsSource) {
    const tableBody = document.querySelector("#competitionTableBody");
    if (!tableBody) return;

    const { zonaA, zonaB } = classifyRows(rowsSource);
    injectStyles();

    tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="competition-special-cell">
          <div class="primera-nacional-format-box">
            <div class="primera-nacional-zones">
              ${zoneTableHtml("Zona A", zonaA)}
              ${zoneTableHtml("Zona B", zonaB)}
            </div>
          </div>
        </td>
      </tr>`;

    const tableTitle = document.querySelector("#competitionTableCard h2");
    if (tableTitle) tableTitle.textContent = "Tabla de posiciones · Fase de grupos";
  }

  async function fetchJson(url) {
    const response = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function loadRowsFromPrimeraNacionalJson() {
    const equipos = await fetchJson(EQUIPOS_PN_URL);
    if (!Array.isArray(equipos) || !equipos.length) return [];
    return equipos.map(rowFromEquipo);
  }

  async function loadRowsFromCompeticionesJson() {
    const data = await fetchJson(COMPETICIONES_URL);
    const competitions = Array.isArray(data?.competiciones) ? data.competiciones : [];
    const competition = competitions.find((item) => item?.id === "primera-nacional" || item?.slug === "arg.2");
    return Array.isArray(competition?.tabla) ? competition.tabla : [];
  }

  async function initPrimeraNacionalTable() {
    let rows = [];

    try {
      rows = await loadRowsFromPrimeraNacionalJson();
    } catch (error) {
      console.warn("No se pudo leer primero equipos_primera_nacional.json", error);
    }

    if (!rowsHaveFreshStats(rows)) {
      try {
        const fallbackRows = await loadRowsFromCompeticionesJson();
        if (rowsHaveFreshStats(fallbackRows)) rows = fallbackRows;
      } catch (error) {
        console.warn("No se pudo leer fallback competiciones.json para Primera Nacional", error);
      }
    }

    renderPrimeraNacionalTable(rows);
  }

  setTimeout(initPrimeraNacionalTable, 250);
  setTimeout(initPrimeraNacionalTable, 1000);
})();
