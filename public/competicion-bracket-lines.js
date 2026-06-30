/* ================================
   BRACKET LPF - LLAVES MÁS CLARAS
================================ */

(function () {
  function mejorarLlavesBracket() {
    if (document.querySelector("#competition-bracket-lines-pro-style")) return;

    const style = document.createElement("style");
    style.id = "competition-bracket-lines-pro-style";
    style.textContent = `
      .competition-bracket {
        width: 100%;
        overflow-x: auto !important;
        padding: 0 14px 14px !important;
      }

      .competition-bracket-tournament {
        min-width: 1080px !important;
        display: grid !important;
        grid-template-columns: 1.2fr 1fr 0.9fr 0.82fr !important;
        gap: 34px !important;
        align-items: stretch !important;
        padding: 8px 0 2px !important;
      }

      .competition-bracket-phase {
        position: relative !important;
        min-width: 0 !important;
        background: linear-gradient(180deg, rgba(20, 73, 45, 0.92), rgba(12, 57, 35, 0.92)) !important;
        border-radius: 12px !important;
        padding: 10px 10px 12px !important;
        overflow: visible !important;
      }

      .competition-bracket-phase::after {
        display: none !important;
      }

      .competition-bracket-phase h3 {
        margin: 0 0 10px !important;
        min-height: 28px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: #ffffff !important;
        border: 0 !important;
        font-size: 11px !important;
        font-weight: 950 !important;
        letter-spacing: -0.02em !important;
        text-transform: uppercase !important;
        text-align: center !important;
      }

      .competition-bracket-list {
        position: relative !important;
        min-height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 12px !important;
        padding: 0 !important;
      }

      .competition-bracket-phase[data-phase="octavos"] .competition-bracket-list {
        justify-content: flex-start !important;
      }

      .competition-bracket-phase[data-phase="cuartos"] .competition-bracket-list {
        justify-content: space-around !important;
        padding-block: 34px !important;
      }

      .competition-bracket-phase[data-phase="semis"] .competition-bracket-list {
        justify-content: space-around !important;
        padding-block: 104px !important;
      }

      .competition-bracket-phase[data-phase="final"] .competition-bracket-list {
        justify-content: center !important;
        padding-block: 202px !important;
      }

      .competition-bracket-match {
        position: relative !important;
        display: grid !important;
        gap: 0 !important;
        border-radius: 8px !important;
        color: #eaffef !important;
        background: rgba(0, 111, 47, 0.88) !important;
        border: 1px solid rgba(105, 255, 133, 0.18) !important;
        padding: 0 !important;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18) !important;
        overflow: visible !important;
      }

      .competition-bracket-team-row {
        min-height: 28px !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 26px !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 5px 7px !important;
        color: #ffffff !important;
        font-size: 11px !important;
        font-weight: 900 !important;
      }

      .competition-bracket-team-row + .competition-bracket-team-row {
        border-top: 1px solid rgba(255, 255, 255, 0.12) !important;
      }

      .competition-bracket-team-row.is-winner {
        color: #fff36c !important;
        background: rgba(45, 170, 70, 0.45) !important;
      }

      .competition-bracket-team-row.is-empty-team {
        color: rgba(255, 255, 255, 0.4) !important;
        background: rgba(255, 255, 255, 0.04) !important;
      }

      .competition-bracket-team-name {
        min-width: 0 !important;
        display: flex !important;
        align-items: center !important;
        gap: 5px !important;
        overflow: hidden !important;
        white-space: nowrap !important;
        text-overflow: ellipsis !important;
      }

      .competition-bracket-team-name img,
      .competition-bracket-team-name .competition-team-logo {
        width: 15px !important;
        height: 15px !important;
        flex: 0 0 15px !important;
        border-radius: 50% !important;
        object-fit: contain !important;
        background: rgba(255, 255, 255, 0.95) !important;
      }

      .competition-bracket-team-score {
        justify-self: end !important;
        min-width: 18px !important;
        text-align: right !important;
        color: inherit !important;
        font-size: 11px !important;
        font-weight: 950 !important;
      }

      .competition-bracket-badge {
        position: absolute !important;
        top: -11px !important;
        right: -8px !important;
        z-index: 2 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 3px !important;
        border-radius: 999px !important;
        color: #173520 !important;
        background: #f6d431 !important;
        padding: 2px 7px !important;
        font-size: 8px !important;
        font-weight: 950 !important;
        text-transform: uppercase !important;
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25) !important;
      }

      .competition-bracket-placeholder-note {
        margin: 8px 14px 0 !important;
        color: rgba(240, 250, 244, 0.62) !important;
        font-size: 11px !important;
        font-weight: 800 !important;
      }

      /* líneas horizontales hacia la siguiente fase */
      .competition-bracket-phase:not([data-phase="final"]) .competition-bracket-match::after {
        content: "" !important;
        position: absolute !important;
        right: -18px !important;
        top: 50% !important;
        width: 18px !important;
        height: 2px !important;
        transform: translateY(-50%) !important;
        background: rgba(186, 255, 120, 0.95) !important;
        border-radius: 999px !important;
        display: block !important;
      }

      /* OCTAVOS -> CUARTOS */
      .competition-bracket-phase[data-phase="octavos"] .competition-bracket-match:nth-child(odd)::before,
      .competition-bracket-phase[data-phase="octavos"] .competition-bracket-match:nth-child(even)::before {
        content: "" !important;
        position: absolute !important;
        right: -18px !important;
        width: 2px !important;
        background: rgba(186, 255, 120, 0.95) !important;
        display: block !important;
      }

      .competition-bracket-phase[data-phase="octavos"] .competition-bracket-match:nth-child(odd)::before {
        top: 50% !important;
        height: calc(50% + 18px) !important;
      }

      .competition-bracket-phase[data-phase="octavos"] .competition-bracket-match:nth-child(even)::before {
        bottom: 50% !important;
        height: calc(50% + 18px) !important;
      }

      /* CUARTOS -> SEMIS */
      .competition-bracket-phase[data-phase="cuartos"] .competition-bracket-match:nth-child(odd)::before,
      .competition-bracket-phase[data-phase="cuartos"] .competition-bracket-match:nth-child(even)::before {
        content: "" !important;
        position: absolute !important;
        right: -18px !important;
        width: 2px !important;
        background: rgba(186, 255, 120, 0.95) !important;
        display: block !important;
      }

      .competition-bracket-phase[data-phase="cuartos"] .competition-bracket-match:nth-child(odd)::before {
        top: 50% !important;
        height: calc(50% + 44px) !important;
      }

      .competition-bracket-phase[data-phase="cuartos"] .competition-bracket-match:nth-child(even)::before {
        bottom: 50% !important;
        height: calc(50% + 44px) !important;
      }

      /* SEMIS -> FINAL */
      .competition-bracket-phase[data-phase="semis"] .competition-bracket-match:nth-child(odd)::before,
      .competition-bracket-phase[data-phase="semis"] .competition-bracket-match:nth-child(even)::before {
        content: "" !important;
        position: absolute !important;
        right: -18px !important;
        width: 2px !important;
        background: rgba(186, 255, 120, 0.95) !important;
        display: block !important;
      }

      .competition-bracket-phase[data-phase="semis"] .competition-bracket-match:nth-child(odd)::before {
        top: 50% !important;
        height: calc(50% + 122px) !important;
      }

      .competition-bracket-phase[data-phase="semis"] .competition-bracket-match:nth-child(even)::before {
        bottom: 50% !important;
        height: calc(50% + 122px) !important;
      }

      .competition-bracket-phase[data-phase="final"] .competition-bracket-match::before,
      .competition-bracket-phase[data-phase="final"] .competition-bracket-match::after {
        display: none !important;
      }

      @media (max-width: 760px) {
        .competition-bracket-tournament {
          min-width: 930px !important;
          gap: 26px !important;
        }

        .competition-bracket-team-row {
          font-size: 10px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  document.addEventListener("DOMContentLoaded", mejorarLlavesBracket);
  mejorarLlavesBracket();
  window.setTimeout(mejorarLlavesBracket, 300);
  window.setTimeout(mejorarLlavesBracket, 1000);
})();
