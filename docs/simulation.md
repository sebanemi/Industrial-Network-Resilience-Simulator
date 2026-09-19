# Modelo de simulación

Este documento describe **qué** modela el sistema y **con qué reglas**, independientemente de la UI (React) o del transporte (HTTP). El código de referencia de estas reglas vive en el motor **C++20** del backend: `backend/src/{models,graph,simulation,routing}`.

## 1. Objetivo

Responder visualmente a una pregunta puntual:

> Si esta es la distribución física de mi fábrica y estos son los nodos de comunicación que instalé, ¿puede la información llegar desde cualquier dispositivo hasta el servidor cuando Internet deja de estar disponible?

El sistema es un **modelador + motor de grafos + simulador**. No controla hardware.

## 2. El mundo modelado

```
Planta (Factory): un rectángulo a escala real.
    width  = ancho en metros
    height = alto en metros

Nodos (Nodes): ubicados dentro de la planta.
    Cada nodo tiene:
      id        identidad única
      name      nombre amigable
      type      SENSOR | ESP32 | SERVER
      position  (x, y) en metros (origen arriba-izquierda)
      range     alcance radio en metros (OPCIONAL)
      status    ONLINE | OFFLINE
```

### Tipos de nodo y su rol

| Tipo | Capaz de retransmitir | Tiene rango por defecto | Rol en el MVP |
| --- | --- | --- | --- |
| `SENSOR` | No (hoja) | No | Endpoint de comunicación (existe en la fábrica, no lo tocamos) |
| `ESP32` | Sí | Sí (configurable) | Infraestructura de contingencia que encamina hacia el servidor |
| `SERVER` | Sí | Sí (configurable) | Destino único de las rutas |

- El `type` del sensor no afecta al routing (un `TEMP-01` y un `MOTOR-03` se tratan igual: endpoints).
- Existe **un único** `SERVER` en el MVP.
- El rango de un sensor puede definirse igualmente si se desea; la regla de conectividad es uniforme (sección 3).

## 3. Conectividad (generación de aristas)

Las aristas **nunca se dibujan a mano**: se derivan automáticamente de posición, rango y estado.

### 3.1 Distancia

Distancia euclidiana plana (el plano es 2D):

```
d(A,B) = sqrt((xB − xA)² + (yB − yA)²)
```

### 3.2 Regla de arista

Una arista **no dirigida** `A—B` existe si y solo si:

```
(1) A y B están ONLINE
(2) si A define rango: d(A,B) ≤ rango(A)
(3) si B define rango: d(A,B) ≤ rango(B)
(4) al menos uno de los dos define rango   ← evita que sensores "se oigan" entre sí
```

Interpretación:

- **Dos ESP32** se conectan si están dentro del alcance **de ambos** (`d ≤ min(rangoA, rangoB)`).
- **Sensor ↔ ESP32** se conecta si el ESP32 lo cubre (`d ≤ rangoEsp`); el sensor es hoja.
- **Server ↔ ESP32** idem con el rango del servidor.
- **Sensor ↔ Sensor**: sin arista (ninguno define rango → regla 4 falla).
- Un nodo `OFFLINE` no genera aristas (regla 1).

Esta regla es determinista y comprensible; no modela aún RSSI, obstáculos ni pérdidas (ver §8).

## 4. Pesos

Primera versión, determinista:

```
peso(A,B) = d(A,B)   (metros)
```

No implementados todavía: RSSI real, interferencia, consumo, latencia, congestión, pérdida de paquetes, calidad de señal, obstáculos, optimización energética. Documentados como extensiones (§8).

## 5. Grafo

- **Vértices**: todos los nodos `ONLINE` (sensores + ESP32 + server).
- **Aristas**: las generadas por la regla de §3, con peso §4.
- El grafo es **no dirigido** y de **una sola componente lógica por ruta** (componentes conexas según alcance).
- El motor **no persiste el grafo**: lo reconstruye desde el estado vivo de la red en cada operación de consulta. Esto hace que cualquier mutación (mover, apagar, crear, borrar) se refleje sin pasos adicionales de "recalcular".

## 6. Routing (Dijkstra)

Implementado en **C++20** (`backend/src/routing/dijkstra.*`), dentro del motor, **nunca** en React. Uso de cola de prioridad (`std::priority_queue`, O(E·log V)).

```
Dijkstra::shortestPath(graph, source, SERVER)
```

Resultado:

```json
{
  "source": "SENSOR-01",
  "destination": "SERVER",
  "reachable": true,
  "total_cost": 42.7,
  "path": ["SENSOR-01", "ESP-01", "ESP-03", "ESP-07", "SERVER"]
}
```

- `reachable = true` → `path` no vacío y `total_cost` es el costo del camino mínimo.
- `reachable = false` → `path` vacío, `total_cost = 0`. El nodo está **aislado**.
- El servidor se usa como destino por defecto del MVP. El algoritmo acepta cualquier par `(origen, destino)` como primitivo del motor.

Empates (arbitrario pero determinista): si dos caminos tienen el mismo costo, Dijkstra devuelve el encontrado primero por orden de exploración de vecinos (los vecinos se recorren en orden de inserción/ordenamiento del grafo). Se documenta para no sorprender.

## 7. Simulación de escenarios

### 7.1 Internet disponible (`internetAvailable = true`)

- La red de contingencia queda en *standby*.
- La información conceptualmente fluye `DISPOSITIVOS → RED NORMAL → INTERNET`.
- El `SERVER` local sigue siendo el destino modelado.

### 7.2 Internet caído (`internetAvailable = false`)

- Flag `internet.available = false` y `contingencyEngaged = true` en el estado.
- La UI lo presenta como `SIMULATE INTERNET FAILURE`.
- El grafo local es el que decide si los datos llegan al servidor por la red de contingencia:

```
              INTERNET
                 X
                 |
SENSOR → ESP → ESP → ESP → SERVER
```

- Nota de diseño: el Internet no altera la topología local en el MVP (el servidor central es siempre **local**). Su toggle controla el modo de operación que la UI declara, mostrando que la red de contingencia sigue dando servicio aunque no haya Internet. Ver ADR-006.

### 7.3 Fallo de nodos (`OFFLINE`)

- `PUT /api/nodes/{id}` con `status = OFFLINE` saca al nodo del grafo.
- La ruta anterior puede desaparecer; se busca alternativa automáticamente (el grafo se reconstruye sin ese vértice).
- Si no queda camino al servidor: `reachable = false` y la UI marca el nodo como **aislado** (aislados = fuente sin ruta). Precedentes:
  - `SENSOR → ESP01 → ESP03 → SERVER` (Internet up, ESP03 online)
  - apagamos `ESP03` → `SENSOR → ESP01 → ESP05 → ESP07 → SERVER`
  - si `ESP01` se apaga también → `SENSOR` aislado.

### 7.4 Recalculación

No hay stored graph, por lo que "recalcular" es implícito: **cada consulta** (`/api/routes`, `/api/simulation`) recalcula sobre el estado actual. El usuario nunca debe recargar la página; la UI reconsume `/api/simulation` tras cada mutación y repinta.

## 8. Fuera de alcance del MVP / extensiones futuras

### V2 — modelo de enlace más rico

- Pesos dinámicos (RSSI, calidad de señal real), pérdida de paquetes, latencia, congestión.
- Obstáculos físicos y propagación (modelos simples).
- Múltiples servidores / destinos configurables.
- Almacenamiento de proyectos (persistencia).

### V3 — hardware

- ESP32 reales con ESP-NOW / Wi-Fi / LoRa, gateway ESP32 → servidor.

### V4 — store-and-forward

- Mensajes almacenados localmente mientras Internet está caído y entrega al restaurarse.

### V5 — routing distribuido

- Cada nodo con conocimiento parcial de la red (protocolos distribuidos) en lugar de grafo global.

Nada de lo anterior forma parte del MVP: la prioridad es un modelo **determinista y fácil de entender**.

## 9. Guía de implementación (checks de tests)

Casos mínimos garantizados por `backend/tests` (§ Fase 2):

1. `A → B → SERVER`: ruta encontrada.
2. `A → B`, `A → C → SERVER`, `B → SERVER`: elige el camino de menor costo.
3. Nodo intermedio offline → busca alternativa.
4. Sin ruta → `reachable = false`.
5. Mover/apagar nodo → conexiones y rutas reflejan el cambio (recalculación).