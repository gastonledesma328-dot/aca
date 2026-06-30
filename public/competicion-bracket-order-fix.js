/* ================================
   BRACKET LPF - ORDEN POR LLAVES REALES
================================ */

(function () {
  const OCTAVOS_ORDER_NAMES = [
    ["Argentinos Juniors", "Lanús"],
    ["Boca Juniors", "Huracán"],
    ["Independiente Rivadavia", "Unión"],
    ["Talleres", "Belgrano"],
    ["Rosario Central", "Independiente"],
    ["Estudiantes", "Racing"],
    ["River Plate", "San Lorenzo"],
    ["Vélez", "Gimnasia"],
  ];

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function keyTeam(team) {
    if (!team) return "";
    return normalizeText(team.id || team.slug || team.nombre || team.nombre_corto || "");
  }

  function nameKey(value) {
    return normalizeText(value);
  }

  function teams(match) {
    return [match?.local?.equipo, match?.visitante?.equipo].filter(Boolean);
  }

  function winner(match) {
    if (match?.ganador) return match.ganador;
    if (match?.local?.ganador) return match.local.equipo;
    if (match?.visitante?.ganador) return match.visitante.equipo;
    return null;
  }

  function candidates(match) {
    if (!match || match.empty) return [];
    const w = winner(match);
    return w ? [w] : teams(match);
  }

  function matchHasTeam(match, team) {
    const key = keyTeam(team);
    if (!key) return false;
    return teams(match).some((t) => keyTeam(t) === key || normalizeText(t.nombre || t.nombre_corto || "") === key);
  }

  function matchHasName(match, name) {
    const key = nameKey(name);
    if (!key) return false;
    return teams(match).some((team) => {
      const full = normalizeText(team?.nombre || "");
      const short = normalizeText(team?.nombre_corto || "");
      const slug = normalizeText(team?.slug || "");
      return full.includes(key) || key.includes(full) || short.includes(key) || key.includes(short) || slug.includes(key) || key.includes(slug);
    });
  }

  function findMatchByNames(matches, homeName, awayName) {
    return (matches || []).find((match) => matchHasName(match, homeName) && matchHasName(match, awayName)) || null;
  }

  function findMatch(rawMatches, groupA, groupB) {
    const remaining = rawMatches || [];

    for (const a of groupA || []) {
      for (const b of groupB || []) {
        const found = remaining.find((match) => matchHasTeam(match, a) && matchHasTeam(match, b));
        if (found) return found;
      }
    }

    for (const a of groupA || []) {
      const found = remaining.find((match) => matchHasTeam(match, a));
      if (found) return found;
    }

    for (const b of groupB || []) {
      const found = remaining.find((match) => matchHasTeam(match, b));
      if (found) return found;
    }

    return null;
  }

  function take(match, remaining) {
    let selected = match;

    if (!selected) {
      selected = remaining.find((item) => item && !item.empty) || null;
    }

    if (!selected) return { empty: true };

    const index = remaining.indexOf(selected);
    if (index >= 0) remaining.splice(index, 1);

    return selected;
  }

  function normalize(matches, slots) {
    const list = Array.isArray(matches) ? matches.slice(0, slots) : [];
    while (list.length < slots) list.push({ empty: true });
    return list;
  }

  function orderRoundOf16(octavosRaw) {
    const remaining = [...(octavosRaw || [])];
    const ordered = [];

    OCTAVOS_ORDER_NAMES.forEach(([a, b]) => {
      const found = findMatchByNames(remaining, a, b);
      ordered.push(take(found, remaining));
    });

    return normalize(ordered, 8);
  }

  function orderQuarterFinals(octavos, cuartosRaw) {
    const remaining = [...(cuartosRaw || [])];

    const relations = [
      [0, 3],
      [1, 2],
      [4, 7],
      [5, 6],
    ];

    return relations.map(([a, b]) => {
      const found = findMatch(remaining, candidates(octavos[a]), candidates(octavos[b]));
      return take(found, remaining);
    });
  }

  function orderSemis(cuartos, semisRaw) {
    const remaining = [...(semisRaw || [])];
    const relations = [
      [0, 1],
      [2, 3],
    ];

    return relations.map(([a, b]) => {
      const found = findMatch(remaining, candidates(cuartos[a]), candidates(cuartos[b]));
      return take(found, remaining);
    });
  }

  function orderFinal(semis, finalRaw) {
    const remaining = [...(finalRaw || [])];
    const found = findMatch(remaining, candidates(semis[0]), candidates(semis[1]));
    return [take(found, remaining)];
  }

  function isTeamName(team, expected) {
    const key = normalizeText(expected);
    const full = normalizeText(team?.nombre || "");
    const short = normalizeText(team?.nombre_corto || "");
    const slug = normalizeText(team?.slug || "");
    return full.includes(key) || key.includes(full) || short.includes(key) || key.includes(short) || slug.includes(key) || key.includes(slug);
  }

  function invertirSiCoincide(match, equipoLocalActual, equipoVisitanteActual) {
    if (!match || match.empty || !match.local || !match.visitante) return match;

    const localTeam = match.local.equipo;
    const visitorTeam = match.visitante.equipo;

    if (isTeamName(localTeam, equipoLocalActual) && isTeamName(visitorTeam, equipoVisitanteActual)) {
      return {
        ...match,
        local: match.visitante,
        visitante: match.local,
      };
    }

    return match;
  }

  function normalizarPartidoLocalVisitante(match) {
    let salida = match;

    // Unión debe mostrarse arriba de Belgrano.
    salida = invertirSiCoincide(salida, "Belgrano", "Unión");

    // Pedido específico: que no quede River Plate VS Belgrano, sino Belgrano VS River Plate.
    salida = invertirSiCoincide(salida, "River Plate", "Belgrano");

    return salida;
  }

  function normalizarOrdenLocalVisitante(matches) {
    return (matches || []).map(normalizarPartidoLocalVisitante);
  }

  function renderOrderedBracket(fases) {
    if (!fases || !window.renderBracketPhaseFix) return;

    const tournament = document.querySelector(".competition-bracket-tournament");
    if (!tournament) return;

    const octavos = normalizarOrdenLocalVisitante(orderRoundOf16(fases.octavos || []));
    const cuartos = normalizarOrdenLocalVisitante(orderQuarterFinals(octavos, fases.cuartos || []));
    const semis = normalizarOrdenLocalVisitante(orderSemis(cuartos, fases.semis || []));
    const final = normalizarOrdenLocalVisitante(orderFinal(semis, fases.final || []));

    tournament.innerHTML = `
      ${window.renderBracketPhaseFix("octavos", "Octavos de final", octavos)}
      ${window.renderBracketPhaseFix("cuartos", "Cuartos de final", cuartos)}
      ${window.renderBracketPhaseFix("semis", "Semifinales", semis)}
      ${window.renderBracketPhaseFix("final", "Final", final)}
    `;

    tournament.dataset.llavesCorregidas = "1";
  }

  async function fixBracketOrder() {
    if ((document.body?.dataset?.competitionId || "") !== "liga-profesional") return;
    if (!window.cargarCompeticionActual) return;

    const competition = await window.cargarCompeticionActual();
    const fases = competition?.especial?.eliminatorias?.fases;
    if (!fases) return;

    renderOrderedBracket(fases);
  }

  window.corregirOrdenBracketLigaProfesional = fixBracketOrder;

  document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(fixBracketOrder, 200);
    window.setTimeout(fixBracketOrder, 800);
    window.setTimeout(fixBracketOrder, 1600);
  });

  window.setTimeout(fixBracketOrder, 300);
  window.setTimeout(fixBracketOrder, 1200);
})();
