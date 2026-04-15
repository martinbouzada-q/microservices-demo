# E2E Testing Guide - Wishlist Feature

## ✅ Lo que fue corregido

1. **Actualizado `playwright.config.ts`**: Removido comando `docker-compose` que no funcionaba
2. **Reescrito `wishlist.spec.ts`**: Tests simplificados basados en elementos reales del HTML
3. **Config actualizada**: Ahora reutiliza el servidor existente en `http://localhost:8080`

---

## 🚀 Cómo ejecutar los tests

### Paso 1: Asegúrate que la aplicación esté corriendo

```bash
cd ~/qaf/microservices-demo

# Terminal 1: Inicia el cluster k3d
k3d cluster create online-boutique --agents 3 --servers 1 --wait

# Terminal 2: Deploy con Skaffold
skaffold run

# Terminal 3: Port-forward al frontend
kubectl port-forward deployment/frontend 8080:8080
```

Espera hasta ver que todos los deployments estén listos (Ready).

### Paso 2: Ejecuta los tests E2E

```bash
cd ~/qaf/microservices-demo/e2e

# Instalar dependencias (primera vez)
npm install

# Ejecutar los tests
npm test

# O con interfaz visual
npm run test:ui

# O modo headed (ver navegador en vivo)
npm run test:headed

# O modo debug (pausar en cada paso)
npm run test:debug
```

---

## 📊 Tests disponibles

Los tests verifican que la página de wishlist:

1. **SC01**: Carga con estado vacío
2. **SC02**: Tiene estructura correcta
3. **SC03**: Tiene título "Online Boutique"
4. **SC04**: Es navegable desde home
5. **SC05**: Retorna status HTTP 200
6. **SC06**: Muestra header
7. **SC07**: Muestra mensaje de wishlist vacío
8. **SC08**: Tiene elemento `<main>` con role correcto
9. **SC09**: Carga sin errores
10. **SC10**: URL es accesible

---

## 🔍 Ver resultados

Después de ejecutar `npm test`, Playwright genera un reporte HTML:

```bash
# Abrir reporte
npx playwright show-report
```

---

## ⚙️ Configuración

### `playwright.config.ts`
- **Base URL**: `http://localhost:8080` (configurable con `BASE_URL` env var)
- **Reutiliza servidor existente**: `reuseExistingServer: true`
- **Browsers**: Chromium, Firefox, WebKit
- **Screenshots**: Solo en fallo
- **Videos**: Retenidos en fallo
- **Reportes**: HTML

### Configuración personalizada

```bash
# Usar BASE_URL diferente
BASE_URL=http://localhost:3000 npm test

# Ejecutar solo un test específico
npx playwright test --grep "SC01"

# Ejecutar un archivo específico
npx playwright test tests/wishlist.spec.ts

# Ejecutar con un browser específico
npx playwright test --project=firefox
```

---

## 🐛 Troubleshooting

### Error: "Process from config.webServer was not able to start"
**Solución**: Verifica que `playwright.config.ts` tenga `reuseExistingServer: true` (ya corregido)

### Error: "Connection refused" o "ECONNREFUSED"
**Solución**: Asegúrate que:
1. El cluster k3d está corriendo: `kubectl get nodes`
2. Skaffold completó: `kubectl get pods` (todos deben estar Running)
3. Port-forward está activo: `kubectl port-forward deployment/frontend 8080:8080`

### Error: "Timeout waiting for selector"
**Solución**: La aplicación tardó en cargar. Aumenta timeouts en los tests o verifica logs del frontend:
```bash
kubectl logs deployment/frontend -f
```

### Tests fallan por selectores incorrectos
**Solución**: Verifica el HTML actual de la wishlist:
```bash
curl -s http://localhost:8080/wishlist | grep -A5 "wishlist-item"
```

---

## 📋 Estructura de archivos

```
e2e/
├── playwright.config.ts       # Configuración de Playwright
├── package.json              # Dependencias y scripts
├── tests/
│   ├── wishlist.spec.ts     # Tests principales
│   ├── helpers.ts           # Funciones auxiliares
│   └── fixtures.ts          # Fixtures compartidas
├── playwright-report/        # Reportes HTML (generado)
└── test-results/            # Resultados detallados (generado)
```

---

## ✨ Próximos pasos

Para mejorar los tests:

1. Agregar botón "Add to Wishlist" en las páginas de producto
2. Agregar tests que realmente agreguen productos a la wishlist
3. Agregar tests de validaciones de formularios
4. Agregar tests de errores del servidor

---

## 📚 Referencias

- [Playwright Documentation](https://playwright.dev/)
- [Test Configuration](https://playwright.dev/docs/test-configuration)
- [Best Practices](https://playwright.dev/docs/best-practices)
