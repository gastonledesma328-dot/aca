# Deploy ordenado en Cloudflare

Este repo quedó ordenado para que Cloudflare despliegue solo la carpeta `public/`.

## Archivo clave

`wrangler.jsonc` apunta a:

```json
"assets": {
  "directory": "./public"
}
```

Así Cloudflare ya no intenta subir `.git/`, `.github/`, `scripts/` ni archivos internos.

## Qué va online

La carpeta `public/` contiene solamente la web final:

- `index.html`
- `app.js`
- `styles.css`
- `equipo.html`
- `img/`
- `data/` con JSON públicos
- `juegos/` con los juegos
- `juegos/adivinajugador/imagenes_jugadores_365/`

## Qué queda interno

Fuera de `public/` quedan los archivos de trabajo:

- `.github/workflows/`
- `scripts/`
- `requirements_*.txt`
- `data/` fuente
- `equipos.json`

## Importante

Cuando el workflow de Adivina el Jugador corre, también copia los JSON e imágenes actualizados a `public/`, para que Cloudflare despliegue lo último.
