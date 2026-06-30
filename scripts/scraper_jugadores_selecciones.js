#!/usr/bin/env node
/*
  scraper_jugadores_selecciones.js
  
  Estrategia:
  1. Cargar rosters de clubes europeos/americanos (sí funcionan siempre)
  2. Extraer headshot.href + citizenship + stats de cada jugador
  3. Agrupar por citizenship → selección nacional
  4. Limitar a 26 jugadores por selección (ordenados por APP)
  5. Para equipos con roster via ESPN national team API, usarlo directamente
  
  Correr: node scripts/scraper_jugadores_selecciones.js
*/

const fs   = require('fs');
const path = require('path');
const https = require('https');

const ROOT       = path.resolve(__dirname, '..');
const OUT_DATA   = path.join(ROOT, 'data',        'jugadores-selecciones.json');
const OUT_PUBLIC = path.join(ROOT, 'public/data', 'jugadores-selecciones.json');

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
  'Referer':         'https://www.espn.com/',
  'Origin':          'https://www.espn.com',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: HEADERS }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function fetchJSON(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const { status, body } = await fetchURL(url);
      if (status === 200) return JSON.parse(body);
      if (status === 404) return null;
    } catch { if (i < retries) await sleep(400 * (i + 1)); }
  }
  return null;
}

// ── Nationality map: English ESPN citizenship → Spanish name ──────────────
const NAT_MAP = {
  'Argentina':'Argentina','Brazil':'Brasil','France':'Francia','Spain':'España',
  'Germany':'Alemania','England':'Inglaterra','Portugal':'Portugal','Uruguay':'Uruguay',
  'Colombia':'Colombia','Mexico':'México','Netherlands':'Países Bajos','Belgium':'Bélgica',
  'Croatia':'Croacia','Morocco':'Marruecos','Japan':'Japón','United States':'Estados Unidos',
  'Ecuador':'Ecuador','Switzerland':'Suiza','Australia':'Australia','Senegal':'Senegal',
  'Algeria':'Argelia','Austria':'Austria','Norway':'Noruega','Scotland':'Escocia',
  'Sweden':'Suecia','Tunisia':'Túnez','Ivory Coast':'Costa de Marfil','Ghana':'Ghana',
  'Poland':'Polonia','Turkey':'Turquía','Serbia':'Serbia','Denmark':'Dinamarca',
  'South Korea':'Corea del Sur','Canada':'Canadá','Panama':'Panamá',
  'Paraguay':'Paraguay','Saudi Arabia':'Arabia Saudita','Iran':'Irán',
  'Iraq':'Irak','Jordan':'Jordania','Uzbekistan':'Uzbekistán',
  'New Zealand':'Nueva Zelanda','Egypt':'Egipto','Cape Verde':'Cabo Verde',
  'Qatar':'Qatar','Haiti':'Haití','Curacao':'Curazao',
  'Bosnia and Herzegovina':'Bosnia y Herz.','DR Congo':'RD Congo',
  'South Africa':'Sudáfrica','Wales':'Gales','Italy':'Italia',
  'Nigeria':'Nigeria','Cameroon':'Camerún','Venezuela':'Venezuela',
  'Chile':'Chile','Bolivia':'Bolivia','Peru':'Perú','Costa Rica':'Costa Rica',
  'Honduras':'Honduras','Jamaica':'Jamaica','Cuba':'Cuba',
  'Burkina Faso':'Burkina Faso','Mali':'Malí','Guinea':'Guinea',
  'Tanzania':'Tanzania','Mozambique':'Mozambique','Zimbabwe':'Zimbabwe',
  'China PR':'China','India':'India','Thailand':'Tailandia',
  'Vietnam':'Vietnam','Indonesia':'Indonesia','Palestine':'Palestina',
  'Lebanon':'Líbano','Syria':'Siria','Kuwait':'Kuwait',
  'Bahrain':'Bahréin','Oman':'Omán','United Arab Emirates':'Emiratos Árabes',
};

// ── World Cup 2026 teams ────────────────────────────────────────────────────
const WC_TEAMS = new Set([
  'Argentina','Brasil','Francia','España','Alemania','Inglaterra','Portugal',
  'Países Bajos','Bélgica','Croacia','Escocia','Suiza','Austria','Noruega',
  'Suecia','Bosnia y Herz.','Uruguay','Colombia','Ecuador','Paraguay',
  'México','Estados Unidos','Canadá','Panamá','Haití','Curazao',
  'Marruecos','Senegal','Egipto','Ghana','Costa de Marfil','Argelia',
  'RD Congo','Túnez','Cabo Verde','Sudáfrica',
  'Japón','Corea del Sur','Australia','Arabia Saudita','Qatar',
  'Jordania','Uzbekistán','Irak','Irán','Nueva Zelanda',
]);

const ESPN_IDS = {
  'Argentina':9,'Brasil':6,'Francia':2,'España':164,'Alemania':3,'Inglaterra':10,
  'Portugal':165,'Países Bajos':167,'Bélgica':1,'Croacia':44,'Escocia':269,
  'Suiza':379,'Austria':371,'Noruega':378,'Suecia':466,'Bosnia y Herz.':452,
  'Uruguay':47,'Colombia':11,'Ecuador':13,'Paraguay':30,
  'México':20,'Estados Unidos':18,'Canadá':571,'Panamá':516,'Haití':531,'Curazao':557,
  'Marruecos':51,'Senegal':83,'Egipto':48,'Ghana':56,'Costa de Marfil':54,
  'Argelia':46,'RD Congo':49,'Túnez':87,'Cabo Verde':96,'Sudáfrica':67,
  'Japón':175,'Corea del Sur':181,'Australia':201,'Arabia Saudita':173,
  'Qatar':196,'Jordania':172,'Uzbekistán':192,'Irak':171,'Irán':170,
  'Nueva Zelanda':202,
};

// ── Club teams to scrape ────────────────────────────────────────────────────
const CLUB_TEAMS = [
  {l:'esp.1',    ids:[83,86,3,17,97,376,1068,2021,2899,369]},
  {l:'eng.1',    ids:[382,368,359,364,360,370,371,379,380,383,361,363,366,367,372,373]},
  {l:'ger.1',    ids:[124,120,127,130,131,125,129,136,137,138,139,140]},
  {l:'fra.1',    ids:[160,161,178,163,176,165,175,177,179,180]},
  {l:'ita.1',    ids:[100,108,111,116,103,105,107,114,109,115,117,118]},
  {l:'por.1',    ids:[229,228,230,232,233,234]},
  {l:'ned.1',    ids:[271,281,282,280,284,285,286]},
  {l:'bra.1',    ids:[155,157,150,153,156,152,158,154,159,151]},
  {l:'mex.1',    ids:[452,454,458,460,455,461,462,453,456,459]},
  {l:'usa.1',    ids:[528,529,530,531,583,527,526,584,585,586]},
  {l:'sco.prem', ids:[240,243,244,245,246,247]},
  {l:'tur.super', ids:[601,604,605,606,607,608]},
  {l:'bel.1',    ids:[2183,2184,2185,2186,2187]},
  {l:'swe.1',    ids:[3025,3026,3027,3028]},
  {l:'aut.bundesliga', ids:[1853,1854,1855,1856]},
  {l:'nor.eliteserien', ids:[3701,3702,3703]},
  {l:'arg.1',    ids:[435,447,440,443,438,446,437,441,433,432,434,436]},
  {l:'col.1',    ids:[2183,3941,3942,3943]},
  {l:'jpn.1',    ids:[3665,3666,3667,3668,3669]},
  {l:'kor.kleague1', ids:[3720,3721,3722,3723]},
  {l:'sau.pro',  ids:[3800,3801,3802,3803]},
  {l:'chn.super', ids:[3850,3851]},
  {l:'mls',      ids:[528,529,530,531,583,527,526,584,585,586,587,588]},
];

const POS_MAP = {
  G:'GK',GK:'GK',POR:'GK',
  D:'DEF',CB:'DEF',LB:'DEF',RB:'DEF',LWB:'DEF',RWB:'DEF',SW:'DEF',
  M:'MID',CM:'MID',CDM:'MID',CAM:'MID',LM:'MID',RM:'MID',DM:'MID',
  F:'FWD',FW:'FWD',FWD:'FWD',ST:'FWD',CF:'FWD',LW:'FWD',RW:'FWD',SS:'FWD',
};
const POS_ORDER = {GK:0,DEF:1,MID:2,FWD:3};

function getStats(p) {
  const cats = p?.statistics?.splits?.categories || [];
  const gen = cats.find(c=>c.name==='general');
  const off = cats.find(c=>c.name==='offensive');
  const gk  = cats.find(c=>c.name==='goalKeeping');
  const s = cat => n => (cat?.stats||[]).find(x=>x.abbreviation===n)?.value??0;
  return {APP:s(gen)('APP'),G:s(off)('G'),A:s(off)('A'),SV:s(gk)('SV'),YC:s(gen)('YC')};
}

// ── PASO 1: Scrape club rosters ─────────────────────────────────────────────
async function scrapeClubRosters() {
  console.log('Cargando rosters de clubs...\n');
  
  // byNationality[selNombre] = [playerObj, ...]
  const byNationality = {};
  let totalPlayers = 0, totalWithPhoto = 0;

  for (const {l, ids} of CLUB_TEAMS) {
    for (const teamId of ids) {
      await sleep(80);
      const d = await fetchJSON(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${l}/teams/${teamId}/roster`
      );
      if (!d?.athletes) continue;

      for (const p of d.athletes) {
        if (!p?.id || !p.citizenship) continue;
        const selNombre = NAT_MAP[p.citizenship];
        if (!selNombre || !WC_TEAMS.has(selNombre)) continue;

        const stats = getStats(p);
        const photo = p.headshot?.href ||
          `https://a.espncdn.com/i/headshots/soccer/players/full/${p.id}.png`;
        const hasRealPhoto = !!p.headshot?.href;

        if (!byNationality[selNombre]) byNationality[selNombre] = {};

        const existing = byNationality[selNombre][p.id];
        if (!existing || stats.APP > (existing.stats?.APP||0)) {
          byNationality[selNombre][p.id] = {
            id:     p.id,
            name:   p.fullName || p.displayName,
            short:  p.shortName || p.displayName,
            pos:    POS_MAP[(p.position?.abbreviation||'').toUpperCase()] || 'MID',
            posRaw: p.position?.abbreviation,
            age:    p.age,
            jersey: p.jersey,
            club:   p.team?.displayName || p.defaultTeam?.displayName || '',
            photo,
            hasRealPhoto,
            stats,
          };
          if (hasRealPhoto) totalWithPhoto++;
          totalPlayers++;
        }
      }
      process.stdout.write('.');
    }
    process.stdout.write(' ' + l + '\n');
  }

  console.log(`\nTotal jugadores encontrados: ${totalPlayers}`);
  console.log(`Con foto real (headshot.href): ${totalWithPhoto}`);
  return byNationality;
}

// ── PASO 2: Scrape event photos (boxscores) ──────────────────────────────────
async function scrapeEventPhotos() {
  console.log('\nScrapeando fotos de partidos recientes...');
  const photoMap = {}; // espnId → headshot URL

  function extract(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(extract); return; }
    if (obj.id && obj.headshot?.href && String(obj.headshot.href).includes('soccer')) {
      photoMap[String(obj.id)] = obj.headshot.href;
    }
    Object.values(obj).forEach(extract);
  }

  const EVENT_LEAGUES = [
    'esp.1','eng.1','ger.1','fra.1','ita.1','por.1','ned.1',
    'bra.1','mex.1','usa.1','arg.1','sco.prem','tur.super',
  ];

  for (const league of EVENT_LEAGUES) {
    await sleep(80);
    const sb = await fetchJSON(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`
    );
    if (!sb?.events?.length) continue;

    for (const event of sb.events.slice(0, 8)) {
      await sleep(60);
      const d = await fetchJSON(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${event.id}`
      );
      if (d) extract(d);
    }
    process.stdout.write('.');
  }

  console.log(`\nFotos de eventos: ${Object.keys(photoMap).length}`);
  return photoMap;
}

// ── PASO 3: Build final teams ────────────────────────────────────────────────
function buildTeams(byNationality, eventPhotoMap) {
  const teams = {};

  for (const selNombre of WC_TEAMS) {
    const playersMap = byNationality[selNombre] || {};
    const players = Object.values(playersMap)
      .map(p => {
        // Upgrade photo from event map if available
        const photo = eventPhotoMap[p.id] || p.photo;
        return { ...p, photo };
      })
      .sort((a,b) => (POS_ORDER[a.pos]??4)-(POS_ORDER[b.pos]??4) || (b.stats.APP||0)-(a.stats.APP||0));

    // Limit to 26: 3 GK, 8 DEF, 8 MID, 7 FWD
    const byPos = {GK:[],DEF:[],MID:[],FWD:[]};
    players.forEach(p => { if (byPos[p.pos]) byPos[p.pos].push(p); });
    const squad = [
      ...byPos.GK.slice(0,3),
      ...byPos.DEF.slice(0,8),
      ...byPos.MID.slice(0,8),
      ...byPos.FWD.slice(0,7),
    ].sort((a,b) => (POS_ORDER[a.pos]??4)-(POS_ORDER[b.pos]??4) || (b.stats.APP||0)-(a.stats.APP||0));

    // Remove internal field
    squad.forEach(p => delete p.hasRealPhoto);

    teams[selNombre] = {
      name: selNombre,
      espnId: ESPN_IDS[selNombre] || null,
      players: squad,
    };
  }
  return teams;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Scraper Jugadores Selecciones Mundial 2026 ===\n');

  const byNationality = await scrapeClubRosters();
  const eventPhotoMap = await scrapeEventPhotos();
  const teams = buildTeams(byNationality, eventPhotoMap);

  // Stats
  const totalPlayers = Object.values(teams).reduce((s,t)=>s+t.players.length,0);
  const withPhoto = Object.values(teams)
    .flatMap(t=>t.players)
    .filter(p => !p.photo.includes('a.espncdn.com/i/headshots/soccer/players/full')).length;

  const output = {
    meta: {
      source:    'ESPN API — club rosters by citizenship + event headshots',
      updatedAt: new Date().toISOString(),
      totalTeams: Object.keys(teams).length,
      totalPlayers,
      playersWithRealPhoto: withPhoto,
    },
    teams,
  };

  const json = JSON.stringify(output, null, 2) + '\n';
  fs.mkdirSync(path.dirname(OUT_DATA),   {recursive:true});
  fs.mkdirSync(path.dirname(OUT_PUBLIC), {recursive:true});
  fs.writeFileSync(OUT_DATA,   json, 'utf8');
  fs.writeFileSync(OUT_PUBLIC, json, 'utf8');

  console.log(`\n✓ Guardado: ${Object.keys(teams).length} selecciones, ${totalPlayers} jugadores`);
  console.log(`  Con foto real: ${withPhoto}`);
  console.log('\nPor selección:');
  Object.entries(teams)
    .sort((a,b)=>b[1].players.length-a[1].players.length)
    .forEach(([n,t]) => {
      const conFoto = t.players.filter(p=>!p.photo.includes('a.espncdn.com/i/headshots/soccer/players/full')).length;
      console.log(`  ${n}: ${t.players.length}j | ${conFoto} con foto`);
    });
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
