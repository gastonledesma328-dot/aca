/* ================================
   BRACKET LPF - ORDEN SIN VACÍOS
================================ */

(function () {
  function keyTeam(team) {
    if (!team) return "";
    return String(team.id || team.slug || team.nombre || team.nombre_corto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
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
    return teams(match).some((t) => keyTeam(t) === key);
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

    // Punto clave: si no hay coincidencia por nombres/IDs, no ponemos "Por definir".
    // Usamos el siguiente partido real que quede para no vaciar cuartos, semis o final.
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

  function orderQuarterFinals(octavos, cuartosRaw) {
    const remaining = [...(cuartosRaw || [])];
    const relations = [
      [0, 7],
      [1, 6],
      [2, 5],
      [3, 4],
    ];

    return relations.map(([a, b]) => {
      const found = findMatch(remaining, candidates(octavos[a]), candidates(octavos[b]));
      return take(found, remaining);
    });
  }

  function orderSemis(cuartos, semisRaw) {
    const remaining = [...(semisRaw || [])];
    const relations = [
      [0, 3],
      [1, 2],
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

  function renderOrderedBracket(fases) {
    if (!fases || !window.renderBracketPhaseFix) return;

    const tournament = document.querySelector(".competition-bracket-tournament");
    if (!tournament) return;

    const octavos = normalize(fases.octavos || [], 8);
    const cuartos = orderQuarterFinals(octavos, fases.cuartos || []);
    const semis = orderSemis(cuartos, fases.semis || []);
    const final = orderFinal(semis, fases.final || []);

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
