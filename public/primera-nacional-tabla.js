(() => {
  const competitionId = document.body?.dataset?.competitionId || new URLSearchParams(window.location.search).get("id") || "";
  if (competitionId !== "primera-nacional") return;

  const DATA_URL = "../data/competiciones.json";

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
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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

  function numberValue(value, fallback = 999) {
    const n = Number(String(value ?? "").replace(",", ".").replace("-", ""));
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

  function classifyRows(tabla) {
    const zonaA = [];
    const zonaB = [];
    const grouped = new Map();

    (tabla || []).forEach((row) => {
      const group = row?.grupo || "General";
      if (isZonaA(group)) zonaA.push(row);
      else if (isZonaB(group)) zonaB.push(row);
      else {
        if (!grouped.has(group)) grouped.set(group, []);
        grouped.get(group).push(row);
      }
    });

    if (!zonaA.length && !zonaB.length) {
      const validGroups = [...grouped.values()].filter((rows) => rows.length >= 8);
      if (validGroups.length >= 2) {
        zonaA.push(...validGroups[0]);
        zonaB.push(...validGroups[1]);
      }
    }

    [zonaA, zonaB].forEach((rows) => {
      rows.sort((a, b) => {
        const pa = numberValue(a?.stats?.posicion);
        const pb = numberValue(b?.stats?.posicion);
        if (pa !== pb) return pa - pb;
        const pts = numberValue(b?.stats?.pts, 0) - numberValue(a?.stats?.pts, 0);
        if (pts !== 0) return pts;
        const dg = numberValue(b?.stats?.dg, 0) - numberValue(a?.stats?.dg, 0);
        if (dg !== 0) return dg;
        return teamName(a?.equipo).localeCompare(teamName(b?.equipo), "es");
      });
    });

    return { zonaA, zonaB };
  }

  function destinoFor(position, totalRows) {
    if (position === 1) {
      return { code: "final", label: "Final", description: "1°: va a la final" };
    }
    if (position >= 2 && position <= 8) {
      return { code: "playoff", label: "Playoffs", description: "2° al 8°: playoffs" };
    }
    if (totalRows >= 2 && position >= totalRows - 1) {
      return { code: "descenso", label: "Descenso", description: "Últimos 2: descenso" };
    }
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
        <td><span class="pn-destino pn-destino-${escapeHtml(destino.code)}" title="${escapeHtml(destino.description)}">${escapeHtml(destino.label)}</span></td>
      </tr>`;
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
                <th>#</th>
                <th class="team-cell">Equipo</th>
                <th>PJ</th>
                <th>G</th>
                <th>E</th>
                <th>P</th>
                <th>GF</th>
                <th>GC</th>
                <th>DG</th>
                <th>PTS</th>
                <th>Destino</th>
              </tr>
            </thead>
            <tbody>
              ${safeRows.length ? safeRows.map((row, index) => rowHtml(row, index, safeRows.length)).join("") : `<tr><td colspan="11" class="team-cell">No hay datos disponibles para ${escapeHtml(title)}.</td></tr>`}
            </tbody>
          </table>
        </div>
      </article>`;
  }

  function injectStyles() {
    if (document.querySelector("#primera-nacional-tabla-style")) return;
    const style = document.createElement("style");
    style.id = "primera-nacional-tabla-style";
    style.textContent = `
      .primera-nacional-format-box {
        display: grid;
        gap: 12px;
        padding: 8px 0;
      }

      .primera-nacional-rules {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 8px;
      }

      .primera-nacional-rule {
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(6, 40, 24, 0.62);
        padding: 10px 12px;
      }

      .primera-nacional-rule strong {
        display: block;
        color: #ffffff;
        font-size: 13px;
        font-weight: 950;
      }

      .primera-nacional-rule span {
        display: block;
        margin-top: 3px;
        color: rgba(232, 255, 238, 0.78);
        font-size: 11px;
        font-weight: 800;
      }

      .primera-nacional-zones {
        display: grid;
        gap: 16px;
      }

      .primera-nacional-zone-head strong {
        color: #ffffff;
        font-size: 18px;
      }

      .primera-nacional-table th:last-child,
      .primera-nacional-table td:last-child {
        text-align: center;
      }

      .pn-row-final {
        background: rgba(255, 220, 80, 0.14);
        box-shadow: inset 4px 0 0 #ffd447;
      }

      .pn-row-playoff {
        background: rgba(65, 180, 255, 0.10);
        box-shadow: inset 4px 0 0 #55c6ff;
      }

      .pn-row-descenso {
        background: rgba(255, 75, 75, 0.13);
        box-shadow: inset 4px 0 0 #ff5c5c;
      }

      .pn-destino {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 78px;
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 10px;
        font-weight: 950;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }

      .pn-destino-final {
        color: #2b2500;
        background: #ffd447;
      }

      .pn-destino-playoff {
        color: #022337;
        background: #55c6ff;
      }

      .pn-destino-descenso {
        color: #ffffff;
        background: #e33f3f;
      }

      .pn-destino-permanencia {
        color: #dfffe8;
        background: rgba(255, 255, 255, 0.12);
      }

      @media (max-width: 760px) {
        .primera-nacional-rules {
          grid-template-columns: 1fr;
        }

        .pn-destino {
          min-width: 70px;
          font-size: 9px;
          padding: 3px 6px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function renderPrimeraNacionalTable(competition) {
    const tableBody = document.querySelector("#competitionTableBody");
    if (!tableBody) return;

    const tabla = Array.isArray(competition?.tabla) ? competition.tabla : [];
    const { zonaA, zonaB } = classifyRows(tabla);

    injectStyles();

    tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="competition-special-cell">
          <div class="primera-nacional-format-box">
            <div class="primera-nacional-rules">
              <article class="primera-nacional-rule">
                <strong>1° de cada zona</strong>
                <span>Va directo a la final por el ascenso.</span>
              </article>
              <article class="primera-nacional-rule">
                <strong>2° al 8° de cada zona</strong>
                <span>Clasifican a los playoffs / reducido.</span>
              </article>
              <article class="primera-nacional-rule">
                <strong>Últimos 2 de cada zona</strong>
                <span>Quedan marcados en zona de descenso.</span>
              </article>
            </div>
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

  async function initPrimeraNacionalTable() {
    try {
      const response = await fetch(`${DATA_URL}?pn=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const competitions = Array.isArray(data?.competiciones) ? data.competiciones : [];
      const competition = competitions.find((item) => item?.id === "primera-nacional" || item?.slug === "arg.2");
      if (!competition) return;
      renderPrimeraNacionalTable(competition);
    } catch (error) {
      console.warn("No se pudo renderizar la tabla especial de Primera Nacional", error);
    }
  }

  // competicion.js también carga datos en async. Este render corre después y pisa solo la tabla de Primera Nacional.
  setTimeout(initPrimeraNacionalTable, 250);
  setTimeout(initPrimeraNacionalTable, 1000);
})();
