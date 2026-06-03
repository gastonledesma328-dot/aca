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
var MW=176,MH=50,CG=52,HD=30;
function esc(v){return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function fd(iso){
  if(!iso)return "";
  try{return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",timeZone:TZ}).format(new Date(iso));}
  catch(e){return (iso||"").slice(5,10);}
}
function buildTree(fases){
  var pi=FASES.findIndex(function(f){return (fases[f.key]||[]).length>0;});
  if(pi<0)return null;
  var fv=FASES.slice(pi);
  var ord={};
  fv.forEach(function(f){
    var arr=(fases[f.key]||[]).slice();
    arr.sort(function(a,b){return (a.llave_num||0)-(b.llave_num||0);});
    ord[f.key]=arr;
  });
  return {fv:fv,ord:ord};
}
function rm(p,fk,x,y){
  var emp=!p||p.empty;
  var L=p&&p.local||{};
  var V=p&&p.visitante||{};
  var done=p&&p.completado;
  var wL=L.ganador===true,wV=V.ganador===true;
  var sL=done&&L.marcador!=null&&L.marcador!==""?esc(L.marcador):"";
  var sV=done&&V.marcador!=null&&V.marcador!==""?esc(V.marcador):"";
  var pen=p&&p.penaltis?"<span class=\"ca-pen\">P</span>":"";
  var fdt=fd(p&&(p.fecha_iso||(p.fecha?p.fecha+"T12:00:00":"")));
  var fin=fk==="final";
  var ln=emp?"Por definir":esc(L.nombre_corto||L.nombre||"?");
  var vn=emp?"Por definir":esc(V.nombre_corto||V.nombre||"?");
  var ll=L.logo?"<img src=\""+esc(L.logo)+"\" class=\"ca-logo\" alt=\"\" loading=\"lazy\">":"<span class=\"ca-logo ca-logo-e\"></span>";
  var vl=V.logo?"<img src=\""+esc(V.logo)+"\" class=\"ca-logo\" alt=\"\" loading=\"lazy\">":"<span class=\"ca-logo ca-logo-e\"></span>";
  var cls="ca-match"+(done?" done":"")+(emp?" tbd":"")+(fin?" final":"");
  return "<div class=\""+cls+"\" style=\"left:"+x+"px;top:"+y+"px;width:"+MW+"px\">"+
    (fin?"<div class=\"ca-ftag\">&#127942; GRAN FINAL</div>":"")+
    (!fin&&fdt?"<div class=\"ca-fd\">"+fdt+"</div>":"")+
    "<div class=\"ca-team "+(wL?"win":done&&!emp?"los":"")+"\">"+ll+
    "<span class=\"ca-tn"+(emp?" tbd":"")+"\">"+(ln)+"</span>"+
    "<span class=\"ca-sc"+(wL?" win":"")+"\">"+sL+"</span></div>"+
    "<div class=\"ca-sep\">"+pen+"</div>"+
    "<div class=\"ca-team "+(wV?"win":done&&!emp?"los":"")+"\">"+vl+
    "<span class=\"ca-tn"+(emp?" tbd":"")+"\">"+(vn)+"</span>"+
    "<span class=\"ca-sc"+(wV?" win":"")+"\">"+sV+"</span></div>"+
    "</div>";
}
function calcY(n0,tH){
  var s=tH/n0,pos=[],r0=[];
  for(var i=0;i<n0;i++)r0.push(s*i+s/2);
  pos.push(r0);
  var prev=r0;
  while(prev.length>1){
    var nx=[];
    for(var j=0;j<prev.length;j+=2){
      var a=prev[j],b=j+1<prev.length?prev[j+1]:prev[j];
      nx.push((a+b)/2);
    }
    pos.push(nx);prev=nx;
  }
  return pos;
}
function buildLines(pos,fv){
  var lines=[],cx=0;
  for(var ri=0;ri<fv.length-1;ri++){
    var xr=cx+MW,xl=cx+MW+CG,xm=xr+CG/2;
    var pn=pos[ri+1];
    for(var mi=0;mi<pn.length;mi++){
      var cy=pn[mi]+HD;
      var cy1=(pos[ri][mi*2]!==undefined?pos[ri][mi*2]:pn[mi])+HD;
      var cy2=(pos[ri][mi*2+1]!==undefined?pos[ri][mi*2+1]:pn[mi])+HD;
      lines.push("<path d=\"M"+xr+","+cy1+" H"+xm+" V"+cy+" H"+xl+"\" fill=\"none\" stroke=\"rgba(125,255,179,.28)\" stroke-width=\"1.5\"/>");
      if(pos[ri][mi*2+1]!==undefined)lines.push("<path d=\"M"+xr+","+cy2+" H"+xm+" V"+cy+" H"+xl+"\" fill=\"none\" stroke=\"rgba(125,255,179,.28)\" stroke-width=\"1.5\"/>");
    }
    cx+=MW+CG;
  }
  return lines.join("");
}
function injStyles(){
  if(document.getElementById("ca-bs"))return;
  var s=document.createElement("style");
  s.id="ca-bs";
  s.textContent="#copa-argentina-bracket{padding:0 0 20px}"
    +".ca-hdr{display:flex;align-items:baseline;gap:10px;padding:12px 16px 8px;border-bottom:1px solid rgba(255,255,255,.1)}"
    +".ca-htitle{font-size:13px;font-weight:900;color:#eaffef;text-transform:uppercase;letter-spacing:.05em}"
    +".ca-hseason{font-size:11px;color:rgba(186,255,120,.7);font-weight:700}"
    +".ca-hupd{font-size:10px;color:rgba(255,255,255,.3);margin-left:auto}"
    +".ca-outer{overflow-x:auto;overflow-y:hidden;padding:8px 14px 14px;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(125,255,179,.3) transparent}"
    +".ca-wrap{position:relative;flex-shrink:0}"
    +".ca-svg{position:absolute;left:0;pointer-events:none;overflow:visible}"
    +".ca-rh{position:absolute;top:0;font-size:9px;font-weight:900;color:rgba(186,255,120,.85);text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;gap:5px;height:30px}"
    +".ca-badge{font-size:9px;padding:1px 5px;border-radius:99px;background:rgba(125,255,179,.15);color:#7dffb3}"
    +".ca-badge.done{background:rgba(50,200,80,.22);color:#6eff8a}"
    +".ca-match{position:absolute;background:rgba(8,52,28,.95);border:1px solid rgba(125,255,179,.18);border-radius:7px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.3);height:50px}"
    +".ca-match.done{border-color:rgba(125,255,179,.32)}"
    +".ca-match.tbd{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1)}"
    +".ca-match.final{border-color:rgba(255,215,0,.45);border-width:1.5px;background:rgba(28,18,0,.97)}"
    +".ca-ftag{font-size:8px;font-weight:900;color:#ffd700;text-align:center;padding:1.5px;background:rgba(255,200,0,.12);letter-spacing:.1em}"
    +".ca-fd{font-size:8px;color:rgba(186,255,120,.6);text-align:center;padding:1px 4px;background:rgba(0,0,0,.18)}"
    +".ca-team{display:grid;grid-template-columns:15px 1fr 18px;align-items:center;gap:4px;padding:3px 6px;min-height:20px;color:#e8fff0}"
    +".ca-team.win{background:rgba(40,175,65,.28);color:#fff}"
    +".ca-team.los{color:rgba(255,255,255,.36)}"
    +".ca-sep{height:1px;background:rgba(255,255,255,.1);margin:0 5px;position:relative;display:flex;align-items:center;justify-content:center}"
    +".ca-logo{width:15px;height:15px;object-fit:contain;border-radius:2px;flex-shrink:0;display:block}"
    +".ca-logo-e{background:rgba(255,255,255,.12);border-radius:50%}"
    +".ca-tn{font-size:10px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    +".ca-tn.tbd{color:rgba(255,255,255,.25);font-style:italic;font-weight:400}"
    +".ca-sc{font-size:11px;font-weight:900;text-align:right;color:rgba(255,255,255,.42);min-width:14px}"
    +".ca-sc.win{color:#ffe566}"
    +".ca-pen{font-size:7px;font-weight:900;color:#ffe566;background:rgba(255,220,0,.15);border-radius:2px;padding:0 3px;position:absolute}"
    +".ca-campeon{position:absolute;width:110px;text-align:center;padding:8px 6px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.3);border-radius:8px}"
    +".ca-clogo{width:34px;height:34px;object-fit:contain;margin-bottom:3px}"
    +".ca-clbl{font-size:8px;color:rgba(255,210,0,.7);font-weight:900;text-transform:uppercase;letter-spacing:.08em}"
    +".ca-cnombre{font-size:11px;font-weight:900;color:#ffd700;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}";
  document.head.appendChild(s);
}
function render(data){
  var c=document.getElementById("competitionTableCard");
  if(!c)return;
  var fases=data.fases||{};
  var camp=data.campeon||null;
  var season=data.season||new Date().getFullYear();
  var upd=data.actualizado?new Date(data.actualizado).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:TZ}):"";
  injStyles();
  var tree=buildTree(fases);
  if(!tree){c.innerHTML="<div id=\"copa-argentina-bracket\"><div class=\"ca-hdr\"><span class=\"ca-htitle\">Cuadro de Llaves</span><span class=\"ca-hseason\">"+season+"</span></div><div style=\"padding:20px;text-align:center;color:rgba(255,255,255,.3);font-size:12px\">Sin datos disponibles</div></div>";return;}
  var fv=tree.fv,ord=tree.ord;
  var n0=Math.max((ord[fv[0].key]||[]).length,fv[0].slots);
  var tH=n0*58;
  var yp=calcY(n0,tH);
  var tW=fv.length*(MW+CG)+(camp?120:0);
  var sH=tH+HD;
  var mds=[],rhs=[],cx=0;
  for(var ri=0;ri<fv.length;ri++){
    var fase=fv[ri];
    var pts=ord[fase.key]||[];
    var cY=yp[ri]||[];
    var n=cY.length;
    var j=0;pts.forEach(function(p){if(p.completado)j++;});
    var tot=pts.length;
    var badge=tot>0?"<span class=\"ca-badge "+(j===tot?"done":"")+"\">"+(j)+"/"+tot+"</span>":"<span class=\"ca-badge\">"+fase.slots+"</span>";
    rhs.push("<div class=\"ca-rh\" style=\"left:"+cx+"px;width:"+MW+"px\">"+esc(fase.label)+badge+"</div>");
    for(var mi=0;mi<n;mi++){
      var p=mi<pts.length?pts[mi]:null;
      var y=Math.round(cY[mi]-MH/2+HD);
      mds.push(rm(p,fase.key,cx,y));
    }
    cx+=MW+CG;
  }
  if(camp){
    var lY=(yp[yp.length-1][0]||tH/2)+HD;
    mds.push("<div class=\"ca-campeon\" style=\"left:"+(cx-CG+4)+"px;top:"+Math.round(lY-35)+"px\">"+
      (camp.logo?"<img src=\""+esc(camp.logo)+"\" alt=\"\" class=\"ca-clogo\">":"")+
      "<div class=\"ca-clbl\">Campeon</div><div class=\"ca-cnombre\">"+esc(camp.nombre||"")+"</div></div>");
  }
  var svgl=buildLines(yp,fv);
  c.innerHTML="<div id=\"copa-argentina-bracket\">"+
    "<div class=\"ca-hdr\"><span class=\"ca-htitle\">Cuadro de Llaves</span><span class=\"ca-hseason\">"+season+"</span>"+(upd?"<span class=\"ca-hupd\">Act. "+upd+"</span>":"")+",</div>"+
    "<div class=\"ca-outer\"><div class=\"ca-wrap\" style=\"width:"+tW+"px;height:"+sH+"px\">"+
    "<svg class=\"ca-svg\" width=\""+tW+"\" height=\""+sH+"\" style=\"top:0\">"+svgl+"</svg>"+
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
      var e=document.getElementById("competitionTableCard");
      if(e)e.innerHTML="<div style=\"padding:20px;text-align:center;color:rgba(255,255,255,.25);font-size:12px\">No se pudo cargar el bracket.</div>";
    });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
else init();
})();
