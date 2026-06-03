(function(){
"use strict";
var DATA="/data/copa_argentina_bracket.json";
var TZ="America/Argentina/Buenos_Aires";
var FASES=[
  {key:"treintaidosavos",label:"32avos",slots:32},
  {key:"dieciseisavos",label:"16avos",slots:16},
  {key:"octavos",label:"Octavos",slots:8},
  {key:"cuartos",label:"Cuartos",slots:4},
  {key:"semis",label:"Semis",slots:2},
  {key:"final",label:"Final",slots:1}
];
var MW=180, MH=52, CG=56, HD=28, VGAP=10;

function esc(v){return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

function fmtDate(iso){
  if(!iso)return "";
  try{return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",timeZone:TZ}).format(new Date(iso));}
  catch(e){return (iso||"").slice(5,10);}
}

/*
  reorderForBracket: dado que los partidos de la fase siguiente tienen src_local/src_visitante
  que apuntan a indices de la fase anterior, reordena la fase anterior para que los pares
  que se cruzan queden adyacentes (en posiciones 2k y 2k+1).
  Devuelve el nuevo array ordenado Y actualiza los src de la fase siguiente.
*/
function reorderPrev(prevPartidos, nextPartidos){
  // Construir lista de pares de src usados por nextPartidos
  var placed = [];  // nuevas posiciones de prevPartidos
  var used = {};
  for(var mi=0;mi<nextPartidos.length;mi++){
    var p = nextPartidos[mi];
    var sL = p.src_local;
    var sV = p.src_visitante;
    if(sL!=null && !used[sL]){ placed.push(sL); used[sL]=true; }
    if(sV!=null && !used[sV]){ placed.push(sV); used[sV]=true; }
  }
  // Agregar los que no tienen src en nextPartidos
  for(var i=0;i<prevPartidos.length;i++){
    if(!used[i]){ placed.push(i); used[i]=true; }
  }
  // Construir array reordenado
  var reordered = [];
  for(var j=0;j<placed.length;j++) reordered.push(prevPartidos[placed[j]]);
  // Construir mapa old_index -> new_index
  var indexMap = {};
  for(var k=0;k<placed.length;k++) indexMap[placed[k]] = k;
  // Actualizar src en nextPartidos
  for(var mi2=0;mi2<nextPartidos.length;mi2++){
    var p2 = nextPartidos[mi2];
    if(p2.src_local!=null) p2.src_local = indexMap[p2.src_local];
    if(p2.src_visitante!=null) p2.src_visitante = indexMap[p2.src_visitante];
  }
  return reordered;
}

function buildBracket(fases){
  var pi=FASES.findIndex(function(f){return (fases[f.key]||[]).length>0;});
  if(pi<0)return null;
  var fv=FASES.slice(pi);
  // Copiar arrays para no mutar el JSON original
  var ord={};
  fv.forEach(function(f){
    var arr=(fases[f.key]||[]).slice();
    arr.sort(function(a,b){return (a.llave_num||0)-(b.llave_num||0);});
    // Deep copy para no perder src originals
    ord[f.key]=arr.map(function(p){return Object.assign({},p);});
  });
  
  // Reordenar cada fase anterior segun como la consume la siguiente
  for(var ri=0;ri<fv.length-1;ri++){
    var prevKey=fv[ri].key;
    var nextKey=fv[ri+1].key;
    if((ord[nextKey]||[]).some(function(p){return p.src_local!=null;})){
      ord[prevKey] = reorderPrev(ord[prevKey], ord[nextKey]);
    }
  }
  
  // Calcular posiciones Y: ronda 0 equiespaciada, siguientes centradas entre sus hijos
  var n0=(ord[fv[0].key]||[]).length;
  if(n0===0)n0=fv[0].slots;
  var slotH=MH+VGAP;
  var totalH=n0*slotH;
  var posY=[];
  var r0=[];
  for(var i=0;i<n0;i++) r0.push(i*slotH+slotH/2);
  posY.push(r0);
  for(var ri2=1;ri2<fv.length;ri2++){
    var pts=ord[fv[ri2].key]||[];
    var prevY=posY[ri2-1];
    var rY=[];
    for(var mi=0;mi<pts.length;mi++){
      var p=pts[mi];
      var sL=(p.src_local!=null)?p.src_local:mi*2;
      var sV=(p.src_visitante!=null)?p.src_visitante:mi*2+1;
      var yL=(sL<prevY.length)?prevY[sL]:(prevY[prevY.length-1]||totalH/2);
      var yV=(sV<prevY.length)?prevY[sV]:yL;
      rY.push((yL+yV)/2);
    }
    // Completar hasta slots
    while(rY.length<fv[ri2].slots){
      var last=rY[rY.length-1]||(totalH/2);
      rY.push(last+slotH*Math.pow(2,ri2));
    }
    posY.push(rY);
  }
  return {fv:fv, ord:ord, posY:posY, totalH:totalH};
}

function buildLines(posY,fv,ord){
  var lines=[],cx=0;
  for(var ri=0;ri<fv.length-1;ri++){
    var xr=cx+MW, xl=cx+MW+CG, xm=xr+CG/2;
    var pts=ord[fv[ri+1].key]||[];
    var prevY=posY[ri];
    var nextY=posY[ri+1];
    for(var mi=0;mi<pts.length;mi++){
      var p=pts[mi];
      var cy=nextY[mi]+HD;
      var sL=(p.src_local!=null)?p.src_local:mi*2;
      var sV=(p.src_visitante!=null)?p.src_visitante:mi*2+1;
      var cy1=((sL<prevY.length)?prevY[sL]:(cy-10))+HD;
      var cy2=((sV<prevY.length)?prevY[sV]:(cy+10))+HD;
      lines.push("<path d=\"M"+xr+","+cy1+" H"+xm+" V"+cy+" H"+xl+"\" fill=\"none\" stroke=\"rgba(125,255,179,.35)\" stroke-width=\"1.5\"/>");
      if(sL!==sV) lines.push("<path d=\"M"+xr+","+cy2+" H"+xm+" V"+cy+" H"+xl+"\" fill=\"none\" stroke=\"rgba(125,255,179,.35)\" stroke-width=\"1.5\"/>");
    }
    cx+=MW+CG;
  }
  return lines.join("");
}

function renderMatch(p,fk,x,y){
  var emp=!p||p.empty;
  var L=p&&p.local||{};
  var V=p&&p.visitante||{};
  var done=p&&p.completado;
  var wL=L.ganador===true, wV=V.ganador===true;
  var sL=done&&L.marcador!=null&&L.marcador!==""?esc(L.marcador):"";
  var sV=done&&V.marcador!=null&&V.marcador!==""?esc(V.marcador):"";
  var pen=p&&p.penaltis?"<span class=\"cb-pen\">pen.</span>":"";
  var fdt=fmtDate(p&&(p.fecha_iso||(p.fecha?p.fecha+"T12:00:00":"")));
  var fin=fk==="final";
  var ln=emp?"Por definir":esc(L.nombre_corto||L.nombre||"?");
  var vn=emp?"Por definir":esc(V.nombre_corto||V.nombre||"?");
  var ll=L.logo?"<img src=\""+esc(L.logo)+"\" class=\"cb-lg\" alt=\"\" loading=\"lazy\">":"<span class=\"cb-lg cb-lge\"></span>";
  var vl=V.logo?"<img src=\""+esc(V.logo)+"\" class=\"cb-lg\" alt=\"\" loading=\"lazy\">":"<span class=\"cb-lg cb-lge\"></span>";
  var cls="cb-m"+(done?" dn":"")+(emp?" tb":"")+(fin?" fn":"");
  return "<div class=\""+cls+"\" style=\"left:"+x+"px;top:"+y+"px;width:"+MW+"px\">"+
    (fin?"<div class=\"cb-ftag\">GRAN FINAL</div>":"")+
    (!fin&&fdt?"<div class=\"cb-dt\">"+fdt+"</div>":"")+
    "<div class=\"cb-t "+(wL?"wn":done&&!emp?"ls":"")+"\">"+ ll+
    "<span class=\"cb-tn"+(emp?" tb":"")+"\">"+ln+"</span>"+
    "<span class=\"cb-sc"+(wL?" wn":"")+"\">"+(sL||"")+"</span></div>"+
    "<div class=\"cb-sep\">"+pen+"</div>"+
    "<div class=\"cb-t "+(wV?"wn":done&&!emp?"ls":"")+"\">"+ vl+
    "<span class=\"cb-tn"+(emp?" tb":"")+"\">"+vn+"</span>"+
    "<span class=\"cb-sc"+(wV?" wn":"")+"\">"+(sV||"")+"</span></div>"+
    "</div>";
}

function injStyles(){
  if(document.getElementById("cb-st"))return;
  var s=document.createElement("style"); s.id="cb-st";
  s.textContent=
    "#copa-argentina-bracket{padding:0 0 24px}"
    +".cb-hdr{display:flex;align-items:baseline;gap:10px;padding:12px 16px 8px;border-bottom:1px solid rgba(255,255,255,.1)}"
    +".cb-ht{font-size:13px;font-weight:900;color:#eaffef;text-transform:uppercase;letter-spacing:.05em}"
    +".cb-hs{font-size:11px;color:rgba(186,255,120,.7);font-weight:700}"
    +".cb-hu{font-size:10px;color:rgba(255,255,255,.3);margin-left:auto}"
    +".cb-outer{overflow-x:auto;overflow-y:hidden;padding:8px 14px 16px;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(125,255,179,.3) transparent}"
    +".cb-wrap{position:relative;flex-shrink:0}"
    +".cb-svg{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}"
    +".cb-rh{position:absolute;top:0;font-size:9px;font-weight:900;color:rgba(186,255,120,.85);text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;gap:5px;height:28px}"
    +".cb-badge{font-size:9px;padding:1px 5px;border-radius:99px;background:rgba(125,255,179,.15);color:#7dffb3}"
    +".cb-badge.dn{background:rgba(50,200,80,.22);color:#6eff8a}"
    +".cb-m{position:absolute;background:rgba(8,52,28,.95);border:1px solid rgba(125,255,179,.18);border-radius:7px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.3);height:52px}"
    +".cb-m.dn{border-color:rgba(125,255,179,.32)}"
    +".cb-m.tb{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1)}"
    +".cb-m.fn{border-color:rgba(255,215,0,.45);border-width:1.5px;background:rgba(28,18,0,.97)}"
    +".cb-ftag{font-size:8px;font-weight:900;color:#ffd700;text-align:center;padding:2px;background:rgba(255,200,0,.12);letter-spacing:.1em}"
    +".cb-dt{font-size:8px;color:rgba(186,255,120,.6);text-align:center;padding:1px 4px;background:rgba(0,0,0,.18)}"
    +".cb-t{display:grid;grid-template-columns:16px 1fr 20px;align-items:center;gap:4px;padding:3px 6px;min-height:21px;color:#e8fff0}"
    +".cb-t.wn{background:rgba(40,175,65,.28);color:#fff}"
    +".cb-t.ls{color:rgba(255,255,255,.36)}"
    +".cb-sep{height:1px;background:rgba(255,255,255,.1);margin:0 5px;position:relative;display:flex;align-items:center;justify-content:center}"
    +".cb-lg{width:16px;height:16px;object-fit:contain;border-radius:2px;flex-shrink:0;display:block}"
    +".cb-lge{background:rgba(255,255,255,.12);border-radius:50%}"
    +".cb-tn{font-size:10px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    +".cb-tn.tb{color:rgba(255,255,255,.25);font-style:italic;font-weight:400}"
    +".cb-sc{font-size:12px;font-weight:900;text-align:right;color:rgba(255,255,255,.42);min-width:16px}"
    +".cb-sc.wn{color:#ffe566}"
    +".cb-pen{font-size:7px;font-weight:900;color:#ffe566;background:rgba(255,220,0,.15);border-radius:2px;padding:0 3px;position:absolute}"
    +".cb-camp{position:absolute;width:110px;text-align:center;padding:8px 6px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.3);border-radius:8px}"
    +".cb-clog{width:36px;height:36px;object-fit:contain;margin-bottom:3px}"
    +".cb-clbl{font-size:8px;color:rgba(255,210,0,.7);font-weight:900;text-transform:uppercase;letter-spacing:.08em}"
    +".cb-cnm{font-size:11px;font-weight:900;color:#ffd700;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}";
  document.head.appendChild(s);
}

function render(data){
  var c=document.getElementById("competitionTableCard");
  if(!c)return;
  var season=data.season||new Date().getFullYear();
  var upd=data.actualizado?new Date(data.actualizado).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:TZ}):"";
  injStyles();
  var tree=buildBracket(data.fases||{});
  if(!tree){
    c.innerHTML="<div id=\"copa-argentina-bracket\"><div class=\"cb-hdr\"><span class=\"cb-ht\">Cuadro de Llaves</span></div><p style=\"padding:20px;text-align:center;color:rgba(255,255,255,.3);font-size:12px\">Sin datos disponibles</p></div>";
    return;
  }
  var fv=tree.fv, ord=tree.ord, posY=tree.posY, totalH=tree.totalH;
  var camp=data.campeon||null;
  var totalW=fv.length*(MW+CG)+(camp?120:0);
  var svgH=totalH+HD;
  var mds=[],rhs=[],cx=0;
  for(var ri=0;ri<fv.length;ri++){
    var fase=fv[ri];
    var pts=ord[fase.key]||[];
    var cY=posY[ri]||[];
    var j=0; pts.forEach(function(p){if(p.completado)j++;});
    var tot=pts.length;
    var badge=tot>0?"<span class=\"cb-badge "+(j===tot?"dn":"")+"\">"+(j)+"/"+tot+"</span>":"<span class=\"cb-badge\">"+fase.slots+"</span>";
    rhs.push("<div class=\"cb-rh\" style=\"left:"+cx+"px;width:"+MW+"px\">"+esc(fase.label)+badge+"</div>");
    var nSlots=Math.max(cY.length, pts.length);
    for(var mi=0;mi<nSlots;mi++){
      var p=mi<pts.length?pts[mi]:null;
      var y=Math.round((mi<cY.length?cY[mi]:cY[cY.length-1]||(totalH/2))-MH/2+HD);
      mds.push(renderMatch(p,fase.key,cx,y));
    }
    cx+=MW+CG;
  }
  if(camp){
    var lY=(posY[posY.length-1][0]||totalH/2)+HD;
    mds.push("<div class=\"cb-camp\" style=\"left:"+(cx-CG+4)+"px;top:"+Math.round(lY-35)+"px\">"+
      (camp.logo?"<img src=\""+esc(camp.logo)+"\" alt=\"\" class=\"cb-clog\">":"")+
      "<div class=\"cb-clbl\">Campeon</div><div class=\"cb-cnm\">"+esc(camp.nombre||"")+"</div></div>");
  }
  var svgLines=buildLines(posY,fv,ord);
  c.innerHTML="<div id=\"copa-argentina-bracket\">"+
    "<div class=\"cb-hdr\"><span class=\"cb-ht\">Cuadro de Llaves</span><span class=\"cb-hs\">"+season+"</span>"+(upd?"<span class=\"cb-hu\">Act. "+upd+"</span>":"")+",</div>"+
    "<div class=\"cb-outer\"><div class=\"cb-wrap\" style=\"width:"+totalW+"px;height:"+svgH+"px\">"+
    "<svg class=\"cb-svg\" width=\""+totalW+"\" height=\""+svgH+"\">"+svgLines+"</svg>"+
    rhs.join("")+mds.join("")+"</div></div></div>";
}

function isP(){return (document.body&&document.body.dataset.competitionId)==="copa-argentina";}
function init(){
  if(!isP())return;
  var el=document.getElementById("competitionTableCard");
  if(!el)return;
  el.innerHTML="<div style=\"padding:20px;text-align:center;color:rgba(255,255,255,.3);font-size:12px\">Cargando bracket...</div>";
  fetch(DATA)
    .then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
    .then(render)
    .catch(function(){
      var el2=document.getElementById("competitionTableCard");
      if(el2)el2.innerHTML="<div style=\"padding:20px;text-align:center;color:rgba(255,255,255,.25);font-size:12px\">No se pudo cargar el bracket.</div>";
    });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
else init();
})();
