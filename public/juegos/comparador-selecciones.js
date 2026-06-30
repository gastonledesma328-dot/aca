/*
  comparador-selecciones.js
  - Roster ESPN:   ../data/comparador-selecciones.json
  - Fixture live:  ../data/fixture-mundial2026.json   (Google KG scraper)
  Muestra scores en vivo, resultados y status de cada partido del fixture.
*/

const DATA_URL    = "../data/comparador-selecciones.json";
const FIXTURE_URL = "../data/fixture-mundial2026.json";

const POS_LABELS = ["Porteros", "Defensas", "Mediocampistas", "Delanteros"];
const POS_TAGS   = ["GK", "DEF", "MID", "FWD"];
const POS_SHORT  = ["POR", "DEF", "MED", "DEL"];
const POS_MAP    = { GK:0, G:0, POR:0, DEF:1, D:1, MID:2, M:2, FWD:3, F:3, ATT:3 };

let DATA           = null;
let FIXTURE_DATA   = null;
let currentMode    = "fixture";
let selected       = null;
let liveTimer      = null;

// ── INIT ──────────────────────────────────────────────────────────────────

async function init() {
  await Promise.all([loadData(), loadFixture()]);
  buildSelects();
  buildFixturePanel();
  scheduleRefreshIfLive();
}

async function loadData() {
  try {
    const res = await fetch(`${DATA_URL}?v=${Date.now()}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    DATA = await res.json();
  } catch { DATA = null; }
}

async function loadFixture() {
  try {
    const res = await fetch(`${FIXTURE_URL}?v=${Date.now()}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    FIXTURE_DATA = await res.json();
    // Convertir startTime UTC a fecha+hora en horario ARG (UTC-3)
    if (FIXTURE_DATA?.fixture?.length) {
      const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      FIXTURE_DATA.fixture = FIXTURE_DATA.fixture.map(m => {
        if (!m.startTime) return m;
        const d = new Date(new Date(m.startTime).getTime() - 3 * 60 * 60 * 1000);
        const fecha = d.getUTCDate() + ' ' + MESES[d.getUTCMonth()];
        const hora  = String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0');
        return { ...m, fecha, hora };
      });
    }
  } catch { FIXTURE_DATA = null; }
}

// Si hay partidos en vivo, refrescar fixture cada 60s
function scheduleRefreshIfLive() {
  clearInterval(liveTimer);
  const hasLive = getFixture().some(m => m.status === "live");
  if (hasLive) {
    liveTimer = setInterval(async () => {
      await loadFixture();
      buildFixturePanel();
    }, 60000);
  }
}

// Mejor fuente disponible para el fixture
// Merge: FALLBACK_FIXTURE (72 partidos completos, fecha+hora ARG correctas)
// + FIXTURE_DATA de Google (scores/status en vivo cuando los hay)
function getFixture() {
  if (!FIXTURE_DATA?.fixture?.length) return FALLBACK_FIXTURE;
  // Construir mapa de scores por "local|visita"
  const liveMap = {};
  FIXTURE_DATA.fixture.forEach(m => {
    liveMap[m.local + '|' + m.visita] = m;
  });
  // Merge: usar fecha/hora del FALLBACK, score/status del live
  // Filtrar scores inválidos (el scraper a veces captura año/mes como score)
  return FALLBACK_FIXTURE.map(m => {
    const live = liveMap[m.local + '|' + m.visita];
    if (!live) return m;
    const score = live.score;
    const validScore = score && score.local <= 20 && score.visita <= 20 ? score : null;
    return { ...m, score: validScore, status: validScore ? live.status : m.status };
  });
}

// ── SELECTS ───────────────────────────────────────────────────────────────

function buildSelects() {
  const teams = getTeamList();
  [document.getElementById("sel1"), document.getElementById("sel2")].forEach(sel => {
    teams.forEach(t => {
      const o = document.createElement("option");
      o.value = t.espnId;
      o.textContent = t.name;
      sel.appendChild(o);
    });
  });
}

function getTeamList() {
  if (DATA?.teams) return Object.values(DATA.teams).sort((a,b) => a.name.localeCompare(b.name,"es"));
  return FALLBACK_TEAMS;
}

function getTeamById(id) {
  const sid = String(id);
  if (DATA?.teams?.[sid]) return DATA.teams[sid];
  return FALLBACK_TEAMS.find(t => String(t.espnId) === sid) || null;
}

// ── FLAG IMAGES ───────────────────────────────────────────────────────────

const FLAG_CODES = {
  'México':'mx','Sudáfrica':'za','Corea del Sur':'kr','Rep. Checa':'cz','República Checa':'cz','Chequia':'cz',
  'Canadá':'ca','Bosnia y Herz.':'ba','Bosnia y Herzegovina':'ba','Qatar':'qa','Catar':'qa','Suiza':'ch',
  'Brasil':'br','Marruecos':'ma','Haití':'ht','Escocia':'gb-sct',
  'Estados Unidos':'us','EE. UU.':'us','Paraguay':'py','Australia':'au','Turquía':'tr',
  'Alemania':'de','Curazao':'cw','Ecuador':'ec','Costa de Marfil':'ci',
  'Países Bajos':'nl','Japón':'jp','Suecia':'se','Túnez':'tn',
  'Bélgica':'be','Egipto':'eg','Irán':'ir','Nueva Zelanda':'nz',
  'España':'es','Cabo Verde':'cv','Arabia Saudita':'sa','Arabia Saudí':'sa','Uruguay':'uy',
  'Francia':'fr','Senegal':'sn','Irak':'iq','Noruega':'no',
  'Argentina':'ar','Argelia':'dz','Austria':'at','Jordania':'jo',
  'Portugal':'pt','RD Congo':'cd','Uzbekistán':'uz','Colombia':'co',
  'Inglaterra':'gb-eng','Croacia':'hr','Ghana':'gh','Panamá':'pa',
};

function flagImg(name, size = 26) {
  const code = FLAG_CODES[name] || 'un';
  return `<img class="mc-flag-img" src="https://flagcdn.com/w40/${code}.png" alt="${name}" onerror="this.src='https://flagcdn.com/w40/un.png'" style="width:${size}px;height:${Math.round(size*0.67)}px">`;
}

// ── SCORE / STATUS HELPERS ────────────────────────────────────────────────

function scoreHTML(match) {
  if (!match) return '';
  if (match.status === 'live') {
    const sc = match.score;
    const scoreStr = sc ? `${sc.local} - ${sc.visita}` : '- -';
    return `<span class="mc-score live"><span class="live-dot"></span>${scoreStr}</span>`;
  }
  if (match.status === 'finished' && match.score) {
    return `<span class="mc-score finished">${match.score.local} - ${match.score.visita}</span>`;
  }
  if (match.status === 'finished') {
    return `<span class="mc-score finished">FT</span>`;
  }
  return `<span class="mc-date">${match.fecha}</span>`;
}

function cardClass(match) {
  if (!match) return '';
  if (match.status === 'live')     return ' card-live';
  if (match.status === 'finished') return ' card-done';
  return '';
}


// ── FIXTURE POR FECHA ─────────────────────────────────────────────────────

const DIAS_ES = { 0:'Dom', 1:'Lun', 2:'Mar', 3:'Mié', 4:'Jue', 5:'Vie', 6:'Sáb' };
const MESES_IDX = { 'Ene':0,'Feb':1,'Mar':2,'Abr':3,'May':4,'Jun':5,'Jul':6,'Ago':7,'Sep':8,'Oct':9,'Nov':10,'Dic':11 };

// Ordena los partidos por startTime o por fecha+hora
function sortFixture(fixture) {
  return [...fixture].sort((a, b) => {
    // Ordenar por fecha local ARG — NO convertir a UTC
    // Comparar día del mes primero, luego hora
    const toKey = m => {
      const [day] = m.fecha.split(' ');
      const [h, min] = (m.hora || '12:00').split(':');
      // Hora 00:xx y 01:xx son madrugada → pertenecen al día de la fecha
      // Las dejamos como están porque ya tienen la fecha correcta asignada
      return +day * 10000 + +h * 100 + +min;
    };
    return toKey(a) - toKey(b);
  });
}

// Agrupar por "fecha" para separadores de día
function groupByDate(fixture) {
  const groups = {};
  fixture.forEach(m => {
    const key = m.fecha;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  return groups;
}

// Fecha label estilo "Jue 11/06"
function dateLabel(fechaStr) {
  const [day, mon] = fechaStr.split(' ');
  const monIdx = MESES_IDX[mon] ?? 5;
  const d = new Date(2026, monIdx, +day);
  const diaSem = DIAS_ES[d.getDay()];
  const mm = String(monIdx + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${diaSem} ${dd}/${mm}`;
}

// Detectar "fecha" del torneo (1, 2, 3) por rango de días
function getFechaNum(fechaStr) {
  const [day] = fechaStr.split(' ');
  const d = +day;
  if (d <= 17) return 1;
  if (d <= 23) return 2;
  return 3;
}

let currentFechaView = 1; // 1, 2 o 3

function buildFixturePanel() {
  const fixture = sortFixture(getFixture());
  const container = document.getElementById('fixturePanel');
  const updatedAt = FIXTURE_DATA?.meta?.updatedAt
    ? new Date(FIXTURE_DATA.meta.updatedAt).toLocaleString('es-AR', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
    : null;

  const liveCount     = fixture.filter(m => m.status === 'live').length;
  const finishedCount = fixture.filter(m => m.status === 'finished').length;

  // Detectar si hay partidos en vivo → mostrar esa fecha
  if (liveCount > 0) {
    const liveMatch = fixture.find(m => m.status === 'live');
    if (liveMatch) currentFechaView = getFechaNum(liveMatch.fecha);
  }

  // Filtrar por fecha actual
  const fechaFixture = fixture.filter(m => getFechaNum(m.fecha) === currentFechaView);
  const byDate = groupByDate(fechaFixture);
  const allFechas = [1, 2, 3];

  let statusBar = '';
  if (liveCount > 0) {
    statusBar = `<div class="fixture-status-bar live-bar"><span class="live-dot"></span>${liveCount} partido${liveCount>1?'s':''} en vivo</div>`;
  }

  // Navegación de fechas
  const nav = `<div class="fecha-nav">
    <button class="fecha-nav-btn" onclick="changeFecha(-1)" ${currentFechaView===1?'disabled':''}>&#8249;</button>
    <span class="fecha-nav-label">FECHA ${currentFechaView}</span>
    <button class="fecha-nav-btn" onclick="changeFecha(1)" ${currentFechaView===3?'disabled':''}>&#8250;</button>
  </div>`;

  let html = nav + statusBar;

  Object.keys(byDate).forEach(fechaKey => {
    const matches = byDate[fechaKey];
    html += `<div class="dia-label">${dateLabel(fechaKey)}</div>`;

    matches.forEach((m, i) => {
      const cardId = `fc-${m.grupo}-${fechaKey.replace(' ','-')}-${i}`;
      const cls    = m.status === 'live' ? ' card-live' : m.status === 'finished' ? ' card-done' : '';

      // Centro: score o guión
      let centro = '';
      if (m.status === 'live' && m.score) {
        centro = `<div class="fc-score live-score"><span class="live-dot"></span>${m.score.local} - ${m.score.visita}</div>`;
      } else if (m.status === 'finished' && m.score) {
        centro = `<div class="fc-score done-score">${m.score.local} - ${m.score.visita}</div>`;
      } else {
        centro = `<div class="fc-score upcoming-score">-</div>`;
      }

      html += `<<div class="fc-row${cls}" id="${cardId}"
        data-t1="${encodeURIComponent(m.local)}" data-t2="${encodeURIComponent(m.visita)}">
        <div class="fc-team local">${flagImg(m.local, 24)}<span class="fc-name">${m.local}</span></div>
        <span class="fc-vs">${m.status==='live'&&m.score ? `<span class='live-dot'></span>${m.score.local}-${m.score.visita}` : m.status==='finished'&&m.score ? `${m.score.local} - ${m.score.visita}` : '-'}</span>
        <div class="fc-team visit"><span class="fc-name">${m.visita}</span>${flagImg(m.visita, 24)}</div>
      </div>`
    });
  });

  container.innerHTML = html;
  // Event delegation — handles special chars in team names safely
  container.querySelectorAll('.fc-row').forEach(row => {
    row.addEventListener('click', () => {
      const t1 = row.dataset.t1;
      const t2 = row.dataset.t2;
      if (t1 && t2) window.location.href = 'comparador-jugadores.html?t1=' + t1 + '&t2=' + t2;
    });
  });
}

function changeFecha(dir) {
  currentFechaView = Math.max(1, Math.min(3, currentFechaView + dir));
  buildFixturePanel();
}


function findTeamByName(name) {
  if (DATA?.teams) return Object.values(DATA.teams).find(t => t.name === name) || null;
  return FALLBACK_TEAMS.find(t => t.name === name) || null;
}

function selectFixture(n1, n2, grupo, fecha, cardId) {
  // Navegar directamente al comparador de jugadores
  const url = `comparador-jugadores.html?t1=${encodeURIComponent(n1)}&t2=${encodeURIComponent(n2)}`;
  window.location.href = url;
}

// ── MODE SWITCH ───────────────────────────────────────────────────────────

function setMode(mode) {
  currentMode = mode;
  document.getElementById("modeFixture").classList.toggle("active", mode === "fixture");
  document.getElementById("modeCustom").classList.toggle("active",  mode === "custom");
  document.getElementById("fixtureSection").classList.toggle("hidden", mode !== "fixture");
  document.getElementById("customSection").classList.toggle("hidden",  mode !== "custom");
  document.getElementById("kickBtn").textContent = "⚽ Comparar selecciones";
  selected = null;
  document.querySelectorAll(".match-card").forEach(c => c.classList.remove("selected"));
  document.getElementById("matchArea").innerHTML = "";
}

// ── LOAD MATCH ────────────────────────────────────────────────────────────

async function loadMatch() {
  let t1, t2, grupoLabel = "", fechaLabel = "";

  if (currentMode === "fixture") {
    if (!selected) { showErr("Seleccioná un partido del fixture primero."); return; }
    ({ t1, t2, grupo: grupoLabel, fecha: fechaLabel } = selected);
    if (!t1 || !t2) {
      // Try by name if no team object found
      const url = `comparador-jugadores.html?t1=${encodeURIComponent(selected.n1)}&t2=${encodeURIComponent(selected.n2)}&grupo=${selected.grupo}`;
      window.location.href = url;
      return;
    }
    // Navigate to jugadores comparison
    const url = `comparador-jugadores.html?t1=${encodeURIComponent(t1.name)}&t2=${encodeURIComponent(t2.name)}&grupo=${grupoLabel}`;
    window.location.href = url;
    return;
  } else {
    const id1 = parseInt(document.getElementById("sel1").value);
    const id2 = parseInt(document.getElementById("sel2").value);
    if (!id1 || !id2) { showErr("Elegí las dos selecciones."); return; }
    if (id1 === id2)  { showErr("Elegí selecciones distintas."); return; }
    t1 = getTeamById(id1);
    t2 = getTeamById(id2);
    if (t1 && t2) {
      const url = `comparador-jugadores.html?t1=${encodeURIComponent(t1.name)}&t2=${encodeURIComponent(t2.name)}`;
      window.location.href = url;
      return;
    }
    fechaLabel = new Date().toLocaleDateString("es-AR", { day:"numeric", month:"short" });
  }

  const btn = document.getElementById("kickBtn");
  btn.disabled = true;
  document.getElementById("matchArea").innerHTML = `
    <div class="loading-state">
      <div class="loading-ring"></div>
      <div class="loading-label">Cargando · ${t1.name} vs ${t2.name}</div>
    </div>`;

  try {
    let roster1 = t1.players || [];
    let roster2 = t2.players || [];
    let logo1   = t1.logoUrl || null;
    let logo2   = t2.logoUrl || null;

    // Si no hay roster en el JSON, llamar a ESPN en vivo
    if (!roster1.length || !roster2.length) {
      const [r1, r2, i1, i2] = await Promise.all([
        espnFetch(`${t1.league}/teams/${t1.espnId}/roster`),
        espnFetch(`${t2.league}/teams/${t2.espnId}/roster`),
        espnFetch(`${t1.league}/teams/${t1.espnId}`),
        espnFetch(`${t2.league}/teams/${t2.espnId}`),
      ]);
      roster1 = parseRosterLive(r1);
      roster2 = parseRosterLive(r2);
      logo1   = i1?.team?.logos?.[0]?.href || null;
      logo2   = i2?.team?.logos?.[0]?.href || null;
    } else {
      roster1 = normalizeCachedRoster(roster1);
      roster2 = normalizeCachedRoster(roster2);
    }

    // Score en vivo del partido si existe en el fixture
    const liveMatch = findLiveMatch(t1.name, t2.name);

    renderMatch(t1, t2, roster1, roster2, logo1, logo2, grupoLabel, fechaLabel, liveMatch);
  } catch (e) {
    showErr("Error al cargar datos. Verificá tu conexión.");
  }
  btn.disabled = false;
}

// Busca el partido en el fixture para score en vivo
function findLiveMatch(n1, n2) {
  const fix = getFixture();
  return fix.find(m =>
    (m.local === n1 && m.visita === n2) ||
    (m.local === n2 && m.visita === n1)
  ) || null;
}

// ── DATA HELPERS ──────────────────────────────────────────────────────────

async function espnFetch(path) {
  const r = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/" + path);
  if (!r.ok) throw new Error("ESPN " + r.status);
  return r.json();
}

function parseRosterLive(data) {
  const out = [];
  (data.athletes || []).forEach(g => {
    (g.items || [g]).forEach(p => {
      if (!p?.fullName) return;
      const ab  = (p.position?.abbreviation || "MID").toUpperCase();
      const pos = POS_MAP[ab] !== undefined ? POS_MAP[ab] : 2;
      out.push({
        name:     p.fullName,
        short:    p.shortName || p.displayName || p.fullName,
        number:   p.jersey   || null,
        age:      p.age      || null,
        posGroup: POS_TAGS[pos],
        posShort: POS_SHORT[pos],
        club:     p.team?.displayName || "—",
        photo:    p.headshot?.href    || null,
      });
    });
  });
  const ORDER = { GK:0, DEF:1, MID:2, FWD:3 };
  return out.sort((a,b) => (ORDER[a.posGroup]??4) - (ORDER[b.posGroup]??4));
}

function normalizeCachedRoster(players) {
  const ORDER = { GK:0, DEF:1, MID:2, FWD:3 };
  return players.map(p => ({
    name:     p.name,
    short:    p.name,
    number:   p.number || null,
    age:      p.age    || null,
    posGroup: p.posGroup || "MID",
    posShort: p.posShort || POS_SHORT[POS_MAP[p.posGroup]||2],
    club:     p.club   || "—",
    photo:    p.photo  || null,
  })).sort((a,b) => (ORDER[a.posGroup]??4) - (ORDER[b.posGroup]??4));
}

function grpByPos(roster) {
  const g = { GK:[], DEF:[], MID:[], FWD:[] };
  roster.forEach(p => { if (g[p.posGroup]) g[p.posGroup].push(p); });
  return g;
}

// ── RENDER ────────────────────────────────────────────────────────────────

function renderMatch(t1, t2, roster1, roster2, logo1, logo2, grupoLabel, fechaLabel, liveMatch) {
  const sc = roster1.length > roster2.length ? "win" : roster1.length < roster2.length ? "lose" : "draw";

  const pitch  = buildPitch(roster1, roster2, t1, t2);
  const h2h    = buildH2H(roster1, roster2, t1, t2);
  const roster = buildRoster(roster1, roster2, t1, t2, logo1, logo2);

  // Score en vivo block
  let scoreLive = '';
  if (liveMatch?.status === 'live' && liveMatch.score) {
    scoreLive = `<div class="live-score-box">
      <span class="live-dot"></span>
      <span class="live-label">EN VIVO</span>
      <span class="live-score-num">${liveMatch.score.local} - ${liveMatch.score.visita}</span>
    </div>`;
  } else if (liveMatch?.status === 'finished' && liveMatch.score) {
    scoreLive = `<div class="live-score-box finished-box">
      <span class="live-label">Terminado</span>
      <span class="live-score-num">${liveMatch.score.local} - ${liveMatch.score.visita}</span>
    </div>`;
  }

  document.getElementById("matchArea").innerHTML = `
    <div class="match-wrap">
      <button class="back-btn" type="button" onclick="backToSetup()">← Volver</button>
      ${scoreLive}
      <div class="scoreboard">
        <div class="sb-team">
          ${logo1 ? `<img class="sb-logo" src="${logo1}" alt="">` : `<div class="sb-logo-fb">${flagImg(t1.name, 44)}</div>`}
          <span class="sb-name">${t1.name}</span>
          <span class="sb-count ${sc}">${roster1.length} jugadores</span>
        </div>
        <div class="sb-center">
          <span class="sb-vs">VS</span>
          <span class="sb-badge">${grupoLabel ? grupoLabel+"<br>" : ""}${fechaLabel}</span>
        </div>
        <div class="sb-team">
          ${logo2 ? `<img class="sb-logo" src="${logo2}" alt="">` : `<div class="sb-logo-fb">${flagImg(t2.name, 44)}</div>`}
          <span class="sb-name">${t2.name}</span>
          <span class="sb-count ${sc==="win"?"lose":sc==="lose"?"win":"draw"}">${roster2.length} jugadores</span>
        </div>
      </div>
      <div class="tab-row">
        <button class="tab-btn active" type="button" onclick="switchTab('pitch',this)">⚽ Campo</button>
        <button class="tab-btn"        type="button" onclick="switchTab('h2h',  this)">⚔️ Duelo</button>
        <button class="tab-btn"        type="button" onclick="switchTab('roster',this)">👥 Plantilla</button>
      </div>
      <div id="tab-pitch"  class="tab-panel active">${pitch}</div>
      <div id="tab-h2h"   class="tab-panel"><div class="h2h-rows">${h2h}</div></div>
      <div id="tab-roster" class="tab-panel">${roster}</div>
    </div>`;
}

function switchTab(name, el) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("tab-" + name).classList.add("active");
}

function backToSetup() {
  document.getElementById("matchArea").innerHTML = "";
  document.getElementById("kickBtn").textContent  = "⚽ Comparar selecciones";
  selected = null;
  document.querySelectorAll(".match-card").forEach(c => c.classList.remove("selected"));
}

function showErr(msg) {
  document.getElementById("matchArea").innerHTML = `<div class="error-state">${msg}</div>`;
}

// ── BUILD PITCH ───────────────────────────────────────────────────────────

function buildPitch(r1, r2, t1, t2) {
  const g1 = grpByPos(r1), g2 = grpByPos(r2);
  function line(players, isRival) {
    if (!players.length) return "";
    return `<div class="pitch-line">${
      players.slice(0, 5).map(p => {
        const initial = (p.short || p.name || "?")[0] || "?";
        return `<div class="pslot${isRival ? " rival" : ""}">
          <div class="pslot-img">${p.photo
            ? `<img src="${p.photo}" alt="" onerror="this.parentElement.textContent='${initial}'">`
            : initial}</div>
          <span class="pslot-name">${(p.short||p.name).split(" ").pop().slice(0,9)}</span>
          <span class="pslot-tag">${p.posShort}</span>
        </div>`;
      }).join("")
    }</div>`;
  }
  return `<div class="pitch-frame"><div class="pitch-inner">
    <div class="pitch-half">${["FWD","MID","DEF","GK"].map(pos=>line(g2[pos],true)).join("")}</div>
    <div class="pitch-divider"><span>${t2.name} VS ${t1.name}</span></div>
    <div class="pitch-half">${["GK","DEF","MID","FWD"].map(pos=>line(g1[pos],false)).join("")}</div>
  </div></div>`;
}

// ── BUILD H2H ─────────────────────────────────────────────────────────────

function buildH2H(r1, r2, t1, t2) {
  const g1 = grpByPos(r1), g2 = grpByPos(r2);
  return ["GK","DEF","MID","FWD"].map((posKey, posIdx) => {
    const a = g1[posKey]||[], b = g2[posKey]||[];
    if (!a.length && !b.length) return "";
    const max = Math.max(a.length, b.length, 1);
    const p1  = Math.round(a.length/max*100), p2 = Math.round(b.length/max*100);
    const rows = Array.from({length:Math.min(Math.max(a.length,b.length),4)},(_,i)=>{
      const pa=a[i], pb=b[i];
      return `<div class="h2h-matchup">
        <div class="h2h-pl">${pa?`<div class="h2h-pl-name">${pa.short||pa.name}</div><div class="h2h-pl-club">${pa.club}</div>`:`<span style="color:var(--muted);font-size:10px">—</span>`}</div>
        <span class="h2h-mid">VS</span>
        <div class="h2h-pl right">${pb?`<div class="h2h-pl-name">${pb.short||pb.name}</div><div class="h2h-pl-club">${pb.club}</div>`:`<span style="color:var(--muted);font-size:10px">—</span>`}</div>
      </div>`;
    }).join("");
    return `<div class="h2h-pos">
      <div class="h2h-head"><span class="h2h-title">${POS_LABELS[posIdx]}</span><span class="h2h-counts">${a.length} vs ${b.length}</span></div>
      <div class="h2h-bar-row">
        <span class="h2h-bar-n">${flagImg(t1.name,16)}</span>
        <div class="h2h-bar-outer"><div class="h2h-bar-l" style="width:${p1}%"></div></div>
        <div class="h2h-bar-outer"><div class="h2h-bar-r" style="width:${p2}%"></div></div>
        <span class="h2h-bar-n">${flagImg(t2.name,16)}</span>
      </div>${rows}
    </div>`;
  }).join("");
}

// ── BUILD ROSTER ──────────────────────────────────────────────────────────

function buildRoster(r1, r2, t1, t2, logo1, logo2) {
  function col(roster, team, logo) {
    const g = grpByPos(roster);
    return `<div class="roster-col">
      <div class="rc-head">
        ${logo?`<img class="rc-logo" src="${logo}" alt="">`:`<div class="rc-logo-fb">${flagImg(team.name,22)}</div>`}
        <span class="rc-name">${team.name}</span>
        <span class="rc-total">${roster.length}</span>
      </div>
      <div class="pos-section">${["GK","DEF","MID","FWD"].map((posKey,posIdx)=>{
        const players=g[posKey];
        if(!players.length) return "";
        return `<div class="pos-head">${POS_LABELS[posIdx]}</div>`+
          players.map(p=>`<div class="prow">
            <span class="prow-num">${p.number||""}</span>
            ${p.photo?`<img class="prow-img" src="${p.photo}" alt="" onerror="this.style.background='rgba(255,255,255,.15)'">`:`<div class="prow-img"></div>`}
            <div class="prow-info"><div class="prow-name">${p.short||p.name}</div><div class="prow-club">${p.club||"—"}</div></div>
            ${p.age?`<span class="prow-age">${p.age}a</span>`:""}
            <span class="ptag ptag-${posKey}">${POS_SHORT[posIdx]}</span>
          </div>`).join("");
      }).join("")}</div>
    </div>`;
  }
  return `<div class="roster-cols">${col(r1,t1,logo1)}${col(r2,t2,logo2)}</div>`;
}

// ── FALLBACK DATA ─────────────────────────────────────────────────────────

const FALLBACK_TEAMS = [
  // Grupo A
  { name:"México",          espnId:20,  league:"fifa.worldq.concacaf", grupo:"A" },
  { name:"Sudáfrica",       espnId:85,  league:"fifa.worldq.caf",      grupo:"A" },
  { name:"Corea del Sur",   espnId:181, league:"fifa.worldq.afc",      grupo:"A" },
  { name:"Rep. Checa",      espnId:450, league:"uefa.nations",         grupo:"A" },
  // Grupo B
  { name:"Canadá",          espnId:571, league:"fifa.worldq.concacaf", grupo:"B" },
  { name:"Bosnia y Herz.",  espnId:452, league:"uefa.nations",         grupo:"B" },
  { name:"Qatar",           espnId:196, league:"fifa.worldq.afc",      grupo:"B" },
  { name:"Suiza",           espnId:379, league:"uefa.nations",         grupo:"B" },
  // Grupo C
  { name:"Brasil",          espnId:6,   league:"fifa.worldq.conmebol", grupo:"C" },
  { name:"Marruecos",       espnId:51,  league:"fifa.worldq.caf",      grupo:"C" },
  { name:"Haití",           espnId:531, league:"fifa.worldq.concacaf", grupo:"C" },
  { name:"Escocia",         espnId:269, league:"uefa.nations",         grupo:"C" },
  // Grupo D
  { name:"Estados Unidos",  espnId:18,  league:"fifa.worldq.concacaf", grupo:"D" },
  { name:"Paraguay",        espnId:30,  league:"fifa.worldq.conmebol", grupo:"D" },
  { name:"Australia",       espnId:201, league:"fifa.worldq.afc",      grupo:"D" },
  { name:"Turquía",         espnId:465, league:"uefa.nations",         grupo:"D" },
  // Grupo E
  { name:"Alemania",        espnId:3,   league:"uefa.nations",         grupo:"E" },
  { name:"Curazao",         espnId:557, league:"fifa.worldq.concacaf", grupo:"E" },
  { name:"Ecuador",         espnId:13,  league:"fifa.worldq.conmebol", grupo:"E" },
  { name:"Costa de Marfil", espnId:54,  league:"fifa.worldq.caf",      grupo:"E" },
  // Grupo F
  { name:"Países Bajos",    espnId:167, league:"uefa.nations",         grupo:"F" },
  { name:"Japón",           espnId:175, league:"fifa.worldq.afc",      grupo:"F" },
  { name:"Suecia",          espnId:466, league:"uefa.nations",         grupo:"F" },
  { name:"Túnez",           espnId:87,  league:"fifa.worldq.caf",      grupo:"F" },
  // Grupo G
  { name:"Bélgica",         espnId:1,   league:"uefa.nations",         grupo:"G" },
  { name:"Egipto",          espnId:48,  league:"fifa.worldq.caf",      grupo:"G" },
  { name:"Irán",            espnId:170, league:"fifa.worldq.afc",      grupo:"G" },
  { name:"Nueva Zelanda",   espnId:202, league:"fifa.worldq.afc",      grupo:"G" },
  // Grupo H
  { name:"España",          espnId:164, league:"uefa.nations",         grupo:"H" },
  { name:"Cabo Verde",      espnId:96,  league:"fifa.worldq.caf",      grupo:"H" },
  { name:"Arabia Saudita",  espnId:173, league:"fifa.worldq.afc",      grupo:"H" },
  { name:"Uruguay",         espnId:47,  league:"fifa.worldq.conmebol", grupo:"H" },
  // Grupo I
  { name:"Francia",         espnId:2,   league:"uefa.nations",         grupo:"I" },
  { name:"Senegal",         espnId:83,  league:"fifa.worldq.caf",      grupo:"I" },
  { name:"Irak",            espnId:171, league:"fifa.worldq.afc",      grupo:"I" },
  { name:"Noruega",         espnId:378, league:"uefa.nations",         grupo:"I" },
  // Grupo J
  { name:"Argentina",       espnId:9,   league:"fifa.worldq.conmebol", grupo:"J" },
  { name:"Argelia",         espnId:46,  league:"fifa.worldq.caf",      grupo:"J" },
  { name:"Austria",         espnId:371, league:"uefa.nations",         grupo:"J" },
  { name:"Jordania",        espnId:172, league:"fifa.worldq.afc",      grupo:"J" },
  // Grupo K
  { name:"Portugal",        espnId:165, league:"uefa.nations",         grupo:"K" },
  { name:"RD Congo",        espnId:49,  league:"fifa.worldq.caf",      grupo:"K" },
  { name:"Uzbekistán",      espnId:192, league:"fifa.worldq.afc",      grupo:"K" },
  { name:"Colombia",        espnId:11,  league:"fifa.worldq.conmebol", grupo:"K" },
  // Grupo L
  { name:"Inglaterra",      espnId:10,  league:"uefa.nations",         grupo:"L" },
  { name:"Croacia",         espnId:44,  league:"uefa.nations",         grupo:"L" },
  { name:"Ghana",           espnId:56,  league:"fifa.worldq.caf",      grupo:"L" },
  { name:"Panamá",          espnId:516, league:"fifa.worldq.concacaf", grupo:"L" },
];

const FALLBACK_FIXTURE = [
  // ══════════════════════════════════════════
  // FECHA 1
  // ══════════════════════════════════════════
  // Jue 11/06
  { grupo:"A", local:"México",           visita:"Sudáfrica",        fecha:"11 Jun", hora:"16:00", status:"upcoming" },
  { grupo:"A", local:"Corea del Sur",    visita:"Rep. Checa",       fecha:"11 Jun", hora:"23:00", status:"upcoming" },
  // Vie 12/06
  { grupo:"B", local:"Canadá",           visita:"Bosnia y Herz.",   fecha:"12 Jun", hora:"16:00", status:"upcoming" },
  { grupo:"D", local:"Estados Unidos",   visita:"Paraguay",         fecha:"12 Jun", hora:"22:00", status:"upcoming" },
  // Sáb 13/06
  { grupo:"B", local:"Qatar",            visita:"Suiza",            fecha:"13 Jun", hora:"16:00", status:"upcoming" },
  { grupo:"C", local:"Brasil",           visita:"Marruecos",        fecha:"13 Jun", hora:"19:00", status:"upcoming" },
  { grupo:"C", local:"Haití",            visita:"Escocia",          fecha:"13 Jun", hora:"22:00", status:"upcoming" },
  // Dom 14/06
  { grupo:"D", local:"Australia",        visita:"Turquía",          fecha:"14 Jun", hora:"01:00", status:"upcoming" },
  { grupo:"E", local:"Alemania",         visita:"Curazao",          fecha:"14 Jun", hora:"14:00", status:"upcoming" },
  { grupo:"F", local:"Países Bajos",     visita:"Japón",            fecha:"14 Jun", hora:"17:00", status:"upcoming" },
  { grupo:"E", local:"Costa de Marfil",  visita:"Ecuador",          fecha:"14 Jun", hora:"20:00", status:"upcoming" },
  { grupo:"F", local:"Suecia",           visita:"Túnez",            fecha:"14 Jun", hora:"23:00", status:"upcoming" },
  // Lun 15/06
  { grupo:"H", local:"España",           visita:"Cabo Verde",       fecha:"15 Jun", hora:"13:00", status:"upcoming" },
  { grupo:"G", local:"Bélgica",          visita:"Egipto",           fecha:"15 Jun", hora:"16:00", status:"upcoming" },
  { grupo:"H", local:"Arabia Saudita",   visita:"Uruguay",          fecha:"15 Jun", hora:"19:00", status:"upcoming" },
  { grupo:"G", local:"Irán",             visita:"Nueva Zelanda",    fecha:"15 Jun", hora:"22:00", status:"upcoming" },
  // Mar 16/06
  { grupo:"I", local:"Francia",          visita:"Senegal",          fecha:"16 Jun", hora:"16:00", status:"upcoming" },
  { grupo:"I", local:"Irak",             visita:"Noruega",          fecha:"16 Jun", hora:"19:00", status:"upcoming" },
  { grupo:"J", local:"Argentina",        visita:"Argelia",          fecha:"16 Jun", hora:"22:00", status:"upcoming" },
  // Mié 17/06
  { grupo:"J", local:"Austria",          visita:"Jordania",         fecha:"17 Jun", hora:"01:00", status:"upcoming" },
  { grupo:"K", local:"Portugal",         visita:"RD Congo",         fecha:"17 Jun", hora:"14:00", status:"upcoming" },
  { grupo:"L", local:"Inglaterra",       visita:"Croacia",          fecha:"17 Jun", hora:"17:00", status:"upcoming" },
  { grupo:"L", local:"Ghana",            visita:"Panamá",           fecha:"17 Jun", hora:"20:00", status:"upcoming" },
  { grupo:"K", local:"Uzbekistán",       visita:"Colombia",         fecha:"17 Jun", hora:"23:00", status:"upcoming" },
  // ══════════════════════════════════════════
  // FECHA 2
  // ══════════════════════════════════════════
  // Jue 18/06
  { grupo:"A", local:"Rep. Checa",       visita:"Sudáfrica",        fecha:"18 Jun", hora:"13:00", status:"upcoming" },
  { grupo:"B", local:"Suiza",            visita:"Bosnia y Herz.",   fecha:"18 Jun", hora:"16:00", status:"upcoming" },
  { grupo:"B", local:"Canadá",           visita:"Qatar",            fecha:"18 Jun", hora:"19:00", status:"upcoming" },
  { grupo:"A", local:"México",           visita:"Corea del Sur",    fecha:"18 Jun", hora:"22:00", status:"upcoming" },
  // Vie 19/06
  { grupo:"D", local:"Estados Unidos",   visita:"Australia",        fecha:"19 Jun", hora:"16:00", status:"upcoming" },
  { grupo:"C", local:"Escocia",          visita:"Marruecos",        fecha:"19 Jun", hora:"19:00", status:"upcoming" },
  { grupo:"C", local:"Brasil",           visita:"Haití",            fecha:"19 Jun", hora:"21:30", status:"upcoming" },
  // Sáb 20/06
  { grupo:"D", local:"Turquía",          visita:"Paraguay",         fecha:"20 Jun", hora:"00:00", status:"upcoming" },
  { grupo:"F", local:"Países Bajos",     visita:"Suecia",           fecha:"20 Jun", hora:"14:00", status:"upcoming" },
  { grupo:"E", local:"Alemania",         visita:"Costa de Marfil",  fecha:"20 Jun", hora:"17:00", status:"upcoming" },
  { grupo:"E", local:"Ecuador",          visita:"Curazao",          fecha:"20 Jun", hora:"21:00", status:"upcoming" },
  // Dom 21/06
  { grupo:"F", local:"Túnez",            visita:"Japón",            fecha:"21 Jun", hora:"01:00", status:"upcoming" },
  { grupo:"H", local:"España",           visita:"Arabia Saudita",   fecha:"21 Jun", hora:"13:00", status:"upcoming" },
  { grupo:"G", local:"Bélgica",          visita:"Irán",             fecha:"21 Jun", hora:"16:00", status:"upcoming" },
  { grupo:"H", local:"Uruguay",          visita:"Cabo Verde",       fecha:"21 Jun", hora:"19:00", status:"upcoming" },
  { grupo:"G", local:"Nueva Zelanda",    visita:"Egipto",           fecha:"21 Jun", hora:"22:00", status:"upcoming" },
  // Lun 22/06
  { grupo:"J", local:"Argentina",        visita:"Austria",          fecha:"22 Jun", hora:"14:00", status:"upcoming" },
  { grupo:"I", local:"Francia",          visita:"Irak",             fecha:"22 Jun", hora:"18:00", status:"upcoming" },
  { grupo:"I", local:"Noruega",          visita:"Senegal",          fecha:"22 Jun", hora:"21:00", status:"upcoming" },
  // Mar 23/06
  { grupo:"J", local:"Jordania",         visita:"Argelia",          fecha:"23 Jun", hora:"00:00", status:"upcoming" },
  { grupo:"K", local:"Portugal",         visita:"Uzbekistán",       fecha:"23 Jun", hora:"14:00", status:"upcoming" },
  { grupo:"L", local:"Inglaterra",       visita:"Ghana",            fecha:"23 Jun", hora:"17:00", status:"upcoming" },
  { grupo:"L", local:"Panamá",           visita:"Croacia",          fecha:"23 Jun", hora:"20:00", status:"upcoming" },
  { grupo:"K", local:"Colombia",         visita:"RD Congo",         fecha:"23 Jun", hora:"23:00", status:"upcoming" },
  // ══════════════════════════════════════════
  // FECHA 3
  // ══════════════════════════════════════════
  // Mié 24/06
  { grupo:"B", local:"Suiza",            visita:"Canadá",           fecha:"24 Jun", hora:"16:00", status:"upcoming" },
  { grupo:"B", local:"Bosnia y Herz.",   visita:"Qatar",            fecha:"24 Jun", hora:"16:00", status:"upcoming" },
  { grupo:"C", local:"Escocia",          visita:"Brasil",           fecha:"24 Jun", hora:"19:00", status:"upcoming" },
  { grupo:"C", local:"Marruecos",        visita:"Haití",            fecha:"24 Jun", hora:"19:00", status:"upcoming" },
  { grupo:"A", local:"Sudáfrica",        visita:"Corea del Sur",    fecha:"24 Jun", hora:"22:00", status:"upcoming" },
  { grupo:"A", local:"Rep. Checa",       visita:"México",           fecha:"24 Jun", hora:"22:00", status:"upcoming" },
  // Jue 25/06
  { grupo:"E", local:"Ecuador",          visita:"Alemania",         fecha:"25 Jun", hora:"17:00", status:"upcoming" },
  { grupo:"E", local:"Curazao",          visita:"Costa de Marfil",  fecha:"25 Jun", hora:"17:00", status:"upcoming" },
  { grupo:"F", local:"Túnez",            visita:"Países Bajos",     fecha:"25 Jun", hora:"20:00", status:"upcoming" },
  { grupo:"F", local:"Japón",            visita:"Suecia",           fecha:"25 Jun", hora:"20:00", status:"upcoming" },
  { grupo:"D", local:"Paraguay",         visita:"Australia",        fecha:"25 Jun", hora:"23:00", status:"upcoming" },
  { grupo:"D", local:"Turquía",          visita:"Estados Unidos",   fecha:"25 Jun", hora:"23:00", status:"upcoming" },
  // Vie 26/06
  { grupo:"I", local:"Noruega",          visita:"Francia",          fecha:"26 Jun", hora:"16:00", status:"upcoming" },
  { grupo:"I", local:"Senegal",          visita:"Irak",             fecha:"26 Jun", hora:"16:00", status:"upcoming" },
  { grupo:"H", local:"Uruguay",          visita:"España",           fecha:"26 Jun", hora:"21:00", status:"upcoming" },
  { grupo:"H", local:"Cabo Verde",       visita:"Arabia Saudita",   fecha:"26 Jun", hora:"21:00", status:"upcoming" },
  // Sáb 27/06
  { grupo:"G", local:"Nueva Zelanda",    visita:"Irán",             fecha:"27 Jun", hora:"00:00", status:"upcoming" },
  { grupo:"G", local:"Egipto",           visita:"Bélgica",          fecha:"27 Jun", hora:"00:00", status:"upcoming" },
  { grupo:"L", local:"Croacia",          visita:"Ghana",            fecha:"27 Jun", hora:"18:00", status:"upcoming" },
  { grupo:"L", local:"Panamá",           visita:"Inglaterra",       fecha:"27 Jun", hora:"18:00", status:"upcoming" },
  { grupo:"K", local:"Colombia",         visita:"Portugal",         fecha:"27 Jun", hora:"20:30", status:"upcoming" },
  { grupo:"K", local:"RD Congo",         visita:"Uzbekistán",       fecha:"27 Jun", hora:"20:30", status:"upcoming" },
  { grupo:"J", local:"Argelia",          visita:"Austria",          fecha:"27 Jun", hora:"23:00", status:"upcoming" },
  { grupo:"J", local:"Jordania",         visita:"Argentina",        fecha:"27 Jun", hora:"23:00", status:"upcoming" },
];
// ── START ─────────────────────────────────────────────────────────────────
init();
