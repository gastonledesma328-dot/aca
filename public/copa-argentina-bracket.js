/* =========================================================
   COPA ARGENTINA - Bracket de Llaves Eliminacion Directa
   
   ORDEN DEL BRACKET:
   Los partidos dentro de cada fase estan ordenados por llave_num
   (orden cronologico ESPN). El ganador del partido llave_num=N
   cruza con el ganador de llave_num=N+1 (par->impar) en la
   siguiente fase, formando el arbol de eliminacion directa.
   
   Datos: /data/copa_argentina_bracket.json (ESPN API scraper)
   ========================================================= */
(function () {
  "use strict";
  const DATA_URL = "/data/copa_argentina_bracket.json";
  const TZ = "America/Argentina/Buenos_Aires";

  const FASES = [
    { key: "treintaidosavos", label: "32avos",  slots: 32 },
    { key: "dieciseisavos",   label: "16avos",  slots: 16 },
    { key: "octavos",         label: "Octavos", slots: 8  },
    { key: "cuartos",         label: "Cuartos", slots: 4  },
    { key: "semis",           label: "Semis",   slots: 2  },
    { key: "final",           label: "Final",   slots: 1  },
  ];

  /* ---- Constantes de layout ---- */
  const MW   = 176;  /* ancho tarjeta partido */
  const MH   = 50;   /* altura tarjeta partido */
  const CGAP = 52;   /* gap entre columnas */
  const HEAD = 30;   /* altura del header de ronda */

  function esc(v){ return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  function fecha(iso){
    if(!iso) return "";
    try{ return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",timeZone:TZ}).format(new Date(iso)); }
    catch(_){ return (iso||"").slice(5,10); }
  }

  function buildTree(fases){
    const primerIdx = FASES.findIndex(f => (fases[f.key]||[]).length > 0);
    if(primerIdx < 0) return null;
    const fasesVis = FASES.slice(primerIdx);
    const ordenado = {};
    fasesVis.forEach(f => {
      const arr = [...(fases[f.key]||[])];
      arr.sort((a,b) => (a.llave_num??0) - (b.llave_num??0));
      ordenado[f.key] = arr;
    });
    return { fasesVis, ordenado };
  }

  function renderMatch(p, faseKey, x, y){
    const isEmpty = !p || p.empty;
    const L  = p?.local    || {};
    const V  = p?.visitante|| {};
    const done = p?.completado;
    const wL = L.ganador === true;
    const wV = V.ganador === true;
    const sL = done && L.marcador!=null && L.marcador!=="" ? esc(L.marcador) : "";
    const sV = done && V.marcador!=null && V.marcador!=="" ? esc(V.marcador) : "";
    const pen = p?.penaltis ? `<span class="ca-pen">P</span>` : "";
    const fd  = fecha(p?.fecha_iso||(p?.fecha ? p.fecha+"T12:00:00" : ""));
    const isFinal = faseKey === "final";
    const lname = isEmpty ? "Por definir" : esc(L.nombre_corto||L.nombre||"?");
    const vname = isEmpty ? "Por definir" : esc(V.nombre_corto||V.nombre||"?");
    const llogo = L.logo ? `<img src="${esc(L.logo)}" class="ca-logo" alt="" loading="lazy">` : `<span class="ca-logo ca-logo-e"></span>`;
    const vlogo = V.logo ? `<img src="${esc(V.logo)}" class="ca-logo" alt="" loading="lazy">` : `<span class="ca-logo ca-logo-e"></span>`;
    const cls = ["ca-match",done?"done":"",isEmpty?"tbd":"",isFinal?"final":""].filter(Boolean).join(" ");
    return `<div class="${cls}" style="left:${x}px;top:${y}px;width:${MW}px">
      ${isFinal?`<div class="ca-ftag">&#127942; GRAN FINAL</div>`:""}
      ${(!isFinal&&fd)?`<div class="ca-fd">${fd}</div>`:""}
      <div class="ca-team ${wL?"win":done&&!isEmpty?"los":""}">
        ${llogo}<span class="ca-tn${isEmpty?" tbd":""}">${lname}</span>
        <span class="ca-sc${wL?" win":""}">${sL}</span>
      </div>
      <div class="ca-sep">${pen}</div>
      <div class="ca-team ${wV?"win":done&&!isEmpty?"los":""}">
        ${vlogo}<span class="ca-tn${isEmpty?" tbd":""}">${vname}</span>
        <span class="ca-sc${wV?" win":""}">${sV}</span>
      </div>
    </div>`;
  }

  function calcYPositions(n0, totalH){
    const step0 = totalH / n0;
    const pos = [];
    const round0 = [];
    for(let i=0; i<n0; i++){ round0.push(step0 * i + step0/2); }
    pos.push(round0);
    let prev = round0;
    while(prev.length > 1){
      const next = [];
      for(let i=0; i<prev.length; i+=2){
        const a = prev[i];
        const b = prev[i+1] ?? prev[i];
        next.push((a+b)/2);
      }
      pos.push(next);
      prev = next;
    }
    return pos;
  }

  function buildLines(positions, fasesVis, x: {
    const lines = [];
    let curX = xInit;
    for(let ri=0; ri<fasesVis.length-1; ri++){
      const yRight = curX + MW;
      const xLeft  = curX + MW + CGAP;
      const xMid   = xRight + CGAP/2;
      const posNext = positions[ri+1];
      for(let mi=0; mi<posNext.length; mi++){
	const cy = posNext[mi] + HEAD;
	const cy1 = (positions[ri][mi*2]   ?? cy) + HEAD;
	const cy2 = (positions[ri][mi*2+1] ?? cy) + HEAD;
	lines.push(`<path d="M${xRight},${cy1} H${xMid} V${cy} H${xLeft}" fill="none" stroke="rgba(125,255,179,.28)" stroke-width="1.5" stroke-linejoin="round"/>`);
	if(positions[ri][mi*2+1] !== undefined) lines.push(`<path d="M${xRight},${cy2} H${xMid} V${cy} H${xLeft}" fill="none" stroke="rgba(125,255,179,.28)" stroke-width="1.5" stroke-linejoin="round"/>`);
      }
      curX += MW + CGAP;
    }
    return lines.join("");
  }

  function injectStyles(){
    if(document.getElementById("ca-bracket-style")) return;
    const s = document.createElement("style");
    s.id = "ca-bracket-style";
    s.textContent = `
;copa-argentina-bracket { padding:0 0 20px; }
.ca-hdr { display:flex;align-items:baseline;gap:10px;padding:12px 16px 8px;border-bottom:1px solid rgba(255,255,255,.1); }
.ca-htitle { font-size:13px;font-weight:900;color:#eaffef;text-transform:uppercase;letter-spacing:.05em; }
.ca-hseason { font-size:11px;color:rgba(186,255,120,.7);font-weight:700; }
.ca-hupd { font-size:10px;color:rgba(255,255,255,.3);margin-left:auto; }
.ca-outer { overflow-x:auto;overflow-y:hidden;padding:8px 14px 14px;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(125,255,179,.3) transparent; }
.ca-wrap { position:relative;flex-shrink:0; }
.ca-svg { position:absolute;left:0;pointer-events:none;overflow:visible; }
.ca-rh { position:absolute;top:0;font-size:9px;font-weight:900;color:rgba(186,255,120,.85);text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;gap:5px;height:30px; }
.ca-badge { font-size:9px;padding:1px 5px;border-radius:99px;background:rgba(125,255,179,.15);color:#7dffb3; }
.ca-badge.done { background:rgba(50,200,80,.22);color:#6eff8a; }
.ca-match { position:absolute;background:rgba(8,52,28,.95);border:1px solid rgba(125,255,179,.18);border-radius:7px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.3);height:50px; }
.ca-match.done { border-color:rgba(125,255,179,.32); }
.ca-match.tbd { background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1); }
.ca-match.final { border-color:rgba(255,215,0,.45);border-width:1.5px;background:rgba(28,18,0,.97); }
.ca-ftag { font-size:8px;font-weight:900;color:#ffd700;text-align:center;padding:1.5px;background:rgba(255,200,0,.12);letter-spacing:.1em; }
.ca-fd { font-size:8px;color:rgba(186,255,120,.6);text-align:center;padding:1px 4px;background:rgba(0,0,9,.18); }
.ca-team { display:grid;grid-template-columns:15px 1fr 18px;align-items:center;gap:4px;padding:3px 6px;min-height:20px;color:#e8fff0; }
.ca-team.win { background:rgba(40,175,65,.28);color:#fff; }
.ca-team.los { color:rgba(255,255,255,.36); }
.ca-sep { height:1px;background:rgba(255,255,255,.1);margin:0 5px;position:relative;display:flex;align-items:center;justify-content:center; }
.ca-logo { width:15px;height:15px;object-fit:contain;border-radius:2px;flex-shrink:0;display:block; }
.ca-logo-e { background:rgba(255,255,255,.12);border-radius:50%; }
.ca-tn { font-size:10px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.ca-tn.tbd { color:rgba(255,255,255,.25);font-style:italic;font-weight:400; }
.ca-sc { font-size:11px;font-weight:900;text-align:right;color:rgba(255,255,255,.42);min-width:14px; }
.ca-sc.win { color:#ffe566; }
.ca-pen { font-size:7px;font-weight:900;color:#ffe566;background:rgba(255,220,0,.15);border-radius:2px;padding:0 3px;position:absolute; }
.ca-campeon { position:absolute;width:110px;text-align:center;padding:8px 6px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.3);border-radius:8px; }
.ca-clogo { width:34px;height:34px;object-fit:contain;margin-bottom:3px; }
.ca-clbl { font-size:8px;color:rgba(255,210,0,.7);font-weight:900;text-transform:uppercase;letter-spacing:.08em; }
.ca-cnombre { font-size:11px;font-weight:900;color:#ffd700;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
`;
    document.head.appendChild(s);
  }

  function render(data){
    const container = document.getElementById("competitionTableCard");
    if(!container) return;
    const fases   = data.fases   || {};
    const campeon = data.campeon || null;
    const season  = data.season  || new Date().getFullYear();
    const updated = data.actualizado ? new Date(data.actualizado).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:TZ}) : "";
    injectStyles();
    const tree = buildTree(fases);
    if(!tree){ container.innerHTML = `<div id="copa-argentina-bracket"><div class="ca-hdr"><span class="ca-htitle">Cuadro de Llaves</span><span class="ca-hseason">${season}</span></div><div style="padding:20px;text-align:center;color:rgba(255,255,255,.3);font-size:12px">Sin datos disponibles</div></div>`; return; }
    const { fasesVis, ordenado } = tree;
    const n0 = Math.max((ordenado[fasesVis[0].key]||[]).length, fasesVis[0].slots);
    const VGAP = 8;
    const slotH = 50 + VGAP;
    const totalH = n0 * slotH;
    const yPos = calcYPositions(n0, totalH);
    const totalW = fasesVis.length * (176 + 52) + (campeon ? 120 : 0);
    const svgH   = totalH + 30;
    const matchDivs  = [];
    const roundHdrs  = [];
    let curX = 0;
    for(let ri=0; ri<fasesVis.length; ri++){
      const fase = fasesVis[ri];
      const partidos = ordenado[fase.key] || [];
      const centersY = yPos[ri]}¿ [];
      const n = centersY.length;
      const jugados = partidos.filter(p=>p.completado).length;
      const total = partidos.length;
      const badge = total>0 ? `<span class="ca-badge ${jugados===total?"done":""}">${jugados}/${total}</span>` : `<span class="ca-badge">${fase.slots}</span>`;
      roundHdrs.push(`<div class="ca-rh" style="left:${curX}px;width:176px">${esc(fase.label)}${badge}</div>`);
      for(let mi=0; mi<n; mi++){
        const p = mi < partidos.length ? partidos[mi] : null;
        const cy = centersY[mi];
        const y = cy - 50/2 + 30;
        matchDivs.push(renderMatch(p, fase.key, curX, Math.round(y)));
      }
      curX += 176 + 52;
    }
    if(campeon){
      const lastY = (yPos[yPos.length-1]?.[0] ?? totalH/2) + 30;
      matchDivs.push(`<div class="ca-campeon" style="left:${curX-52+4}px;top:${Math.round(lastY-35)}px">${campeon.logo?`<img src="${esc(campeon.logo)}" alt="" class="ca-clogo">`:""}<div class="ca-clbl">Campeon</div><div class="ca-cnombre">${esc(campeon.nombre||"")}</div></div>`);
    }
    const svgLines = buildLines(yPos, fasesVis, 0);
    container.innerHTML = `<div id="copa-argentina-bracket"><div class="ca-hdr"><span class="ca-htitle">Cuadro de Llaves</span><span class="ca-hseason">${season}</span>${updated?`<span class="ca-hupd">Act. ${updated}</span>`:""}</div><div class="ca-outer"><div class="ca-wrap" style="width:${totalW}px;height:${svgH}px"><svg class="ca-svg" width="${totalW}" height="${svgH}" style="top:0">${svgLines}</svg>${roundHdrs.join("")}${matchDivs.join("")}</div></div></div>`;
  }

  function isCopaPage(){ return (document.body?.dataset?.competitionId||"")==="copa-argentina"; }

  function init(){
    if(!isCopaPage()) return;
    const el = document.getElementById("competitionTableCard");
    if(!el) return;
    el.innerHTML = `<div style="padding:20px;text-align:center;color:rgba(255,255,255,.3);font-size:12px">Cargando bracket...</div>`;
    fetch("/data/copa_argentina_bracket.json")
      .then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
      .then(render)
      .catch(()=>{ const el2=document.getElementById("competitionTableCard"); if(el2) el2.innerHTML=`<div style="padding:20px;text-align:center;color:rgba(255,255,255,.25);font-size:12px">No se pudo cargar el bracket.</div>`; });
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
  else init();
})();
