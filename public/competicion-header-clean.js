function limpiarCabezaCompeticion() {
  const summary = document.querySelector("#competitionSummary");
  const updated = document.querySelector("#competitionUpdated");
  const subtitle = document.querySelector("#competitionHeroSubtitle");

  if (summary) {
    summary.innerHTML = "";
    summary.style.display = "none";
  }

  if (updated) {
    updated.textContent = "";
    updated.style.display = "none";
  }

  if (subtitle) {
    subtitle.textContent = subtitle.textContent
      .replace(/\s*·\s*Fuente:\s*.*$/i, "")
      .replace(/^\s*Fuente:\s*.*$/i, "")
      .trim();
  }
}

function obtenerTabActivaCompeticion() {
  const active = document.querySelector(".competition-tab.active");
  return active?.dataset?.competitionTab || "tabla";
}

function actualizarVisibilidadCuadro() {
  const cuadro = document.querySelector("#competitionLigaProfesionalExtras");
  if (!cuadro) return;

  const tabActiva = obtenerTabActivaCompeticion();
  cuadro.style.display = tabActiva === "tabla" ? "" : "none";
}

function iniciarControlCuadro() {
  document.querySelectorAll(".competition-tab").forEach((button) => {
    if (button.dataset.bracketVisibilityBound === "1") return;
    button.dataset.bracketVisibilityBound = "1";

    button.addEventListener("click", () => {
      window.setTimeout(actualizarVisibilidadCuadro, 0);
      window.setTimeout(actualizarVisibilidadCuadro, 80);
    });
  });

  actualizarVisibilidadCuadro();
}

function mantenimientoCompeticion() {
  limpiarCabezaCompeticion();
  iniciarControlCuadro();
  actualizarVisibilidadCuadro();
}

mantenimientoCompeticion();

let cleanHeaderTries = 0;
const cleanHeaderInterval = window.setInterval(() => {
  mantenimientoCompeticion();
  cleanHeaderTries += 1;

  if (cleanHeaderTries > 80) {
    window.clearInterval(cleanHeaderInterval);
  }
}, 100);

const cleanHeaderObserver = new MutationObserver(() => mantenimientoCompeticion());
cleanHeaderObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
