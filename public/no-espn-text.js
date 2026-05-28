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
      body[data-competition-id="liga-profesional"] .competition-team-titles {
        max-width: 150px !important;
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

      body[data-competition-id="liga-profesional"] .competition-team-titles.no-titles small {
        color: rgba(234, 255, 239, 0.92) !important;
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
