/* ================================
   LEYENDA TABLA ANUAL LPF
   - Oculta el texto gris de la esquina superior derecha.
   - Agrega la explicación de colores al pie de la tabla anual.
================================ */

(function () {
  const LEGEND_ITEMS = [
    { className: "legend-libertadores-top", text: "1°: Libertadores 2027 + Supercopa Internacional 2026" },
    { className: "legend-libertadores", text: "2° y 3°: CONMEBOL Libertadores" },
    { className: "legend-sudamericana", text: "4° al 9°: CONMEBOL Sudamericana" },
    { className: "legend-descenso", text: "30°: Descenso" },
  ];

  function esTablaAnual(subtable) {
    const title = subtable.querySelector(".competition-subtable-head strong");
    return String(title?.textContent || "").trim().toLowerCase() === "tabla anual";
  }

  function aplicarLeyenda() {
    document.querySelectorAll(".competition-subtable").forEach((subtable) => {
      if (!esTablaAnual(subtable)) return;

      const headRight = subtable.querySelector(".competition-subtable-head span");
      if (headRight) {
        headRight.textContent = "";
        headRight.style.display = "none";
      }

      if (subtable.querySelector(".competition-annual-legend")) return;

      const legend = document.createElement("div");
      legend.className = "competition-annual-legend";
      legend.innerHTML = LEGEND_ITEMS.map((item) => `
        <span class="competition-annual-legend-item ${item.className}">
          <i aria-hidden="true"></i>
          <strong>${item.text}</strong>
        </span>
      `).join("");

      subtable.appendChild(legend);
    });
  }

  function aplicarEstilos() {
    if (document.querySelector("#competition-annual-legend-style")) return;

    const style = document.createElement("style");
    style.id = "competition-annual-legend-style";
    style.textContent = `
      body[data-competition-id="liga-profesional"] .competition-subtable .competition-subtable-head span {
        font-size: 0;
      }

      body[data-competition-id="liga-profesional"] .competition-annual-legend {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        padding: 10px 12px 12px;
        border-top: 1px solid rgba(95, 207, 128, 0.22);
        background: rgba(4, 32, 22, 0.42);
      }

      body[data-competition-id="liga-profesional"] .competition-annual-legend-item {
        min-width: 0;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: #eaffef;
        font-size: 11px;
        font-weight: 850;
        line-height: 1.15;
      }

      body[data-competition-id="liga-profesional"] .competition-annual-legend-item i {
        width: 12px;
        height: 12px;
        flex: 0 0 12px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
      }

      body[data-competition-id="liga-profesional"] .competition-annual-legend-item strong {
        min-width: 0;
        font: inherit;
      }

      body[data-competition-id="liga-profesional"] .competition-annual-legend-item.legend-libertadores-top i {
        background: #5fcf80;
      }

      body[data-competition-id="liga-profesional"] .competition-annual-legend-item.legend-libertadores i {
        background: #2ebdff;
      }

      body[data-competition-id="liga-profesional"] .competition-annual-legend-item.legend-sudamericana i {
        background: #f7d24c;
      }

      body[data-competition-id="liga-profesional"] .competition-annual-legend-item.legend-descenso i {
        background: #ff5d5d;
      }

      @media (max-width: 720px) {
        body[data-competition-id="liga-profesional"] .competition-annual-legend {
          grid-template-columns: 1fr;
          gap: 7px;
          padding: 10px;
        }

        body[data-competition-id="liga-profesional"] .competition-annual-legend-item {
          font-size: 10.5px;
          align-items: flex-start;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    aplicarEstilos();
    aplicarLeyenda();
  }

  document.addEventListener("DOMContentLoaded", init);
  window.setTimeout(init, 250);
  window.setTimeout(init, 1000);
  window.setTimeout(init, 2200);

  const observer = new MutationObserver(() => init());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
