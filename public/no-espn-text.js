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

  function mejorarVisibilidadTitulosCero() {
    if (document.querySelector("#competition-zero-titles-style")) return;

    const style = document.createElement("style");
    style.id = "competition-zero-titles-style";
    style.textContent = `
      body[data-competition-id="liga-profesional"] .competition-teams-grid {
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)) !important;
        gap: 10px !important;
        align-items: stretch !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card {
        min-height: 88px !important;
        display: grid !important;
        grid-template-columns: 42px minmax(0, 1fr) !important;
        align-items: center !important;
        gap: 10px !important;
        padding: 12px 16px !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card > .competition-team-logo {
        width: 40px !important;
        height: 40px !important;
        justify-self: center !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-card-main {
        min-width: 0 !important;
        width: 100% !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 38px !important;
        align-items: center !important;
        gap: 10px !important;
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
        width: 36px !important;
        min-width: 36px !important;
        max-width: 36px !important;
        height: 24px !important;
        justify-content: center !important;
        justify-self: end !important;
        align-self: center !important;
        padding: 0 !important;
        border-radius: 999px !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles small {
        display: none !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles strong {
        font-size: 13px !important;
        line-height: 1 !important;
        text-align: center !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.has-titles {
        color: #ffffff !important;
        background: linear-gradient(180deg, #0ea5a4, #0f766e) !important;
        border: 1px solid rgba(153, 246, 228, 0.55) !important;
        box-shadow: 0 8px 18px rgba(15, 118, 110, 0.28) !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.has-titles strong {
        color: #ffffff !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.no-titles {
        opacity: 1 !important;
        color: #eaffef !important;
        background: rgba(234, 255, 239, 0.16) !important;
        border: 1px solid rgba(234, 255, 239, 0.28) !important;
      }

      body[data-competition-id="liga-profesional"] .competition-team-titles.no-titles strong {
        color: #ffffff !important;
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
