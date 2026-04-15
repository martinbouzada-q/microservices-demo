# microservices-demo (Online Boutique)

## Tech Stack
- Go 1.25 (toolchain go1.26.1) — frontend, checkoutservice, productcatalogservice, shippingservice
- C# / .NET 10.0 — cartservice
- Java 21 / Gradle — adservice
- Node.js — currencyservice, paymentservice
- Python 3.x — emailservice, recommendationservice, shoppingassistantservice, loadgenerator
- gRPC (all inter-service communication)
- OpenTelemetry 1.42.0 (all services)
- gorilla/mux 1.8.1 (frontend HTTP)
- LangChain 1.2.0 + LangGraph 1.0.10rc1 + Google Gemini (shoppingassistantservice)
- Redis / AlloyDB / Google Cloud Spanner (pluggable cart backends)
- pgvector + AlloyDB (shopping assistant RAG embeddings)

## File Placement Guide
| File Type | Location | Example |
|-----------|----------|---------|
| Go gRPC server | `src/<service>/` | `src/checkoutservice/main.go` |
| Go HTTP handlers | `src/frontend/` | `src/frontend/handlers.go` |
| Go templates (SSR) | `src/frontend/templates/` | `src/frontend/templates/home.html` |
| Static assets | `src/frontend/static/` | `src/frontend/static/icons/*.svg` |
| Generated proto stubs (Go) | `src/<service>/genproto/` | `src/frontend/genproto/demo.pb.go` |
| C# gRPC service | `src/cartservice/src/services/` | `src/cartservice/src/services/CartService.cs` |
| C# cart store implementations | `src/cartservice/src/cartstore/` | `src/cartservice/src/cartstore/RedisCartStore.cs` |
| C# tests | `src/cartservice/tests/` | `src/cartservice/tests/CartServiceTests.cs` |
| Java gRPC service | `src/adservice/src/main/java/hipstershop/` | `src/adservice/src/main/java/hipstershop/AdService.java` |
| Proto definitions | `src/<service>/src/main/proto/` or duplicated per service | `src/adservice/src/main/proto/demo.proto` |
| Python gRPC server | `src/<service>/` | `src/emailservice/email_server.py` |
| Load test scenarios | `src/loadgenerator/` | `src/loadgenerator/locustfile.py` |
| Kubernetes manifests | `kubernetes-manifests/` | `kubernetes-manifests/frontend.yaml` |
| Helm chart | `helm-chart/` | `helm-chart/Chart.yaml` |
| Terraform IaC | `terraform/` | `terraform/main.tf` |
| Go unit tests | `src/<service>/` | `src/shippingservice/main_test.go` |

## Essential Commands
| Task | Command |
|------|---------|
| Build & deploy all services | `skaffold run` |
| Build & deploy to staging | `skaffold run --default-repo=us-docker.pkg.dev/$PROJECT_ID/...` |
| Run Go tests | `cd src/<service> && go test ./...` |
| Run C# tests | `dotnet test src/cartservice/` |
| Run load generator | `cd src/loadgenerator && locust` |
| Validate Terraform | `terraform validate terraform/` |
| Build Helm chart | `helm lint helm-chart/` |
| Apply Kubernetes manifests | `kubectl apply -f kubernetes-manifests/` |

## Architecture Pattern
Microservices BFF (Backend-for-Frontend). The `frontend` service is the sole HTTP entry point — it aggregates gRPC calls to all downstream services and renders server-side HTML via Go templates. All inter-service communication is **gRPC only**, using insecure transport (TLS delegated to the network layer).

## Key Conventions
- All Go services use `logrus v1.9.4` + structured JSON logging
- All services export traces via OTLP gRPC to `COLLECTOR_SERVICE_ADDR` when `ENABLE_TRACING=1`
- Service addresses are injected via env vars (e.g. `CART_SERVICE_ADDR`, `CHECKOUT_SERVICE_ADDR`)
- `demo.proto` is duplicated per service — there is no single canonical proto source
- `emailservice.SendOrderConfirmation` logs only — no real email is sent
- `shop_session-id` cookie (48hr TTL) is the only session mechanism; no auth/authz exists
- Cart backend is pluggable: Redis (default), Spanner, AlloyDB — selected at runtime via env/DI config

## Critical Environment Variables
| Variable | Used By | Purpose |
|----------|---------|---------|
| `PORT` | all | Listening port |
| `CART_SERVICE_ADDR` | frontend, checkoutservice | Cart gRPC address |
| `CHECKOUT_SERVICE_ADDR` | frontend | Checkout gRPC address |
| `PRODUCT_CATALOG_SERVICE_ADDR` | frontend, checkoutservice | Catalog gRPC address |
| `CURRENCY_SERVICE_ADDR` | frontend, checkoutservice | Currency gRPC address |
| `SHIPPING_SERVICE_ADDR` | frontend, checkoutservice | Shipping gRPC address |
| `RECOMMENDATION_SERVICE_ADDR` | frontend | Recommendations gRPC address |
| `AD_SERVICE_ADDR` | frontend | Ads gRPC address |
| `SHOPPING_ASSISTANT_SERVICE_ADDR` | frontend | AI assistant address |
| `REDIS_ADDR` | cartservice | Redis connection string |
| `COLLECTOR_SERVICE_ADDR` | all | OTel Collector OTLP endpoint |
| `ENABLE_TRACING` | all | Activate OTel trace export |
| `ENABLE_PROFILER` | Go/Node services | Activate Cloud Profiler |
| `PROJECT_ID`, `REGION` | shoppingassistantservice, productcatalogservice | GCP project for AlloyDB/Secret Manager |