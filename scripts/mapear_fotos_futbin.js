#!/usr/bin/env node
/*
  mapear_fotos_futbin.js

  Lee las carpetas de imágenes generadas por el scraper de Futbin
  y las conecta con los jugadores del JSON.

  Estructura esperada:
    imagenes_mundial/
      Argentina/
        messi_base.png
        di_maria_base.png
      España/
        lamine_yamal_base.png
        ...

  Uso:
    node scripts/mapear_fotos_futbin.js [--input imagenes_mundial]
*/

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const ARGS    = process.argv.slice(2);
const INPUT   = ARGS.find((_, i) => ARGS[i-1] === '--input') || 'imagenes_mundial';
const IMG_SRC = path.resolve(ROOT, INPUT);

const JSON_IN     = path.join(ROOT, 'data',        'jugadores-selecciones.json');
const JSON_OUT    = path.join(ROOT, 'data',        'jugadores-selecciones.json');
const JSON_PUBLIC = path.join(ROOT, 'public/data', 'jugadores-selecciones.json');

// Destino de las imágenes en el proyecto
const IMG_DEST_REL = 'public/img/players';
const IMG_DEST     = path.join(ROOT, IMG_DEST_REL);

// ── Normaliza un nombre para comparación ──────────────────────────────────────
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quitar acentos
    .replace(/[^a-z0-9]/g, '')        // solo alfanumérico
    .trim();
}

// ── Lee todos los archivos de imagen de una carpeta ──────────────────────────
function readImgFolder(folderPath) {
  if (!fs.existsSync(folderPath)) return [];
  return fs.readdirSync(folderPath)
    .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .map(f => ({
      file: f,
      fullPath: path.join(folderPath, f),
      // Quitar el sufijo _base / _rare / etc. y la extensión para obtener el nombre
      nameKey: normalize(f.replace(/_[^_]+\.(png|jpg|jpeg|webp)$/i, '').replace(/\.(png|jpg|jpeg|webp)$/i, ''))
    }));
}

// ── Mapeo de nombres de carpetas del scraper → nombres en el JSON ────────────
const FOLDER_TO_JSON = {
  'argentina':    'Argentina',
  'brasil':       'Brasil',
  'france':       'Francia',
  'francia':      'Francia',
  'espana':       'España',
  'spain':        'España',
  'alemania':     'Alemania',
  'germany':      'Alemania',
  'inglaterra':   'Inglaterra',
  'england':      'Inglaterra',
  'portugal':     'Portugal',
  'paises bajos': 'Países Bajos',
  'netherlands':  'Países Bajos',
  'holanda':      'Países Bajos',
  'belgica':      'Bélgica',
  'belgium':      'Bélgica',
  'croacia':      'Croacia',
  'croatia':      'Croacia',
  'escocia':      'Escocia',
  'scotland':     'Escocia',
  'suiza':        'Suiza',
  'switzerland':  'Suiza',
  'austria':      'Austria',
  'noruega':      'Noruega',
  'norway':       'Noruega',
  'suecia':       'Suecia',
  'sweden':       'Suecia',
  'uruguay':      'Uruguay',
  'colombia':     'Colombia',
  'ecuador':      'Ecuador',
  'paraguay':     'Paraguay',
  'mexico':       'México',
  'estados unidos': 'Estados Unidos',
  'usa':          'Estados Unidos',
  'canada':       'Canadá',
  'panama':       'Panamá',
  'haiti':        'Haití',
  'curazao':      'Curazao',
  'marruecos':    'Marruecos',
  'morocco':      'Marruecos',
  'senegal':      'Senegal',
  'egipto':       'Egipto',
  'egypt':        'Egipto',
  'ghana':        'Ghana',
  'costa de marfil': 'Costa de Marfil',
  'argelia':      'Argelia',
  'algeria':      'Argelia',
  'rd congo':     'RD Congo',
  'tunez':        'Túnez',
  'tunisia':      'Túnez',
  'cabo verde':   'Cabo Verde',
  'sudafrica':    'Sudáfrica',
  'south africa': 'Sudáfrica',
  'japon':        'Japón',
  'japan':        'Japón',
  'corea del sur': 'Corea del Sur',
  'korea':        'Corea del Sur',
  'australia':    'Australia',
  'arabia saudita': 'Arabia Saudita',
  'qatar':        'Qatar',
  'jordania':     'Jordania',
  'uzbekistan':   'Uzbekistán',
  'irak':         'Irak',
  'iran':         'Irán',
  'nueva zelanda': 'Nueva Zelanda',
  'bosnia':       'Bosnia y Herz.',
  'bosnia y herz': 'Bosnia y Herz.',
  'republica checa': 'Rep. Checa',
};

function folderToJsonName(folderName) {
  const key = normalize(folderName);
  // Exact match first
  for (const [k, v] of Object.entries(FOLDER_TO_JSON)) {
    if (normalize(k) === key) return v;
  }
  // Partial match
  for (const [k, v] of Object.entries(FOLDER_TO_JSON)) {
    if (key.includes(normalize(k)) || normalize(k).includes(key)) return v;
  }
  return folderName; // fallback
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(IMG_SRC)) {
    console.error(`❌ No existe la carpeta: ${IMG_SRC}`);
    console.error(`   Corré el scraper de Futbin primero, o especificá --input <carpeta>`);
    process.exit(1);
  }

  fs.mkdirSync(IMG_DEST, { recursive: true });

  // Leer el JSON
  const data = JSON.parse(fs.readFileSync(JSON_IN, 'utf8'));

  // Leer las carpetas de imágenes
  const folders = fs.readdirSync(IMG_SRC, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);

  console.log(`\n=== Mapeo de fotos Futbin → JSON ===`);
  console.log(`Carpeta fuente: ${IMG_SRC}`);
  console.log(`Carpetas encontradas: ${folders.map(f => f).join(', ')}\n`);

  let totalMapped = 0, totalCopied = 0, totalMissing = 0;

  for (const folder of folders) {
    const jsonName = folderToJsonName(folder);
    const team = data.teams[jsonName];

    if (!team) {
      console.log(`⚠️  Carpeta "${folder}" → JSON "${jsonName}" — equipo no encontrado`);
      continue;
    }

    const imgs = readImgFolder(path.join(IMG_SRC, folder));
    if (!imgs.length) { console.log(`  ${jsonName}: sin imágenes`); continue; }

    console.log(`[${jsonName}] ${imgs.length} imágenes, ${team.players.length} jugadores`);

    let mapped = 0;
    for (const player of team.players) {
      const pKey = normalize(player.name);

      // Buscar la mejor imagen para este jugador
      // 1. Nombre exacto normalizado
      // 2. Apellido coincide
      // 3. Primer apellido coincide
      let match = imgs.find(img => img.nameKey === pKey);

      if (!match) {
        // Try last name
        const lastName = normalize(player.name.split(' ').pop());
        match = imgs.find(img => img.nameKey.includes(lastName) && lastName.length > 3);
      }

      if (!match) {
        // Try first word
        const firstName = normalize(player.name.split(' ')[0]);
        if (firstName.length > 3) {
          match = imgs.find(img => img.nameKey.includes(firstName));
        }
      }

      if (match) {
        // Copy image to public/img/players/{espnId}.png
        const ext = path.extname(match.file);
        const destFile = `${player.id}${ext}`;
        const destPath = path.join(IMG_DEST, destFile);

        fs.copyFileSync(match.fullPath, destPath);

        // Update JSON path
        player.photo = `../img/players/${destFile}`;
        mapped++;
        totalCopied++;
        // console.log(`    ✓ ${player.name} → ${match.file}`);
      } else {
        totalMissing++;
        // console.log(`    ✗ ${player.name} — sin imagen`);
      }
    }

    totalMapped += mapped;
    console.log(`  → ${mapped}/${team.players.length} jugadores con imagen`);
  }

  // Guardar JSON actualizado
  const json = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(JSON_OUT,    json, 'utf8');
  fs.writeFileSync(JSON_PUBLIC, json, 'utf8');

  console.log(`\n✓ JSON actualizado`);
  console.log(`✓ Imágenes copiadas a: ${IMG_DEST}`);
  console.log(`\nResumen:`);
  console.log(`  Jugadores con imagen : ${totalMapped}`);
  console.log(`  Sin imagen           : ${totalMissing}`);
  console.log(`  Total copiadas       : ${totalCopied}`);
}

main();
