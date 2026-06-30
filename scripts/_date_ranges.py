"""
_date_ranges.py — Rangos de fecha por competición.

Cada entrada define cuándo empieza y termina la temporada natural.
Competiciones que cruzan años (ej: Champions ago-jun) usan dos rangos.

Formato: list[tuple[str, str]] donde cada string es YYYYMMDD.
"""

from datetime import datetime


def _y(offset=0):
    """Año actual + offset."""
    return datetime.now().year + offset


def rango_anio_completo():
    """Enero–diciembre del año actual."""
    y = _y()
    return [(f"{y}0101", f"{y}1231")]


def rango_temporada_europea():
    """
    Temporadas europeas: julio año anterior – junio año actual.
    Ej: Champions 2024/25 = jul 2024 – jun 2025.
    """
    y = _y()
    return [(f"{y-1}0701", f"{y}0630")]


def rango_temporada_larga():
    """
    Para competiciones que van de agosto a mayo/junio.
    Cubre también la pretemporada.
    """
    y = _y()
    return [(f"{y-1}0801", f"{y}0731")]


def rango_arg_liga():
    """Liga Profesional y Primera Nacional: febrero–diciembre."""
    y = _y()
    return [(f"{y}0201", f"{y}1231")]


def rango_eliminatorias():
    """
    Eliminatorias mundialistas: empezaron en 2023, terminan en 2025/2026.
    Cubrimos los últimos 3 años para tener historial completo.
    """
    y = _y()
    return [(f"{y-2}0101", f"{y}1231")]


def rango_copa_conmebol():
    """
    Libertadores/Sudamericana: febrero–noviembre del año actual.
    """
    y = _y()
    return [(f"{y}0201", f"{y}1130")]


def rango_mundial():
    """Mundiales: solo el año del torneo (suelen durar 1 mes)."""
    y = _y()
    return [(f"{y}0101", f"{y}1231")]


def rango_mundial_sub20():
    """Mundial Sub-20: año actual completo."""
    y = _y()
    return [(f"{y}0101", f"{y}1231")]


def rango_nations_league():
    """UEFA Nations League: septiembre año anterior – junio actual."""
    y = _y()
    return [(f"{y-1}0901", f"{y}0630")]


def rango_copa_nacional():
    """FA Cup, Copa del Rey, Coppa Italia: agosto año anterior – mayo actual."""
    y = _y()
    return [(f"{y-1}0801", f"{y}0531")]
