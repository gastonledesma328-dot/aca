/* ================================
   LEYENDA TABLA ANUAL LPF
   - Oculta el texto gris de la esquina superior derecha.
   - Quita los textos internos dentro de la tabla anual.
   - Agrega la explicación de colores al pie con los mismos colores de los puestos.
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
      /* Quitar texto gris de la esquina superior derecha */
      body[data-competition-id="liga-profesional"] .competition-special-tables .competition-subtable:nth-child(3) .competition-subtable-head span {
        display: none !important;
      }

      /* Quitar el texto amarillo que estaba en el encabezado desde competicion-compact.css */
      body[data-competition-id="liga-profesional"] .competition-special-tables .competition-subtable:nth-child(3) .competition-subtable-head::after {
        content: none !important;
        display: none !important;
      }

      /* Quitar textos internos de clasificación dentro de las filas de la Tabla anual */
      body[data-competition-id="liga-profesional"] .competition-special-tables .competition-subtable:nth-child(3) tbody tr .team-cell::after {
        content: none !important;
        display: none !important;
      }

      body[data-competition-id="liga-profesional"] .competition-special-tables .competition-subtable:nth-child(3) .competition-table .team-cell {
        justify-content: flex-start !important;
      }

      body[data-competition-id="liga-profesional"] .competition-special-tables .competition-subtable:nth-child(3) .competition-table .team-cell .competition-team-inline {
        width: 100% !important;
        flex: 1 1 auto !important;
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

      /* Mismos colores que los puestos de la Tabla anual */
      body[data-competition-id="liga-profesional"] .competition-annual-legend-item.legend-libertadores-top i {
        background: #f6d431;
      }

      body[data-competition-id="liga-profesional"] .competition-annual-legend-item.legend-libertadores i {
        background: #4299e1;
      }

      body[data-competition-id="liga-profesional"] .competition-annual-legend-item.legend-sudamericana i {
        background: #805ad5;
      }

      body[data-competition-id="liga-profesional"] .competition-annual-legend-item.legend-descenso i {
        background: #f56565;
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
