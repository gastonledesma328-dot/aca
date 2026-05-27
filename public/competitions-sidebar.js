/* ================================
   SIDEBAR DE COMPETICIONES - AGENDA
================================ */

const COMPETITION_GROUPS = [
  {
    title: "DESTACADO",
    featured: true,
    items: [
      ["Liga Profesional", ["liga profesional", "torneo betano", "arg.1"]],
      ["Primera Nacional", ["primera nacional", "arg.2"]],
      ["Libertadores", ["libertadores", "conmebol.libertadores"]],
      ["Sudamericana", ["sudamericana", "conmebol.sudamericana"]],
      ["Copa Argentina", ["copa argentina"]],
      ["Champions", ["champions", "uefa.champions"]],
      ["Eliminatorias Conmebol", ["eliminatorias conmebol", "fifa.worldq.conmebol"]],
      ["Mundial", ["mundial", "fifa.world", "fifa.cwc", "mundial de clubes"]],
    ],
  },
  {
    title: "🇦🇷 ARGENTINA",
    items: [
      ["Liga Profesional", ["liga profesional", "torneo betano", "arg.1"]],
      ["Primera Nacional", ["primera nacional", "arg.2"]],
      ["Copa Argentina", ["copa argentina"]],
    ],
  },
  {
    title: "🌐 INTERNACIONAL",
    items: [
      ["Libertadores", ["libertadores", "conmebol.libertadores"]],
      ["Sudamericana", ["sudamericana", "conmebol.sudamericana"]],
      ["Mundial de Clubes", ["mundial de clubes", "fifa.cwc"]],
      ["Mundial", ["mundial", "fifa.world"]],
    ],
  },
  { title: "🏴 INGLATERRA", items: [["Premier League", ["premier league", "eng.1"]], ["FA Cup", ["fa cup"]]] },
  { title: "🇪🇸 ESPAÑA", items: [["LaLiga", ["laliga", "la liga", "esp.1"]], ["Copa del Rey", ["copa del rey"]]] },
  { title: "🇮🇹 ITALIA", items: [["Serie A", ["serie a", "ita.1"]], ["Coppa Italia", ["coppa italia"]]] },
  { title: "🇩🇪 ALEMANIA", items: [["Bundesliga", ["bundesliga", "ger.1"]]] },
  { title: "🇵🇹 PORTUGAL", items: [["Primeira Liga", ["primeira liga", "por.1"]]] },
  { title: "🇫🇷 FRANCIA", items: [["Ligue 1", ["ligue 1", "fra.1"]]] },
  { title: "🇧🇷 BRASIL", items: [["Brasileirão", ["brasileirao", "brasileirão", "bra.1"]], ["Copa do Brasil", ["copa do brasil"]]] },
  { title: "🇺🇾 URUGUAY", items: [["Campeonato Uruguayo", ["campeonato uruguayo", "uruguayan championship", "uru.1"]]] },
  { title: "🇵🇾 PARAGUAY", items: [["Primera División", ["paraguay", "par.1", "copa de primera"]]] },
  { title: "🇨🇴 COLOMBIA", items: [["Primera A", ["colombia", "col.1", "primera a"]]] },
  { title: "🇨🇱 CHILE", items: [["Primera División", ["chile", "chi.1"]]] },
  { title: "🇲🇽 MÉXICO", items: [["Liga MX", ["liga mx", "mex.1"]]] },
  { title: "🇺🇸 EEUU", items: [["MLS", ["mls", "usa.1"]]] },
  { title: "🌐 SELECCIONES", items: [["Eliminatorias", ["eliminatorias", "worldq"]], ["Amistosos", ["amistosos", "friendly"]]] },
];

let activeCompetitionFilter = null;

function normalizeCompetitionText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function competitionTextFromGroup(group) {
  if (!group) return "";

  const title = group.querySelector(".agenda-league-title strong, .agenda-group-head strong, .league-head h2, h2, strong")?.textContent || "";
  const subtitle = group.querySelector(".agenda-league-title span, .agenda-group-head span")?.textContent || "";
  const dataset = Object.values(group.dataset || {}).join(" ");

  return normalizeCompetitionText(`${title} ${subtitle} ${dataset}`);
}

function competitionMatches(text, terms) {
  const normalizedTerms = (terms || []).map(normalizeCompetitionText).filter(Boolean);
  return normalizedTerms.some((term) => text.includes(term) || term.includes(text));
}

function applyCompetitionFilter(filter) {
  activeCompetitionFilter = filter;

  document.querySelectorAll(".competition-filter-btn").forEach((button) => {
    button.classList.toggle("active", filter && button.dataset.filterLabel === filter.label);
  });

  document.querySelectorAll(".competition-clear-btn").forEach((button) => {
    button.classList.toggle("active", !filter);
  });

  const groups = document.querySelectorAll("#leagueGrid .agenda-group, #leagueGrid .league-card");
  let visible = 0;

  groups.forEach((group) => {
    const text = competitionTextFromGroup(group);
    const show = !filter || competitionMatches(text, filter.terms);
    group.classList.toggle("competition-hidden", !show);
    if (show) visible += 1;
  });

  const status = document.querySelector("#competitionFilterStatus");
  if (status) {
    status.innerHTML = filter
      ? `Filtro activo: <strong>${filter.label}</strong> · ${visible} competición/es`
      : "Mostrando todas las competiciones";
  }
}

function buildCompetitionButton(label, terms) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "competition-filter-btn";
  button.textContent = label;
  button.dataset.filterLabel = label;
  button.addEventListener("click", () => applyCompetitionFilter({ label, terms }));
  return button;
}

function createCompetitionsSidebar() {
  const aside = document.createElement("aside");
  aside.className = "competitions-sidebar";
  aside.setAttribute("aria-label", "Competiciones");

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "competition-clear-btn active";
  clear.textContent = "Todas las competiciones";
  clear.addEventListener("click", () => applyCompetitionFilter(null));
  aside.appendChild(clear);

  COMPETITION_GROUPS.forEach((group, index) => {
    if (group.featured) {
      const title = document.createElement("button");
      title.type = "button";
      title.className = "competition-sidebar-title";
      title.innerHTML = `<span>${group.title}</span><span>⌃</span>`;
      aside.appendChild(title);

      const list = document.createElement("div");
      list.className = "competition-featured-list";
      group.items.forEach(([label, terms]) => list.appendChild(buildCompetitionButton(label, terms)));
      aside.appendChild(list);
      return;
    }

    const country = document.createElement("section");
    country.className = `competition-country${index <= 2 ? " open" : ""}`;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "competition-country-toggle";
    toggle.innerHTML = `<span>${group.title}</span><span>⌄</span>`;
    toggle.addEventListener("click", () => country.classList.toggle("open"));

    const leagues = document.createElement("div");
    leagues.className = "competition-leagues";
    group.items.forEach(([label, terms]) => leagues.appendChild(buildCompetitionButton(label, terms)));

    country.append(toggle, leagues);
    aside.appendChild(country);
  });

  const status = document.createElement("p");
  status.className = "competition-filter-status";
  status.id = "competitionFilterStatus";
  status.textContent = "Mostrando todas las competiciones";
  aside.appendChild(status);

  return aside;
}

function mountCompetitionsSidebar() {
  const leagueGrid = document.querySelector("#leagueGrid");
  if (!leagueGrid || document.querySelector(".agenda-with-competitions")) return;

  const wrapper = document.createElement("section");
  wrapper.className = "agenda-with-competitions";
  wrapper.setAttribute("aria-label", "Agenda con competiciones");

  const parent = leagueGrid.parentNode;
  parent.insertBefore(wrapper, leagueGrid);
  wrapper.appendChild(createCompetitionsSidebar());
  wrapper.appendChild(leagueGrid);
}

function observeCompetitionAgendaChanges() {
  const leagueGrid = document.querySelector("#leagueGrid");
  if (!leagueGrid) return;

  const observer = new MutationObserver(() => {
    if (activeCompetitionFilter) {
      window.requestAnimationFrame(() => applyCompetitionFilter(activeCompetitionFilter));
    }
  });

  observer.observe(leagueGrid, { childList: true, subtree: false });
}

document.addEventListener("DOMContentLoaded", () => {
  mountCompetitionsSidebar();
  observeCompetitionAgendaChanges();
});
