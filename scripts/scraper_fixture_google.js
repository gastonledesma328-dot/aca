#!/usr/bin/env node
/*
  scraper_fixture_google.js
  Fixture Mundial 2026 – scraper con 3 estrategias:

  1. Playwright (headless Chromium) → Google lr_lm_mt endpoint
     Requiere: npm install playwright && npx playwright install chromium
     Funciona en GitHub Actions ubuntu-latest con:
       npx playwright install chromium --with-deps

  2. Puppeteer con Chrome del sistema (fallback)
     Funciona en GitHub Actions ubuntu-latest con:
       sudo apt-get install -y google-chrome-stable

  3. ESPN API (fallback final) – trae partidos del fixture via API pública

  Output: data/fixture-mundial2026.json + public/data/fixture-mundial2026.json

  Uso local:   node scripts/scraper_fixture_google.js
  GitHub CI:   .github/workflows/update-fixture-google.yml
*/

const fs   = require("fs");
const path = require("path");

const ROOT       = path.resolve(__dirname, "..");
const OUT_DATA   = path.join(ROOT, "data",        "fixture-mundial2026.json");
const OUT_PUBLIC = path.join(ROOT, "public/data", "fixture-mundial2026.json");

// ── Endpoint de Google Knowledge Graph ───────────────────────────────────
// Parámetros extraídos del URL compartido por el usuario:
//   lmid: /m/0r4xs1m  (Copa Mundial FIFA 2026)
//   emid: /m/0r4xs1m  (mismo entity ID)
//   sp: 2             (panel de fixture/schedule)
//   et: lg            (league/group stage)
const ASYNC_PARAMS = [
  "sp:2",
  "lmid:%2Fm%2F0r4xs1m",
  "emid:%2Fm%2F0r4xs1m",
  "ftm:",
  "stm:",
  "et:lg",
  "mpd:2026-06-11T19%3A00%3A00Z",
  "_pms:s",
  "_fmt:pc",
].join(",");

const GOOGLE_ASYNC_URL =
  `https://www.google.com/async/lr_lm_mt?async=${ASYNC_PARAMS}&hl=es-419&gl=ar`;

const GOOGLE_SEARCH_URL =
  "https://www.google.com/search?q=fixture+copa+mundial+2026+fase+de+grupos&hl=es-419&gl=ar";

// ── Mapeo de nombres Google → nombres estándar del juego ─────────────────
const NAME_MAP = {
  "Chequia":              "Rep. Checa",
  "Catar":                "Qatar",
  "Bosnia y Herzegovina": "Bosnia y Herz.",
  "EE. UU.":              "Estados Unidos",
  "Congo - Kinshasa":     "RD Congo",
  "RD del Congo":         "RD Congo",
  "R. D. Congo":          "RD Congo",
  "Arabia Saudí":         "Arabia Saudita",
};

function normName(n) {
  return NAME_MAP[n?.trim()] || n?.trim() || "?";
}

// ── Parser del HTML de Google ─────────────────────────────────────────────
function parseGoogleFixture(html) {
  const positions = [];
  const rx = /data-df-match-mid="(\/g\/[^"]+)"[^>]*data-start-time="([^"]+)"/g;
  let m;
  while ((m = rx.exec(html)) !== null) {
    positions.push({ mid: m[1], startTime: m[2], idx: m.index });
  }

  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

  return positions.map((pos, i) => {
    const end   = i < positions.length - 1 ? positions[i+1].idx : pos.idx + 4000;
    const chunk = html.substring(pos.idx, Math.min(end, pos.idx + 4000));
    const text  = chunk.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|").replace(/\s+/g, " ");
    const parts = text.split("|").map(s => s.trim()).filter(s => s && s.length > 0);

    // Grupo
    const grupoM = parts.find(p => /^Grupo\s+[A-L]$/i.test(p));
    const grupo  = grupoM ? grupoM.slice(-1).toUpperCase() : "?";

    // Equipos: pares duplicados consecutivos
    const teams = [];
    for (let j = 0; j < parts.length - 1; j++) {
      const p = parts[j];
      if (
        p === parts[j+1] &&
        p.length >= 3 &&
        !/\d/.test(p) &&
        !/►|[\/:]|p\.m\.|a\.m\.|Grupo|Jue|Vie|Sáb|Dom|Lun|Mar|Mié|Jue|VIVO|Terminado/.test(p)
      ) {
        teams.push(normName(p));
        j++;
        if (teams.length === 2) break;
      }
    }

    // Score
    const scoreM = text.match(/\b(\d+)\s*[-–]\s*(\d+)\b/);
    const score  = scoreM ? { local: +scoreM[1], visita: +scoreM[2] } : null;

    // Status
    let status = "upcoming";
    if (/EN VIVO|VIVO|\bVIVO\b/.test(text)) status = "live";
    else if (/Terminado|Tiempo\s*extra|Penales/.test(text) || score) status = "finished";

    // Sede (opcional)
    const sedeM = text.match(/Sede[:\s]+([A-ZÁÉÍÓÚ][^|]{5,40})/i);

    // Fecha local ARG
    const d     = new Date(pos.startTime);
    const fecha = `${d.getUTCDate()} ${meses[d.getUTCMonth()].charAt(0).toUpperCase() + meses[d.getUTCMonth()].slice(1)}`;

    if (teams.length === 2) {
      return {
        mid: pos.mid,
        startTime: pos.startTime,
        fecha,
        grupo,
        local:  teams[0],
        visita: teams[1],
        score,
        status,
        ...(sedeM ? { sede: sedeM[1].trim() } : {}),
      };
    }
    return null;
  }).filter(Boolean);
}

// ── Estrategia 1: Playwright ──────────────────────────────────────────────
async function tryPlaywright() {
  const playwright = require("playwright");
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "es-419",
    extraHTTPHeaders: { "Accept-Language": "es-419,es;q=0.9" },
  });
  const page = await context.newPage();

  let panelHtml = "";

  // Interceptar la respuesta lr_lm_mt
  page.on("response", async (res) => {
    if (res.url().includes("lr_lm_mt") && res.status() === 200) {
      try { panelHtml = await res.text(); } catch {}
    }
  });

  await page.goto(GOOGLE_SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);

  // Si no llegó por intercepción, llamar directo con cookies de sesión
  if (!panelHtml || !panelHtml.includes("data-df-match-mid")) {
    panelHtml = await page.evaluate(async (url) => {
      const r = await fetch(url, { credentials: "include" });
      return r.ok ? r.text() : "";
    }, GOOGLE_ASYNC_URL);
  }

  await browser.close();
  return panelHtml;
}

// ── Estrategia 2: Puppeteer con Chrome del sistema ────────────────────────
async function tryPuppeteer() {
  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ||
      "/usr/bin/google-chrome-stable" ||
      "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
  await page.setExtraHTTPHeaders({ "Accept-Language": "es-419,es;q=0.9" });

  let panelHtml = "";
  page.on("response", async (res) => {
    if (res.url().includes("lr_lm_mt")) {
      try { panelHtml = await res.text(); } catch {}
    }
  });

  await page.goto(GOOGLE_SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);

  if (!panelHtml || !panelHtml.includes("data-df-match-mid")) {
    panelHtml = await page.evaluate(async (url) => {
      const r = await fetch(url, { credentials: "include" });
      return r.ok ? r.text() : "";
    }, GOOGLE_ASYNC_URL);
  }

  await browser.close();
  return panelHtml;
}

// ── Estrategia 3: ESPN API (fallback final) ───────────────────────────────
async function tryESPN() {
  // ESPN tiene el fixture del Mundial 2026 en su scoreboard
  const urls = [
    "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard",
    "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.worldq.conmebol/scoreboard",
  ];

  const https = require("https");
  const fetchJson = (url) =>
    new Promise((res, rej) => {
      https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (r) => {
        let d = "";
        r.on("data", c => (d += c));
        r.on("end", () => {
          try { res({ status: r.statusCode, data: JSON.parse(d) }); }
          catch { rej(new Error("JSON parse error")); }
        });
      }).on("error", rej);
    });

  const matches = [];
  for (const url of urls) {
    try {
      const { status, data } = await fetchJson(url);
      if (status === 200 && data?.events) {
        data.events.forEach(ev => {
          const comp = ev.competitions?.[0];
          if (!comp) return;
          const teams  = comp.competitors || [];
          const home   = teams.find(t => t.homeAway === "home");
          const away   = teams.find(t => t.homeAway === "away");
          if (!home || !away) return;
          const d      = new Date(ev.date);
          const meses  = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
          matches.push({
            mid:       "/espn/" + ev.id,
            startTime: ev.date,
            fecha:     `${d.getUTCDate()} ${meses[d.getUTCMonth()][0].toUpperCase() + meses[d.getUTCMonth()].slice(1)}`,
            grupo:     "?",
            local:     home.team?.displayName || "?",
            visita:    away.team?.displayName || "?",
            score:     ev.status?.type?.completed
              ? { local: parseInt(home.score||0), visita: parseInt(away.score||0) }
              : null,
            status:    ev.status?.type?.completed ? "finished"
              : ev.status?.type?.state === "in" ? "live" : "upcoming",
            logoLocal:  home.team?.logo || null,
            logoVisita: away.team?.logo || null,
          });
        });
      }
    } catch (e) {
      console.warn("  ESPN fetch error:", e.message);
    }
  }
  return matches;
}

// ── Helpers de I/O ────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function saveOutput(matches) {
  const output = {
    meta: {
      source:    "Google Knowledge Graph lr_lm_mt + ESPN API",
      updatedAt: new Date().toISOString(),
      total:     matches.length,
    },
    fixture: matches,
  };
  const json = JSON.stringify(output, null, 2) + "\n";
  fs.mkdirSync(path.dirname(OUT_DATA),   { recursive: true });
  fs.mkdirSync(path.dirname(OUT_PUBLIC), { recursive: true });
  fs.writeFileSync(OUT_DATA,   json, "utf8");
  fs.writeFileSync(OUT_PUBLIC, json, "utf8");
}

function loadPrevious() {
  try {
    if (fs.existsSync(OUT_DATA)) return JSON.parse(fs.readFileSync(OUT_DATA, "utf8"));
  } catch {}
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Scraper Fixture Mundial 2026 – Google KG ===\n");

  const previous = loadPrevious();
  if (previous) console.log(`Backup: ${previous.fixture?.length ?? 0} partidos previos.\n`);

  let matches = [];

  // ── Intentar Playwright ──
  console.log("[1/3] Playwright...");
  try {
    const html = await tryPlaywright();
    if (html && html.includes("data-df-match-mid")) {
      matches = parseGoogleFixture(html);
      console.log(`  ✓ ${matches.length} partidos via Playwright\n`);
    } else {
      console.log("  ✗ Sin datos de partidos\n");
    }
  } catch (e) {
    console.log(`  ✗ ${e.message}\n`);
  }

  // ── Intentar Puppeteer ──
  if (matches.length < 10) {
    console.log("[2/3] Puppeteer...");
    try {
      const html = await tryPuppeteer();
      if (html && html.includes("data-df-match-mid")) {
        const m2 = parseGoogleFixture(html);
        if (m2.length > matches.length) {
          matches = m2;
          console.log(`  ✓ ${matches.length} partidos via Puppeteer\n`);
        }
      } else {
        console.log("  ✗ Sin datos de partidos\n");
      }
    } catch (e) {
      console.log(`  ✗ ${e.message}\n`);
    }
  }

  // ── Intentar ESPN API ──
  if (matches.length < 10) {
    console.log("[3/3] ESPN API fallback...");
    try {
      const espnMatches = await tryESPN();
      if (espnMatches.length > 0) {
        matches = espnMatches;
        console.log(`  ✓ ${matches.length} partidos via ESPN API\n`);
      } else {
        console.log("  ✗ Sin datos ESPN\n");
      }
    } catch (e) {
      console.log(`  ✗ ${e.message}\n`);
    }
  }

  // ── Fallback: datos previos ──
  if (matches.length < 5) {
    if (previous?.fixture?.length) {
      console.warn("Usando datos previos como fallback.");
      matches = previous.fixture;
    } else {
      throw new Error("Sin datos y sin backup.");
    }
  }

  // ── Merge con previos para no perder partidos ──
  if (previous?.fixture?.length) {
    const prevMap = {};
    previous.fixture.forEach(m => (prevMap[m.mid] = m));
    matches.forEach(m => (prevMap[m.mid] = m)); // nuevos sobreescriben
    matches = Object.values(prevMap);
  }

  saveOutput(matches);

  // ── Resumen ──
  console.log(`\n── Resumen: ${matches.length} partidos ──`);
  const byGroup = {};
  matches.forEach(m => {
    if (!byGroup[m.grupo]) byGroup[m.grupo] = 0;
    byGroup[m.grupo]++;
  });
  Object.keys(byGroup).sort().forEach(g => {
    const live     = matches.filter(m => m.grupo === g && m.status === "live").length;
    const finished = matches.filter(m => m.grupo === g && m.status === "finished").length;
    console.log(`  Grupo ${g}: ${byGroup[g]} partidos (${finished} terminados, ${live} en vivo)`);
  });
  console.log("\n✓ Guardado en data/ y public/data/");
}

main().catch(err => {
  console.error("\n❌ Error fatal:", err.message);
  process.exit(1);
});
