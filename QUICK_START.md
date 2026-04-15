# 🚀 Quick Start - Wishlist Feature (SCRUM-1)

## ⚡ 3 Terminales = Aplicación lista

### Terminal 1: Crear cluster k3d
```bash
cd ~/qaf/microservices-demo

# Limpiar cluster anterior (si existe)
k3d cluster delete online-boutique 2>/dev/null || true

# Crear nuevo cluster
k3d cluster create online-boutique --agents 3 --servers 1 --wait

# Verificar que está listo
kubectl get nodes
# Deberías ver: k3d-online-boutique-server-0   Ready
```

### Terminal 2: Deploy con Skaffold
```bash
cd ~/qaf/microservices-demo

# Build y deploy de TODO
skaffold run

# Espera hasta ver: "Deployments stabilized" 
# Esto construirá las imágenes y desplegará todos los servicios
```

### Terminal 3: Acceso local
```bash
cd ~/qaf/microservices-demo

# Abre el frontend en localhost:8080
kubectl port-forward deployment/frontend 8080:8080

# En tu navegador:
# http://localhost:8080          <- Home
# http://localhost:8080/wishlist <- Wishlist
```

---

## 🎯 URLs importantes

| URL | Descripción |
|-----|-------------|
| `http://localhost:8080` | Home page |
| `http://localhost:8080/wishlist` | Wishlist (vacío al iniciar) |
| `http://localhost:8080/product/OLJCESPC7Z` | Ejemplo de producto |
| `http://localhost:8080/cart` | Shopping cart |

---

## ✅ Verificar estado

```bash
# Ver todos los pods
kubectl get pods

# Ver logs del frontend
kubectl logs deployment/frontend -f

# Ver logs del favoritesservice (nueva API)
kubectl logs deployment/favoritesservice -f

# Ver todos los servicios
kubectl get svc
```

---

## 🧪 Ejecutar tests E2E

```bash
cd ~/qaf/microservices-demo/e2e

# Primera vez: instalar dependencias
npm install

# Ejecutar tests
npm test

# Ver resultados con interfaz visual
npm run test:ui

# Modo interactivo
npm run test:headed

# Reportes
npx playwright show-report
```

> **Importante**: La aplicación debe estar corriendo en `localhost:8080` para que los tests funcionen

---

## 🛑 Parar todo

```bash
# Terminal 3: Ctrl+C (detiene port-forward)

# Terminal 2: Ctrl+C (detiene skaffold)

# Terminal 1: Eliminar cluster
k3d cluster delete online-boutique
```

---

## 📦 Qué se deployó

- **Frontend** (Go) - HTTP server con templates
- **FavoritesService** (Go) - Nueva API gRPC para wishlist
- **CartService** (C#) - Carrito de compras
- **ProductCatalogService** (Go) - Catálogo
- **CurrencyService** (Node) - Conversión de monedas
- **Y 8 servicios más...**

---

## 🔧 Estructura del código

```
src/
├── frontend/
│   ├── main.go                    # Entry point
│   ├── wishlist_handlers.go       # Handlers para /wishlist
│   ├── templates/
│   │   └── wishlist.html         # Página de wishlist
│   └── genproto/
│       └── demo_grpc.pb.go       # Proto compilados
│
└── favoritesservice/
    ├── main.go                    # gRPC server del wishlist
    ├── Dockerfile                 # Multi-stage build ARM64
    ├── go.mod / go.sum           # Dependencias Go
    └── Tests/                     # Tests unitarios
```

---

## 📖 Documentación

- `E2E_TESTING.md` - Guía completa de tests
- `.claude/CLAUDE.md` - Notas técnicas del proyecto
- `kubernetes-manifests/` - Configuración de Kubernetes
- `skaffold.yaml` - Configuración de build y deploy

---

## 💡 Tips

- Los comandos `kubectl` solo funcionan si el cluster k3d está corriendo
- Si necesitas reiniciar un pod: `kubectl delete pod <pod-name>`
- Para ver logs en tiempo real: `kubectl logs -f deployment/<nombre>`
- El wishlist usa sesiones HTTP, no requiere autenticación

---

## ❌ Problemas comunes

| Problema | Solución |
|----------|----------|
| `connection refused` | Verifica que el port-forward está activo |
| `ErrImagePull` | Espera más tiempo a que se construyan las imágenes |
| `Pending` pods | Ejecuta `kubectl describe pod <nombre>` para ver detalles |
| Tests fallan | Verifica que `http://localhost:8080` responde |

---

## 🎉 Listo!

Ya tienes:
- ✅ Aplicación corriendo en Kubernetes
- ✅ Wishlist feature funcionando  
- ✅ Tests E2E listos
- ✅ Todo commiteado en git

¡Diviértete! 🚀
