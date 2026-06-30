/*
  comparador-jugadores.js
  - Duel paso a paso por posición: GK → DEF → MID → FWD
  - Click en card abre selector de jugador para esa posición/lado
  - Plantilla limitada a 26 jugadores por selección (los de más partidos)
*/

const DATA_URL = '../data/jugadores-selecciones.json';

let DATA = null, team1 = null, team2 = null;
let formation = '4-3-3';
const FORMATIONS = { '4-3-3':{DEF:4,MID:3,FWD:3}, '4-4-2':{DEF:4,MID:4,FWD:2}, '3-5-2':{DEF:3,MID:5,FWD:2} };
const POS_ORDER = {GK:0,DEF:1,MID:2,FWD:3};

// Índice de duelo actual
let _duels = [], _duelIdx = 0;
// Jugador seleccionado por posición: { 'left-GK-0': playerObj, 'right-DEF-2': playerObj, ... }
let _picks = {};

const FLAG_CODES = {
  'Argentina':'ar','Brasil':'br','Francia':'fr','España':'es','Alemania':'de',
  'Inglaterra':'gb-eng','Portugal':'pt','Uruguay':'uy','Colombia':'co','México':'mx',
  'Países Bajos':'nl','Bélgica':'be','Croacia':'hr','Marruecos':'ma','Japón':'jp',
  'Estados Unidos':'us','Ecuador':'ec','Suiza':'ch','Australia':'au','Senegal':'sn',
  'Italia':'it','Argelia':'dz','Austria':'at','Noruega':'no','Escocia':'gb-sct',
  'Suecia':'se','Túnez':'tn','Costa de Marfil':'ci','Ghana':'gh',
  'Corea del Sur':'kr','Arabia Saudita':'sa','Irán':'ir','Irak':'iq',
  'Jordania':'jo','RD Congo':'cd','Uzbekistán':'uz','Panamá':'pa',
  'Canadá':'ca','Paraguay':'py','Bosnia y Herz.':'ba','Haití':'ht',
  'Cabo Verde':'cv','Curazao':'cw','Nueva Zelanda':'nz','Qatar':'qa',
};

// ── INIT ──────────────────────────────────────────────────────────────────

async function init() {
  const params = new URLSearchParams(location.search);
  const t1n = params.get('t1'), t2n = params.get('t2');
  if (t1n && t2n) {
    document.getElementById('matchLabel').textContent = `${t1n} vs ${t2n}`;
    document.title = `${t1n} vs ${t2n} | Partidos.Hoy`;
  }
  await loadData();
  if (!DATA) {
    document.getElementById('loadingState').innerHTML =
      `<p style="color:rgba(232,83,58,.9);font-size:13px">No se pudo cargar <code>data/jugadores-selecciones.json</code></p>`;
    return;
  }
  team1 = resolveTeam(t1n);
  team2 = resolveTeam(t2n);
  if (!team1 || !team2) {
    document.getElementById('loadingState').innerHTML =
      `<p style="color:rgba(232,83,58,.9);font-size:13px">Selecciones no encontradas: ${t1n} / ${t2n}</p>`;
    return;
  }
  // Warn if no players found for a team
  if (!team1.players?.length) console.warn('Sin jugadores para', team1.name, '— el JSON no tiene datos de esta selección');
  if (!team2.players?.length) console.warn('Sin jugadores para', team2.name, '— el JSON no tiene datos de esta selección');
  // Limitar a 26 jugadores por equipo (los más activos por posición)
  team1 = { ...team1, players: top26(team1.players) };
  team2 = { ...team2, players: top26(team2.players) };

  setupHeader();
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('comparator').style.display = 'block';
  document.getElementById('tabPlantilla1').textContent = team1.name;
  document.getElementById('tabPlantilla2').textContent = team2.name;
  buildDuelList();
  renderDuelStep();
  renderPlantilla('plantilla1Wrap', team1);
  renderPlantilla('plantilla2Wrap', team2);
}

// Toma los 26 mejores jugadores: 3 GK, 8 DEF, 8 MID, 7 FWD (o lo que haya)
function top26(players) {
  const byPos = {GK:[],DEF:[],MID:[],FWD:[]};
  players.forEach(p => { if (byPos[p.pos]) byPos[p.pos].push(p); });
  Object.values(byPos).forEach(arr => arr.sort((a,b) => (b.stats?.APP||0)-(a.stats?.APP||0)));
  return [
    ...byPos.GK.slice(0,3),
    ...byPos.DEF.slice(0,8),
    ...byPos.MID.slice(0,8),
    ...byPos.FWD.slice(0,7),
  ];
}

async function loadData() {
  try {
    const r = await fetch(`${DATA_URL}?v=${Date.now()}`);
    if (r.ok) DATA = await r.json();
  } catch {}
}

function resolveTeam(name) {
  if (!name) return null;
  if (DATA?.teams?.[name]) return DATA.teams[name];
  // Case-insensitive match
  const k = Object.keys(DATA?.teams||{}).find(k => k.toLowerCase() === name.toLowerCase());
  if (k) return DATA.teams[k];
  // Not found — return empty placeholder so the page still loads
  return { name, espnId: null, players: [], confederation: '?' };
}

// ── HEADER ────────────────────────────────────────────────────────────────

function setupHeader() {
  document.getElementById('teamName1').textContent = team1.name;
  document.getElementById('teamName2').textContent = team2.name;
  const fc = n => FLAG_CODES[n] || 'un';
  const l1 = document.getElementById('logo1'), l2 = document.getElementById('logo2');
  l1.src = `https://a.espncdn.com/i/teamlogos/soccer/500/${team1.espnId}.png`;
  l1.onerror = () => l1.src = `https://flagcdn.com/w80/${fc(team1.name)}.png`;
  l2.src = `https://a.espncdn.com/i/teamlogos/soccer/500/${team2.espnId}.png`;
  l2.onerror = () => l2.src = `https://flagcdn.com/w80/${fc(team2.name)}.png`;
}

// ── TABS ─────────────────────────────────────────────────────────────────

function switchTab(name, el) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

// ── FORMATION ────────────────────────────────────────────────────────────

function setFormation(f, el) {
  formation = f;
  document.querySelectorAll('.form-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  _picks = {};
  buildDuelList();
  renderDuelStep();
}

// ── BUILD DUELS ───────────────────────────────────────────────────────────

function getLineupPlayers(team) {
  const f = FORMATIONS[formation];
  const byPos = {GK:[],DEF:[],MID:[],FWD:[]};
  team.players.forEach(p => { if (byPos[p.pos]) byPos[p.pos].push(p); });
  Object.values(byPos).forEach(arr => arr.sort((a,b) => (b.stats?.APP||0)-(a.stats?.APP||0)));
  return {
    GK:  byPos.GK.slice(0, 1),
    DEF: byPos.DEF.slice(0, f.DEF),
    MID: byPos.MID.slice(0, f.MID),
    FWD: byPos.FWD.slice(0, f.FWD),
    // All available per position (for selector)
    _all: {
      GK:  byPos.GK,
      DEF: byPos.DEF,
      MID: byPos.MID,
      FWD: byPos.FWD,
    }
  };
}

function buildDuelList() {
  const l1 = getLineupPlayers(team1);
  const l2 = getLineupPlayers(team2);
  const POS_LABELS = {GK:'Portero',DEF:'Defensa',MID:'Mediocampista',FWD:'Delantero'};
  _duels = [];
  ['GK','DEF','MID','FWD'].forEach(pos => {
    const a1 = l1[pos]||[], a2 = l2[pos]||[];
    const len = Math.max(a1.length, a2.length);
    for (let i = 0; i < len; i++) {
      const key1 = `left-${pos}-${i}`;
      const key2 = `right-${pos}-${i}`;
      _duels.push({
        pos,
        label: POS_LABELS[pos] + (len > 1 ? ' ' + (i+1) : ''),
        key1, key2,
        // default players (can be overridden by _picks)
        def1: a1[i] || null,
        def2: a2[i] || null,
        // all available for selector
        all1: (l1._all[pos] || []),
        all2: (l2._all[pos] || []),
      });
    }
  });
}

// Gets the actual player (picked or default)
function getPlayer(duel, side) {
  const key = side === 'left' ? duel.key1 : duel.key2;
  const def = side === 'left' ? duel.def1 : duel.def2;
  return _picks[key] !== undefined ? _picks[key] : def;
}

// ── RENDER DUEL STEP ──────────────────────────────────────────────────────

function renderDuelStep() {
  const total = _duels.length;
  const d = _duels[_duelIdx];
  if (!d) return;

  const p1 = getPlayer(d, 'left');
  const p2 = getPlayer(d, 'right');

  const score1 = p1 ? (p1.stats?.G||0)+(p1.stats?.A||0)+(p1.stats?.APP||0)*.1+(p1.stats?.SV||0)*.05 : 0;
  const score2 = p2 ? (p2.stats?.G||0)+(p2.stats?.A||0)+(p2.stats?.APP||0)*.1+(p2.stats?.SV||0)*.05 : 0;
  const tot = score1 + score2 || 1;
  const pct1 = Math.round(score1/tot*100), pct2 = 100-pct1;

  const prevDis = _duelIdx === 0 ? 'disabled' : '';
  const nextLbl = _duelIdx === total-1 ? 'Ver plantillas →' : 'Siguiente →';

  document.getElementById('positionRows').innerHTML = `
    <div class="duel-progress">
      <div class="duel-pos-label">${d.label}</div>
      <div class="duel-counter">${_duelIdx+1} / ${total}</div>
    </div>
    <div class="duel-progress-bar">
      <div class="duel-progress-fill" style="width:${((_duelIdx+1)/total)*100}%"></div>
    </div>
    <div class="duel-row">
      ${p1 ? playerCardHTML(p1, 'left',  d, score1 >= score2) : '<div class="empty-card">Sin jugador</div>'}
      <div class="duel-center">
        <div class="duel-score-bar" style="--p1:${pct1}%;--p2:${pct2}%"></div>
        <span class="duel-vs-text">VS</span>
        <div class="duel-score-bar" style="--p1:${pct2}%;--p2:${pct1}%"></div>
      </div>
      ${p2 ? playerCardHTML(p2, 'right', d, score2 > score1) : '<div class="empty-card right">Sin jugador</div>'}
    </div>
    <div class="duel-nav">
      <button class="duel-nav-btn prev" onclick="prevDuel()" ${prevDis}>← Anterior</button>
      <button class="duel-nav-btn next" onclick="nextDuel()">${nextLbl}</button>
    </div>`;
}

function prevDuel() { if (_duelIdx > 0) { _duelIdx--; renderDuelStep(); } }
function nextDuel() {
  if (_duelIdx < _duels.length-1) { _duelIdx++; renderDuelStep(); }
  else { switchTab('plantilla1', document.querySelectorAll('.tab-btn')[1]); }
}

// ── PLAYER CARD ───────────────────────────────────────────────────────────

function playerCardHTML(p, side, duel, isWinner) {
  const isRight = side === 'right';
  const rightCls = isRight ? ' right' : '';
  const winCls = isWinner ? ' winner' : '';
  const stats = p.stats || {};
  const isGK = p.pos === 'GK';
  const badgeCls = `badge-${p.pos}`;
  const allPlayers = isRight ? duel.all2 : duel.all1;
  const key = isRight ? duel.key2 : duel.key1;

  const s1 = {icon:'👟', val:stats.APP||0, lbl:'PJ'};
  const s2 = isGK ? {icon:'🧤', val:stats.SV||0, lbl:'ATJ'} : {icon:'⚽', val:stats.G||0, lbl:'GOL'};
  const s3 = isGK ? {icon:'🟨', val:stats.YC||0, lbl:'AM'}  : {icon:'🎯', val:stats.A||0, lbl:'ASI'};

  const statsHTML = [s1,s2,s3].map(s => `
    <div class="pc-stat">
      <span class="pc-stat-icon">${s.icon}</span>
      <span class="pc-stat-val">${s.val}</span>
      <span class="pc-stat-lbl">${s.lbl}</span>
    </div>`).join('');

  const clubHTML = `
    <div class="pc-club-block">
      <span style="font-size:20px;line-height:1">🏟️</span>
      <span class="pc-club-name">${(p.club||'').split(' ').slice(0,2).join(' ')}</span>
    </div>`;

  // Change button — shows how many alternatives
  const altCount = allPlayers.length - 1;
  const changeBtnHTML = altCount > 0
    ? `<button class="pc-change-btn" onclick="openSelector('${key}',event)" title="Cambiar jugador">
        ⇄ Cambiar
       </button>`
    : '';

  // Generate initials avatar fallback
  const initials = p.name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
  const posColors = {GK:'#2a5fa8,#1a3f78',DEF:'#1a5c32,#0d3a1e',MID:'#6b5210,#3d2e08',FWD:'#7a2210,#4a1308'};
  const gradColors = posColors[p.pos] || posColors.MID;

  return `<div class="player-card${rightCls}${winCls}">
    <img class="pc-photo" src="${p.photo}" alt="${p.name}"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <div class="pc-photo-fallback" style="display:none;background:linear-gradient(160deg,${gradColors})">
      <span class="pc-initials">${initials}</span>
    </div>
    <div class="pc-overlay"></div>
    ${p.jersey ? `<span class="pc-jersey">#${p.jersey}</span>` : ''}
    <span class="pc-pos-badge ${badgeCls}">${p.pos}</span>
    ${changeBtnHTML}
    <div class="pc-bottom">
      <div class="pc-name">${p.name}</div>
      <div class="pc-stats-row">
        ${isRight
          ? '<div class="pc-stats">' + statsHTML + '</div>' + clubHTML
          : clubHTML + '<div class="pc-stats">' + statsHTML + '</div>'}
      </div>
    </div>
  </div>`;
}

// ── SELECTOR DE JUGADOR ───────────────────────────────────────────────────

// _selectorState almacena qué key está abierta
let _selectorKey = null;

function openSelector(key, event) {
  event.stopPropagation();
  _selectorKey = key;
  const duel = _duels[_duelIdx];
  if (!duel) return;
  const isRight = key === duel.key2;
  const players = isRight ? duel.all2 : duel.all1;
  const current = _picks[key] !== undefined ? _picks[key] : (isRight ? duel.def2 : duel.def1);

  const items = players.map(p => {
    const isSelected = current && p.id === current.id;
    const stats = p.stats || {};
    const isGK = p.pos === 'GK';
    const stat2 = isGK ? `${stats.SV||0} ATJ` : `${stats.G||0} G`;
    const stat3 = isGK ? `${stats.YC||0} AM`  : `${stats.A||0} A`;
    return `<div class="sel-item${isSelected?' sel-active':''}" onclick="pickPlayer('${key}','${p.id}')">
      <img class="sel-photo" src="${p.photo}" alt="${p.name}" onerror="this.style.background='rgba(255,255,255,.1)'">
      <div class="sel-info">
        <div class="sel-name">${p.name}</div>
        <div class="sel-club">${p.club||'—'}</div>
      </div>
      <div class="sel-stats">
        <span>${stats.APP||0} PJ</span>
        <span>${stat2}</span>
        <span>${stat3}</span>
      </div>
      ${isSelected ? '<span class="sel-check">✓</span>' : ''}
    </div>`;
  }).join('');

  const side = isRight ? 'right' : 'left';
  const teamName = isRight ? team2.name : team1.name;

  document.getElementById('selectorOverlay').innerHTML = `
    <div class="selector-panel">
      <div class="sel-header">
        <span class="sel-title">${teamName} — ${duel.label}</span>
        <button class="sel-close" onclick="closeSelector()">✕</button>
      </div>
      <div class="sel-list">${items}</div>
    </div>`;
  document.getElementById('selectorOverlay').style.display = 'flex';
}

function pickPlayer(key, playerId) {
  const duel = _duels[_duelIdx];
  const isRight = key === duel.key2;
  const players = isRight ? duel.all2 : duel.all1;
  const p = players.find(x => x.id === playerId);
  if (p) _picks[key] = p;
  closeSelector();
  renderDuelStep();
}

function closeSelector() {
  document.getElementById('selectorOverlay').style.display = 'none';
  _selectorKey = null;
}

// ── PLANTILLA ─────────────────────────────────────────────────────────────

function renderPlantilla(containerId, team) {
  const fc = FLAG_CODES[team.name] || 'un';
  const logoSrc = `https://a.espncdn.com/i/teamlogos/soccer/500/${team.espnId}.png`;
  const byPos = {GK:[],DEF:[],MID:[],FWD:[]};
  team.players.forEach(p => { if (byPos[p.pos]) byPos[p.pos].push(p); });
  Object.values(byPos).forEach(arr => arr.sort((a,b) => (b.stats?.APP||0)-(a.stats?.APP||0)));
  const POS_LABELS = {GK:'Porteros',DEF:'Defensas',MID:'Mediocampistas',FWD:'Delanteros'};
  const BADGE = {GK:'badge-GK',DEF:'badge-DEF',MID:'badge-MID',FWD:'badge-FWD'};
  const POS_S  = {GK:'POR',DEF:'DEF',MID:'MED',FWD:'DEL'};

  let html = `<div class="plantilla-header">
    <img class="plantilla-logo" src="${logoSrc}" alt="${team.name}" onerror="this.src='https://flagcdn.com/w40/${fc}.png'">
    <span class="plantilla-title">${team.name}</span>
    <span class="plantilla-meta">${team.players.length} jugadores</span>
  </div>`;

  ['GK','DEF','MID','FWD'].forEach(pos => {
    const players = byPos[pos];
    if (!players.length) return;
    html += `<div class="plantilla-pos-group"><div class="plantilla-pos-head">${POS_LABELS[pos]}</div>`;
    players.forEach(p => {
      const gk = p.pos==='GK', s = p.stats||{};
      html += `<div class="plantilla-row">
        <span class="pr-num">${p.jersey||''}</span>
        <img class="pr-photo" src="${p.photo}" alt="${p.name}" onerror="this.style.background='rgba(255,255,255,.1)'">
        <div class="pr-info">
          <div class="pr-name">${p.name}</div>
          <div class="pr-club">${p.club||'—'}</div>
        </div>
        ${p.age ? `<span class="pr-age">${p.age}a</span>` : ''}
        <div class="pr-stats">
          <div class="pr-stat">${s.APP||0}<span>PJ</span></div>
          <div class="pr-stat">${gk?(s.SV||0):(s.G||0)}<span>${gk?'ATJ':'GOL'}</span></div>
          <div class="pr-stat">${gk?(s.YC||0):(s.A||0)}<span>${gk?'AM':'ASI'}</span></div>
        </div>
        <span class="pr-pos-tag ${BADGE[pos]}">${POS_S[pos]}</span>
      </div>`;
    });
    html += `</div>`;
  });
  document.getElementById(containerId).innerHTML = html;
}

// ── START ─────────────────────────────────────────────────────────────────
init();
