# Decisiones arquitectónicas (ADR)

Registro de decisiones importantes del proyecto. Formato breve, orientado a que agentes de IA y humanos conserven el contexto.

Regla: **integrar las decisiones antes de escribir código**, y volver a este archivo cuando una decisión cambie.

---

## ADR-001: Framework HTTP del backend

- **Fecha:** 2026-09-18
- **Motivo:** El backend debe exponer el motor de simulación vía REST con poco peso y pocas dependencias (C++20).
- **Alternativas consideradas:** Crow (header-only), cpp-httplib, Drogon, Pistache, Boost.Beast directamente.
- **Decisión:** **Crow** (v1.3.x), consumido por CMake FetchContent, compilado contra Boost (Asio incluido vía Boost). Header-only y ligero, con JSON integrado.
- **Consecuencias:** Dependencia de Boost en la imagen Docker (solo build); sin dependencias externas en runtime. Crow carece de HTTPS integrado — innecesario para MVP local (ver ADR-004).

## ADR-002: Build del backend

- **Fecha:** 2026-09-18
- **Motivo:** Construcción reproducible y orientada a Docker.
- **Alternativas consideradas:** Make, CMake con FetchContent, vcpkg/conan.
- **Decisión:** **CMake ≥ 3.20 con FetchContent** para Crow (pinned tag). Bibliotecas del core compiladas como librería estática `simcore`; binarios `sim-server` (HTTP) y `sim-tests` (unit, sin HTTP).
- **Consecuencias:** El primer build requiere red para clonar Crow (cacheable por Docker layer). Los tests del motor se ejecutan con `ctest` y no dependen de la API.

## ADR-003: Frontend — stack y renderizado

- **Fecha:** 2026-09-18
- **Motivo:** UI de modelado físico a escala con zoom/pan/drag, sin peso innecesario.
- **Alternativas consideradas:**
  - Render: **React Flow** (orientado a grafo abstracto, no a plano físico a escala, más peso)
  - **Konva/react-konva** (canvas, drag builtin, dependencia extra)
  - **SVG nativo** ← **elegido**
  - **Canvas puro** (silencioso en eventos, más código manual)
- **Decisión:** React + TypeScript + Vite; **SVG nativo** con viewBox y transformaciones de pan/zoom. Eventos pointer para drag, rueda para zoom. Grid + regla de distancia en SVG.
- **Consecuencias:** Dependencias reducidas a React/Vite; control total de la representación a escala (metros↔px). El rendimiento alcanza de sobra para decenas/centenares de nodos del MVP. Si el proyecto crece a miles de nodos, migrar el canvas a Konva manteniendo la capa `canvas/` (geometría) intacta.

## ADR-004: Despliegue con Docker Compose

- **Fecha:** 2026-09-18
- **Motivo:** "No quiero depender de instalaciones manuales" — el proyecto debe correr con `docker compose up --build`.
- **Alternativas consideradas:** scripts locales por SO, devcontainers, compilado manual.
- **Decisión:** **Docker Compose** con dos servicios: `backend` (imagen Ubuntu compilada con CMake; expone 8080) y `frontend` (build Node → nginx estático con proxy `/api/` → `backend:8080`, host 5173).
- **Consecuencias:** Sin instalaciones locales. El único acceso al backend para el navegador es el proxy de nginx (evita CORS y expone una sola puerta de entrada).

## ADR-005: Persistencia — ninguna (memoria)

- **Fecha:** 2026-09-18
- **Motivo:** El MVP es un modelador+simulador en tiempo real de una única sesión; no se pidió guardado.
- **Alternativas consideradas:** SQLite, ficheros JSON, sin persistencia.
- **Decisión:** Estado vivo en memoria dentro de `Network` (un solo proceso, un solo proyecto). Sin base de datos.
- **Consecuencias:** Reiniciar el contenedor pierde el proyecto. Extensión prevista: persistencia de proyectos en V2 (ADR futuro). Este ADR mantiene el motor simple y testeable.

## ADR-006: Semántica del toggle de Internet

- **Fecha:** 2026-09-18
- **Motivo:** La petición exige simular "caída de Internet" y demostrar que la red local sigue llegando al servidor.
- **Alternativas consideradas:** (a) que Internet altere el grafo local (p.ej. desactivar aristas); (b) toggle informativo.
- **Decisión:** El toggle **no** modifica el grafo local en el MVP. El `SERVER` es local, así que la topología de contingencia no depende de Internet. `internet.available` cambia el **modo operativo** declarado en el estado (`contingencyEngaged`) y la UI lo muestra (banner "INTERNET DOWN", rutas como contingencia). La pregunta que responde el MVP —"¿puede llegar la información al servidor sin Internet?"— se evalúa con el toggle activado + fallos de nodos.
- **Consecuencias:** Comportamiento claro y determinista. Si en el futuro se modela un destino en la nube, este ADR deberá revisarse (el toggle pasaría a afectar al grafo).

## ADR-007: Regla de conectividad simétrica

- **Fecha:** 2026-09-18
- **Motivo:** Definir de forma determinista cuándo dos dispositivos se comunican sin dibujar aristas a mano.
- **Alternativas consideradas:** (a) `d ≤ rango(A)` únicamente (mal para dos ESP32 con rangos distintos); (b) `d ≤ rango` del denominador (p.ej. ESP32); (c) ambos extremos + al menos un rango definido.
- **Decisión:** Arista `A—B` ⟺ `d ≤ rango(A)` (si A tiene rango) **y** `d ≤ rango(B)` (si B tiene rango) **y** al menos un extremo tenga rango. Peso = `d`.
- **Consecuencias:** Simétrica y obvia para el usuario (dos ESP32 con rangos 25 y 15 se unen si `d ≤ 15`); sensores no se conectan entre sí. Documentado en `simulation.md §3`.

## ADR-008: Frameworks de testing del core

- **Fecha:** 2026-09-18
- **Motivo:** Tests unitarios del motor **sin** HTTP (tests = checks del comportamiento de Dijkstra, conectividad, distancias, nodos offline, rutas inexistentes, recalculación).
- **Alternativas consideradas:** Catch2 (FetchContent, dependencia extra) vs harness interno mínimo.
- **Decisión:** **Harness de tests propio y mínimo** (`tests/test.h`) con macros `CHECK`/`SECTION` + registro y reporte, compilado como test runner (`sim-tests`) con `ctest`. Evita una dependencia de red de terceros en el build.
- **Consecuencias:** Sin dependencia extra de test; el arsenal cubre los casos mínimos de §24 de la especificación. Si el proyecto crece, migrar a Catch2 es trivial (los tests ya separan asserts de estructura).