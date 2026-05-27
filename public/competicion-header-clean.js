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

limpiarCabezaCompeticion();

let cleanHeaderTries = 0;
const cleanHeaderInterval = window.setInterval(() => {
  limpiarCabezaCompeticion();
  cleanHeaderTries += 1;

  if (cleanHeaderTries > 80) {
    window.clearInterval(cleanHeaderInterval);
  }
}, 100);

const cleanHeaderObserver = new MutationObserver(() => limpiarCabezaCompeticion());
cleanHeaderObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
