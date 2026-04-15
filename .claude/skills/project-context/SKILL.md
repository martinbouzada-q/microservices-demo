---
name: project-context
description: Deep architectural knowledge of the microservices-demo (Online Boutique) polyglot e-commerce application — service topology, data flows, checkout orchestration, AI assistant pipeline, and critical gotchas
user-invokable: true
---

# Project Context: microservices-demo (Online Boutique)

## When to Use This Skill
- When implementing a new feature that spans multiple services
- When modifying gRPC contracts (proto changes)
- When debugging inter-service communication issues
- When adding or changing data store integrations
- When working on the AI shopping assistant pipeline
- When modifying the checkout flow
- When setting up a new deployment environment

## Service Topology

```
Browser
  └─► frontend (HTTP :8080, Go/gorilla-mux) — BFF
        ├─► checkoutservice (:5050, Go) — purchase orchestrator
        │     ├─► cartservice (:7070, C#/.NET 10)
        │     ├─► productcatalogservice (:3550, Go)
        │     ├─► currencyservice (:7000, Node.js)
        │     ├─► shippingservice (:50051, Go)
        │     ├─► paymentservice (Node.js)
        │     └─► emailservice (Python) [logs only, no real email]
        ├─► recommendationservice (:8080, Python)
        ├─► adservice (:9555, Java 21)
        └─► shoppingassistantservice (:80, Python/Flask)
              ├─► Google Gemini 1.5-flash (vision + text)
              └─► AlloyDB + pgvector (product embeddings RAG)
```

## Checkout Flow (8 Steps in checkoutservice)
1. `GetCart` — fetch user cart from CartService
2. `GetProduct` — fetch prices for each cart item from ProductCatalogService
3. `Convert` — convert item prices to user's selected currency via CurrencyService
4. `GetQuote` — fetch shipping cost from ShippingService
5. `Convert` — convert shipping cost to user currency via CurrencyService
6. `Charge` — charge credit card via PaymentService
7. `ShipOrder` — trigger shipment via ShippingService
8. `EmptyCart` + `SendOrderConfirmation` — clear cart and send confirmation email (email is a no-op stub)

Any failure in steps 6–8 does **not** roll back the charge — there is no saga/compensation pattern.

## gRPC Services Contract
All services implement methods defined in `demo.proto` (duplicated per service directory — no single source of truth):

| Service | Key RPCs |
|---|---|
| CartService | `AddItem`, `GetCart`, `EmptyCart` |
| ProductCatalogService | `ListProducts`, `GetProduct`, `SearchProducts` |
| ShippingService | `GetQuote`, `ShipOrder` |
| CurrencyService | `GetSupportedCurrencies`, `Convert` |
| PaymentService | `Charge` |
| EmailService | `SendOrderConfirmation` |
| CheckoutService | `PlaceOrder` |
| RecommendationService | `ListRecommendations` |
| AdService | `GetAds` |

## Data Stores

### Redis (cartservice default)
- In-cluster `redis-cart` service (alpine), port 6379
- No TTL configured — carts persist indefinitely
- Terraform `memorystore.tf` exists — production may use Cloud Memorystore instead of in-cluster Redis

### AlloyDB / PostgreSQL
- **productcatalogservice:** reads product catalog using `pgx/v5` + `google-cloud-alloydb-connector`
- **shoppingassistantservice:** stores product vector embeddings using `pgvector` + `SQLAlchemy 2.0`
- Credentials fetched from **Google Cloud Secret Manager** at startup

### Pluggable Cart Backends (cartservice)
Three `ICartStore` implementations: `RedisCartStore`, `SpannerCartStore`, `AlloyDBCartStore`. Backend is selected at runtime — likely via env var or DI registration, not visible in standard Kubernetes manifests.

## AI Shopping Assistant Pipeline
- **Entry:** POST `/bot` on frontend → proxied to shoppingassistantservice Flask endpoint
- **Vision:** user uploads room image → Gemini 1.5-flash generates room description
- **RAG:** description embedded via `models/embedding-001` → similarity search in AlloyDB pgvector → retrieves matching products
- **Orchestration:** LangGraph state machine coordinates vision → retrieval → generation steps
- **Startup requirement:** `PROJECT_ID`, `REGION`, `ALLOYDB_*` env vars **must** be set or the service crashes on startup — these are absent from standard `kubernetes-manifests/`

## Session & Auth
- **No authentication or authorization** — all routes are public by design (demo app)
- Session: random `shop_session-id` UUID cookie, 48-hour max age, set on every request if absent
- No server-side session store — the cookie value alone is the cart key in Redis

## Observability
- **Tracing:** All services export OTLP traces via gRPC to `COLLECTOR_SERVICE_ADDR` when `ENABLE_TRACING=1`; propagation uses W3C TraceContext + Baggage across all gRPC hops via `otelgrpc`
- **Profiling:** Go and Node.js services use Google Cloud Profiler (`ENABLE_PROFILER=1`)
- **Logging:** Go services use `logrus v1.9.4` structured JSON; Node.js uses `pino v10.3.1`; Python uses `python-json-logger`
- No OTel Collector manifest in `kubernetes-manifests/` — collector is deployed separately or via third-party platform

## Gotchas & Non-Obvious Patterns

### Proto is Duplicated — No Shared Source
```
# WRONG assumption: edit one proto file to change all services
src/adservice/src/main/proto/demo.proto       ← one copy
src/currencyservice/...                        ← another copy
src/paymentservice/...                         ← another copy

# RIGHT approach: update EVERY copy of demo.proto and regenerate stubs in each service
```

### gRPC Transport is Insecure by Design
```go
// All Go services do this — do NOT add TLS without a full network policy review
conn, err := grpc.Dial(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
```

### emailservice Does Not Send Email
```python
# email_server.py — SendOrderConfirmation only logs the order
# Do NOT expect actual email delivery in any environment
logger.info("A confirmation email has been sent to %s", request.email)
# (no SMTP call, no SendGrid, nothing)
```

### shoppingassistantservice Crashes Without GCP Env Vars
```python
# Service reads these at startup — missing = immediate crash
PROJECT_ID = os.environ["PROJECT_ID"]
REGION     = os.environ["REGION"]
# Plus ALLOYDB_CLUSTER, ALLOYDB_INSTANCE, ALLOYDB_DB, ALLOYDB_SECRET_NAME
```

### Cart Store Selection (cartservice)
The three `ICartStore` implementations are registered via .NET DI. The active backend is controlled at runtime — check `Program.cs` or `Startup.cs` for the registration logic and the env var that switches between `RedisCartStore`, `SpannerCartStore`, and `AlloyDBCartStore`.

### No Rollback on Checkout Failure
The `PlaceOrder` RPC in `checkoutservice` calls `PaymentService.Charge` at step 6, then `ShippingService.ShipOrder` at step 7. If step 7 or 8 fails, the payment has already been charged with no compensation/rollback. This is a known demo limitation.

### langgraph Is a Release Candidate
```
langgraph==1.0.10rc1  # rc1 — not a stable release
```
Pin to a stable release before any production use.

### Version Skew in Go gRPC
```
shippingservice:    google.golang.org/grpc v1.79.2   ← one minor behind
all other Go svcs:  google.golang.org/grpc v1.79.3
```
Keep in sync when upgrading gRPC across the repo.

## CI/CD Pipeline (GitHub Actions)
- **PRs:** `ci-pr.yaml` — runs `go test`, `dotnet test src/cartservice/`, Helm lint, Kustomize build, Terraform validate
- **Main:** `ci-main.yaml` — builds all Docker images via Skaffold, deploys to staging namespace, smoke tests
- **Trigger:** push + pull_request on `main`
- No automated test coverage for: adservice, currencyservice, emailservice, paymentservice, recommendationservice, shoppingassistantservice

## Adding a New Service — Checklist
1. Create `src/<newservice>/` with its own module/manifest file
2. Copy and update `demo.proto` if adding new RPC methods (update all other copies too)
3. Add Kubernetes `Deployment` + `Service` manifest in `kubernetes-manifests/`
4. Add entry in `skaffold.yaml` under `build.artifacts` and `deploy.kubectl.manifests`
5. Add service address env var to all callers' Kubernetes manifests
6. Wire OTel tracing using the existing `initTracing()` pattern from any sibling service
7. If the service needs AlloyDB/Secret Manager, ensure `PROJECT_ID`/`REGION` env vars are injected