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
   Usa solo los datos generados por el workflow.
================================ */

(function () {
  function obtenerTitulos(team) {
    const directo = team?.titulos?.total;
    const numero = Number(directo);
    return Number.isFinite(numero) && numero >= 0 ? numero : null;
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
        justify-content: center;
        gap: 5px;
        border-radius: 999px;
        color: #ffffff;
        background: linear-gradient(180deg, #7c2d12, #431407);
        border: 1px solid rgba(255, 237, 213, 0.55);
        padding: 5px 9px;
        font-size: 12px;
        font-weight: 950;
        line-height: 1;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
        box-shadow: 0 7px 16px rgba(124, 45, 18, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.22);
      }
      body[data-competition-id="liga-profesional"] [data-competition-section="equipos"] .competition-title-badge .cup-emoji {
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
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

      card.innerHTML = `<span class="competition-team-main"></span><span class="competition-title-badge" title="Títulos"><span class="cup-emoji">🏆</span> ${cantidad === null ? "-" : cantidad}</span>`;
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
