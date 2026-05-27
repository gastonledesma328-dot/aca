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

  cuadro.style.display = obtenerTabActivaCompeticion() === "tabla" ? "" : "none";
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

function mantenimientoCompeticionSeguro() {
  limpiarCabezaCompeticion();
  iniciarControlCuadro();
  actualizarVisibilidadCuadro();
}

mantenimientoCompeticionSeguro();

document.addEventListener("click", (event) => {
  if (event.target.closest(".competition-tab")) {
    window.setTimeout(mantenimientoCompeticionSeguro, 0);
    window.setTimeout(mantenimientoCompeticionSeguro, 80);
  }
});

let cleanHeaderTries = 0;
const cleanHeaderInterval = window.setInterval(() => {
  mantenimientoCompeticionSeguro();
  cleanHeaderTries += 1;

  if (cleanHeaderTries > 40) {
    window.clearInterval(cleanHeaderInterval);
  }
}, 150);
