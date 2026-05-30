import scraper_primera_nacional as scraper

# Primera Nacional tiene 36 fechas. Para reconstruir el calendario completo
# desde los fixtures de cada equipo no alcanza con 5 próximos + 10 resultados.
# Guardamos un margen amplio por equipo para cubrir toda la temporada.
scraper.MAX_PROXIMOS_PARTIDOS = 80
scraper.MAX_RESULTADOS = 80


if __name__ == "__main__":
    scraper.main()
