/* =========================================================
   COPA ARGENTINA - Bracket de Llaves Eliminacion Directa
   Formato: arbol bracket izq->derecha, lineas conectadas
   Datos: copa_argentina_bracket.json (ESPN API scraper)
   ========================================================= */
(function () {
  "use strict";
  const DATA_URL = "/data/copa_argentina_bracket.json";
  const TZ = "America/Argentina/Buenos_Aires";

  /* Fases en orden: la mas temprana primero */
  const FASES = [
    { key: "treintaidosavos", label: "32avos",   slots: 32, cols: 2 },
    { key: "dieciseisavos",   label: "16avos",   slots: 16, cols: 1 },
    { key: "octavos",         label: "Octavos",  slots: 8,  cols: 1 },
    { key: "cuartos",         label: "Cuartos",  slots: 4,  cols: 1 },
    { key: "semis",           label: "Semis",    slots: 2,  cols: 1 },
    { key: "final",           label: "Final",    slots: 1,  cols: 1 },
  ];

  const MATCH_H  = 52;   /* altura de un partido en px */
  const MATCH_W  = 180;  /* ancho de tarjeta partido */
  const COL_GAP  = 48;   /* espacio entre columnas */
  const ROW_GAP  = 8;    /* gap entre partidos */

  function esc(v){ return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  function ganadorNombre(p){
    if(!p||p.empty) return null;
    if(p.local?.ganador) return p.local.nombre_corto||p.local.nombre;
    if(p.visitante?.ganador) return p.visitante.nombre_corto||p.visitante.nombre;
    return null;
  }

  function fechaCorta(iso){
    if(!iso) return "";
    try{ return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",timeZone:TZ}).format(new Date(iso)); }
    catch(_){ return iso.slice(5,10); }
  }

  /* Renderiza SVG del bracket completo */
  function buildBracketSVG(fases, campeon, season, updated){
    /* ---- preparar datos ---- */
    /* Solo mostrar desde la primera fase con datos */
    const fasesConDatos = FASES.filter(f => (fases[f.key]||[]).length > 0 || f.key==="cuartos"||f.key==="semis"||f.key==="final");

    /* Siempre mostrar: desde la primera con partidos hasta final */
    const primerIdx = FASES.findIndex(f=>(fases[f.key]||[]).length>0);
    const fasesVis = FASES.slice(Math.max(0,primerIdx));

    /* La primera fase visible puede tener muchos partidos -> en 2 sub-columnas si >=16 */
    /* Para el layout: cada fase es una columna. La primera puede dividirse */

    /* ---- calcular geometria ---- */
    /* slots de la primera fase visible = N partidos */
    const primeraFase = fasesVis[0];
    const nPrimera   = (fases[primeraFase.key]||[]).length || primeraFase.slots;

    /* Agrupar la primera fase en pares de columnas si es muy larga */
    /* Layout: columna izq (mitad superior) | col derecha (mitad inferior) -> segunda fase -> ... */
    /* Usamos layout de bracket clasico: izq superior, izq inferior -> cruzan en siguiente ronda */

    const totalRondas = fasesVis.length;

    /* Altura de una ronda = slots * (MATCH_H + ROW_GAP) */
    /* Ronda 0: nPrimera partidos. Ronda 1: nPrimera/2. Etc. */
    const nSlots = (ronda) => Math.ceil(nPrimera / Math.pow(2, ronda));
    const rondaH = (ronda) => nSlots(ronda) * (MATCH_H + ROW_GAP);
    const totalH  = rondaH(0) + 60; /* +60 para header */

    /* Ancho total */
    /* Primera ronda puede split en 2 sub-columnas */
    const usarSplit = nPrimera > 8;
    const colCount  = usarSplit ? totalRondas + 1 : totalRondas; /* extra col para la mitad */
    const svgW = colCount * (MATCH_W + COL_GAP) + 20;

    /* ---- SVG ---- */
    let out = [];

    /* Header */
    out.push(`<div class="cpb-hdr"><span class="cpb-htitle">Cuadro de Llaves</span><span class="cpb-hseason">${season}</span>${updated?`<span class="cpb-hupdated">Act. ${updated}</span>`:""}</div>`);

    /* Contenedor scroll */
    out.push(`<div class="cpb-outer">`);

    /* SVG del bracket */
    const svgLines = [];
    const matchDivs = [];

    /* Para cada ronda calcular posiciones Y de cada partido */
    const positions = []; /* positions[rondaIdx][matchIdx] = {x,y} */

    let curX = 10;
    for(let ri=0; ri<fasesVis.length; ri++){
      const fase = fasesVis[ri];
      const partidos = fases[fase.key] || [];
      const n = nSlots(ri);
      const stepH = totalH / n;
      const posRonda = [];

      for(let mi=0; mi<n; mi++){
        const cy = stepH * mi + stepH/2 + 30; /* +30 header offset en SVG */
        const y  = cy - MATCH_H/2;
        posRonda.push({ x: curX, y, cx: curX + MATCH_W/2, cy });
      }
      positions.push(posRonda);

      /* Lineas de conexion con ronda anterior */
      if(ri > 0){
        const prevPos = positions[ri-1];
        for(let mi=0; mi<n; mi++){
          const cur = posRonda[mi];
          const p1  = prevPos[mi*2];
          const p2  = prevPos[mi*2+1];
          if(p1 && p2){
            const x1 = p1.x + MATCH_W;
            const y1 = p1.cy;
            const x2 = p2.x + MATCH_W;
            const y2 = p2.cy;
            const xm = cur.x;
            const ym = cur.cy;
            /* Linea horizontal desde p1 a mitad, vertical hasta p2, horizontal hasta cur */
            const xMid = x1 + (xm - x1)/2;
            svgLines.push(`<path d="M${x1},${y1} H${xMid} V${y2} H${xm}" fill="none" stroke="rgba(125,255,179,.3)" stroke-width="1.5"/>`);
            svgLines.push(`<path d="M${xMid},${ym} H${xm}" fill="none" stroke="rgba(125,255,179,.3)" stroke-width="1.5"/>`);
          }
        }
      }

      /* Match divs */
      for(let mi=0; mi<n; mi++){
        const pos = posRonda[mi];
        const p   = mi < partidos.length ? partidos[mi] : null;
        const isEmpty = !p;
        const L = p?.local || {};
        const V = p?.visitante || {};
        const done = p?.completado;
        const wL = L.ganador===true;
        const wV = V.ganador===true;
        const sL = done && L.marcador!=null && L.marcador!=="" ? esc(L.marcador) : "";
        const sV = done && V.marcador!=null && V.marcador!=="" ? esc(V.marcador) : "";
        const pen = p?.penaltis ? `<span class="cpb-pen">p.</span>` : "";
        const isFinal = fase.key==="final";
        const fecha = fechaCorta(p?.fecha_iso||(p?.fecha?p.fecha+"T12:00:00":""));

        const lname = isEmpty ? "Por definir" : esc(L.nombre_corto||L.nombre||"?");
        const vname = isEmpty ? "Por definir" : esc(V.nombre_corto||V.nombre||"?");
        const llogo = L.logo ? `<img src="${esc(L.logo)}" class="cpb-lg" alt="" loading="lazy">` : `<span class="cpb-lg cpb-lg-e"></span>`;
        const vlogo = V.logo ? `<img src="${esc(V.logo)}" class="cpb-lg" alt="" loading="lazy">` : `<span class="cpb-lg cpb-lg-e"></span>`;

        matchDivs.push(`<div class="cpb-match${done?" done":""}${isEmpty?" tbd":""}${isFinal?" final":""}" style="left:${pos.x}px;top:${pos.y}px">
          ${isFinal?`<div class="cpb-ftag">FINAL</div>`:""}
          ${(!isFinal && fecha)?`<div class="cpb-fd">${fecha}</div>`:""}
          <div class="cpb-team ${wL?"win":done?"los":""}">
            ${llogo}<span class="cpb-tn${isEmpty?" tbd":""}">${lname}</span>
            ${sL?`<span class="cpb-sc${wL?" win":""}">${sL}</span>`:`<span class="cpb-sc"></span>`}
          </div>
          <div class="cpb-div">${pen}</div>
          <div class="cpb-team ${wV?"win":done?"los":""}">
            ${vlogo}<span class="cpb-tn${isEmpty?" tbd":""}">${vname}</span>
            ${sV?`<span class="cpb-sc${wV?" win":""}">${sV}</span>`:`<span class="cpb-sc"></span>`}
          </div>
        </div>`);
      }

      curX += MATCH_W + COL_GAP;
    }

    /* Campeon card */
    let campeonHTML = "";
    if(campeon){
      const lastPos = positions[positions.length-1][0];
      const cx = lastPos ? lastPos.x + MATCH_W + 20 : curX;
      const cy = lastPos ? lastPos.cy - 30 : totalH/2;
      matchDivs.push(`<div class="cpb-campeon" style="left:${cx}px;top:${cy}px">
        ${campeon.logo?`<img src="${esc(campeon.logo)}" alt="" class="cpb-clogo">`:""}
        <div class="cpb-clbl">Campeon</div>
        <div class="cpb-cnombre">${esc(campeon.nombre||"")}</div>
      </div>`);
    }

    /* Headers de rondas */
    const headerH = 28;
    const roundHeaders = [];
    curX = 10;
    for(let ri=0; ri<fasesVis.length; ri++){
      const fase = fasesVis[ri];
      const partidos = fases[fase.key]||[];
      const jugados = partidos.filter(p=>p.completado).length;
      const total = partidos.length;
      const badge = total>0 ? `<span class="cpb-rb ${jugados===total?"done":""}">${jugados}/${total}</span>` : "";
      roundHeaders.push(`<div class="cpb-rh" style="left:${curX}px;width:${MATCH_W}px">${esc(fase.label)}${badge}</div>`);
      curX += MATCH_W + COL_GAP;
    }

    const totalW = curX + (campeon ? 160 : 0);
    const svgH = totalH - 30;

    out.push(`<div class="cpb-bracket" style="width:${totalW}px;height:${totalH}px">
      <div class="cpb-rounds">${roundHeaders.join("")}</div>
      <svg class="cpb-svg" width="${totalW}" height="${svgH}" style="top:28px">${svgLines.join("")}</svg>
      ${matchDivs.join("")}
    </div>`);

    out.push("</div>");
    return out.join("");
  }

  /* ---- Estilos ---- */
  function injectStyles(){
    if(document.getElementById("cpb-styles")) return;
    const s = document.createElement("style");
    s.id = "cpb-styles";
    s.textContent = `
#copa-argentina-bracket { padding:0 0 24px; }
.cpb-hdr { display:flex;align-items:baseline;gap:10px;padding:14px 16px 10px;border-bottom:1px solid rgba(255,255,255,.1); }
.cpb-htitle { font-size:13px;font-weight:900;color:#eaffef;text-transform:uppercase;letter-spacing:.05em; }
.cpb-hseason { font-size:11px;color:rgba(186,255,120,.7);font-weight:700; }
.cpb-hupdated { font-size:10px;color:rgba(255,255,255,.3);margin-left:auto; }
.cpb-outer { overflow-x:auto;overflow-y:hidden;padding:10px 16px 16px;-webkit-overflow-scrolling:touch;
  scrollbar-width:thin;scrollbar-color:rgba(125,255,179,.3) transparent; }
.cpb-bracket { position:relative;flex-shrink:0; }
.cpb-svg { position:absolute;left:0;pointer-events:none; }
.cpb-rounds { position:relative;height:28px; }
.cpb-rh { position:absolute;font-size:9px;font-weight:900;color:rgba(186,255,120,.8);
  text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;gap:6px; }
.cpb-rb { font-size:9px;padding:1px 5px;border-radius:99px;background:rgba(125,255,179,.15);color:#7dffb3; }
.cpb-rb.done { background:rgba(50,200,80,.25);color:#6eff8a; }
.cpb-match { position:absolute;width:180px;background:rgba(8,55,30,.92);
  border:1px solid rgba(125,255,179,.18);border-radius:7px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.25); }
.cpb-match.done { border-color:rgba(125,255,179,.3); }
.cpb-match.tbd { background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1); }
.cpb-match.final { border-color:rgba(255,215,0,.4);border-width:1.5px;background:rgba(30,20,0,.95); }
.cpb-ftag { font-size:8px;font-weight:900;color:#ffd700;text-align:center;
  padding:2px;background:rgba(255,200,0,.12);letter-spacing:.1em; }
.cpb-fd { font-size:8px;color:rgba(186,255,120,.6);text-align:center;
  padding:1px 4px;background:rgba(0,0,0,.2); }
.cpb-team { display:grid;grid-template-columns:16px 1fr 20px;align-items:center;
  gap:4px;padding:4px 6px;min-height:22px;color:#e8fff0;font-size:10px;font-weight:700; }
.cpb-team.win { background:rgba(40,180,70,.3);color:#fff; }
.cpb-team.los { color:rgba(255,255,255,.38); }
.cpb-div { height:1px;background:rgba(255,255,255,.1);margin:0 5px;position:relative;display:flex;align-items:center;justify-content:center; }
.cpb-lg { width:16px;height:16px;object-fit:contain;border-radius:2px;flex-shrink:0;display:block; }
.cpb-lg-e { background:rgba(255,255,255,.12);border-radius:50%; }
.cpb-tn { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:700; }
.cpb-tn.tbd { color:rgba(255,255,255,.25);font-style:italic;font-weight:400; }
.cpb-sc { font-size:12px;font-weight:900;text-align:right;color:rgba(255,255,255,.45);min-width:16px; }
.cpb-sc.win { color:#ffe566; }
.cpb-pen { font-size:7px;font-weight:900;color:#ffe566;background:rgba(255,220,0,.15);
  border-radius:2px;padding:1px 3px; }
.cpb-campeon { position:absolute;width:120px;text-align:center;padding:10px 8px;
  background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.3);border-radius:8px; }
.cpb-clogo { width:36px;height:36px;object-fit:contain;margin-bottom:4px; }
.cpb-clbl { font-size:8px;color:rgba(255,210,0,.7);font-weight:900;text-transform:uppercase;letter-spacing:.08em; }
.cpb-cnombre { font-size:11px;font-weight:900;color:#ffd700;margin-top:2px; }
`;
    document.head.appendChild(s);
  }

  /* ---- render principal ---- */
  function render(data){
    const container = document.getElementById("competitionTableCard");
    if(!container) return;
    const fases   = data.fases || {};
    const campeon = data.campeon || null;
    const season  = data.season || new Date().getFullYear();
    const updated = data.actualizado
      ? new Date(data.actualizado).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:TZ})
      : "";
    injectStyles();
    container.innerHTML = `<div id="copa-argentina-bracket">${buildBracketSVG(fases,campeon,season,updated)}</div>`;
  }

  function isCopaPage(){ return (document.body.dataset.competitionId||"")==="copa-argentina"; }

  function init(){
    if(!isCopaPage()) return;
    const el = document.getElementById("competitionTableCard");
    if(!el) return;
    el.innerHTML = `<div style="padding:20px;text-align:center;color:rgba(255,255,255,.35);font-size:12px">Cargando bracket...</div>`;
    fetch(DATA_URL)
      .then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(render)
      .catch(()=>{
        const el2=document.getElementById("competitionTableCard");
        if(el2) el2.innerHTML=`<div style="padding:20px;text-align:center;color:rgba(255,255,255,.25);font-size:12px">No se pudo cargar el bracket.</div>`;
      });
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
  else init();
})();
