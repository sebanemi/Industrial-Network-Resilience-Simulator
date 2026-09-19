# API REST

Base URL del backend: `http://localhost:8080`. Detalle del secuenciador de estados de simulación en `docs/simulation.md` (modelo de dominio) y `docs/architecture-graph.md` (vista de componentes).

> Frontend en Docker: la API se consume siempre a través del mismo origen (nginx proxy `/api` → backend:8080), por lo que **no** se requieren cabeceras CORS en el navegador.

Todos los cuerpos usan `application/json`. Respuestas de error con `{ "error": "...", "details"?: {...} }`.

---

## Estado global / simulación

### `GET /api/simulation`

Estado completo de la simulación actual (depende solo del estado vivo del motor).

```json
{
  "factory": { "width": 100.0, "height": 60.0 },
  "internet": { "available": true, "contingencyEngaged": false },
  "nodes": [
    {
      "id": "SENSOR-01",
      "name": "TEMP-01",
      "type": "SENSOR",
      "x": 20.0, "y": 15.0,
      "range": null,
      "status": "ONLINE",
      "reachable": true
    }
  ],
  "connections": [
    { "from": "SENSOR-01", "to": "ESP-01", "weight": 7.07 }
  ],
  "isolated": ["SENSOR-02"]
}
```

- `nodes[].reachable` : resultado de Dijkstra hacia el servidor (false = aislado o servidor inexistente).
- `isolated` : ids de nodos alcanzables-etiquetados-doal `SENSOR`/`ESP32` sin camino al servidor (los `OFFLINE` no aparecen aquí).

### `PUT /api/factory`

Actualiza las dimensiones de la planta e Internet.

```json
{ "width": 120, "height": 80, "internetAvailable": false }
```

Respuesta: `GET /api/simulation` (subconjunto `{factory, internet}`). Errores: `400` si `width/height <= 0`.

### `POST /api/internet`

Atajo para cambiar solo el estado de Internet.

```json
{ "available": false }
```

Respuesta: `{ "internet": { "available": false, "contingencyEngaged": true } }`.

---

## Factory

### `GET /api/factory`

```json
{ "width": 100.0, "height": 60.0, "internetAvailable": true }
```

---

## Nodos

### `GET /api/nodes`

Lista `Array<NodeDto>` como en `simulation.nodes`, sin `reachable`.

### `POST /api/nodes`

Crea un nodo.

```json
{
  "id": "ESP-01",
  "name": "ESP-01",
  "type": "ESP32",
  "x": 20, "y": 30,
  "range": 25
}
```

- `id` **requerido y único**. Valores sugeridos `TEMP-01`, `ESP-01`, `SERVER`.
- `type`: `"SENSOR" | "ESP32" | "SERVER"`.
- `range`: opcional (p.ej. sensores). Si se omite para un `ESP32`/`SERVER` se usa un valor por defecto de fábrica.
- Restricciones: `400` si falta `id`/`type` o `x,y` inválidos; `409` si `id` ya existe; `409` si se intenta crear un segundo `SERVER`.

Respuesta `201`: el `NodeDto` creado.

### `GET /api/nodes/{id}`

```json
{ "id": "...", "name": "...", "type": "...", "x": 0, "y": 0, "range": 20.0, "status": "ONLINE" }
```

`404` si no existe.

### `PUT /api/nodes/{id}`

Actualiza propiedades del nodo. **Cualquier subconjunto** de campos es válido:

```json
{ "x": 35, "y": 20, "range": 15, "name": "ESP-CALIB", "status": "OFFLINE" }
```

Respuesta: `NodeDto` actualizado. `404` si no existe; `409` si `id` en body apunta a otro id (no permitido renombrar el id en esta versión; borrar y crear si se desea otro id).

### `DELETE /api/nodes/{id}`

`204` al eliminar (o `404` si no existe). Eliminar el servidor actual deja la simulación sin destino.

---

## Conexiones (grafique from where the edges come)

### `GET /api/connections`

Aristas derivadas del estado actual (solo nodos ONLINE con la regla de rango de §3 de simulation.md):

```json
[
  { "from": "SENSOR-01", "to": "ESP-01", "weight": 7.07 }
]
```

---

## Routing

### `POST /api/routes`

Calcula la ruta de menor costo (Dijkstra) de un nodo al servidor.

```json
{ "source": "SENSOR-01" }
```

Respuesta:

```json
{
  "source": "SENSOR-01",
  "destination": "SERVER",
  "reachable": true,
  "total_cost": 42.7,
  "path": ["SENSOR-01", "ESP-01", "ESP-03", "ESP-07", "SERVER"]
}
```

- Si `source` no existe → `404`.
- Si `source == destination` y es el server → `path: [id]`, `cost: 0`, `reachable: true`.
- Sin camino → `reachable: false`, `path: []`, `total_cost: 0`.

---

## Códigos de estado

| Código | Uso |
| --- | --- |
| 200 | OK |
| 201 | Nodo creado |
| 204 | Eliminación sin cuerpo |
| 400 | Cuerpo/parámetros inválidos |
| 404 | Recurso inexistente |
| 409 | Conflicto de estado (id/nodo duplicado, segundo servidor) |
| 500 | Error interno (el motor no debe hacer fallos por estado inválido) |

---

## Contratos TypeScript (espejo)

Ver `frontend/src/models/types.ts` para los tipos que el frontend usa. API y frontend deben mantenerse en sincronía a partir de estos contratos.