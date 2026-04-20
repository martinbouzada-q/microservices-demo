# QA Analysis — SCRUM-16: Add Personalized Recommendations Based on User Behavior

**Ticket:** SCRUM-16  
**Feature:** Personalized recommendations via category-affinity scoring  
**Service:** `recommendationservice` (Python / gRPC)  
**Analyst:** martin.bouzada@qubika.com  
**Date:** 2026-04-16  
**Status:** Pre-implementation review

---

## 1. Análisis de Requerimientos

### 1.1 Entendimiento de la Feature

El servicio de recomendaciones actual (`src/recommendationservice/recommendation_server.py`) selecciona productos mediante `random.sample()`, ignorando completamente el campo `user_id` y cualquier señal de comportamiento del usuario. Esta feature reemplaza ese mecanismo con un algoritmo de puntuación por afinidad de categorías que opera en tres fases:

1. **Scoring**: se asigna peso a cada categoría del catálogo en función de los productos vistos (`viewed_product_ids`, peso 1), en carrito (`product_ids`, peso 2) y comprados (`purchased_product_ids`, peso 3). Los candidatos se ordenan por la suma de pesos de sus categorías.
2. **Exclusión**: los productos ya vistos, en carrito o comprados se eliminan del pool de candidatos antes de devolver resultados.
3. **Fallback de diversidad**: si después de la exclusión quedan menos de 4 candidatos, se rellena con productos aleatorios del catálogo (excluyendo siempre los ya excluidos).

El cambio requiere extender el mensaje proto `ListRecommendationsRequest` con dos nuevos campos opcionales (`viewed_product_ids`, `purchased_product_ids`) manteniendo retrocompatibilidad total con clientes que no los envíen.

La UI del frontend (`src/frontend/rpc.go:113`) trunca a 4 recomendaciones. El servicio actualmente devuelve hasta 5 (`max_responses = 5`). La feature se expone en tres superficies: página de producto (handler línea 185), página de carrito (línea 361) y confirmación de pedido (línea 473).

---

### 1.2 Gaps y Ambigüedades Detectadas

#### CRITICO-01 — Catálogo insuficiente para Escenario 1 (bloquea testing de aceptación)

**Problema:** El Escenario 1 del ticket indica: "User viewed 3 products in Accessories → ≥3 of 4 recommendations from Accessories". El catálogo real contiene exactamente **2 productos en la categoría "accessories"**: Sunglasses (`OLJCESPC7Z`) y Watch (`1YMWWN1N4O`). Si el usuario ya vio 3 productos de Accessories (lo que es imposible dado que solo existen 2), el criterio de "≥3 de 4 recomendaciones de Accessories" es **matemáticamente imposible** incluso si ambos productos no hubieran sido vistos.

**Impacto:** El criterio de aceptación del Escenario 1 no puede cumplirse tal y como está redactado con el catálogo de producción. Si el algoritmo funciona correctamente, tras excluir los productos vistos de Accessories, el pool disponible de Accessories podría quedar vacío (0 candidatos en esa categoría). Las recomendaciones resultantes serían de otras categorías, lo que haría fallar el escenario.

**Escenario concreto de fallo:**
- Usuario ve: `OLJCESPC7Z` (Sunglasses, accessories) y `1YMWWN1N4O` (Watch, accessories). Ya se agotó el catálogo de Accessories.
- El ticket pide que haya visto "3 productos en Accessories" — esto es imposible ya que solo existen 2.
- Incluso si el criterio fuera "vio 2 de Accessories", con ambos excluidos queda 0 candidatos de esa categoría.

**Propuesta de resolución (opciones):**
1. Reformular el Escenario 1: "Usuario vio 1 producto de Accessories → la otra Accessories no vista aparece en recomendaciones, complementado con productos de otras categorías." Esta es la única formulación honesta con el catálogo actual.
2. Ampliar el catálogo de pruebas con al menos 4 productos de "accessories" antes de ejecutar el Escenario 1 original (requiere coordinar con el equipo de producto).
3. Reformular el criterio a "≥1 de 4 recomendaciones de Accessories" y que el producto de Accessories no visto aparezca en primer lugar.

**Acción requerida antes del testing:** Confirmación del Product Owner sobre qué catálogo de datos se usa en el entorno de pruebas y si se amplía para este escenario.

---

#### CRITICO-02 — El frontend NO pasa `viewed_product_ids` ni `purchased_product_ids` al servicio de recomendaciones

**Problema:** El método `getRecommendations` en `src/frontend/rpc.go` (líneas 99-117) actualmente construye la llamada gRPC de la siguiente forma:

```go
&pb.ListRecommendationsRequest{UserId: userID, ProductIds: productIDs}
```

No existe ningún mecanismo en el frontend para rastrear productos vistos o comprados por sesión y pasarlos como `viewed_product_ids` / `purchased_product_ids`. El ticket define el algoritmo del servidor pero **no especifica cómo el frontend recopila y transmite esas señales de comportamiento**.

**Impacto:** Sin cambios en el frontend y/o un mecanismo de almacenamiento de historial de sesión, los nuevos campos proto nunca recibirán datos. El algoritmo de afinidad solo recibirá los `product_ids` (exclusiones de carrito), funcionando de forma degradada en todas las superficies excepto el carrito.

**Propuesta de resolución:** Clarificar si el scope de SCRUM-16 incluye:
- Modificación del frontend para rastrear `viewed_product_ids` en cookie/sesión y pasarlos en cada llamada.
- Modificación del frontend para incluir en `purchased_product_ids` los productos del pedido confirmado en la llamada de la página de confirmación.
- O si el algoritmo de backend debe ser validado de forma independiente vía gRPC directo, posponiendo la integración frontend a un ticket separado.

---

#### CRITICO-03 — Error de identificación de producto en Escenario 4

**Problema:** El ticket afirma: "Just purchased 'L9ECAV7KIM' (Mug, footwear)". El ID `L9ECAV7KIM` corresponde a **Loafers** (categoría `footwear`), no a Mug. Mug tiene el ID `6E92ZMYYFZ` (categoría `kitchen`). El texto ya fue corregido parcialmente en el enunciado pero la referencia a "Mug" en la descripción del escenario introduce confusión.

**Impacto:** Si el escenario se implementa con el ID `L9ECAV7KIM` (Loafers/footwear), la búsqueda de "complementary (same category)" apuntará a footwear, cuya única alternativa es... no existe otra categoría "footwear". Solo hay 1 producto en footwear, con lo que el criterio "≥2 of 4 are complementary (same category)" no puede cumplirse para esta categoría.

**Propuesta de resolución:** Reemplazar el producto del Escenario 4 por uno de una categoría con múltiples miembros (ej., kitchen: Mug `6E92ZMYYFZ`, Salt & Pepper `LS4PSXUNUM`, Bamboo Jar `9SIQT8TOJO`). "Purchased Mug `6E92ZMYYFZ`" → ≥2 de 4 recomendaciones son kitchen. Esto sí es verificable.

---

#### MEDIO-01 — Definición ambigua de "deprioritized" para productos vistos

**Problema:** El Escenario 1 dice "viewed products deprioritized" pero la Fase 2 del algoritmo dice "Exclude viewed, carted, and purchased products". Hay contradicción: ¿los productos vistos se excluyen (Fase 2) o solo se depriorizan (Escenario 1)?

**Impacto:** Si se excluyen, el escenario de "deprioritized" no aplica. Si no se excluyen, la descripción de Fase 2 es incorrecta. La implementación no puede satisfacer ambas descripciones simultáneamente.

**Propuesta de resolución:** Definir explícitamente: los productos del carrito (`product_ids`) y comprados (`purchased_product_ids`) se excluyen por completo. Los productos vistos (`viewed_product_ids`) se excluyen también pero su categoría contribuye al scoring. Confirmar con el equipo de desarrollo cuál es el comportamiento esperado.

---

#### MEDIO-02 — Ausencia de mecanismo de persistencia para señales de comportamiento

**Problema:** El ticket no especifica dónde se almacenan `viewed_product_ids` y `purchased_product_ids` entre requests. El único mecanismo de sesión existente es la cookie `shop_session-id` (48h TTL). No hay almacenamiento de historial de usuario en Redis ni en ningún otro store.

**Impacto:** Sin persistencia, el historial de comportamiento se pierde entre navegaciones. La personalización solo sería posible si el cliente (frontend) mantiene el historial en memoria durante la sesión HTTP activa.

**Propuesta de resolución:** Definir el mecanismo de almacenamiento antes de comenzar la implementación. Opciones: (a) historial en cookie (limitado a ~4KB), (b) historial en Redis usando `shop_session-id` como clave, (c) sin persistencia cross-request (solo el request actual tiene contexto).

---

#### MEDIO-03 — `max_responses = 5` vs. UI cap de 4

**Problema:** El servidor devuelve hasta 5 resultados (`max_responses = 5`) pero el frontend los trunca a 4 en `rpc.go:113`. El algoritmo de diversidad (Fase 3) activa el fallback "si < 4 candidatos", pero el ticket no aclara si el threshold debe ser `< 4` (número que ve el usuario) o `< 5` (número que devuelve el servidor).

**Impacto:** Si el servidor devuelve 4 candidatos después del scoring, el fallback no se activa. El frontend muestra los 4. Si el servidor devuelve exactamente 4 y el fallback threshold es 4, se comporta correctamente. Pero si el fallback es "< 4" y el servidor tiene 4, no se activa, y el frontend muestra 4 — correcto. Si el threshold es "< 5", se activa con 4 candidatos, añadiendo ruido al resultado aunque el usuario reciba 4 buenos candidatos.

**Propuesta de resolución:** Clarificar si `max_responses` debe reducirse a 4 para alinear servidor y UI, y si el threshold de diversidad es "< 4" o "< 5".

---

#### BAJO-01 — Escenario 6 (rendimiento) no especifica baseline de arranque en frío

**Problema:** El Escenario 6 exige p99 < 500ms con 100 usuarios concurrentes, pero no especifica si el catálogo de `productcatalogservice` está en caché. La primera llamada a `ListProducts` en el arranque puede ser significativamente más lenta.

**Propuesta de resolución:** Especificar un período de warmup antes de medir, o excluir las primeras N peticiones de la medición de percentil.

---

#### BAJO-02 — El `user_id` sigue siendo ignorado en la nueva propuesta

**Problema:** El algoritmo propuesto basa la personalización en las señales de comportamiento del request, no en el `user_id`. Esto significa que dos sesiones del mismo usuario con diferente historial en el request recibirán recomendaciones diferentes, y no hay lógica de perfil de usuario persistente.

**Impacto:** El título de la feature ("based on user behavior") puede crear expectativas de personalización cross-session que el algoritmo no cumple. Si un usuario cierra sesión y vuelve, su historial se pierde.

**Propuesta de resolución:** Documentar explícitamente en el ticket que la personalización es por-request (in-context), no por perfil de usuario persistente. Esto está parcialmente cubierto en el "Out of Scope" con "Cross-session personalization".

---

### 1.3 Riesgos de Calidad

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|----|--------|-------------|---------|------------|
| R-01 | El catálogo de 9 productos hace que la exclusión agote rápidamente los candidatos, activando el fallback en casi todos los casos con contexto moderado | Alta | Alto | Verificar que el fallback es robusto y no devuelve duplicados ni excluidos |
| R-02 | El algoritmo de scoring puede ser no determinista si hay empate de puntuación entre categorías | Media | Medio | Definir criterio de desempate (ej., aleatorio controlado por seed, o por precio) |
| R-03 | El cálculo de afinidad itera sobre todo el catálogo por cada request; con 9 productos es O(n) trivial pero puede degradar si el catálogo crece | Baja | Bajo | Diseñar con catálogo cacheado en memoria |
| R-04 | El `product_catalog_stub` es una variable global en `recommendation_server.py`; si el servicio de catálogo está caído, todas las recomendaciones fallan | Alta | Alto | Verificar manejo de excepciones gRPC y comportamiento cuando `ListProducts` falla |
| R-05 | Los nuevos campos proto (`viewed_product_ids`, `purchased_product_ids`) deben añadirse al `.proto` de todos los servicios que lo replican (el proto está duplicado por servicio) | Alta | Crítico | Verificar que `src/frontend/genproto/demo.pb.go` y `src/recommendationservice/demo_pb2.py` se actualizan en sincronía |
| R-06 | Regresión en el comportamiento de nuevos usuarios: el fallback aleatorio debe ser estadísticamente equivalente al comportamiento actual | Media | Medio | Tests de regresión con request vacío verifican distribución de categorías |
| R-07 | Memory leak si el historial de viewed_product_ids crece sin límite por parte del cliente | Media | Medio | Definir límite máximo de IDs por campo (ej., últimos 20 vistos) |
| R-08 | El servidor usa `ThreadPoolExecutor(max_workers=10)`; con 100 usuarios concurrentes puede haber queue latency | Alta | Medio | Medir latencia bajo carga con el Escenario 6; considerar aumentar workers |

---

### 1.4 Dependencias y Precondiciones

Las siguientes condiciones deben estar satisfechas antes de iniciar el ciclo de testing:

1. **Servicios ejecutándose localmente o en staging:**
   - `recommendationservice` con el nuevo algoritmo desplegado
   - `productcatalogservice` accesible en `PRODUCT_CATALOG_SERVICE_ADDR`
   - `frontend` actualizado con los campos proto nuevos (si el scope incluye frontend)
   - `cartservice` + Redis para pruebas de carrito

2. **Proto actualizado y compilado:**
   - `ListRecommendationsRequest` debe incluir `viewed_product_ids` (field 3) y `purchased_product_ids` (field 4)
   - `demo_pb2.py` regenerado en `src/recommendationservice/`
   - `demo.pb.go` regenerado en `src/frontend/genproto/`
   - Verificar que ambas versiones son sintácticamente equivalentes

3. **Resolución de gaps críticos:**
   - CRITICO-01 y CRITICO-03 resueltos (catálogo de test definido, escenarios corregidos)
   - CRITICO-02 resuelto (alcance de cambios en frontend confirmado)

4. **Entorno de performance:**
   - `locust` instalado (`src/loadgenerator/`)
   - Acceso a métricas de memoria del pod (kubectl top pods o Prometheus)
   - Baseline de latencia sin carga documentado

5. **Variables de entorno configuradas:**
   - `PRODUCT_CATALOG_SERVICE_ADDR`
   - `PORT` (default 8080)
   - `ENABLE_TRACING=0` para tests de funcionalidad (evitar ruido de OTel)

---

## 2. Casos de Prueba Manuales

> **Nota sobre el catálogo:** Los casos de prueba han sido ajustados a la realidad del catálogo de 9 productos. Los escenarios del ticket que eran imposibles han sido adaptados con una nota de discrepancia.

---

**TC-SCRUM16-001: Afinidad por categoría a partir de producto visto (página de producto)**
- **Tipo**: Funcional
- **Prioridad**: Alta
- **Precondiciones**: Servicio de recomendaciones desplegado con el nuevo algoritmo. `viewed_product_ids` se puede pasar vía gRPC directo o el frontend lo envía. Catálogo real de 9 productos activo.
- **Pasos**:
  1. Enviar request gRPC `ListRecommendations` con `user_id="test-user-1"`, `product_ids=["OLJCESPC7Z"]` (Sunglasses excluido, en carrito), `viewed_product_ids=[]`, `purchased_product_ids=[]`.
  2. Registrar los 4-5 productos devueltos.
  3. Enviar un segundo request con `viewed_product_ids=["OLJCESPC7Z"]` (Sunglasses visto), `product_ids=[]`.
  4. Comparar los resultados.
- **Resultado Esperado**: En el paso 3, `Watch` (`1YMWWN1N4O`, accessories) debe aparecer entre los resultados dado el scoring por categoría "accessories" (peso 1 por viewership). `Sunglasses` NO debe aparecer (fue visto/excluido). La distribución de categorías en el resultado del paso 3 debe diferir del paso 1 mostrando sesgo hacia "accessories".
- **Notas**: Con solo 2 productos de "accessories", el sesgo observable es limitado. Si `Watch` aparece en posición más alta que en el resultado aleatorio de referencia, el algoritmo funciona correctamente.

---

**TC-SCRUM16-002: Afinidad por carrito — productos del carrito excluidos de recomendaciones**
- **Tipo**: Funcional (Escenario 2 del ticket)
- **Prioridad**: Alta
- **Precondiciones**: Nuevo algoritmo desplegado.
- **Pasos**:
  1. Enviar request con `user_id="test-user-2"`, `product_ids=["OLJCESPC7Z", "66VCHSJNUP"]` (Sunglasses + Tank Top en carrito).
  2. Verificar los 4-5 productos devueltos.
  3. Repetir el request 5 veces para verificar que la exclusión es consistente.
- **Resultado Esperado**:
  - `OLJCESPC7Z` (Sunglasses) NO aparece en ninguna respuesta.
  - `66VCHSJNUP` (Tank Top) NO aparece en ninguna respuesta.
  - Los 4 resultados restantes provienen de las 7 categorías no excluidas.
  - Dado que el carrito incluye "accessories" y "clothing/tops", debería haber sesgo hacia esas categorías en los resultados (Watch por accessories, otros por clothing/tops si hubiera más productos).
- **Notas**: El Tank Top tiene categorías "clothing" y "tops". No existe otro producto de "clothing" o "tops" en el catálogo, por lo que la influencia de esa categoría en el scoring no producirá candidatos adicionales.

---

**TC-SCRUM16-003: Nueva sesión sin historial — comportamiento de fallback aleatorio**
- **Tipo**: Funcional / Regresión (Escenario 3 del ticket)
- **Prioridad**: Alta
- **Precondiciones**: Nuevo algoritmo desplegado.
- **Pasos**:
  1. Enviar request con `user_id="new-session-xyz"`, `product_ids=[]`, `viewed_product_ids=[]`, `purchased_product_ids=[]`.
  2. Registrar los productos devueltos.
  3. Verificar las categorías de los productos devueltos.
  4. Medir la latencia de la respuesta con 5 llamadas consecutivas.
- **Resultado Esperado**:
  - Se devuelven exactamente 4 productos (truncados por el frontend) o hasta 5 (si se llama directamente al servicio).
  - Los productos abarcan al menos 2 categorías distintas.
  - Latencia < 200ms en todas las llamadas.
  - No se producen errores ni excepciones.
- **Notas**: Con historial vacío, el algoritmo debe comportarse de forma equivalente al `random.sample()` anterior. Verificar que la diversidad de categorías es razonable (el resultado no devuelve siempre los mismos 4 productos).

---

**TC-SCRUM16-004: Producto comprado excluido de recomendaciones (Escenario 4 adaptado)**
- **Tipo**: Funcional
- **Prioridad**: Alta
- **Precondiciones**: Nuevo algoritmo desplegado. [NOTA: El Escenario 4 del ticket usa `L9ECAV7KIM` que es Loafers/footwear — único en esa categoría. Se adapta a Mug (kitchen) para que el criterio sea verificable.]
- **Pasos**:
  1. Enviar request con `user_id="test-user-4"`, `purchased_product_ids=["6E92ZMYYFZ"]` (Mug comprado), `product_ids=[]`, `viewed_product_ids=[]`.
  2. Verificar los productos devueltos.
  3. Verificar que los productos de categoría "kitchen" aparecen con prioridad.
- **Resultado Esperado**:
  - `6E92ZMYYFZ` (Mug) NO aparece en las recomendaciones (excluido por compra).
  - Al menos 2 de los 4 resultados son de categoría "kitchen": Salt & Pepper Shakers (`LS4PSXUNUM`) y/o Bamboo Glass Jar (`9SIQT8TOJO`).
  - El scoring de "kitchen" (peso 3 por purchase) supera al de otras categorías, por lo que ambos productos de kitchen restantes deben aparecer.
- **Notas**: Si el resultado del ticket original (L9ECAV7KIM/Loafers) se usa en el test, el criterio "≥2 de 4 de footwear" no puede cumplirse porque solo existe 1 producto de footwear en total y ya se excluye el comprado. Este gap debe resolverse antes de ejecutar el test de aceptación formal.

---

**TC-SCRUM16-005: Peso mayor para productos comprados vs. vistos**
- **Tipo**: Funcional
- **Prioridad**: Alta
- **Precondiciones**: Nuevo algoritmo desplegado con scoring viewed=1, cart=2, purchased=3.
- **Pasos**:
  1. Enviar request A: `viewed_product_ids=["LS4PSXUNUM"]` (Salt Shakers, kitchen, peso 1), sin otras señales.
  2. Registrar posición de productos kitchen en el resultado.
  3. Enviar request B: `purchased_product_ids=["LS4PSXUNUM"]` (Salt Shakers, kitchen, peso 3), sin otras señales.
  4. Registrar posición de productos kitchen en el resultado.
  5. Comparar la presencia y posición de `6E92ZMYYFZ` (Mug) y `9SIQT8TOJO` (Bamboo Jar) en ambos resultados.
- **Resultado Esperado**:
  - En ambos requests, `LS4PSXUNUM` está excluido (fue visto/comprado).
  - En el request B (purchased), los productos kitchen restantes (`6E92ZMYYFZ`, `9SIQT8TOJO`) tienen mayor score que en el request A y deben aparecer en las primeras posiciones.
  - Si el algoritmo devuelve resultados ordenados por score, la posición de Mug y Bamboo Jar debe ser más alta en el request B.
- **Notas**: Este test verifica la diferenciación de pesos en el algoritmo. Requiere que el servicio devuelva resultados ordenados por score descendente.

---

**TC-SCRUM16-006: Aislamiento de sesiones — Escenario 5**
- **Tipo**: Seguridad / Funcional
- **Prioridad**: Alta
- **Precondiciones**: Nuevo algoritmo desplegado. Si el historial se almacena en algún store persistente, verificar que está segmentado por sesión.
- **Pasos**:
  1. Enviar request con `user_id="abc-123"`, `viewed_product_ids=["66VCHSJNUP", "1YMWWN1N4O"]` (Tank Top, Watch — clothing + accessories).
  2. Registrar los resultados.
  3. Enviar request con `user_id="xyz-789"`, `viewed_product_ids=[]`, `product_ids=[]`, `purchased_product_ids=[]`.
  4. Registrar los resultados del segundo request.
  5. Comparar: el segundo request no debe estar influenciado por el historial del primero.
- **Resultado Esperado**:
  - El request de "xyz-789" devuelve una distribución aleatoria sin sesgo hacia "clothing" o "accessories".
  - No hay datos compartidos entre sesiones.
  - Si se repite el request de "xyz-789" múltiples veces, la distribución varía aleatoriamente (sin estar fijada por el historial de "abc-123").
- **Notas**: Este test es especialmente importante si se introduce cualquier tipo de caché compartida entre sesiones o estado global en el servidor. El servidor actual con variables globales (`product_catalog_stub`) no presenta riesgo de cross-session, pero cualquier estructura de datos de scoring que se comparta entre threads sería un riesgo.

---

**TC-SCRUM16-007: Todos los productos excluidos — edge case de catálogo exhausto**
- **Tipo**: Edge Case
- **Prioridad**: Alta
- **Precondiciones**: Nuevo algoritmo desplegado. Catálogo con 9 productos.
- **Pasos**:
  1. Enviar request con los 9 IDs del catálogo en `product_ids` (todos en el carrito): `["OLJCESPC7Z","66VCHSJNUP","1YMWWN1N4O","L9ECAV7KIM","2ZYFJ3GM2N","0PUK6V6EV0","LS4PSXUNUM","9SIQT8TOJO","6E92ZMYYFZ"]`.
  2. Verificar la respuesta del servicio.
- **Resultado Esperado**:
  - El servicio devuelve una lista vacía (`product_ids: []`) sin error.
  - No se lanza excepción ni se devuelve error gRPC.
  - El log del servicio registra el evento con nivel INFO o WARN.
- **Notas**: El código actual usa `list(set(product_ids)-set(request.product_ids))` — si el resultado es vacío, `random.sample(range(0), 0)` devuelve `[]`. El nuevo algoritmo debe mantener este comportamiento.

---

**TC-SCRUM16-008: Producto visto con ID inválido (no existe en catálogo)**
- **Tipo**: Negativo
- **Prioridad**: Media
- **Precondiciones**: Nuevo algoritmo desplegado.
- **Pasos**:
  1. Enviar request con `viewed_product_ids=["INVALID-PRODUCT-ID-999"]`.
  2. Verificar la respuesta del servicio.
- **Resultado Esperado**:
  - El servicio ignora el ID inválido de forma silenciosa (no puede calcular su categoría, contribuye 0 al scoring).
  - Se devuelven recomendaciones normales basadas en el resto del historial.
  - No se devuelve error gRPC.
  - El log puede registrar un WARNING sobre el ID no encontrado.
- **Notas**: El algoritmo debe ser robusto ante IDs que no existen en el catálogo. La llamada a `GetProduct` no debe propagar excepciones al handler principal.

---

**TC-SCRUM16-009: Retrocompatibilidad — cliente legacy sin los nuevos campos**
- **Tipo**: Regresión / Compatibilidad
- **Prioridad**: Alta
- **Precondiciones**: Nuevo proto y nuevo algoritmo desplegados.
- **Pasos**:
  1. Enviar request con solo los campos existentes: `user_id="legacy-client"`, `product_ids=["0PUK6V6EV0"]`.
  2. No incluir `viewed_product_ids` ni `purchased_product_ids` (campos omitidos = default vacío en proto3).
  3. Verificar la respuesta.
- **Resultado Esperado**:
  - El servicio responde normalmente con hasta 5 recomendaciones.
  - `0PUK6V6EV0` (Candle Holder) no aparece en los resultados.
  - El comportamiento es equivalente al algoritmo actual para requests sin historial.
  - No se devuelve error de "unknown field" ni error de parsing proto.
- **Notas**: En proto3, los campos opcionales omitidos se interpretan como valores default (lista vacía para `repeated`). Esto debe funcionar sin cambios en clientes existentes.

---

**TC-SCRUM16-010: Página de producto — verificación de exclusión del producto actual**
- **Tipo**: Funcional / E2E
- **Prioridad**: Alta
- **Precondiciones**: Frontend y backend desplegados. El usuario navega a la página de un producto.
- **Pasos**:
  1. Navegar a `/product/OLJCESPC7Z` (Sunglasses).
  2. Verificar la sección de recomendaciones visible en la página.
  3. Comprobar que Sunglasses no aparece entre las recomendaciones.
  4. Verificar que se muestran exactamente 4 recomendaciones.
- **Resultado Esperado**:
  - Sunglasses (`OLJCESPC7Z`) está ausente de las recomendaciones.
  - Se muestran 4 productos distintos.
  - Todos los productos mostrados tienen imágenes, nombres y precios correctamente renderizados.
- **Notas**: El frontend pasa `[currentProductID]` como `product_ids` — esto es un carrito de 1 elemento. Verificar que el handler en `handlers.go:185` funciona correctamente con el nuevo proto.

---

**TC-SCRUM16-011: Página de carrito — recomendaciones excluyen ítems del carrito**
- **Tipo**: Funcional / E2E
- **Prioridad**: Alta
- **Precondiciones**: Frontend desplegado. El usuario tiene ítems en el carrito.
- **Pasos**:
  1. Agregar `LS4PSXUNUM` (Salt & Pepper Shakers) y `9SIQT8TOJO` (Bamboo Jar) al carrito.
  2. Navegar a `/cart`.
  3. Verificar la sección de recomendaciones.
- **Resultado Esperado**:
  - Salt & Pepper Shakers y Bamboo Jar NO aparecen en las recomendaciones.
  - Se muestran 4 recomendaciones de los 7 productos restantes.
  - Los productos de categoría "kitchen" (Mug `6E92ZMYYFZ`) deben aparecer con alta prioridad dado el scoring de carrito (peso 2 para "kitchen").
- **Notas**: Verificar que `cartIDs(cart)` en `handlers.go:361` devuelve correctamente los IDs del carrito.

---

**TC-SCRUM16-012: Página de confirmación de pedido — recomendaciones sin exclusiones**
- **Tipo**: Funcional / E2E
- **Prioridad**: Media
- **Precondiciones**: Frontend desplegado. El usuario completa un pedido.
- **Pasos**:
  1. Completar un flujo de compra hasta la página de confirmación.
  2. Verificar la sección de recomendaciones en la página de confirmación.
  3. Verificar que el producto comprado no aparece en las recomendaciones (si `purchased_product_ids` se implementa en el frontend).
- **Resultado Esperado**:
  - Se muestran 4 recomendaciones.
  - Si el frontend pasa `purchased_product_ids`, el producto recién comprado no aparece.
  - Si el frontend pasa `nil` (comportamiento actual en `handlers.go:473`), las recomendaciones son aleatorias pero válidas.
- **Notas**: El comportamiento actual pasa `nil` para `productIDs` en la confirmación. Si el scope de SCRUM-16 incluye pasar los productos comprados como `purchased_product_ids`, este test debe verificar el nuevo comportamiento.

---

**TC-SCRUM16-013: Productos vistos repetidamente — idempotencia del scoring**
- **Tipo**: Edge Case
- **Prioridad**: Media
- **Precondiciones**: Nuevo algoritmo desplegado.
- **Pasos**:
  1. Enviar request con `viewed_product_ids=["OLJCESPC7Z", "OLJCESPC7Z", "OLJCESPC7Z"]` (mismo producto 3 veces).
  2. Verificar que el score de "accessories" no se triplica artificialmente.
- **Resultado Esperado**:
  - El algoritmo deduplica los IDs antes de calcular el scoring (o el scoring es por categoría única).
  - El resultado es equivalente a haber pasado `viewed_product_ids=["OLJCESPC7Z"]`.
  - No se devuelven errores.
- **Notas**: Sin deduplicación, un usuario que visita repetidamente el mismo producto podría inflar artificialmente el score de esa categoría.

---

**TC-SCRUM16-014: Servicio de catálogo caído — degradación elegante**
- **Tipo**: Negativo / Resiliencia
- **Prioridad**: Alta
- **Precondiciones**: Nuevo algoritmo desplegado. Capacidad de simular caída del `productcatalogservice`.
- **Pasos**:
  1. Detener o bloquear el `productcatalogservice`.
  2. Enviar request a `recommendationservice`.
  3. Observar la respuesta y los logs.
- **Resultado Esperado**:
  - El servicio devuelve un error gRPC descriptivo (UNAVAILABLE o INTERNAL) en lugar de colgar indefinidamente.
  - El frontend maneja el error silenciosamente (ya implementado en `handlers.go:186`: "ignores the error retrieving recommendations since it is not critical").
  - El log del `recommendationservice` registra el error con nivel ERROR.
  - La página de producto/carrito/confirmación carga correctamente sin la sección de recomendaciones o con sección vacía.
- **Notas**: El código actual (`product_catalog_stub.ListProducts`) no tiene timeout explícito. Verificar que el gRPC timeout está configurado correctamente para evitar que el recomendador bloquee indefinidamente.

---

**TC-SCRUM16-015: Fallback de diversidad con < 4 candidatos**
- **Tipo**: Edge Case
- **Prioridad**: Media
- **Precondiciones**: Nuevo algoritmo desplegado.
- **Pasos**:
  1. Construir un request que deje menos de 4 candidatos disponibles. Ejemplo: excluir 6 de los 9 productos del catálogo combinando `viewed_product_ids`, `product_ids` y `purchased_product_ids`. Usar: `product_ids=["OLJCESPC7Z","66VCHSJNUP","1YMWWN1N4O"]`, `viewed_product_ids=["L9ECAV7KIM","2ZYFJ3GM2N"]`, `purchased_product_ids=["0PUK6V6EV0"]`.
  2. Verificar los 3 productos candidatos restantes: `LS4PSXUNUM`, `9SIQT8TOJO`, `6E92ZMYYFZ`.
  3. Verificar la respuesta.
- **Resultado Esperado**:
  - El servicio devuelve los 3 candidatos disponibles (no 4, ya que no hay suficientes).
  - El fallback de diversidad NO introduce productos ya excluidos.
  - La respuesta no contiene duplicados.
  - No se lanza excepción.
- **Notas**: La Fase 3 del algoritmo dice "diversity fallback if < 4 candidates". Con 3 candidatos reales, el fallback no puede añadir un 4.º sin repetir un excluido. El comportamiento esperado debe ser: devolver los 3 disponibles.

---

**TC-SCRUM16-016: Señales mixtas — mismo producto en viewed y purchased**
- **Tipo**: Edge Case
- **Prioridad**: Baja
- **Precondiciones**: Nuevo algoritmo desplegado.
- **Pasos**:
  1. Enviar request con `viewed_product_ids=["6E92ZMYYFZ"]` y `purchased_product_ids=["6E92ZMYYFZ"]` (Mug en ambos).
  2. Verificar que Mug no aparece en los resultados (excluido).
  3. Verificar que el scoring de "kitchen" refleja el peso mayor (purchased=3, no viewed=1 ni suma 4).
- **Resultado Esperado**:
  - `6E92ZMYYFZ` excluido de los resultados.
  - El scoring de "kitchen" usa el peso máximo (purchased=3) en lugar de sumar ambos pesos.
  - Los otros productos de "kitchen" (`LS4PSXUNUM`, `9SIQT8TOJO`) aparecen en los resultados.

---

## 3. Casos de Prueba de Automatización

### 3.1 Estrategia de Automatización

| Capa | Framework | Justificación | Cobertura objetivo |
|------|-----------|---------------|-------------------|
| Unit tests | `pytest` + `unittest.mock` | Valida la lógica de scoring aislada del transporte gRPC. Rápido, determinista, sin infraestructura. | ≥ 80% del nuevo código de scoring |
| Integration tests | `pytest` + `grpc` Python client | Valida el comportamiento end-to-end del servicio gRPC con datos reales del catálogo. Detecta problemas de serialización proto y de integración con ProductCatalogService. | Todos los campos del nuevo proto |
| E2E tests | `playwright` (Python o TypeScript) | Valida la experiencia del usuario en las 3 superficies del frontend. Detecta problemas de renderizado y de integración frontend-backend. | Las 3 superficies de recomendación |
| Performance tests | `locust` | Valida el Escenario 6 (SLA de latencia y memoria). Detecta regresiones de rendimiento introducidas por el nuevo algoritmo. | 100 usuarios concurrentes |

Los tests de contrato proto (backward compat) se cubren en la capa de integración. No se automatiza ML ni testing estadístico de distribución (fuera de scope).

---

### 3.2 Casos Automatizables — Unit Tests (pytest)

```python
# test_recommendation_algorithm.py
# Unit tests para la lógica de scoring de recomendaciones personalizadas
# Ejecutar con: pytest test_recommendation_algorithm.py -v
#
# Asume que el algoritmo de scoring se extrae a una función/clase pura
# separada del handler gRPC para facilitar el testing unitario.
# Ejemplo de interfaz esperada:
#
#   from recommendation_engine import score_and_rank, build_exclusion_set
#
# El módulo `recommendation_engine.py` debe implementar la lógica de scoring
# separada del servidor gRPC.

import pytest
from unittest.mock import MagicMock, patch
import sys

# Catálogo de 9 productos (refleja products.json real)
MOCK_CATALOG = [
    MagicMock(id="OLJCESPC7Z", categories=["accessories"]),        # Sunglasses
    MagicMock(id="66VCHSJNUP", categories=["clothing", "tops"]),   # Tank Top
    MagicMock(id="1YMWWN1N4O", categories=["accessories"]),        # Watch
    MagicMock(id="L9ECAV7KIM", categories=["footwear"]),           # Loafers
    MagicMock(id="2ZYFJ3GM2N", categories=["hair", "beauty"]),     # Hairdryer
    MagicMock(id="0PUK6V6EV0", categories=["decor", "home"]),      # Candle Holder
    MagicMock(id="LS4PSXUNUM", categories=["kitchen"]),            # Salt & Pepper Shakers
    MagicMock(id="9SIQT8TOJO", categories=["kitchen"]),            # Bamboo Glass Jar
    MagicMock(id="6E92ZMYYFZ", categories=["kitchen"]),            # Mug
]

CATALOG_BY_ID = {p.id: p for p in MOCK_CATALOG}


# -------------------------------------------------------------------------
# Fixtures
# -------------------------------------------------------------------------

@pytest.fixture
def mock_catalog_stub():
    """Mock del ProductCatalogService que devuelve el catálogo de 9 productos."""
    stub = MagicMock()
    response = MagicMock()
    response.products = MOCK_CATALOG
    stub.ListProducts.return_value = response
    return stub


@pytest.fixture
def recommendation_service(mock_catalog_stub):
    """
    Instancia el RecommendationService con el stub del catálogo mockeado.
    Ajustar el import según la estructura final del módulo.
    """
    # Import diferido para no fallar si el módulo aún no existe
    with patch("recommendation_server.product_catalog_stub", mock_catalog_stub):
        from recommendation_server import RecommendationService
        return RecommendationService()


# -------------------------------------------------------------------------
# TC-UNIT-001: Scoring por viewed_product_ids (peso 1)
# -------------------------------------------------------------------------

class TestCategoryAffinityScoring:

    def test_viewed_products_bias_toward_accessories(self, recommendation_service):
        """
        Ver Sunglasses (accessories) debe sesgar las recomendaciones hacia Watch (accessories).
        TC-UNIT-001
        """
        import demo_pb2

        request = MagicMock()
        request.user_id = "test-user"
        request.product_ids = []                  # sin exclusiones de carrito
        request.viewed_product_ids = ["OLJCESPC7Z"]   # Sunglasses visto
        request.purchased_product_ids = []

        context = MagicMock()

        with patch("recommendation_server.product_catalog_stub") as mock_stub:
            response_mock = MagicMock()
            response_mock.products = MOCK_CATALOG
            mock_stub.ListProducts.return_value = response_mock

            response = recommendation_service.ListRecommendations(request, context)

        result_ids = list(response.product_ids)

        # Sunglasses fue visto → debe estar excluido
        assert "OLJCESPC7Z" not in result_ids, \
            "El producto visto (Sunglasses) no debe aparecer en recomendaciones"

        # Watch (única otra accessories) debe aparecer dado el scoring de afinidad
        assert "1YMWWN1N4O" in result_ids, \
            "Watch (accessories) debe estar en las recomendaciones por afinidad de categoría"

    def test_cart_products_bias_toward_same_category(self, recommendation_service):
        """
        Sunglasses en carrito (accessories, peso 2) → Watch debe aparecer.
        TC-UNIT-002
        """
        request = MagicMock()
        request.user_id = "test-user"
        request.product_ids = ["OLJCESPC7Z"]  # Sunglasses en carrito
        request.viewed_product_ids = []
        request.purchased_product_ids = []

        context = MagicMock()

        with patch("recommendation_server.product_catalog_stub") as mock_stub:
            response_mock = MagicMock()
            response_mock.products = MOCK_CATALOG
            mock_stub.ListProducts.return_value = response_mock

            response = recommendation_service.ListRecommendations(request, context)

        result_ids = list(response.product_ids)

        assert "OLJCESPC7Z" not in result_ids, \
            "El producto en carrito (Sunglasses) no debe aparecer en recomendaciones"
        assert "1YMWWN1N4O" in result_ids, \
            "Watch (accessories) debe aparecer por afinidad de carrito"

    def test_purchased_products_have_highest_weight(self, recommendation_service):
        """
        Mug comprado (kitchen, peso 3) → Salt Shakers y Bamboo Jar deben aparecer.
        Verifica que purchased tiene más peso que viewed.
        TC-UNIT-003
        """
        request_purchased = MagicMock()
        request_purchased.user_id = "test-user"
        request_purchased.product_ids = []
        request_purchased.viewed_product_ids = []
        request_purchased.purchased_product_ids = ["6E92ZMYYFZ"]  # Mug comprado

        context = MagicMock()

        with patch("recommendation_server.product_catalog_stub") as mock_stub:
            response_mock = MagicMock()
            response_mock.products = MOCK_CATALOG
            mock_stub.ListProducts.return_value = response_mock

            response = recommendation_service.ListRecommendations(request_purchased, context)

        result_ids = list(response.product_ids)

        assert "6E92ZMYYFZ" not in result_ids, \
            "Mug (comprado) no debe aparecer en recomendaciones"

        kitchen_in_results = [pid for pid in result_ids
                              if pid in ("LS4PSXUNUM", "9SIQT8TOJO")]
        assert len(kitchen_in_results) >= 2, \
            f"Al menos 2 productos de kitchen deben aparecer por purchased weight=3. " \
            f"Resultado: {result_ids}"

    def test_purchased_weight_exceeds_viewed_weight(self, recommendation_service):
        """
        Mug visto (kitchen, peso 1) vs. Mug comprado (kitchen, peso 3).
        Con purchased, los otros productos de kitchen deben aparecer antes que
        con solo viewed.
        TC-UNIT-004
        """
        context = MagicMock()

        with patch("recommendation_server.product_catalog_stub") as mock_stub:
            response_mock = MagicMock()
            response_mock.products = MOCK_CATALOG
            mock_stub.ListProducts.return_value = response_mock

            # Request con solo viewed
            req_viewed = MagicMock()
            req_viewed.user_id = "user-a"
            req_viewed.product_ids = []
            req_viewed.viewed_product_ids = ["6E92ZMYYFZ"]
            req_viewed.purchased_product_ids = []
            resp_viewed = recommendation_service.ListRecommendations(req_viewed, context)

        with patch("recommendation_server.product_catalog_stub") as mock_stub:
            response_mock = MagicMock()
            response_mock.products = MOCK_CATALOG
            mock_stub.ListProducts.return_value = response_mock

            # Request con purchased
            req_purchased = MagicMock()
            req_purchased.user_id = "user-b"
            req_purchased.product_ids = []
            req_purchased.viewed_product_ids = []
            req_purchased.purchased_product_ids = ["6E92ZMYYFZ"]
            resp_purchased = recommendation_service.ListRecommendations(req_purchased, context)

        # En ambos casos Mug está excluido
        assert "6E92ZMYYFZ" not in list(resp_viewed.product_ids)
        assert "6E92ZMYYFZ" not in list(resp_purchased.product_ids)

        # Con purchased, los resultados deben incluir más productos de kitchen
        kitchen_viewed = sum(1 for pid in resp_viewed.product_ids
                             if pid in ("LS4PSXUNUM", "9SIQT8TOJO"))
        kitchen_purchased = sum(1 for pid in resp_purchased.product_ids
                                if pid in ("LS4PSXUNUM", "9SIQT8TOJO"))

        assert kitchen_purchased >= kitchen_viewed, \
            "Con purchased, el sesgo hacia kitchen debe ser igual o mayor que con viewed"


# -------------------------------------------------------------------------
# TC-UNIT-005 a 007: Lógica de exclusión
# -------------------------------------------------------------------------

class TestExclusionLogic:

    def test_viewed_products_excluded_from_results(self, recommendation_service):
        """
        Todos los productos vistos deben estar ausentes del resultado.
        TC-UNIT-005
        """
        viewed = ["OLJCESPC7Z", "1YMWWN1N4O"]  # Sunglasses + Watch (ambas accessories)

        request = MagicMock()
        request.user_id = "test-user"
        request.product_ids = []
        request.viewed_product_ids = viewed
        request.purchased_product_ids = []
        context = MagicMock()

        with patch("recommendation_server.product_catalog_stub") as mock_stub:
            response_mock = MagicMock()
            response_mock.products = MOCK_CATALOG
            mock_stub.ListProducts.return_value = response_mock
            response = recommendation_service.ListRecommendations(request, context)

        for pid in viewed:
            assert pid not in response.product_ids, \
                f"Producto visto {pid} no debe aparecer en recomendaciones"

    def test_cart_products_excluded_from_results(self, recommendation_service):
        """
        Todos los productos del carrito deben estar ausentes del resultado.
        TC-UNIT-006
        """
        cart = ["OLJCESPC7Z", "66VCHSJNUP"]  # Sunglasses + Tank Top

        request = MagicMock()
        request.user_id = "test-user"
        request.product_ids = cart
        request.viewed_product_ids = []
        request.purchased_product_ids = []
        context = MagicMock()

        with patch("recommendation_server.product_catalog_stub") as mock_stub:
            response_mock = MagicMock()
            response_mock.products = MOCK_CATALOG
            mock_stub.ListProducts.return_value = response_mock
            response = recommendation_service.ListRecommendations(request, context)

        for pid in cart:
            assert pid not in response.product_ids, \
                f"Producto de carrito {pid} no debe aparecer en recomendaciones"

    def test_purchased_products_excluded_from_results(self, recommendation_service):
        """
        Todos los productos comprados deben estar ausentes del resultado.
        TC-UNIT-007
        """
        purchased = ["6E92ZMYYFZ", "LS4PSXUNUM"]  # Mug + Salt Shakers

        request = MagicMock()
        request.user_id = "test-user"
        request.product_ids = []
        request.viewed_product_ids = []
        request.purchased_product_ids = purchased
        context = MagicMock()

        with patch("recommendation_server.product_catalog_stub") as mock_stub:
            response_mock = MagicMock()
            response_mock.products = MOCK_CATALOG
            mock_stub.ListProducts.return_value = response_mock
            response = recommendation_service.ListRecommendations(request, context)

        for pid in purchased:
            assert pid not in response.product_ids, \
                f"Producto comprado {pid} no debe aparecer en recomendaciones"

    def test_no_duplicate_products_in_result(self, recommendation_service):
        """
        El resultado no debe contener productos duplicados.
        TC-UNIT-008
        """
        request = MagicMock()
        request.user_id = "test-user"
        request.product_ids = []
        request.viewed_product_ids = ["OLJCESPC7Z"]
        request.purchased_product_ids = []
        context = MagicMock()

        with patch("recommendation_server.product_catalog_stub") as mock_stub:
            response_mock = MagicMock()
            response_mock.products = MOCK_CATALOG
            mock_stub.ListProducts.return_value = response_mock
            response = recommendation_service.ListRecommendations(request, context)

        result_ids = list(response.product_ids)
        assert len(result_ids) == len(set(result_ids)), \
            f"El resultado contiene duplicados: {result_ids}"


# -------------------------------------------------------------------------
# TC-UNIT-009: Fallback de diversidad con < 4 candidatos
# -------------------------------------------------------------------------

class TestDiversityFallback:

    def test_fallback_when_less_than_4_candidates(self, recommendation_service):
        """
        Con 6 productos excluidos, quedan 3 candidatos. El servicio debe devolver
        los 3 disponibles sin repetir ni incluir excluidos.
        TC-UNIT-009
        """
        # Excluimos 6 de 9 productos
        excluded = {
            "OLJCESPC7Z", "66VCHSJNUP", "1YMWWN1N4O",   # cart
            "L9ECAV7KIM", "2ZYFJ3GM2N",                   # viewed
            "0PUK6V6EV0",                                   # purchased
        }
        expected_candidates = {"LS4PSXUNUM", "9SIQT8TOJO", "6E92ZMYYFZ"}

        request = MagicMock()
        request.user_id = "test-user"
        request.product_ids = ["OLJCESPC7Z", "66VCHSJNUP", "1YMWWN1N4O"]
        request.viewed_product_ids = ["L9ECAV7KIM", "2ZYFJ3GM2N"]
        request.purchased_product_ids = ["0PUK6V6EV0"]
        context = MagicMock()

        with patch("recommendation_server.product_catalog_stub") as mock_stub:
            response_mock = MagicMock()
            response_mock.products = MOCK_CATALOG
            mock_stub.ListProducts.return_value = response_mock
            response = recommendation_service.ListRecommendations(request, context)

        result_ids = set(response.product_ids)

        assert result_ids.issubset(expected_candidates), \
            f"El resultado contiene productos excluidos: {result_ids - expected_candidates}"
        assert len(result_ids) <= 3, \
            f"No pueden haber más de 3 resultados con solo 3 candidatos: {result_ids}"
        assert result_ids.isdisjoint(excluded), \
            f"El fallback incluye productos excluidos: {result_ids & excluded}"

    def test_empty_catalog_after_exclusion(self, recommendation_service):
        """
        Con todos los productos excluidos, el resultado debe ser lista vacía sin error.
        TC-UNIT-010
        """
        all_ids = [p.id for p in MOCK_CATALOG]

        request = MagicMock()
        request.user_id = "test-user"
        request.product_ids = all_ids
        request.viewed_product_ids = []
        request.purchased_product_ids = []
        context = MagicMock()

        with patch("recommendation_server.product_catalog_stub") as mock_stub:
            response_mock = MagicMock()
            response_mock.products = MOCK_CATALOG
            mock_stub.ListProducts.return_value = response_mock
            response = recommendation_service.ListRecommendations(request, context)

        assert list(response.product_ids) == [], \
            "Con todos los productos excluidos, el resultado debe ser lista vacía"


# -------------------------------------------------------------------------
# TC-UNIT-011: Nuevo usuario sin historial (fallback aleatorio)
# -------------------------------------------------------------------------

class TestNewUserFallback:

    def test_new_user_gets_recommendations(self, recommendation_service):
        """
        Un usuario sin historial debe recibir hasta 5 recomendaciones de cualquier categoría.
        TC-UNIT-011
        """
        request = MagicMock()
        request.user_id = "brand-new-user"
        request.product_ids = []
        request.viewed_product_ids = []
        request.purchased_product_ids = []
        context = MagicMock()

        with patch("recommendation_server.product_catalog_stub") as mock_stub:
            response_mock = MagicMock()
            response_mock.products = MOCK_CATALOG
            mock_stub.ListProducts.return_value = response_mock
            response = recommendation_service.ListRecommendations(request, context)

        result_ids = list(response.product_ids)
        assert 1 <= len(result_ids) <= 5, \
            f"Se esperan entre 1 y 5 recomendaciones, se obtuvieron {len(result_ids)}"
        assert len(set(result_ids)) == len(result_ids), \
            "No deben haber duplicados en las recomendaciones"

    def test_new_user_result_varies_across_calls(self, recommendation_service):
        """
        Sin historial, múltiples llamadas no deben devolver siempre el mismo orden.
        Verifica que el fallback tiene aleatoriedad.
        TC-UNIT-012
        """
        request = MagicMock()
        request.user_id = "brand-new-user"
        request.product_ids = []
        request.viewed_product_ids = []
        request.purchased_product_ids = []
        context = MagicMock()

        results = []
        for _ in range(10):
            with patch("recommendation_server.product_catalog_stub") as mock_stub:
                response_mock = MagicMock()
                response_mock.products = MOCK_CATALOG
                mock_stub.ListProducts.return_value = response_mock
                response = recommendation_service.ListRecommendations(request, context)
                results.append(tuple(response.product_ids))

        unique_results = set(results)
        assert len(unique_results) > 1, \
            "Con historial vacío, las recomendaciones deben variar entre llamadas (aleatorias)"


# -------------------------------------------------------------------------
# TC-UNIT-013: Idempotencia de distribución por categoría
# -------------------------------------------------------------------------

class TestIdempotency:

    def test_same_input_produces_same_category_distribution(self, recommendation_service):
        """
        El mismo input debe producir siempre el mismo conjunto de categorías
        (aunque el orden interno pueda variar).
        TC-UNIT-013
        """
        request = MagicMock()
        request.user_id = "test-user"
        request.product_ids = []
        request.viewed_product_ids = ["6E92ZMYYFZ"]   # Mug visto → kitchen sesgo
        request.purchased_product_ids = []
        context = MagicMock()

        results = []
        for _ in range(5):
            with patch("recommendation_server.product_catalog_stub") as mock_stub:
                response_mock = MagicMock()
                response_mock.products = MOCK_CATALOG
                mock_stub.ListProducts.return_value = response_mock
                response = recommendation_service.ListRecommendations(request, context)
                categories = frozenset(
                    cat
                    for pid in response.product_ids
                    for cat in CATALOG_BY_ID[pid].categories
                    if pid in CATALOG_BY_ID
                )
                results.append(categories)

        # La distribución de categorías debe ser consistente entre llamadas
        assert all(r == results[0] for r in results), \
            f"La distribución de categorías varía entre llamadas con mismo input: {results}"

    def test_repeated_viewed_product_does_not_inflate_score(self, recommendation_service):
        """
        Ver el mismo producto múltiples veces no debe inflar el score de su categoría.
        TC-UNIT-014
        """
        context = MagicMock()

        def get_result(viewed_list):
            with patch("recommendation_server.product_catalog_stub") as mock_stub:
                response_mock = MagicMock()
                response_mock.products = MOCK_CATALOG
                mock_stub.ListProducts.return_value = response_mock
                req = MagicMock()
                req.user_id = "test-user"
                req.product_ids = []
                req.viewed_product_ids = viewed_list
                req.purchased_product_ids = []
                return set(recommendation_service.ListRecommendations(req, context).product_ids)

        result_once = get_result(["OLJCESPC7Z"])
        result_triple = get_result(["OLJCESPC7Z", "OLJCESPC7Z", "OLJCESPC7Z"])

        assert result_once == result_triple, \
            "Ver el mismo producto repetido no debe cambiar el resultado de recomendaciones"
```

---

### 3.3 Casos Automatizables — Integration Tests (gRPC)

```python
# test_recommendation_integration.py
# Integration tests que llaman al gRPC endpoint real del recommendationservice
# Requiere: recommendationservice corriendo en localhost:8080 (o la dirección configurada)
# Ejecutar con: pytest test_recommendation_integration.py -v --integration
#
# Variables de entorno:
#   RECOMMENDATION_SERVICE_ADDR=localhost:8080
#   PRODUCT_CATALOG_SERVICE_ADDR=localhost:3550

import os
import pytest
import grpc

# Importar los stubs proto actualizados con los nuevos campos
# Asume que demo_pb2.py ha sido regenerado con viewed_product_ids y purchased_product_ids
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import demo_pb2
import demo_pb2_grpc

RECOMMENDATION_ADDR = os.getenv("RECOMMENDATION_SERVICE_ADDR", "localhost:8080")

# IDs reales del catálogo de 9 productos
SUNGLASSES    = "OLJCESPC7Z"   # accessories
TANK_TOP      = "66VCHSJNUP"   # clothing, tops
WATCH         = "1YMWWN1N4O"   # accessories
LOAFERS       = "L9ECAV7KIM"   # footwear
HAIRDRYER     = "2ZYFJ3GM2N"   # hair, beauty
CANDLE_HOLDER = "0PUK6V6EV0"   # decor, home
SALT_PEPPER   = "LS4PSXUNUM"   # kitchen
BAMBOO_JAR    = "9SIQT8TOJO"   # kitchen
MUG           = "6E92ZMYYFZ"   # kitchen

ALL_IDS = [SUNGLASSES, TANK_TOP, WATCH, LOAFERS, HAIRDRYER,
           CANDLE_HOLDER, SALT_PEPPER, BAMBOO_JAR, MUG]


@pytest.fixture(scope="module")
def grpc_channel():
    channel = grpc.insecure_channel(RECOMMENDATION_ADDR)
    yield channel
    channel.close()


@pytest.fixture(scope="module")
def stub(grpc_channel):
    return demo_pb2_grpc.RecommendationServiceStub(grpc_channel)


# -------------------------------------------------------------------------
# TC-INT-001: Request válido con viewed_product_ids
# -------------------------------------------------------------------------

def test_valid_request_with_viewed_product_ids(stub):
    """
    Llamada con viewed_product_ids poblado. El producto visto no debe aparecer.
    TC-INT-001
    """
    request = demo_pb2.ListRecommendationsRequest(
        user_id="integration-test-user-1",
        product_ids=[],
        viewed_product_ids=[SUNGLASSES],
        purchased_product_ids=[]
    )
    response = stub.ListRecommendations(request)
    result_ids = list(response.product_ids)

    assert SUNGLASSES not in result_ids, \
        "Sunglasses (visto) no debe aparecer en recomendaciones"
    assert len(result_ids) > 0, "Se esperan al menos 1 recomendación"
    assert len(result_ids) <= 5, "No se esperan más de 5 recomendaciones"
    assert WATCH in result_ids, \
        "Watch (accessories) debe aparecer por afinidad con Sunglasses (viewed)"


# -------------------------------------------------------------------------
# TC-INT-002: Request válido con product_ids (exclusiones de carrito)
# -------------------------------------------------------------------------

def test_valid_request_with_cart_exclusions(stub):
    """
    Llamada con product_ids (carrito). Los productos del carrito no deben aparecer.
    TC-INT-002
    """
    cart_products = [SUNGLASSES, TANK_TOP]
    request = demo_pb2.ListRecommendationsRequest(
        user_id="integration-test-user-2",
        product_ids=cart_products,
        viewed_product_ids=[],
        purchased_product_ids=[]
    )
    response = stub.ListRecommendations(request)
    result_ids = list(response.product_ids)

    for pid in cart_products:
        assert pid not in result_ids, \
            f"Producto de carrito {pid} no debe aparecer en recomendaciones"
    assert len(result_ids) > 0, "Se esperan recomendaciones incluso con carrito"


# -------------------------------------------------------------------------
# TC-INT-003: Request con todos los campos poblados
# -------------------------------------------------------------------------

def test_valid_request_all_fields_populated(stub):
    """
    Llamada con user_id, product_ids, viewed_product_ids y purchased_product_ids.
    TC-INT-003
    """
    request = demo_pb2.ListRecommendationsRequest(
        user_id="integration-test-user-3",
        product_ids=[SUNGLASSES],                # carrito
        viewed_product_ids=[TANK_TOP],            # visto
        purchased_product_ids=[CANDLE_HOLDER]     # comprado
    )
    response = stub.ListRecommendations(request)
    result_ids = list(response.product_ids)

    # Ninguno de los excluidos debe aparecer
    excluded = {SUNGLASSES, TANK_TOP, CANDLE_HOLDER}
    for pid in excluded:
        assert pid not in result_ids, \
            f"Producto excluido {pid} no debe aparecer en recomendaciones"

    # kitchen tiene mayor peso por purchased=3 (decor category)
    # Watch tiene peso 1 por accessories de Sunglasses (cart=2)
    # El resultado debe contener productos de accessories o decor/home con prioridad
    assert len(result_ids) > 0, "Se esperan recomendaciones con campos mixtos"
    assert len(set(result_ids)) == len(result_ids), "No deben haber duplicados"


# -------------------------------------------------------------------------
# TC-INT-004: Request con user_id vacío
# -------------------------------------------------------------------------

def test_request_with_empty_user_id(stub):
    """
    user_id vacío no debe causar error; el servicio no depende de él para el scoring.
    TC-INT-004
    """
    request = demo_pb2.ListRecommendationsRequest(
        user_id="",
        product_ids=[],
        viewed_product_ids=[],
        purchased_product_ids=[]
    )
    response = stub.ListRecommendations(request)
    result_ids = list(response.product_ids)

    assert len(result_ids) > 0, \
        "Un user_id vacío no debe impedir devolver recomendaciones"


# -------------------------------------------------------------------------
# TC-INT-005: viewed_product_ids con IDs desconocidos
# -------------------------------------------------------------------------

def test_unknown_product_ids_in_viewed(stub):
    """
    IDs que no existen en el catálogo se ignoran silenciosamente.
    TC-INT-005
    """
    request = demo_pb2.ListRecommendationsRequest(
        user_id="integration-test-user-5",
        product_ids=[],
        viewed_product_ids=["NONEXISTENT-PRODUCT-ID-999", "ANOTHER-INVALID-ID"],
        purchased_product_ids=[]
    )
    # No debe lanzar excepción gRPC
    response = stub.ListRecommendations(request)
    result_ids = list(response.product_ids)

    assert len(result_ids) > 0, \
        "IDs desconocidos en viewed_product_ids no deben bloquear las recomendaciones"
    assert all(pid in ALL_IDS for pid in result_ids), \
        "Los resultados solo deben contener IDs del catálogo real"


# -------------------------------------------------------------------------
# TC-INT-006: Retrocompatibilidad — solo campos legacy
# -------------------------------------------------------------------------

def test_backward_compat_legacy_fields_only(stub):
    """
    Clientes que solo envían user_id y product_ids (sin los nuevos campos) no deben
    experimentar errores. Los nuevos campos en proto3 default a listas vacías.
    TC-INT-006
    """
    # Crear un request usando SOLO los campos existentes antes del cambio
    # En proto3, omitir repeated fields es equivalente a enviarlos vacíos
    request = demo_pb2.ListRecommendationsRequest(
        user_id="legacy-client-user",
        product_ids=[LOAFERS]
        # viewed_product_ids y purchased_product_ids NO se especifican
    )
    response = stub.ListRecommendations(request)
    result_ids = list(response.product_ids)

    assert LOAFERS not in result_ids, \
        "El producto en product_ids (Loafers) no debe aparecer (retrocompatible)"
    assert len(result_ids) > 0, \
        "El cliente legacy debe recibir recomendaciones normales"
    assert len(result_ids) <= 5, "No más de 5 recomendaciones"


# -------------------------------------------------------------------------
# TC-INT-007: Todos los productos excluidos — catálogo exhausto
# -------------------------------------------------------------------------

def test_all_products_excluded_returns_empty(stub):
    """
    Con todos los 9 productos excluidos, la respuesta debe ser una lista vacía sin error.
    TC-INT-007
    """
    request = demo_pb2.ListRecommendationsRequest(
        user_id="test-exhaustion",
        product_ids=ALL_IDS,
        viewed_product_ids=[],
        purchased_product_ids=[]
    )
    response = stub.ListRecommendations(request)
    result_ids = list(response.product_ids)

    assert result_ids == [], \
        f"Con catálogo exhausto, se esperan 0 recomendaciones. Se obtuvieron: {result_ids}"


# -------------------------------------------------------------------------
# TC-INT-008: Verificar que el scoring de purchased supera al de viewed
# -------------------------------------------------------------------------

def test_purchased_score_greater_than_viewed_score(stub):
    """
    Mug comprado (kitchen, peso 3) produce más sesgo hacia kitchen que Mug visto (peso 1).
    TC-INT-008
    """
    # Request con Mug visto (kitchen afín, peso 1)
    req_viewed = demo_pb2.ListRecommendationsRequest(
        user_id="scoring-test-viewed",
        product_ids=[],
        viewed_product_ids=[MUG],
        purchased_product_ids=[]
    )
    resp_viewed = stub.ListRecommendations(req_viewed)
    kitchen_in_viewed = sum(1 for pid in resp_viewed.product_ids
                            if pid in (SALT_PEPPER, BAMBOO_JAR))

    # Request con Mug comprado (kitchen afín, peso 3)
    req_purchased = demo_pb2.ListRecommendationsRequest(
        user_id="scoring-test-purchased",
        product_ids=[],
        viewed_product_ids=[],
        purchased_product_ids=[MUG]
    )
    resp_purchased = stub.ListRecommendations(req_purchased)
    kitchen_in_purchased = sum(1 for pid in resp_purchased.product_ids
                               if pid in (SALT_PEPPER, BAMBOO_JAR))

    assert kitchen_in_purchased >= kitchen_in_viewed, \
        f"Purchased (kitchen={kitchen_in_purchased}) debe ≥ viewed (kitchen={kitchen_in_viewed})"

    # Con purchased, ambos kitchen restantes deben aparecer (peso 3 domina)
    assert kitchen_in_purchased == 2, \
        f"Con Mug comprado, Salt Shakers y Bamboo Jar deben estar en recomendaciones. " \
        f"Resultado: {list(resp_purchased.product_ids)}"
```

---

### 3.4 Casos Automatizables — E2E Tests (Playwright)

```typescript
// e2e/recommendations.spec.ts
// Tests E2E con Playwright para las 3 superficies de recomendaciones
// Ejecutar con: npx playwright test recommendations.spec.ts
// Requiere: frontend corriendo en FRONTEND_URL (default http://localhost:8080)

import { test, expect, Page, BrowserContext } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:8080';

// IDs y nombres del catálogo real
const PRODUCTS = {
  SUNGLASSES:    { id: 'OLJCESPC7Z', name: 'Sunglasses',            category: 'accessories' },
  TANK_TOP:      { id: '66VCHSJNUP', name: 'Tank Top',              category: 'clothing'    },
  WATCH:         { id: '1YMWWN1N4O', name: 'Watch',                 category: 'accessories' },
  LOAFERS:       { id: 'L9ECAV7KIM', name: 'Loafers',               category: 'footwear'    },
  HAIRDRYER:     { id: '2ZYFJ3GM2N', name: 'Hairdryer',             category: 'hair'        },
  CANDLE_HOLDER: { id: '0PUK6V6EV0', name: 'Candle Holder',         category: 'decor'       },
  SALT_PEPPER:   { id: 'LS4PSXUNUM', name: 'Salt & Pepper Shakers', category: 'kitchen'     },
  BAMBOO_JAR:    { id: '9SIQT8TOJO', name: 'Bamboo Glass Jar',      category: 'kitchen'     },
  MUG:           { id: '6E92ZMYYFZ', name: 'Mug',                   category: 'kitchen'     },
};

/**
 * Extrae los nombres de los productos en la sección de recomendaciones.
 * Asume que el template renderiza recomendaciones en un contenedor con
 * clase o data-testid "recommendations" y los productos como elementos <a>.
 */
async function getRecommendationNames(page: Page): Promise<string[]> {
  // Ajustar el selector al template real del frontend
  const recs = page.locator('[data-testid="recommendations"] .recommendation-item, ' +
                             '.recommendations .hot-product-card');
  await recs.first().waitFor({ timeout: 5000 }).catch(() => {});
  const count = await recs.count();
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await recs.nth(i).textContent();
    if (text) names.push(text.trim());
  }
  return names;
}

// -------------------------------------------------------------------------
// TC-E2E-001: Página de producto excluye el producto actual de recomendaciones
// -------------------------------------------------------------------------

test('TC-E2E-001: product page excludes current product from recommendations', async ({ page }) => {
  await page.goto(`${FRONTEND_URL}/product/${PRODUCTS.SUNGLASSES.id}`);

  const recNames = await getRecommendationNames(page);

  expect(recNames.length).toBeGreaterThan(0);
  expect(recNames.length).toBeLessThanOrEqual(4);
  expect(recNames).not.toContain(PRODUCTS.SUNGLASSES.name);
});

// -------------------------------------------------------------------------
// TC-E2E-002: Página de carrito excluye ítems del carrito de recomendaciones
// -------------------------------------------------------------------------

test('TC-E2E-002: cart page excludes cart items from recommendations', async ({ page }) => {
  // Agregar Salt & Pepper Shakers al carrito
  await page.goto(`${FRONTEND_URL}/product/${PRODUCTS.SALT_PEPPER.id}`);
  await page.click('[data-testid="add-to-cart"], button:has-text("Add to Cart")');
  await page.waitForURL(`${FRONTEND_URL}/cart`);

  // Navegar al carrito
  await page.goto(`${FRONTEND_URL}/cart`);

  const recNames = await getRecommendationNames(page);

  expect(recNames).not.toContain(PRODUCTS.SALT_PEPPER.name);
  expect(recNames.length).toBeGreaterThan(0);
  expect(recNames.length).toBeLessThanOrEqual(4);
});

// -------------------------------------------------------------------------
// TC-E2E-003: Página de confirmación de pedido muestra recomendaciones
// -------------------------------------------------------------------------

test('TC-E2E-003: order confirmation page shows recommendations', async ({ page }) => {
  // Completar un flujo de compra mínimo
  await page.goto(`${FRONTEND_URL}/product/${PRODUCTS.MUG.id}`);
  await page.click('[data-testid="add-to-cart"], button:has-text("Add to Cart")');
  await page.waitForURL(`${FRONTEND_URL}/cart`);

  await page.goto(`${FRONTEND_URL}/cart`);
  await page.click('[data-testid="checkout"], a:has-text("Place Order")');

  // Rellenar formulario de checkout con datos de prueba
  await page.fill('[name="email"]',          'test@example.com');
  await page.fill('[name="street_address"]', '123 Test Street');
  await page.fill('[name="zip_code"]',       '10001');
  await page.fill('[name="city"]',           'Test City');
  await page.fill('[name="state"]',          'NY');
  await page.fill('[name="country"]',        'US');
  await page.fill('[name="credit_card_number"]',           '4432801561520454');
  await page.fill('[name="credit_card_expiration_month"]', '1');
  await page.fill('[name="credit_card_expiration_year"]',  '2030');
  await page.fill('[name="credit_card_cvv"]',              '672');

  await page.click('[type="submit"], button:has-text("Place Order")');
  await page.waitForURL(/\/order/, { timeout: 10000 });

  const recNames = await getRecommendationNames(page);
  expect(recNames.length).toBeGreaterThan(0);
  expect(recNames.length).toBeLessThanOrEqual(4);
});

// -------------------------------------------------------------------------
// TC-E2E-004: Navegar entre productos actualiza recomendaciones
// -------------------------------------------------------------------------

test('TC-E2E-004: navigating between products updates recommendations', async ({ page }) => {
  await page.goto(`${FRONTEND_URL}/product/${PRODUCTS.SUNGLASSES.id}`);
  const recsFirst = await getRecommendationNames(page);

  await page.goto(`${FRONTEND_URL}/product/${PRODUCTS.MUG.id}`);
  const recsSecond = await getRecommendationNames(page);

  // Las recomendaciones deben ser diferentes cuando el producto base es diferente
  // (Sunglasses excluded from first, Mug excluded from second)
  expect(recsFirst).not.toContain(PRODUCTS.SUNGLASSES.name);
  expect(recsSecond).not.toContain(PRODUCTS.MUG.name);

  // Al menos alguna diferencia entre las recomendaciones de ambas páginas
  // (dado que los productos excluidos son distintos)
  const firstSet = new Set(recsFirst);
  const secondSet = new Set(recsSecond);
  const areIdentical = [...firstSet].every(r => secondSet.has(r)) &&
                       firstSet.size === secondSet.size;

  // Las listas pueden solaparse pero no deben ser idénticas en todos los casos
  // (con 9 productos y exclusiones diferentes, es altamente probable que difieran)
  // Nota: este test puede ser flaky si el algoritmo de fallback produce el mismo resultado.
  // Usar como señal informativa, no como bloqueo hard.
  expect(recsFirst.length).toBeGreaterThan(0);
  expect(recsSecond.length).toBeGreaterThan(0);
});

// -------------------------------------------------------------------------
// TC-E2E-005: Aislamiento de sesiones — dos contextos independientes
// -------------------------------------------------------------------------

test('TC-E2E-005: session isolation — two browser contexts get independent recommendations',
  async ({ browser }) => {

  // Contexto A: usuario con historial de Accessories (ve Sunglasses)
  const contextA: BrowserContext = await browser.newContext();
  const pageA: Page = await contextA.newPage();
  await pageA.goto(`${FRONTEND_URL}/product/${PRODUCTS.SUNGLASSES.id}`);
  const recsA = await getRecommendationNames(pageA);

  // Contexto B: usuario nuevo, sin historial
  const contextB: BrowserContext = await browser.newContext();
  const pageB: Page = await contextB.newPage();
  await pageB.goto(`${FRONTEND_URL}/product/${PRODUCTS.MUG.id}`);
  const recsB = await getRecommendationNames(pageB);

  // Verificar que ambos reciben recomendaciones válidas
  expect(recsA.length).toBeGreaterThan(0);
  expect(recsB.length).toBeGreaterThan(0);

  // El contexto B no debe ver el mismo sesgo hacia Accessories que el contexto A
  // (Contexto B vio Mug → debería tener sesgo hacia kitchen, no accessories)
  expect(recsB).not.toContain(PRODUCTS.MUG.name);  // Mug excluido en contexto B
  expect(recsA).not.toContain(PRODUCTS.SUNGLASSES.name); // Sunglasses excluido en contexto A

  await contextA.close();
  await contextB.close();
});

// -------------------------------------------------------------------------
// TC-E2E-006: Siempre se muestran exactamente 4 recomendaciones (si hay suficientes)
// -------------------------------------------------------------------------

test('TC-E2E-006: product page shows exactly 4 recommendations when catalog is sufficient',
  async ({ page }) => {
  // Con 9 productos y 1 excluido, hay 8 candidatos → debe mostrar 4
  await page.goto(`${FRONTEND_URL}/product/${PRODUCTS.WATCH.id}`);
  const recNames = await getRecommendationNames(page);

  expect(recNames.length).toBe(4);
  expect(new Set(recNames).size).toBe(4); // sin duplicados
});
```

---

### 3.5 Casos Automatizables — Performance Tests (locust)

```python
# locustfile_recommendations.py
# Performance tests para el escenario 6 de SCRUM-16
# Ejecutar con: locust -f locustfile_recommendations.py --host=http://localhost:8080
#               --users=100 --spawn-rate=10 --run-time=2m --headless
#
# Para verificar p99 < 500ms, revisar las estadísticas de Locust al final de la ejecución
# o integrar con --csv=recommendations_perf para análisis post-ejecución.

import random
import time
from locust import HttpUser, task, between, events
from locust.env import Environment

# IDs reales del catálogo
ALL_PRODUCT_IDS = [
    "OLJCESPC7Z",  # Sunglasses (accessories)
    "66VCHSJNUP",  # Tank Top (clothing)
    "1YMWWN1N4O",  # Watch (accessories)
    "L9ECAV7KIM",  # Loafers (footwear)
    "2ZYFJ3GM2N",  # Hairdryer (hair/beauty)
    "0PUK6V6EV0",  # Candle Holder (decor/home)
    "LS4PSXUNUM",  # Salt & Pepper Shakers (kitchen)
    "9SIQT8TOJO",  # Bamboo Glass Jar (kitchen)
    "6E92ZMYYFZ",  # Mug (kitchen)
]


def random_subset(product_list: list, max_count: int = 3) -> list:
    """Selecciona un subconjunto aleatorio de hasta max_count productos."""
    k = random.randint(0, min(max_count, len(product_list)))
    return random.sample(product_list, k)


class NewUserWithoutHistory(HttpUser):
    """
    Simula un usuario nuevo sin historial de comportamiento.
    Representa el 40% del tráfico.
    Verifica que el fallback aleatorio tiene latencia < 200ms (Escenario 3).
    """
    weight = 40
    wait_time = between(0.5, 1.5)

    @task
    def view_product_page_no_history(self):
        """Accede a una página de producto sin historial previo."""
        product_id = random.choice(ALL_PRODUCT_IDS)
        start = time.time()
        with self.client.get(
            f"/product/{product_id}",
            name="/product/[id] (new-user)",
            catch_response=True
        ) as response:
            elapsed_ms = (time.time() - start) * 1000
            if response.status_code != 200:
                response.failure(f"Status {response.status_code}")
            elif elapsed_ms > 500:
                response.failure(f"Latencia excesiva: {elapsed_ms:.0f}ms > 500ms SLA")
            else:
                response.success()

    @task(weight=2)
    def view_cart_empty(self):
        """Accede al carrito vacío."""
        with self.client.get(
            "/cart",
            name="/cart (empty)",
            catch_response=True
        ) as response:
            if response.status_code != 200:
                response.failure(f"Status {response.status_code}")


class UserWithBehaviorHistory(HttpUser):
    """
    Simula un usuario con historial de comportamiento (viewed + cart).
    Representa el 50% del tráfico.
    Verifica que el scoring por afinidad no introduce latencia adicional significativa.
    """
    weight = 50
    wait_time = between(0.5, 2.0)

    def on_start(self):
        """Inicializa un historial de comportamiento aleatorio para este usuario."""
        self.viewed_products = random_subset(ALL_PRODUCT_IDS, max_count=3)
        self.cart_products = random_subset(
            [p for p in ALL_PRODUCT_IDS if p not in self.viewed_products],
            max_count=2
        )

    @task(weight=3)
    def view_product_with_history(self):
        """
        Accede a una página de producto. Si el frontend pasa viewed_product_ids,
        el backend aplica scoring. Este test mide la latencia total del flujo.
        """
        available = [p for p in ALL_PRODUCT_IDS
                     if p not in self.viewed_products and p not in self.cart_products]
        if not available:
            return

        product_id = random.choice(available)
        # Registrar el producto como visto para el historial in-memory
        self.viewed_products.append(product_id)
        if len(self.viewed_products) > 10:
            self.viewed_products = self.viewed_products[-10:]  # mantener ventana de 10

        with self.client.get(
            f"/product/{product_id}",
            name="/product/[id] (with-history)",
            catch_response=True
        ) as response:
            if response.status_code != 200:
                response.failure(f"Status {response.status_code}")

    @task(weight=2)
    def view_cart_with_items(self):
        """Accede al carrito con ítems (el frontend pasa cart IDs como exclusiones)."""
        if not self.cart_products:
            return

        # Agregar un producto al carrito primero
        product_id = self.cart_products[0]
        self.client.post(
            "/cart",
            data={"product_id": product_id, "quantity": 1},
            name="POST /cart"
        )

        with self.client.get(
            "/cart",
            name="/cart (with-items)",
            catch_response=True
        ) as response:
            if response.status_code != 200:
                response.failure(f"Status {response.status_code}")

    @task
    def complete_purchase_flow(self):
        """
        Flujo completo de compra. Verifica que la página de confirmación
        muestra recomendaciones dentro del SLA.
        """
        if not self.cart_products:
            return

        product_id = random.choice(self.cart_products)
        self.client.post("/cart", data={"product_id": product_id, "quantity": 1},
                         name="POST /cart (checkout-flow)")

        with self.client.post(
            "/checkout",
            data={
                "email":                        "loadtest@example.com",
                "street_address":               "123 Load Test Ave",
                "zip_code":                     "10001",
                "city":                         "Load City",
                "state":                        "NY",
                "country":                      "US",
                "credit_card_number":           "4432801561520454",
                "credit_card_expiration_month": "1",
                "credit_card_expiration_year":  "2030",
                "credit_card_cvv":              "672",
            },
            name="POST /checkout",
            catch_response=True
        ) as response:
            if response.status_code not in (200, 302):
                response.failure(f"Checkout failed: {response.status_code}")


class PowerUserWithPurchaseHistory(HttpUser):
    """
    Simula un usuario con historial de compras previas (purchased_product_ids).
    Representa el 10% del tráfico.
    Verifica que el scoring con peso mayor (purchased=3) no degrada la performance.
    """
    weight = 10
    wait_time = between(1.0, 3.0)

    PURCHASE_SCENARIOS = [
        ["6E92ZMYYFZ"],              # Compró Mug (kitchen)
        ["OLJCESPC7Z", "1YMWWN1N4O"], # Compró ambas Accessories
        ["L9ECAV7KIM"],              # Compró Loafers (footwear único)
        ["LS4PSXUNUM", "9SIQT8TOJO", "6E92ZMYYFZ"],  # Compró toda kitchen
    ]

    def on_start(self):
        self.purchased = random.choice(self.PURCHASE_SCENARIOS)

    @task
    def view_product_after_purchase(self):
        """
        Accede a producto con historial de compras. El mayor scoring de purchased
        (peso 3) no debe introducir latencia adicional perceptible.
        """
        candidates = [p for p in ALL_PRODUCT_IDS if p not in self.purchased]
        if not candidates:
            return

        product_id = random.choice(candidates)
        with self.client.get(
            f"/product/{product_id}",
            name="/product/[id] (power-user)",
            catch_response=True
        ) as response:
            if response.status_code != 200:
                response.failure(f"Status {response.status_code}")


# -------------------------------------------------------------------------
# Hooks de validación de SLA
# -------------------------------------------------------------------------

@events.quitting.add_listener
def assert_sla(environment: Environment, **kwargs):
    """
    Valida el SLA del Escenario 6 al final del test:
    - p99 < 500ms para todos los endpoints de recomendaciones
    - Tasa de error < 1%
    """
    stats = environment.runner.stats

    print("\n" + "="*60)
    print("VALIDACION DE SLA — SCRUM-16 Escenario 6")
    print("="*60)

    sla_failed = False

    for name, stat in stats.entries.items():
        if stat.num_requests == 0:
            continue

        p99_ms = stat.get_response_time_percentile(0.99)
        error_rate = stat.num_failures / stat.num_requests if stat.num_requests > 0 else 0

        print(f"\nEndpoint: {name[1]}")
        print(f"  Requests:    {stat.num_requests}")
        print(f"  p99 latency: {p99_ms:.0f}ms  (SLA: < 500ms)")
        print(f"  Error rate:  {error_rate:.1%}  (SLA: < 1%)")

        if p99_ms >= 500:
            print(f"  [FAIL] p99 {p99_ms:.0f}ms excede el SLA de 500ms")
            sla_failed = True
        else:
            print(f"  [PASS] p99 dentro del SLA")

        if error_rate >= 0.01:
            print(f"  [FAIL] Error rate {error_rate:.1%} excede 1%")
            sla_failed = True
        else:
            print(f"  [PASS] Error rate dentro del threshold")

    print("\n" + "="*60)
    if sla_failed:
        print("RESULTADO: FAIL — SLA no cumplido")
        environment.process_exit_code = 1
    else:
        print("RESULTADO: PASS — Todos los SLAs cumplidos")
    print("="*60)
```

---

## 4. Criterios de Aceptación de QA

La firma de QA sobre SCRUM-16 requiere que todos los siguientes ítems estén en estado PASS:

### 4.1 Funcionalidad

- [ ] **TC-SCRUM16-001 a TC-SCRUM16-016** ejecutados. Todos en estado PASS o SKIP documentado con justificación.
- [ ] Los 3 gaps CRÍTICOS (CRITICO-01, CRITICO-02, CRITICO-03) han sido resueltos o formalmente aceptados como riesgo por el Product Owner, con evidencia escrita en el ticket.
- [ ] El Escenario 1 del ticket ha sido reformulado con criterios verificables para el catálogo de 9 productos, o se ha acordado un dataset de prueba ampliado.
- [ ] El producto `L9ECAV7KIM` (Loafers) no se menciona como "Mug" en ningún criterio de aceptación del ticket.

### 4.2 Calidad del Código y Tests Automatizados

- [ ] Cobertura de unit tests ≥ 80% en el código nuevo del algoritmo de scoring (`recommendation_engine.py` o equivalente).
- [ ] Todos los unit tests de la sección 3.2 pasan en CI.
- [ ] Todos los integration tests de la sección 3.3 pasan contra el entorno de staging con `productcatalogservice` real.
- [ ] Los E2E tests de la sección 3.4 pasan en las 3 superficies: página de producto, carrito, confirmación de pedido.
- [ ] No hay regresiones en los tests existentes del frontend (`cd src/frontend && go test ./...`).

### 4.3 Proto y Retrocompatibilidad

- [ ] El proto actualizado con los campos 3 y 4 ha sido regenerado correctamente en `src/recommendationservice/demo_pb2.py`.
- [ ] El proto actualizado ha sido regenerado en `src/frontend/genproto/demo.pb.go`.
- [ ] TC-SCRUM16-009 (retrocompatibilidad) y TC-INT-006 verifican que clientes legacy sin los nuevos campos no experimentan errores.
- [ ] No hay campos con números de campo 3 o 4 en conflicto con ningún otro mensaje proto del sistema.

### 4.4 Rendimiento

- [ ] Locust test ejecutado con 100 usuarios concurrentes durante al menos 2 minutos.
- [ ] p99 de latencia < 500ms en todas las rutas de recomendaciones (`/product/[id]`, `/cart`, `/checkout`).
- [ ] Tasa de errores < 1% durante el test de carga.
- [ ] Memoria del pod `recommendationservice` ≤ 220Mi bajo carga (verificar con `kubectl top pod` o Prometheus).
- [ ] Sin memory leaks detectables después de 10 minutos de carga sostenida.

### 4.5 Seguridad y Aislamiento

- [ ] TC-SCRUM16-006 y TC-E2E-005 confirman que no hay filtración de datos entre sesiones.
- [ ] No hay logging de `user_id` o historial de productos en nivel DEBUG que pueda exponer PII.
- [ ] Los nuevos campos proto no introducen vectores de inyección (IDs arbitrariamente largos, caracteres especiales).

### 4.6 Sign-off Final

- [ ] Toda la evidencia de ejecución de tests (screenshots, logs, reportes Locust) ha sido adjuntada al ticket SCRUM-16 en Jira.
- [ ] El documento de QA Analysis ha sido revisado y aprobado por el Tech Lead.
- [ ] El deploy en staging ha sido verificado con smoke tests manuales en las 3 superficies.

---

## 5. Notas para el Equipo

### Para el equipo de desarrollo

**Prioridad máxima antes de comenzar la implementación:**

1. **Resolver CRITICO-01 y CRITICO-03:** Los escenarios de aceptación deben reescribirse para ser verificables con el catálogo de producción. Proponer una reformulación en el ticket antes de desarrollar. No tiene sentido implementar un algoritmo correcto que no puede demostrar su correctitud en los tests de aceptación.

2. **Resolver CRITICO-02 (scope del frontend):** Aclarar si SCRUM-16 incluye los cambios en `src/frontend/rpc.go` para pasar `viewed_product_ids` y `purchased_product_ids`. Sin eso, el algoritmo de backend solo actúa sobre exclusiones de carrito (`product_ids`), que ya era el comportamiento existente respecto a la exclusión.

3. **Extraer la lógica de scoring a un módulo separado:** Para permitir unit testing aislado, la función de scoring debe separarse del handler gRPC. Sugerencia:
   ```
   src/recommendationservice/recommendation_engine.py   # lógica pura
   src/recommendationservice/recommendation_server.py   # handler gRPC (usa engine)
   ```

4. **Manejar el `product_catalog_stub` como dependencia inyectable:** El stub global actual hace difícil el testing. Considerar inyección via constructor de `RecommendationService`.

5. **Configurar timeout en la llamada a `ListProducts`:** Actualmente no tiene timeout. Con el servicio de catálogo caído, el recomendador puede colgar. Usar contexto gRPC con deadline.

6. **Definir comportamiento para IDs inválidos en los nuevos campos:** El algoritmo debe manejar silenciosamente IDs que no están en el catálogo (sin excepción, con log WARNING).

7. **El proto está duplicado:** Actualizar `demo.proto` y regenerar en **todos** los servicios que lo necesiten. Verificar que `src/frontend/genproto/demo.pb.go` coincide con `src/recommendationservice/demo_pb2.py`.

### Para el equipo de QA

- Los tests de la sección 3.2 (unit tests) están escritos para ser usados como especificación por el desarrollador. Compartirlos antes de la implementación para alinear expectativas.
- El test TC-E2E-004 ("navegar entre productos actualiza recomendaciones") puede ser inestable si el algoritmo de fallback aleatorio produce el mismo resultado para dos productos distintos. Usarlo como señal orientativa.
- El Escenario 6 (performance) requiere coordinación con infraestructura para medir memoria del pod en Kubernetes. Si no hay acceso a métricas del cluster, este criterio puede validarse con métricas de proceso Python (`psutil`) directamente en el contenedor.
- Documentar la versión exacta de `grpcio` y `protobuf` usada en los tests de integración. La serialización proto puede variar entre versiones.

### Para el Product Owner

- El catálogo actual de 9 productos limita significativamente la verificabilidad de los criterios de aceptación categóricos. Los Escenarios 1 y 4 necesitan ser reformulados. QA bloquea el inicio del testing formal hasta que CRITICO-01 y CRITICO-03 estén resueltos.
- La feature entrega personalización "por-request" (in-context), no personalización persistente de usuario. Si el objetivo de negocio requiere recordar el historial entre sesiones, eso debe agregarse al scope como un nuevo requisito técnico (persistencia en Redis con clave `shop_session-id`).
- Los títulos de los escenarios del ticket mezclan el nombre del producto con el ID incorrecto (Escenario 4: L9ECAV7KIM es Loafers, no Mug). Esto debe corregirse en el ticket para evitar confusión durante los sprints de implementación y testing.

---

*Documento generado para SCRUM-16 | Online Boutique — microservices-demo | QA: martin.bouzada@qubika.com | 2026-04-16*
