#!/usr/bin/env node
/*
  servidor_guardar_fotos.js
  
  Servidor HTTP local en puerto 8001 que recibe imágenes del browser
  y las guarda en public/img/players/
  
  Uso:
  1. node scripts/servidor_guardar_fotos.js
  2. Abrí el browser y ejecutá el script de descarga
  3. Las fotos se guardan automáticamente
*/
const http = require('http');
const fs   = require('fs');
const path = require('path');

const IMG_DIR = path.join(__dirname, '../public/img/players');
fs.mkdirSync(IMG_DIR, { recursive: true });

let saved = 0, total = 0;

const server = http.createServer((req, res) => {
  // CORS headers para que el browser pueda llamar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'POST' && req.url === '/save') {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
      try {
        const { id, data } = JSON.parse(Buffer.concat(body).toString());
        // data is base64 encoded image
        const buf = Buffer.from(data, 'base64');
        const dest = path.join(IMG_DIR, `${id}.webp`);
        fs.writeFileSync(dest, buf);
        saved++;
        if (saved % 20 === 0 || saved === total) process.stdout.write(`\r  ${saved}/${total} guardadas...`);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true, saved}));
      } catch(e) {
        res.writeHead(500); res.end(JSON.stringify({error:e.message}));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/start') {
    let body = [];
    req.on('data', c => body.push(c));
    req.on('end', () => {
      const {count} = JSON.parse(Buffer.concat(body).toString());
      total = count; saved = 0;
      console.log(`\nRecibiendo ${total} imágenes...`);
      res.writeHead(200); res.end(JSON.stringify({ok:true}));
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/done') {
    console.log(`\n✓ Guardadas: ${saved}/${total} imágenes en ${IMG_DIR}`);
    res.writeHead(200); res.end(JSON.stringify({ok:true, saved, total}));
    setTimeout(() => { console.log('Servidor cerrado.'); process.exit(0); }, 500);
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(8001, () => {
  console.log('=== Servidor de fotos corriendo en http://localhost:8001 ===');
  console.log('Ahora ejecutá el script en el browser...\n');
});
