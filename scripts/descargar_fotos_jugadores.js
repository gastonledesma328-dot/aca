#!/usr/bin/env node
/*
  descargar_fotos_jugadores.js
  
  Lee jugadores-selecciones.json, descarga las fotos de Sofascore
  y las guarda en public/img/players/{espnId}.jpg
  Luego actualiza el JSON para apuntar a las imágenes locales.
  
  Uso: node scripts/descargar_fotos_jugadores.js
*/

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const ROOT      = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'data', 'jugadores-selecciones.json');
const JSON_PUB  = path.join(ROOT, 'public/data', 'jugadores-selecciones.json');
const IMG_DIR   = path.join(ROOT, 'public/img/players');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Referer': 'https://www.sofascore.com/',
  'Accept': 'image/png,image/jpeg,image/*',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, { headers: HEADERS }, res => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', err => { file.close(); try { fs.unlinkSync(dest); } catch {} reject(err); });
  });
}

async function main() {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  
  // Get all unique players
  const allPlayers = [];
  const seen = new Set();
  Object.values(data.teams).forEach(team => {
    team.players.forEach(p => {
      if (!seen.has(p.id)) { seen.add(p.id); allPlayers.push(p); }
    });
  });
  
  const withSofa = allPlayers.filter(p => p.photo?.includes('sofascore'));
  console.log(`Total jugadores: ${allPlayers.length}`);
  console.log(`Con foto Sofascore: ${withSofa.length}`);
  console.log(`Guardando en: ${IMG_DIR}\n`);
  
  let ok = 0, skip = 0, fail = 0;
  
  for (const p of withSofa) {
    const dest = path.join(IMG_DIR, `${p.id}.jpg`);
    
    // Skip if already downloaded
    if (fs.existsSync(dest)) {
      skip++;
      continue;
    }
    
    await sleep(80);
    try {
      await downloadImage(p.photo, dest);
      ok++;
      if (ok % 20 === 0) console.log(`  ✓ ${ok}/${withSofa.length} descargadas...`);
    } catch (e) {
      fail++;
    }
  }
  
  console.log(`\n✓ Descargadas: ${ok} | Existentes: ${skip} | Fallidas: ${fail}`);
  
  // Update JSON to point to local paths
  Object.values(data.teams).forEach(team => {
    team.players.forEach(p => {
      const local = path.join(IMG_DIR, `${p.id}.jpg`);
      if (fs.existsSync(local)) {
        p.photo = `../img/players/${p.id}.jpg`;
      }
    });
  });
  
  const json = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(JSON_PATH, json, 'utf8');
  fs.writeFileSync(JSON_PUB,  json, 'utf8');
  console.log('✓ JSON actualizado con rutas locales');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
