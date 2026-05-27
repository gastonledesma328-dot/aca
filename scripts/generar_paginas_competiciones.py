import os

PAGES_DIR = "public/competiciones"

COMPETICIONES = [
    ("liga-profesional", "Liga Profesional"),
    ("primera-nacional", "Primera Nacional"),
    ("copa-argentina", "Copa Argentina"),
    ("libertadores", "Libertadores"),
    ("sudamericana", "Sudamericana"),
    ("champions", "Champions"),
    ("europa-league", "Europa League"),
    ("conference-league", "Conference League"),
    ("mundial-clubes", "Mundial de Clubes"),
    ("eliminatorias-conmebol", "Eliminatorias Conmebol"),
    ("eliminatorias-uefa", "Eliminatorias UEFA"),
    ("mundial", "Mundial"),
    ("premier-league", "Premier League"),
    ("laliga", "LaLiga"),
    ("serie-a", "Serie A"),
    ("bundesliga", "Bundesliga"),
    ("primeira-liga", "Primeira Liga"),
    ("ligue-1", "Ligue 1"),
    ("brasileirao", "Brasileirão"),
    ("uruguay", "Campeonato Uruguayo"),
    ("paraguay", "Liga de Paraguay"),
    ("colombia", "Primera A Colombia"),
    ("chile", "Primera División Chile"),
    ("mexico", "Liga MX"),
    ("mls", "MLS"),
]


def html_page(competition_id, title):
    return f'''<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} | Partidos Hoy</title>
    <link rel="stylesheet" href="../styles.css" />
    <link rel="stylesheet" href="../competicion.css" />
    <link rel="stylesheet" href="../competicion-compact.css" />
  </head>

  <body data-competition-id="{competition_id}">
    <main class="competition-page-shell">
      <header class="competition-topbar">
        <a class="brand" href="../index.html" aria-label="Partidos Hoy">
          <span>Partid</span><img src="../assets/iconoweb.png" alt="o" class="brand-ball-logo" style="width:24px;height:24px;margin:0 2px;object-fit:contain;display:inline-block;vertical-align:middle;" /><span>s</span><strong>.Hoy</strong>
        </a>
        <a class="competition-back-link" href="../index.html">← Volver a la agenda</a>
      </header>

      <section class="competition-hero">
        <div>
          <p class="competition-kicker">Competición</p>
          <h1 id="competitionHeroTitle">{title}</h1>
          <p class="competition-subtitle" id="competitionHeroSubtitle">Cargando datos...</p>
          <p class="competition-updated" id="competitionUpdated"></p>
        </div>
        <div class="competition-summary-grid" id="competitionSummary" style="display:none"></div>
      </section>

      <nav class="competition-tabs" aria-label="Secciones de la competición">
        <button class="competition-tab active" type="button" data-competition-tab="tabla">Tabla</button>
        <button class="competition-tab" type="button" data-competition-tab="proximos">Próximos partidos</button>
        <button class="competition-tab" type="button" data-competition-tab="ultimos">Últimos resultados</button>
        <button class="competition-tab" type="button" data-competition-tab="equipos">Equipos</button>
      </nav>

      <section class="competition-grid">
        <article class="competition-card competition-section" id="competitionTableCard" data-competition-section="tabla">
          <div class="competition-card-head">
            <div>
              <p class="competition-section-kicker">Posiciones</p>
              <h2>Tabla de posiciones</h2>
            </div>
          </div>
          <div class="competition-table-wrap">
            <table class="competition-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th class="team-cell">Equipo</th>
                  <th>PJ</th>
                  <th>G</th>
                  <th>E</th>
                  <th>P</th>
                  <th>GF</th>
                  <th>GC</th>
                  <th>DG</th>
                  <th>PTS</th>
                </tr>
              </thead>
              <tbody id="competitionTableBody">
                <tr><td colspan="10" class="team-cell">Cargando tabla...</td></tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="competition-card competition-section hidden" data-competition-section="proximos">
          <div class="competition-card-head">
            <div>
              <p class="competition-section-kicker">Calendario</p>
              <h2>Próximos partidos</h2>
            </div>
          </div>
          <div class="competition-list" id="competitionNextList"></div>
        </article>

        <article class="competition-card competition-section hidden" data-competition-section="ultimos">
          <div class="competition-card-head">
            <div>
              <p class="competition-section-kicker">Resultados</p>
              <h2>Últimos partidos</h2>
            </div>
          </div>
          <div class="competition-list" id="competitionLastList"></div>
        </article>

        <article class="competition-card competition-section hidden" data-competition-section="equipos">
          <div class="competition-card-head">
            <div>
              <p class="competition-section-kicker">Participantes</p>
              <h2>Equipos</h2>
            </div>
          </div>
          <div class="competition-teams-grid" id="competitionTeamsGrid"></div>
        </article>
      </section>
    </main>

    <footer>Desarrollado por <strong>AzWink</strong></footer>
    <script src="../competicion.js"></script>
    <script src="../competicion-header-clean.js"></script>
  </body>
</html>
'''


def main():
    os.makedirs(PAGES_DIR, exist_ok=True)

    for competition_id, title in COMPETICIONES:
        path = os.path.join(PAGES_DIR, f"{competition_id}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html_page(competition_id, title))
        print(f"✅ Generada página {path}")


if __name__ == "__main__":
    main()
