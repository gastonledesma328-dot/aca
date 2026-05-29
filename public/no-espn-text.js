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

  function mejorarVisibilidadTitulosCero() {
    if (document.querySelector("#competition-zero-titles-style")) return;

    const style = document.createElement("style");
    style.id = "competition-zero-titles-style";
    style.textContent = `
      body[data-competition-id="liga-profesional"] .competition-teams-grid {
        grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)) !important;
        gap: 12px !important;
        align-items: stretch !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card {
        min-height: 92px !important;
        display: grid !important;
        grid-template-columns: 44px minmax(0, 1fr) !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 14px 16px !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card > .competition-team-logo {
        width: 42px !important;
        height: 42px !important;
        justify-self: center !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card-main {
        min-width: 0 !important;
        width: 100% !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto !important;
        align-items: center !important;
        gap: 12px !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card-name {
        min-width: 0 !important;
        overflow: hidden !important;
        text-overflow: clip !important;
        white-space: normal !important;
        line-height: 1.08 !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        text-align: left !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles {
        min-width: 66px !important;
        height: 32px !important;
        justify-self: end !important;
        align-self: center !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 5px !important;
        padding: 0 10px !important;
        border-radius: 999px !important;
        font-weight: 950 !important;
        letter-spacing: -0.2px !important;
        position: relative !important;
        overflow: hidden !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles::before {
        content: "🏆" !important;
        display: inline-block !important;
        font-size: 14px !important;
        line-height: 1 !important;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35)) !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles::after {
        content: "" !important;
        position: absolute !important;
        inset: 1px 1px auto 1px !important;
        height: 42% !important;
        border-radius: inherit !important;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0)) !important;
        pointer-events: none !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles small {
        display: none !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles strong {
        font-size: 14px !important;
        line-height: 1 !important;
        text-align: center !important;
        color: #442500 !important;
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.45) !important;
        position: relative !important;
        z-index: 1 !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.has-titles {
        color: #442500 !important;
        background: linear-gradient(180deg, #ffe783 0%, #f8c433 48%, #c98200 100%) !important;
        border: 1px solid rgba(255, 238, 160, 0.95) !important;
        box-shadow: 0 9px 18px rgba(248, 196, 51, 0.34), inset 0 -2px 0 rgba(120, 63, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.65) !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.no-titles {
        min-width: 54px !important;
        color: #fff6c7 !important;
        background: linear-gradient(180deg, rgba(132, 91, 19, 0.92), rgba(71, 45, 9, 0.92)) !important;
        border: 1px solid rgba(255, 216, 107, 0.45) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16) !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.no-titles strong {
        color: #fff6c7 !important;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.4) !important;
      }

      @media (max-width: 720px) {
        body[data-competition-id="liga-profesional"] .competition-teams-grid {
          grid-template-columns: 1fr !important;
        }

        body[data-competition-id="liga-profesional"] .competition-team-card {
          grid-template-columns: 42px minmax(0, 1fr) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function limpiarTodo() {
    limpiarElemento(document.body || document.documentElement);
  }

  document.addEventListener("DOMContentLoaded", () => {
    limpiarTodo();
    mejorarVisibilidadTitulosCero();
  });
  limpiarTodo();
  mejorarVisibilidadTitulosCero();
  window.setTimeout(limpiarTodo, 250);
  window.setTimeout(limpiarTodo, 1000);
  window.setTimeout(limpiarTodo, 2500);
  window.setTimeout(mejorarVisibilidadTitulosCero, 250);
  window.setTimeout(mejorarVisibilidadTitulosCero, 1000);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(limpiarElemento);
      if (mutation.type === "characterData") limpiarNodoTexto(mutation.target);
    });
    mejorarVisibilidadTitulosCero();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
