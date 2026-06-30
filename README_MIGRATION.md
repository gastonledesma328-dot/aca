# Refactor Arquitectura Scrapers — Guía completa

## ¿Qué cambió y por qué?

### El problema del sistema anterior

`competiciones.json` era un archivo monolítico que concentraba todos los datos de todas las competiciones. Esto causaba:

- **Carga completa siempre**: el frontend descargaba TODO aunque solo necesitara la Liga Profesional
- **Sin granularidad**: si el scraper de Champions fallaba, se perdían todos los datos
- **Lógica HTTP duplicada**: cada scraper construía sus requests por separado
- **Difícil de testear y mantener**: un cambio en una competición podía romper el archivo entero
- **Sin soporte para brackets**: los torneos de eliminación directa no tenían estructura separada

### La solución nueva

```
public/data/competitions/
├── liga-profesional/
│   ├── meta.json          ← metadata, league_code, logo, etc.
│   ├── fixtures.json      ← partidos
│   ├── standings.json     ← tabla (con grupos si aplica)
│   └── teams.json         ← equipos
├── champions-league/
│   ├── meta.json
│   ├── fixtures.json
│   ├── standings.json
│   ├── bracket.json       ← solo en competiciones knockout
│   └── teams.json
└── ...
```

**`public/data/competiciones.json` se sigue generando** automáticamente al final de cada run para no romper el frontend existente.

---

## Arquitectura del código

```
scripts/
├── core/
│   ├── http_client.py     ← UN solo cliente HTTP para todo el sistema
│   ├── espn_client.py     ← Todos los endpoints ESPN + registro de competiciones
│   ├── logger.py          ← Setup de logging
│   └── utils.py           ← Funciones compartidas (normalize_team, safe_get, etc.)
│
├── competitions/
│   ├── base_scraper.py    ← Clase base con toda la lógica reutilizable
│   ├── bracket_mixin.py   ← Reconstrucción de brackets para torneos knockout
│   │
│   ├── argentina/         ← Liga Pro, Primera Nacional, Copa Argentina
│   ├── conmebol/          ← Libertadores, Sudamericana, Eliminatorias
│   ├── uefa/              ← Champions, Europa, Conference, Eliminatorias UEFA
│   ├── fifa/              ← Mundial, Mundial de Clubes
│   ├── europa/            ← Premier, LaLiga, Serie A, Bundesliga, Ligue 1, Primeira
│   └── america/           ← Brasileirão, Uruguay, Paraguay, Colombia, Chile, Liga MX, MLS
│
├── run_scrapers.py        ← CLI principal
└── migrate.py             ← Script de migración desde el sistema legacy
```

### Principio de herencia

```
HttpClient (requests + cache + retries)
    └── ESPNClient (endpoints ESPN)
            └── BaseCompetitionScraper (lógica reutilizable)
                    ├── BracketMixin (reconstrucción de llaves)
                    ├── LigaProfesionalScraper (sin override)
                    ├── CopaArgentinaScraper (override fetch_standings=None)
                    ├── LibertadoresScraper (override fetch_standings con grupos)
                    └── ChampionsLeagueScraper (BracketMixin + standings fase liga)
```

**Agregar una competición nueva** = crear una clase de 5 líneas:
```python
class NuevaLigaScraper(BaseCompetitionScraper):
    slug = "nueva-liga"
    league_code = "XXX.1"
    name = "Nueva Liga"
```

---

## Pasos de migración

### Paso 1: Migrar estructura de carpetas (sin romper nada)

```bash
python scripts/migrate.py --dry-run   # revisar qué va a hacer
python scripts/migrate.py             # ejecutar
```

Esto crea la estructura nueva y deja `competiciones.json` intacto.

### Paso 2: Correr los scrapers por primera vez

```bash
pip install -r requirements.txt
python scripts/run_scrapers.py --group argentina
python scripts/run_scrapers.py --all
```

### Paso 3: Verificar compatibilidad del frontend

El archivo `competiciones.json` se regenera automáticamente. Verificar que el frontend lo sigue leyendo correctamente.

### Paso 4: Actualizar el frontend gradualmente

Cambiar las llamadas del frontend de:
```javascript
// Antes — carga todo
fetch('/data/competiciones.json')

// Después — carga solo lo necesario
fetch('/data/competitions/liga-profesional/fixtures.json')
fetch('/data/competitions/liga-profesional/standings.json')
```

---

## GitHub Actions

El workflow `.github/workflows/scraping.yml` ejecuta:

1. **Matrix de 6 grupos** en paralelo (argentina, conmebol, uefa, fifa, europa, america)
2. **`fail-fast: false`** — si falla Champions, la Liga Pro sigue procesándose
3. **Cache de dependencias pip** — instalación rápida
4. **Cache de ESPN responses** — reutiliza respuestas entre runs
5. **Artefactos de logs** — debugging sin ir a la máquina
6. **Commit automático** de los JSONs actualizados
7. **`[skip ci]`** en el commit para no disparar el workflow infinitamente

### Ejecución manual

Desde GitHub → Actions → "Scraping ESPN" → "Run workflow":
- `group`: dejar vacío para todos, o poner `argentina`, `conmebol`, etc.
- `force_refresh`: marcar para ignorar cache

---

## Schemas JSON

### `meta.json`
```json
{
  "slug": "liga-profesional",
  "name": "Liga Profesional Argentina",
  "league_code": "ARG.1",
  "country": "ARG",
  "confederation": "CONMEBOL",
  "type": "league",
  "standings_type": "single",
  "fixture_strategy": "calendar",
  "logo": "https://...",
  "group": "argentina",
  "season": null,
  "updated_at": "2024-01-01T00:00:00+00:00"
}
```

### `fixtures.json`
```json
{
  "updated_at": "2024-01-01T00:00:00+00:00",
  "count": 38,
  "fixtures": [
    {
      "id": "12345",
      "date": "2024-04-15T20:00:00Z",
      "status": "STATUS_FINAL",
      "state": "post",
      "venue": "Estadio Monumental",
      "round": 15,
      "home": { "team": {...}, "score": 2, "winner": true },
      "away": { "team": {...}, "score": 1, "winner": false }
    }
  ]
}
```

### `standings.json`
```json
{
  "updated_at": "...",
  "groups": [
    {
      "name": "General",
      "teams": [
        {
          "team": { "id": "1", "name": "River Plate", ... },
          "rank": 1,
          "gamesPlayed": 15,
          "wins": 10,
          "ties": 3,
          "losses": 2,
          "points": 33,
          "goalsFor": 28,
          "goalsAgainst": 12
        }
      ]
    }
  ]
}
```

### `bracket.json`
```json
{
  "updated_at": "...",
  "rounds": [
    {
      "name": "Octavos de final",
      "matches": [
        {
          "match_id": "99001",
          "date": "2024-04-09T20:00:00Z",
          "status": "STATUS_FINAL",
          "state": "post",
          "home": { "team": {...}, "score": 3, "aggregate_score": 5 },
          "away": { "team": {...}, "score": 0, "aggregate_score": 1 },
          "winner": "12345",
          "next_match_id": "99050"
        }
      ]
    }
  ]
}
```

---

## Agregar una nueva fuente de datos (no ESPN)

El diseño está preparado. Crear un nuevo cliente en `scripts/core/`:

```python
# scripts/core/sofascore_client.py
class SofaScoreClient:
    def __init__(self, http: HttpClient):
        self.http = http

    def get_standings(self, tournament_id: str) -> Optional[dict]:
        ...
```

Y crear scrapers alternativos que mezclen ambas fuentes:

```python
class LigaProConFallback(BaseCompetitionScraper):
    def fetch_standings(self):
        # Intentar ESPN primero
        data = super().fetch_standings()
        if data:
            return data
        # Fallback a SofaScore
        return self.sofascore.get_standings("ARG_1")
```

---

## Posibles cuellos de botella futuros

| Problema | Solución |
|---|---|
| ESPN bloquea IPs por rate limiting | User-agent rotativo + delays aleatorios (ya implementado) |
| Demasiadas competiciones → jobs lentos | Aumentar paralelismo en matrix o separar por frecuencia de actualización |
| JSON grandes en competiciones con muchos fixtures | Paginación de fixtures (implementar `?page=N` en fetch_fixtures) |
| ESPN cambia estructura de API | `safe_get()` con defaults garantiza que no rompa todo |
| Frontend lento cargando datos | Lazy loading por competición (ya preparado con archivos separados) |
| Datos en tiempo real | Agregar workflow con cron cada 5min solo para scoreboard de partidos activos |
