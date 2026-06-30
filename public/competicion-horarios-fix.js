/* ================================
   CORRECCIÓN DE HORARIOS NO CONFIRMADOS
   Algunas fechas futuras llegan desde la API con hora placeholder 00:00/01:00.
   En esos casos se muestra A confirmar y no 0 - 0 como resultado.
================================ */

(function () {
  function corregirHorariosNoConfirmados(root = document) {
    root.querySelectorAll?.(".season-row").forEach((row) => {
      const time = row.querySelector(".season-time");
      if (!time) return;

      const value = String(time.textContent || "").trim();
      if (value !== "00:00" && value !== "01:00") return;

      time.textContent = "A conf.";
      time.title = "Horario a confirmar";
      time.classList.add("season-time-tbd");

      const score = row.querySelector(".season-score");
      if (score && String(score.textContent || "").trim() === "0 - 0") {
        score.textContent = "-";
      }
    });
  }

  function aplicarEstilo() {
    if (document.querySelector("#horarios-fix-style")) return;
    const style = document.createElement("style");
    style.id = "horarios-fix-style";
    style.textContent = `
      .season-time.season-time-tbd {
        font-size: 10px !important;
        line-height: 1.05 !important;
        text-align: center !important;
        padding: 0 4px !important;
        color: #d8ffe6 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    aplicarEstilo();
    corregirHorariosNoConfirmados(document);
  }

  document.addEventListener("DOMContentLoaded", init);
  window.setTimeout(init, 300);
  window.setTimeout(init, 1000);
  window.setTimeout(init, 2000);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) corregirHorariosNoConfirmados(node);
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
