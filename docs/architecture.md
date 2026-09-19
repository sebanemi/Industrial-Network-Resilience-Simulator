# Architecture

> Grado de detalle: arquitectura de referencia del MVP. El recurso de verdad topológico es `architecture-graph.md`.

## 1. Principio rector

No estamos "haciendo una página web". Estamos construyendo **un motor de simulación de redes IoT industriales que actualmente tiene una interfaz web**.

Consecuencias:

- El núcleo (modelos, grafo, conectividad, routing) **no depende** de HTTP ni de React.
- El backend es un servicio REST autónomo: puede ser consumido por esta UI, por otra UI, por scripts o, en el futuro, por hardware real.
- React **nunca** implementa reglas de negocio (distancias, rangos, rutas).

## 2. Componentes

### 2.1 Motor de simulación (`backend/src/models`, `graph`, `simulation`, `routing`)

Puro C++20, sin dependencias de red. Es la única parte con lógica de negocio.

| Módulo | Archivos | Responsabilidad |
| --- | --- | --- |
| `models` | `point.hpp`, `node.hpp` | Tipos de dominio: `Point`, `NodeType`, `NodeStatus`, `Node`. Funciones de distancia euclidiana. |
| `graph` | `edge.hpp`, `graph.hpp/cpp` | `Edge` (origen, destino, peso) y `Graph` (lista de adyacencia no dirigida, con operaciones seguras). |
| `simulation` | `network.hpp/cpp` | `Network`: dueño del estado (dimensión de planta, nodos, rango, estado online/offline, Internet). Construye el grafo, calcula aristas/pesos, detecta nodos aislados. |
| `routing` | `dijkstra.hpp/cpp` | `Dijkstra` (priority queue). `shortestPath(graph, source, target)` devuelve estado alcanzable, costo total y camino. |

Reglas del dominio (detalle en `simulation.md`):

- Arista `A—B` existe solo si **ambos** extremos la soportan: `d(A,B) <= rango(A)` y `d(A,B) <= rango(B)`.
- Un nodo sin rango (ej. sensor) es un *extremo hoja*: solo puede vincularse al alcance del otro extremo.
- Dos nodos sin rango no generan arista.
- Peso de arista = distancia euclidiana.
- Los nodos `OFFLINE` no participan en el grafo.
- `SERVER` es el destino de routing (único por MVP).

### 2.2 Capa API (`backend/src/api`, `backend/src/main.cpp`)

Traduce REST ↔ modelo. Sin reglas de negocio:

- Handlers por recurso (`/api/nodes`, `/api/routes`, `/api/simulation`, ...).
- Serialización JSON (conversión modelos ↔ `crow::json::wvalue`).
- Errores con semántica HTTP (400/404/409).

### 2.3 Frontend (`frontend/src`)

Presentación pura:

| Módulo | Responsabilidad |
| --- | --- |
| `api/client.ts` | Cliente REST tipado. **Única** vía de acceso al backend en el frontend. |
| `models/types.ts` | Interfaces TS que espejan los contratos JSON de la API. |
| `state/` | Estado global (planta, nodos, internet, selección, panel) vía `useReducer`/context. |
| `canvas/` | Geometría (transformación m→px), pan/zoom, eventos de arrastre. |
| `components/` | `FactoryCanvas`, `Toolbar`, panels de nodo/simulación, etc. |

La vista es un **SVG a escala** sobre un grid opcional: cada nodo es un círculo con su nombre, y los rangos se dibujan como circunferencias (solo ESP32/SERVER).

## 3. Dependencias

```
api  ──► simulation ──► routing ──► graph ──► models
                          ▲
                          │
                     (sin dependencias circulares)
```

- `api` depende de todo el motor.
- `simulation` depende de `graph` y `models`.
- `routing`/`graph`/`models` no dependen entre sí excepto `routing`→`graph` (tipos de `Edge`/`Graph`).
- El frontend solo depende del **contrato** de la API (no de la implementación del motor).

## 4. Flujo de datos

### 4.1 Consultar estado completo

```
GET /api/simulation
  → api: construye el grafo con Network::buildGraph()
  → api: por cada sensor online, ejecuta Dijkstra hacia SERVER
  → responde: { factory, internet, nodes, connections, routes, isolated }
```

### 4.2 Calcular una ruta

```
POST /api/routes { source: "SENSOR-01" }
  → api: Network::nodes()
  → api: Dijkstra::shortestPath(graph, "SENSOR-01", "SERVER")
  → responde: { source, destination, reachable, total_cost, path }
```

### 4.3 Mover un nodo (sin recargar página)

```
PUT /api/nodes/{id} { x, y }
  → api: Network::moveNode(id, x, y)
  → Graph no se almacena: la próxima consulta lo reconstruye desde el estado
  → la UI vuelve a pedir /api/simulation y repinta
```

## 5. Estado y recálculo

El motor guarda **estado vivo** (nodos + planta + internet) en memoria (inventario de una única simulación; sin base de datos, ver ADR-005). **No almacena el grafo**: este se deriva en cada consulta a partir del estado (posiciones, rangos, online/offline). Por lo tanto toda mutación (mover, apagar, crear, borrar) se refleja automáticamente en conexiones, pesos y rutas sin pasos extra de *recalculación*.

## 6. Decisiones de tecnología (resumen)

| Decisión | Elección | Motivo | ADR |
| --- | --- | --- | --- |
| Framework HTTP | Crow (header-only, admite C++20) | Ligero, single include, JSON integrado | ADR-001 |
| Build backend | CMake + Boost | Estándar, reproducible en Docker | ADR-002 |
| Motor | C++20 (RAII, const-correctness, STL) | Núcleo desacoplado de la UI | — |
| Frontend | React + TS + Vite | Stack solicitado, rápido con Vite | ADR-003 |
| Render | SVG nativo (sin librería de grafos) | Plano físico a escala, sin peso innecesario | ADR-003 |
| Despliegue | Docker Compose | Reproducible desde cero | ADR-004 |
| Persistencia | Ninguna (memoria) | MVP | ADR-005 |

## 7. Seguridad/scope (no-MVP)

Sin auth, sin base de datos, sin TLS interno, sin multiusuario: la app escucha en la red local del desarrollador. Cualquier formalización debe plantearse como extensión (ver `decisions.md`).