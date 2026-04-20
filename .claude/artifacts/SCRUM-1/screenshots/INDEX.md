# Screenshots — SCRUM-1

## Status

Las carpetas `before/`, `after/` y `diffs/` están vacías porque la app no estaba corriendo al momento de ejecutar las fases.

## Para generarlas

1. Levantar la app (ej. con skaffold o docker-compose)
2. Correr el script de captura:

```bash
# Con Playwright instalado (v1.59.1 disponible)
BASE_URL=http://localhost:8080 npx playwright test --headed
```

## Páginas a capturar

| Pantalla | Ruta | Estado |
|----------|------|--------|
| Home (con botón wishlist en header) | `/` | Pendiente |
| Página de producto (con botón "Add to Wishlist") | `/product/{id}` | Pendiente |
| Wishlist vacía | `/wishlist` | Pendiente |
| Wishlist con items | `/wishlist` (con sesión) | Pendiente |

## Screenshots de referencia

Los screenshots de SCRUM-5 (antes de la feature wishlist) se encuentran en:
`.claude/artifacts/SCRUM-5/screenshots/before/`
