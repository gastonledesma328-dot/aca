/* ================================================
     COPA ARGENTINA - CUADRO DE FASES DEL TORNEO
     Reemplaza la tabla vacia con info visual de fases
   ================================================ */
(function () {
  const COMPETITION_ID = document.body.dataset.competitionId || "";
  if (COMPETITION_ID !== "copa-argentina") return;

  const FASES = [
{
      key: "treintaidosavos",
      label: "32avos de Final",
      equipos: 64,
      partidos: 32,
      icon: "&#9654;",
      desc: "Comienza el cuadro principal con los 64 equipos enfrentandose en 32 llaves. Participan clubes de Primera Division, Primera Nacional y divisiones inferiores.",
},
{
      key: "dieciseisavos",
      label: "16avos de Final",
      equipos: 32,
      partidos: 16,
      icon: "&#9654;",
      desc: "Avanzan los 32 mejores equipos clasificados de los 32avos de final.",
},
{
      key: "octavos",
      label: "Octavos de Final",
      equipos: 16,
      partidos: 8,
      icon: "&#9654;",
      desc: "Los 16 equipos supervivientes compiten por un lugar en los cuartos de final.",
},
{
      key: "cuartos",
      label: "Cuartos de Final",
      equipos: 8,
      partidos: 4,
      icon: "&#9654;",
      desc: "Instancia decisiva: solo 8 equipos quedan con vida en el torneo.",
},
{
      key: "semis",
      label: "Semifinales",
      equipos: 4,
      partidos: 2,
      icon: "&#9654;",
      desc: "Los 4 mejores equipos se juegan el pase a la gran final del torneo.",
},
{
      key: "final",
      label: "La Final",
      equipos: 2,
      partidos: 1,
      icon: "&#127942;",
      desc: "Partido unico en estadio neutral. El ganador se corona campeon y obtiene clasificacion automatica a la Copa Libertadores, ademas de disputar la Supercopa Argentina.",
      highlight: true,
},
  ];

  function renderCuadroFases(bracketData) {
    const card = document.getElementById("competitionTableCard");
    if (!card) return;

    const fases = (bracketData && bracketData.fases) || {};
    const campeon = (bracketData && bracketData.campeon) || null;
    const season = (bracketData && bracketData.season) || new Date().getFullYear();

    const counters = {};
    FASES.forEach((f) => {
      const matches = fases[f.key] || [];
      const jugados = matches.filter((m) => m.completado).length;
      counters[f.key] = { total: matches.length, jugados };
});

    const campeonHTML = campeon
      ? `<div style="
            margin-bottom:18px;
            padding:14px 18px;
            background:linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,165,0,0.08));
            border:1px solid rgba(255,215,0,0.35);
            border-radius:10px;
            display:flex;align-items:center;gap:12px;
          ">
          <span style="font-size:24px">&#127942;</span>
          <div>
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.55);margin-bottom:2px">Campeon ${season}</div>
            <div style="font-size:16px;font-weight:700;color:#ffe066">${campeon.nombre || campeon}</div>
          </div>
        </div>`
      : "";

    const fasesHTML = FASES.map((f) => {
      const cnt = counters[f.key] || { total: 0, jugados: 0 };
      const pct = cnt.total > 0 ? Math.round((cnt.jugados / cnt.total) * 100) : 0;
      const bg = f.highlight
        ? "background:linear-gradient(135deg,rgba(255,180,0,0.18),rgba(200,120,0,0.10));border-color:rgba(255,200,0,0.3);"
        : "";
      const labelColor = f.highlight ? "#ffe066" : "#7dffb3";
      const pillColor = f.highlight ? "background:rgba(255,200,0,0.2);color:#ffe066;" : "background:rgba(125,255,179,0.15);color:#7dffb3;";
      const progBar =
        cnt.total > 0
          ? `<div style="margin-top:8px;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${f.highlight ? "#ffe066" : "#3dda6e"};transition:width .4s"></div>
             </div>
             <div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:3px">${cnt.jugados} de ${cnt.total} partidos jugados</div>`
          : `<div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:6px">Sin partidos asignados aun</div>`;

      return `<div style="
          border:1px solid rgba(125,255,179,0.14);
          border-radius:10px;
          padding:14px 16px 12px;
          ${bg}
        ">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:16px">${f.icon}</span>
            <span style="font-size:13px;font-weight:700;color:${labelColor};text-transform:uppercase;letter-spacing:.04em">${f.label}</span>
          </div>
          <span style="font-size:11px;padding:2px 9px;border-radius:99px;${pillColor}">${f.equipos} equipos</span>
        </div>
        <p style="font-size:12px;color:rgba(255,255,255,.62);margin:0 0 4px;line-height:1.5">${f.desc}</p>
        ${progBar}
      </div>`;
}).join("");

    card.innerHTML = `
      <div class="competition-card-head">
        <div>
          <p class="competition-section-kicker">Copa Argentina</p>
          <h2>Cuadro de Fases del Torneo</h2>
        </div>
      </div>
      <div style="padding:0 4px 8px">
        ${campeonHTML}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${fasesHTML}
        </div>
        <p style="font-size:11px;color:rgba(255,255,255,.3);text-align:right;margin-top:12px">
          Temporada ${season} &middot; Fuente: ESPN API
        </p>
      </div>`;
}

  function tryLoad() {
    const bracketUrl = "../data/copa_argentina_bracket.json";
    fetch(bracketUrl)
      .then((r) => r.ok ? r.json() : null)
      .catch(() => null)
      .then((data) => renderCuadroFases(data));
}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryLoad);
} else {
    tryLoad();
}
})();
