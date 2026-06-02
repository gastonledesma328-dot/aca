/* =========================================================
   COPA ARGENTINA - Cuadro de Enfrentamientos
   Estilo LPF: columnas por fase, llaves conectadas
   Datos reales desde copa_argentina_bracket.json (ESPN API)
   Scraper: scripts/scraper_copa_argentina.py (GitHub Actions)
   ========================================================= */
(function () {
     "use strict";

   const DATA_URL = "/data/copa_argentina_bracket.json";
     const TZ = "America/Argentina/Buenos_Aires";

   const FASES = [
      { key: "treintaidosavos", label: "32avos de Final",  slots: 32 },
      { key: "dieciseisavos",   label: "16avos de Final",  slots: 16 },
      { key: "octavos",         label: "Octavos de Final", slots: 8  },
      { key: "cuartos",         label: "Cuartos de Final", slots: 4  },
      { key: "semis",           label: "Semifinales",      slots: 2  },
      { key: "final",           label: "Final",            slots: 1  },
        ];

   /* ---------- utils ---------- */
   function esc(v) {
          return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
   }
     function fechaCorta(iso) {
            if (!iso) return "";
            try {
                     return new Intl.DateTimeFormat("es-AR",{weekday:"short",day:"2-digit",month:"2-digit",timeZone:TZ})
                       .format(new Date(iso)).replace(/\./g,"");
            } catch(_){ return iso.slice(0,10); }
     }
     function teamLogo(team) {
            const src = team?.logo || "";
            return src
              ? `<img class="cpb-logo" src="${esc(src)}" alt="" loading="lazy">`
                     : `<span class="cpb-logo cpb-logo--empty"></span>`;
     }
     function teamName(team) {
            return esc(team?.nombre_corto || team?.nombre || "Por definir");
     }

   /* ---------- render partido ---------- */
   function renderMatch(p, faseKey) {
          if (!p || p.empty) {
                   return `<div class="cpb-match cpb-match--tbd">
                           <div class="cpb-team"><span class="cpb-logo cpb-logo--empty"></span><span class="cpb-name cpb-name--tbd">Por definir</span><span class="cpb-score"></span></div>
                                   <div class="cpb-divider"></div>
                                           <div class="cpb-team"><span class="cpb-logo cpb-logo--empty"></span><span class="cpb-name cpb-name--tbd">Por definir</span><span class="cpb-score"></span></div>
                                                 </div>`;
          }

       const L = p.local || {};
          const V = p.visitante || {};
          const done = p.completado;
          const wL = L.ganador === true;
          const wV = V.ganador === true;
          const sL = done && L.marcador != null && L.marcador !== "" ? esc(L.marcador) : "";
          const sV = done && V.marcador != null && V.marcador !== "" ? esc(V.marcador) : "";
          const pen = p.penaltis ? `<span class="cpb-pen">pen.</span>` : "";
          const fecha = fechaCorta(p.fecha_iso || (p.fecha ? p.fecha+"T12:00:00":""));
          const isFinal = faseKey === "final";

       return `<div class="cpb-match${done?" cpb-match--done":""}${isFinal?" cpb-match--final":""}">
             ${isFinal?`<div class="cpb-final-label">GRAN FINAL</div>`:""}
                   ${fecha?`<div class="cpb-match-fecha">${fecha}</div>`:""}
                         <div class="cpb-team ${wL?"cpb-team--winner":done?"cpb-team--loser":""}">
                                 ${teamLogo(L)}
                                         <span class="cpb-name">${teamName(L)}</span>
                                                 <span class="cpb-score${wL?" cpb-score--winner":""}">${sL}</span>
                                                       </div>
                                                             <div class="cpb-divider"></div>
                                                                   ${pen}
                                                                         <div class="cpb-team ${wV?"cpb-team--winner":done?"cpb-team--loser":""}">
                                                                                 ${teamLogo(V)}
                                                                                         <span class="cpb-name">${teamName(V)}</span>
                                                                                                 <span class="cpb-score${wV?" cpb-score--winner":""}">${sV}</span>
                                                                                                       </div>
                                                                                                             ${p.estadio?`<div class="cpb-estadio">${esc(p.estadio.split(",")[0])}</div>`:""}
                                                                                                                 </div>`;
   }

   /* ---------- render fase (columna) ---------- */
   function renderFase(fase, rawPartidos, campeon) {
          const lista = [...(rawPartidos||[])];
          while (lista.length < fase.slots) lista.push({empty:true});
          const jugados = (rawPartidos||[]).filter(p=>p.completado).length;
          const total   = (rawPartidos||[]).length;
          const badge   = total > 0
            ? `<span class="cpb-fase-badge ${jugados===total?"cpb-fase-badge--done":""}">${jugados}/${total}</span>`
                   : `<span class="cpb-fase-badge cpb-fase-badge--pending">0/${fase.slots}</span>`;

       const isFinal = fase.key === "final";
          const campeonCard = isFinal && campeon
            ? `<div class="cpb-campeon">
                       <img src="${esc(campeon.logo||"")}" alt="" class="cpb-campeon-logo">
                                  <div class="cpb-campeon-label">Campeon</div>
                                             <div class="cpb-campeon-nombre">${esc(campeon.nombre||"")}</div>
                                                      </div>`
                   : "";

       return `<div class="cpb-fase" data-fase="${esc(fase.key)}">
             <div class="cpb-fase-head">
                     <span class="cpb-fase-label">${esc(fase.label)}</span>
                             ${badge}
                                   </div>
                                         ${campeonCard}
                                               <div class="cpb-fase-matches">
                                                       ${lista.map(p => renderMatch(p, fase.key)).join("")}
                                                             </div>
                                                                 </div>`;
   }

   /* ---------- estilos ---------- */
   function injectStyles() {
          if (document.getElementById("cpb-styles")) return;
          const s = document.createElement("style");
          s.id = "cpb-styles";
          s.textContent = `
          #copa-argentina-bracket { padding: 0 0 20px; }

          .cpb-bracket-header {
            display: flex; align-items: baseline; gap: 10px;
              padding: 14px 16px 10px;
                border-bottom: 1px solid rgba(255,255,255,.1);
                }
                .cpb-bracket-title { font-size:14px; font-weight:900; color:#eaffef; text-transform:uppercase; letter-spacing:.04em; }
                .cpb-bracket-season { font-size:11px; color:rgba(186,255,120,.65); font-weight:700; }
                .cpb-updated { font-size:10px; color:rgba(255,255,255,.3); margin-left:auto; }

                /* Scroll horizontal */
                .cpb-scroll {
                  overflow-x: auto;
                    padding: 14px 12px 10px;
                      -webkit-overflow-scrolling: touch;
                        scrollbar-width: thin;
                          scrollbar-color: rgba(125,255,179,.3) transparent;
                          }
                          .cpb-stages {
                            display: flex;
                              gap: 10px;
                                align-items: flex-start;
                                  min-width: max-content;
                                  }

                                  /* Fase / columna */
                                  .cpb-fase {
                                    width: 185px;
                                      flex-shrink: 0;
                                        background: linear-gradient(180deg,rgba(20,73,45,.94),rgba(10,52,30,.94));
                                          border-radius: 10px;
                                            padding: 8px 8px 10px;
                                              border: 1px solid rgba(125,255,179,.12);
                                              }
                                              .cpb-fase[data-fase="final"] {
                                                background: linear-gradient(135deg,rgba(40,80,20,.98),rgba(20,60,15,.98));
                                                  border-color: rgba(255,210,0,.25);
                                                  }
                                                  .cpb-fase-head {
                                                    display: flex; align-items: center; justify-content: space-between;
                                                      margin-bottom: 8px; padding-bottom: 6px;
                                                        border-bottom: 1px solid rgba(255,255,255,.1);
                                                        }
                                                        .cpb-fase-label {
                                                          font-size: 10px; font-weight: 900; color: #b8ffcc;
                                                            text-transform: uppercase; letter-spacing: .06em;
                                                            }
                                                            .cpb-fase-badge {
                                                              font-size: 10px; font-weight: 700; padding: 1px 7px;
                                                                border-radius: 99px; background: rgba(125,255,179,.15); color: #7dffb3;
                                                                }
                                                                .cpb-fase-badge--done { background: rgba(50,200,80,.25); color: #6eff8a; }
                                                                .cpb-fase-badge--pending { color: rgba(255,255,255,.3); background: transparent; border: 1px solid rgba(255,255,255,.12); }

                                                                .cpb-fase-matches { display: flex; flex-direction: column; gap: 6px; }

                                                                /* Partido */
                                                                .cpb-match {
                                                                  background: rgba(0,100,40,.7);
                                                                    border: 1px solid rgba(125,255,179,.14);
                                                                      border-radius: 7px;
                                                                        padding: 0;
                                                                          overflow: hidden;
                                                                            position: relative;
                                                                            }
                                                                            .cpb-match--done { border-color: rgba(125,255,179,.22); }
                                                                            .cpb-match--tbd {
                                                                              background: rgba(255,255,255,.04);
                                                                                border-color: rgba(255,255,255,.08);
                                                                                }
                                                                                .cpb-match--final {
                                                                                  background: linear-gradient(135deg,rgba(60,40,0,.9),rgba(40,25,0,.9));
                                                                                    border-color: rgba(255,210,0,.35);
                                                                                      border-width: 1.5px;
                                                                                      }
                                                                                      .cpb-final-label {
                                                                                        font-size: 9px; font-weight: 900; color: #ffd700;
                                                                                          text-align: center; padding: 3px 0 2px;
                                                                                            background: rgba(255,200,0,.1);
                                                                                              letter-spacing: .08em;
                                                                                              }
                                                                                              .cpb-match-fecha {
                                                                                                font-size: 9px; color: rgba(186,255,120,.7);
                                                                                                  text-align: center; padding: 2px 0 1px;
                                                                                                    background: rgba(0,0,0,.15);
                                                                                                      letter-spacing: .02em;
                                                                                                      }
                                                                                                      .cpb-team {
                                                                                                        display: grid;
                                                                                                          grid-template-columns: 18px 1fr 22px;
                                                                                                            align-items: center;
                                                                                                              gap: 5px;
                                                                                                                padding: 5px 7px;
                                                                                                                  min-height: 26px;
                                                                                                                    color: #e8fff0;
                                                                                                                      font-size: 11px; font-weight: 700;
                                                                                                                      }
                                                                                                                      .cpb-team--winner { background: rgba(50,190,80,.28); color: #fff; }
                                                                                                                      .cpb-team--loser  { color: rgba(255,255,255,.42); }
                                                                                                                      .cpb-divider { height: 1px; background: rgba(255,255,255,.1); margin: 0 6px; }
                                                                                                                      .cpb-logo { width:18px; height:18px; object-fit:contain; border-radius:2px; flex-shrink:0; display:block; }
                                                                                                                      .cpb-logo--empty { background:rgba(255,255,255,.1); border-radius:50%; }
                                                                                                                      .cpb-name { font-size:10px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                                                                                                                      .cpb-name--tbd { color:rgba(255,255,255,.28); font-style:italic; font-weight:400; }
                                                                                                                      .cpb-score { font-size:13px; font-weight:900; text-align:right; min-width:18px; color:rgba(255,255,255,.5); }
                                                                                                                      .cpb-score--winner { color:#ffe566; }
                                                                                                                      .cpb-pen {
                                                                                                                        font-size:8px; font-weight:900; color:#ffe566;
                                                                                                                          background:rgba(255,220,0,.15); border-radius:3px;
                                                                                                                            padding:1px 4px; text-align:center; margin:0 7px;
                                                                                                                            }
                                                                                                                            .cpb-estadio {
                                                                                                                              font-size:8px; color:rgba(255,255,255,.3);
                                                                                                                                padding:2px 7px 4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                                                                                                                                }
                                                                                                                                
                                                                                                                                /* Campeon */
                                                                                                                                .cpb-campeon {
                                                                                                                                  text-align:center; padding:8px 4px 10px;
                                                                                                                                    background:rgba(255,215,0,.08); border-radius:7px;
                                                                                                                                      border:1px solid rgba(255,215,0,.2); margin-bottom:8px;
                                                                                                                                      }
                                                                                                                                      .cpb-campeon-logo { width:40px; height:40px; object-fit:contain; margin-bottom:4px; }
                                                                                                                                      .cpb-campeon-label { font-size:9px; color:rgba(255,210,0,.7); font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
                                                                                                                                      .cpb-campeon-nombre { font-size:12px; font-weight:900; color:#ffd700; margin-top:2px; }
                                                                                                                                      
                                                                                                                                      @media (max-width:600px){
                                                                                                                                        .cpb-fase { width:160px; }
                                                                                                                                          .cpb-name { font-size:9px; }
                                                                                                                                          }`;
          document.head.appendChild(s);
   }

   /* ---------- render principal ---------- */
   function render(data) {
          const container = document.getElementById("copa-argentina-bracket");
          if (!container) return;

       const fases = data.fases || {};
          const campeon = data.campeon || null;
          const season = data.season || new Date().getFullYear();
          const updated = data.actualizado
            ? new Date(data.actualizado).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:TZ})
                   : "";

       injectStyles();

       container.innerHTML = `
             <div class="cpb-bracket-header">
                     <span class="cpb-bracket-title">Cuadro de Enfrentamientos</span>
                             <span class="cpb-bracket-season">${season}</span>
                                     ${updated?`<span class="cpb-updated">Act. ${updated}</span>`:""}
                                           </div>
                                                 <div class="cpb-scroll">
                                                         <div class="cpb-stages">
                                                                   ${FASES.map(f => renderFase(f, fases[f.key], campeon)).join("")}
                                                                           </div>
                                                                                 </div>`;
   }

   /* ---------- init ---------- */
   function isCopaPage() {
          return (document.body.dataset.competitionId || "") === "copa-argentina";
   }

   function init() {
          if (!isCopaPage()) return;

       const el = document.getElementById("copa-argentina-bracket");
          if (!el) return;

       el.innerHTML = `<div style="padding:20px;text-align:center;color:rgba(255,255,255,.4);font-size:12px">Cargando cuadro...</div>`;

       fetch(DATA_URL)
            .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(render)
            .catch(() => {
                       const el2 = document.getElementById("copa-argentina-bracket");
                       if (el2) el2.innerHTML = `<div style="padding:20px;text-align:center;color:rgba(255,255,255,.3);font-size:12px">No se pudo cargar el cuadro.</div>`;
            });
   }

   if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
     else init();
})();
