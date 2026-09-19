# Industrial Network Resilience Simulator

Modelador y simulador gráfico de **redes IoT industriales resilientes ante la pérdida de Internet**.

Representa una fábrica a escala (dimensiones reales en metros), permite colocar **sensores**, **nodos ESP32** y un **servidor central**, construye automáticamente un grafo a partir de las posiciones físicas y los rangos de comunicación, y responde a la pregunta:

> *"Si esta es la distribución física de mi fábrica y estos son los nodos de comunicación que instalé, ¿puede la información llegar desde cualquier dispositivo hasta el servidor cuando Internet deja de estar disponible?"*

- Motor de simulación **C++20** (grafo + Dijkstra) expuesto vía **REST**.
- Frontend **React + TypeScript + Vite** (plano SVG a escala, zoom/pan, drag & drop).
- Todo se ejecuta con **Docker Compose**.

> El MVP **no** controla hardware físico. `ESP32` son nodos lógicos de un modelo. Es un *modelador + motor de grafos + simulador*.

---

## Inicio rápido

```bash
docker compose up --build
```

- Frontend: <http://localhost:5173>
- Backend (API directa): <http://localhost:8080/api/simulation>

Flujo de uso:

1. Crear la planta y definir sus dimensiones (ancho/alto en metros).
2. Agregar el `SERVER` (único), sensores y ESP32 sobre el plano.
3. Mover dispositivos y observar cómo aparecen/desaparecen conexiones según el rango.
4. Seleccionar un sensor → calcular ruta Dijkstra hasta el servidor y visualizarla.
5. Simular `INTERNET FAILURE` y apagar nodos ESP32 → ver rutas alternativas y dispositivos aislados.

---

## Arquitectura (resumen)

```
Frontend (React + SVG)
    │
    │ HTTP/REST
    ▼
Backend (C++20 / Crow)
    │
    ▼
Simulation Engine
    ├── Network Model  (nodos, posiciones, rangos, estado)
    ├── Connectivity   (aristas derivadas de distancia v/s rango)
    ├── Graph          (grafo no dirigido con pesos)
    └── Routing        (Dijkstra: origen → SERVER)
```

El backend funciona **independientemente** del frontend: la interfaz solo pide datos y visualiza resultados; no contiene reglas de negocio.

## Estructura del repositorio

```
├── backend/            Motor de simulación C++20 + API REST (Crow)
│   ├── src/
│   │   ├── api/        Capa HTTP: handlers REST + serialización JSON
│   │   ├── models/     Point, Node, NodeType, NodeStatus
│   │   ├── graph/      Edge, Graph
│   │   ├── simulation/ Network (estado, conectividad, aislados)
│   │   ├── routing/    Dijkstra
│   │   └── main.cpp    Bootstrap del servidor
│   ├── tests/          Tests unitarios del core (sin HTTP)
│   ├── CMakeLists.txt
│   └── Dockerfile
├── frontend/           UI React + TypeScript (Vite) + plano SVG
│   ├── src/
│   │   ├── components/ Toolbar, panels, factory canvas
│   │   ├── canvas/     Geometría SVG, pan/zoom
│   │   ├── api/        Cliente REST
│   │   ├── models/     Tipos TS alineados con la API
│   │   └── state/      Estado de la aplicación
│   ├── Dockerfile      Build + nginx (proxy /api → backend)
│   └── package.json
├── docs/               Documentación del proyecto
├── docker-compose.yml
└── .gitignore
```

## Documentación

| Archivo | Contenido |
| --- | --- |
| `docs/architecture.md` | Componentes, responsabilidades, dependencias y flujo de datos. |
| `docs/architecture-graph.md` | **Mapa permanente del proyecto** (el recurso de verdad de la arquitectura). |
| `docs/simulation.md` | Modelo de simulación: reglas de conectividad, pesos, Dijkstra, fallos. |
| `docs/api.md` | Todos los endpoints REST. |
| `docs/decisions.md` | Decisiones arquitectónicas (formato ADR). |

## Desarrollo local sin Docker (opcional)

Para que el proyecto sea reproducible, se recomienda Docker. Si se desea desarrollo local:

- **Backend**: requiere CMake ≥ 3.16, compilador C++20 y Boost ≥ 1.5, luego:
  `cmake -S backend -B backend/build && cmake --build backend/build && ctest --test-dir backend/build`
- **Frontend**: `cd frontend && npm install && npm run dev` (con proxy de `/api` a `http://localhost:8080`).

## Roadmap (extensiones futuras)

Documentadas en `docs/decisions.md` y `docs/simulation.md`. Incluyen pesos dinámicos/RSSI, obstáculos, múltiples servidores, persistencia de proyectos (V2), integración ESP-NOW real (V3), store-and-forward (V4) y routing distribuido (V5). Ninguna de ellas forma parte del MVP.

## Licencia de componentes de terceros

- [Crow](https://github.com/CrowCpp/Crow) — BSD-3-Clause (framework HTTP).
- Boost — Boost Software License (usado por Crow/vía Asio).