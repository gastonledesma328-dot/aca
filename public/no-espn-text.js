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
        grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)) !important;
        gap: 12px !important;
        align-items: stretch !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card {
        min-height: 104px !important;
        height: auto !important;
        display: grid !important;
        grid-template-columns: 46px minmax(0, 1fr) !important;
        align-items: center !important;
        gap: 14px !important;
        padding: 16px 18px !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card > .competition-team-logo {
        width: 44px !important;
        height: 44px !important;
        justify-self: center !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card-main {
        min-width: 0 !important;
        width: 100% !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto !important;
        align-items: center !important;
        gap: 14px !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card-name {
        min-width: 0 !important;
        overflow: visible !important;
        text-overflow: unset !important;
        white-space: normal !important;
        line-height: 1.15 !important;
        display: block !important;
        -webkit-line-clamp: unset !important;
        -webkit-box-orient: unset !important;
        text-align: left !important;
        word-break: normal !important;
        overflow-wrap: anywhere !important;
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
        overflow: visible !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles::before {
        content: "🏆" !important;
        display: inline-block !important;
        font-size: 14px !important;
        line-height: 1 !important;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3)) !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles::after {
        content: none !important;
        display: none !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles small {
        display: none !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles strong {
        font-size: 14px !important;
        line-height: 1 !important;
        text-align: center !important;
        color: #442500 !important;
        text-shadow: none !important;
        position: relative !important;
        z-index: 1 !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.has-titles {
        color: #442500 !important;
        background: linear-gradient(180deg, #f7d24c 0%, #e0a91b 100%) !important;
        border: 1px solid rgba(255, 226, 101, 0.9) !important;
        box-shadow: 0 6px 14px rgba(224, 169, 27, 0.28), inset 0 -1px 0 rgba(93, 57, 0, 0.18) !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.no-titles {
        min-width: 54px !important;
        color: #fff6c7 !important;
        background: linear-gradient(180deg, rgba(132, 91, 19, 0.92), rgba(71, 45, 9, 0.92)) !important;
        border: 1px solid rgba(255, 216, 107, 0.45) !important;
        box-shadow: none !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.no-titles strong {
        color: #fff6c7 !important;
        text-shadow: none !important;
      }

      @media (max-width: 720px) {
        body[data-competition-id="liga-profesional"] .competition-teams-grid {
          grid-template-columns: 1fr !important;
        }

        body[data-competition-id="liga-profesional"] .competition-team-card {
          grid-template-columns: 42px minmax(0, 1fr) !important;
          min-height: 96px !important;
          padding: 14px 14px !important;
        }

        body[data-competition-id="liga-profesional"] .competition-team-card-main {
          gap: 10px !important;
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
