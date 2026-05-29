from datetime import datetime

import generar_competiciones_lpf_fix as fix


def cargar_partidos_lpf_calendario_completo(league_slug, limit=14):
    if league_slug != "arg.1":
        return fix.ORIGINAL_CARGAR_PARTIDOS(league_slug, limit)

    # El problema era que solo se reforzaba mayo, entonces la web arrancaba en Fecha 9.
    # Acá forzamos a consultar todo Apertura + playoffs + Clausura.
    base = fix.ORIGINAL_CARGAR_PARTIDOS(league_slug, limit=500)
    apertura_completa = fix.fetch_scoreboard_range(league_slug, datetime(2026, 1, 1), datetime(2026, 6, 30))
    clausura_completa = fix.fetch_scoreboard_range(league_slug, datetime(2026, 7, 1), datetime(2026, 12, 31))

    partidos = fix.dedupe_matches((base.get("todos") or []) + apertura_completa + clausura_completa)

    for match in partidos:
        if not match.get("fase"):
            match["fase"] = fix.phase_by_date(match)

    finalizados = [p for p in partidos if p.get("completado") or p.get("estado_tipo") == "post"]
    proximos = [p for p in partidos if not (p.get("completado") or p.get("estado_tipo") == "post")]

    finalizados.sort(key=lambda p: p.get("fecha") or "", reverse=True)
    proximos.sort(key=lambda p: p.get("fecha") or "")
    partidos.sort(key=lambda p: p.get("fecha") or "")

    return {
        "ultimos": finalizados[:limit],
        "proximos": proximos[:limit],
        "todos": partidos,
        "total_scoreboard": len(partidos),
        "calendario_completo": True,
        "rangos_refuerzo": {
            "apertura": "20260101-20260630",
            "clausura": "20260701-20261231",
        },
    }


fix.g.cargar_partidos = cargar_partidos_lpf_calendario_completo


if __name__ == "__main__":
    fix.g.main()
