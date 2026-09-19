# Architecture Graph

**Mapa permanente del proyecto.**

Este archivo es el recurso de verdad de la arquitectura. **Debe actualizarse cada vez que cambie la arquitectura real del código** (nuevos módulos, nuevas rutas de API, cambios de dependencia). Cuando se trabaje sobre el código, después de cualquier cambio estructural hay que volver aquí y aplicar el delta.

Última sincronización con el código: **Fase 5 (MVP completo)**.

---

## 1. Vista de componentes (runtime)

```
                        ┌─────────────────────────────┐
                        │        Browser              │
                        │  React + TypeScript (Vite)  │
                        │                             │
                        │  FactoryCanvas (SVG)        │
                        │  Toolbar / Panels           │
                        │  state/ (useReducer)        │
                        │        │  api/client.ts     │
                        └────────┼────────────────────┘
                                 │ HTTP/REST (JSON)
                                 │
                        ┌────────▼────────────────────┐
                        │  Backend C++20 (Crow)       │
                        │  main.cpp  →  api/*         │
                        └────────┬────────────────────┘
                                 │ (llamadas directas, sin HTTP)
                        ┌────────▼────────────────────┐
                        │  Simulation Engine          │
                        │  ┌──────────┐   ┌─────────┐ │
                        │  │Network   │   │Dijkstra │ │
                        │  │(.hpp/.cpp)│   │(.hpp)   │ │
                        │  └────┬─────┘   └────┬────┘ │
                        │       │              │      │
                        │       ▼              │      │
                        │  ┌──────────┐        │      │
                        │  │ Graph    │◄───────┘      │
                        │  │(.hpp/.cpp)│               │
                        │  └────┬─────┘               │
                        │       ▼                     │
                        │  ┌──────────┐    ┌────────┐ │
                        │  │ Edge     │    │ Point  │ │
                        │  │(.hpp)    │◄───│ Node   │ │
                        │  │          │    │ models │ │
                        │  └──────────┘    └────────┘ │
                        └──────────────────────────────┘
```

Dependencias entre módulos C++ (dirección estricta, sin ciclos):

```
api         →  simulation → graph → models
simulation  →  routing   (necesita Dijkstra para detectar aislados) ✓
routing     →  graph     (Edge, Graph)
graph       →  models    (Point)
routing     →  models    (expone NodeId)
simulation  →  models
```

> Nota: `simulation` (Network) calcula aislados llamando a `routing::Dijkstra`; `routing` no conoce a `simulation`. No hay ciclo.

## 2. Grafo de dominio (conceptual)

```
                       Factory
                          │
        ┌─────────────────┼───────────────────┐
        │                 │                   │
    Plant              Nodes               Simulation
  (width,height)   ┌─────┼─────┐       ┌──────┼──────────┐
        │          │     │     │       │      │          │
        │       Sensor ESP32 Server  Internet   Node     Routes
        │          │     │     │       State   Status
        │          │  (range)  │       (on/off)
        │          └─────┼─────┘
        │                │
        ▼                ▼
   Position (x,y)  Connectivity
    (metros)       edge ⟺ d(A,B) ≤ range(A) ∧ d(A,B) ≤ range(B)
                        │
                        ▼
                     Graph
                        │ (peso = d(A,B))
                        ▼
                     Dijkstra ──► shortestPath(source → Server)
                        │
                        ▼
                  { reachable, total_cost, path }
```

## 3. Vista de módulos del backend (`backend/src`)

```
backend/
│
├── main.cpp            Bootstrap: crea Network + configura rutas Crow
│
├── api/
│   ├── api.h           Declaración del montaje de rutas
│   └── api.cpp         Handlers REST + conversión modelos ⇄ JSON
│
├── models/
│   ├── point.hpp       struct Point { double x,y; }; distance(a,b)
│   └── node.hpp        enum NodeType{Sensor,Esp32,Server};
│                       enum NodeStatus{Online,Offline};
│                       struct Node { id,name,type,position,range?,status };
│
├── graph/
│   ├── edge.hpp        struct Edge { from,to,weight };
│   └── graph.hpp/.cpp  class Graph (adjacency list, undirected)
│
├── simulation/
│   └── network.hpp/.cpp class Network
│                            factory dims, nodes{}, serverId, internet
│                            buildGraph(online-only), edge rule, weights,
│                            moveNode/setStatus/addNode/removeNode,
│                            isolatedNodes()
│
└── routing/
    └── dijkstra.hpp/.cpp  Dijkstra::shortestPath(Graph, src, dst)
                                → Route { reachable, cost, path }
```

## 4. Contrato REST (resumen)

```
GET    /api/simulation           estado completo (factory+internet+nodes+edges+routes+isolated)
GET    /api/factory              dimensión de planta + internet
PUT    /api/factory              { width, height, internetAvailable }
GET    /api/nodes                lista de nodos
POST   /api/nodes                crear nodo
GET    /api/nodes/{id}           un nodo
PUT    /api/nodes/{id}           actualizar (posición/rango/nombre/estado)
DELETE /api/nodes/{id}           eliminar
GET    /api/connections          aristas derivadas (id, from, to, weight)
POST   /api/routes               { source } → Dijkstra hasta SERVER
```

Detalle completo en `docs/api.md`.

## 5. Vista de módulos del frontend (`frontend/src`)

```
frontend/
│
├── main.tsx / App.tsx        Composición de la UI
├── models/types.ts           Contratos JSON (NodeDto, RouteDto, SimulationDto…)
├── api/client.ts             RestClient (fetch tipado, base /api)
├── state/store.tsx           AppState + useReducer (planta, nodos, internet, selección, panel)
├── canvas/
│   ├── geometry.ts           transform world(m) ⇄ viewport(px); helpers de pan/zoom
│   └── usePanZoom.ts         hook: wheel/pinch/drag + grid
└── components/
    ├── FactoryCanvas.tsx     plano SVG principal (nodos, rangos, aristas, ruta activa)
    ├── Toolbar.tsx           acciones (agregar, simular internet, toggles)
    ├── NodeFormPanel.tsx     edición del nodo seleccionado
    ├── StatusPanel.tsx       estado de simulación (internet, aislados, botón ruta)
    └── DistanceLegend.tsx    regla/indicador de escala
```

## 6. Flujo de simulación de una rutina típica (plant)

```
1. PUT /api/factory {width:100, height:60}
2. POST /api/nodes   {type:"SERVER", x:90, y:10, range:50}
3. POST /api/nodes ×N (SENSOR,…) , (ESP32 x:..,y:..,range:..)
4. PUT /api/nodes/{id} {x:…,y:…}          → la UI repinta conexiones
5. POST /api/internet {available:false}   → estado: contingency engaged
6. PUT /api/nodes/{id} {status:"OFFLINE"} → desaparece del grafo
7. POST /api/routes {source:"SENSOR-01"}  → ruta/aislado, la UI lo colorea
```

## 7. Reglas de conectividad & pesos (regla de oro)

```
edge(A,B) existe ⟺ A,B están ONLINE
                ⟺ d = √((xB−xA)² + (yB−yA)²)  cumple:
                       d ≤ range(A) (si A tiene rango)
                  y    d ≤ range(B) (si B tiene rango)
                  y    (al menos un extremo define rango)
Peso(edge) = d
```

## 8. Changelog de arquitectura

| Fecha | Cambio | Archivos tocados |
| --- | --- | --- |
| 2026-09-18 | Fase 1: definición del diseño (docs + estructura) | — (solo docs) |
| 2026-09-18 | Fase 2: núcleo C++ (models/graph/simulation/routing) implementado | backend/src/*, backend/tests/* |
| 2026-09-18 | Fase 3: API REST Crow + main.cpp | backend/src/api/, backend/src/main.cpp |
| 2026-09-18 | Fase 4: frontend React+TS+SVG | frontend/src/* |
| 2026-09-18 | Fase 5: Docker Compose end-to-end | docker-compose.yml, backend/Dockerfile, frontend/Dockerfile |
| 2026-09-18 | Fases 4–5 verificadas E2E (build estricto TS + bundle, imagen nginx con proxy /api, `docker compose up`, smoke test completo vía :5173: crear SERVER/ESP/SENSOR, conexiones ponderadas, ruta Dijkstra, OFFLine → aislado, internet caído, PUT/DELETE) | frontend/src/*, docker-compose.yml |

> Este changelog debe crecer con el proyecto. Si la arquitectura cambia, agréguense filas y actualícese el diagrama correspondiente.