/* ================================
   OCULTAR TEXTO VISIBLE CON ESPN
================================ */

(function () {
  const ESPN_REGEX = /ESPN/gi;

  function limpiarTexto(value) {
    return String(value || "")
      .replace(/\s*·\s*Fuente:\s*[^·\n\r]*ESPN[^·\n\r]*/gi, "")
      .replace(/^\s*Fuente:\s*[^·\n\r]*ESPN[^·\n\r]*$/gi, "")
      .replace(/\s*desde\s+ESPN\s*/gi, " ")
      .replace(/\s*de\s+ESPN\s*/gi, " ")
      .replace(/\s*con\s+ESPN\s*/gi, " ")
      .replace(/ESPN\s*API/gi, "")
      .replace(ESPN_REGEX, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+·\s*$/g, "")
      .replace(/^\s*·\s+/g, "")
      .trim();
  }

  function limpiarNodoTexto(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    if (!ESPN_REGEX.test(node.nodeValue || "")) return;

    const limpio = limpiarTexto(node.nodeValue);
    node.nodeValue = limpio;
  }

  function limpiarAtributos(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

    ["title", "aria-label", "alt", "placeholder"].forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value && /ESPN/i.test(value)) {
        element.setAttribute(attr, limpiarTexto(value));
      }
    });
  }

  function limpiarElemento(root) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      limpiarNodoTexto(root);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    limpiarAtributos(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;

    while (node) {
      if (node.nodeType === Node.TEXT_NODE) limpiarNodoTexto(node);
      if (node.nodeType === Node.ELEMENT_NODE) limpiarAtributos(node);
      node = walker.nextNode();
    }
  }

  function limpiarTodo() {
    limpiarElemento(document.body || document.documentElement);
  }

  document.addEventListener("DOMContentLoaded", limpiarTodo);
  limpiarTodo();
  window.setTimeout(limpiarTodo, 250);
  window.setTimeout(limpiarTodo, 1000);
  window.setTimeout(limpiarTodo, 2500);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(limpiarElemento);
      if (mutation.type === "characterData") limpiarNodoTexto(mutation.target);
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();

/* ================================
   EQUIPOS LPF - COPAS/TÍTULOS
================================ */

(function () {
  const TITULOS = {
    "river-plate": 38,
    "boca-juniors": 35,
    "racing-club": 18,
    "independiente": 16,
    "san-lorenzo": 15,
    "velez-sarsfield": 10,
    "estudiantes-de-la-plata": 6,
    "newells-old-boys": 6,
    "huracan": 5,
    "rosario-central": 4,
    "argentinos-juniors": 3,
    "ferro-carril-oeste": 2,
    "lanus": 2,
    "quilmes": 2,
    "banfield": 1,
    "arsenal-de-sarandi": 1,
    "gimnasia-la-plata": 1,
    "gimnasia-y-esgrima-la-plata": 1
  };

  function normalizar(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function obtenerTitulos(team) {
    const directo = team?.titulos?.total ?? team?.titulos_liga ?? team?.titles ?? team?.championships;
    const numero = Number(directo);
    if (Number.isFinite(numero) && numero >= 0) return numero;

    const keys = [team?.slug, team?.id, team?.nombre, team?.nombre_corto].map(normalizar).filter(Boolean);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(TITULOS, key)) return TITULOS[key];
    }
    return 0;
  }

  async function cargarEquiposLiga() {
    const response = await fetch(`../data/competiciones.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    const comp = (data.competiciones || []).find((item) => item.id === "liga-profesional" || item.slug === "arg.1");
    return Array.isArray(comp?.equipos) ? comp.equipos : [];
  }

  function aplicarEstiloTitulos() {
    if (document.querySelector("#competition-team-titles-style")) return;
    const style = document.createElement("style");
    style.id = "competition-team-titles-style";
    style.textContent = `
      body[data-competition-id="liga-profesional"] [data-competition-section="equipos"] .competition-team-card {
        justify-content: space-between !important;
        padding-inline: 12px !important;
      }
      body[data-competition-id="liga-profesional"] [data-competition-section="equipos"] .competition-team-main {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1 1 auto;
      }
      body[data-competition-id="liga-profesional"] [data-competition-section="equipos"] .competition-title-badge {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border-radius: 999px;
        color: #173520;
        background: #f6d431;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 950;
        box-shadow: 0 6px 14px rgba(246, 212, 49, 0.22);
      }
    `;
    document.head.appendChild(style);
  }

  async function aplicarTitulosEquipos() {
    if ((document.body?.dataset?.competitionId || "") !== "liga-profesional") return;
    const grid = document.querySelector('[data-competition-section="equipos"] #competitionTeamsGrid');
    if (!grid) return;

    const cards = grid.querySelectorAll(".competition-team-card");
    if (!cards.length) return;

    aplicarEstiloTitulos();

    const equipos = await cargarEquiposLiga().catch(() => []);
    cards.forEach((card, index) => {
      if (card.dataset.titulosAplicados === "1") return;
      const team = equipos[index] || {};
      const logo = card.querySelector("img, .competition-team-logo");
      const name = card.querySelector("span:not(.competition-team-logo)");
      const cantidad = obtenerTitulos(team);

      card.innerHTML = `<span class="competition-team-main"></span><span class="competition-title-badge" title="Títulos">🏆 ${cantidad}</span>`;
      const main = card.querySelector(".competition-team-main");
      if (logo) main.appendChild(logo);
      if (name) main.appendChild(name);
      card.dataset.titulosAplicados = "1";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(aplicarTitulosEquipos, 300);
    window.setTimeout(aplicarTitulosEquipos, 900);
    window.setTimeout(aplicarTitulosEquipos, 1800);
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest('[data-competition-tab="equipos"]')) {
      window.setTimeout(aplicarTitulosEquipos, 120);
      window.setTimeout(aplicarTitulosEquipos, 500);
    }
  });
})();
