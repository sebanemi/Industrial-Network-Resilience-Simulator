#include "api/api.h"

#include <optional>
#include <string>
#include <utility>

#include "graph/edge.hpp"
#include "models/shape.hpp"
#include "routing/dijkstra.hpp"

namespace sim {

namespace {

using namespace std::string_literals;

constexpr const char* kJsonContentType = "application/json";

crow::response jsonResponse(crow::json::wvalue w, int code = 200) {
    crow::response res(code);
    res.body = w.dump() + "\n";
    res.set_header("Content-Type", kJsonContentType);
    // Headers de seguridad
    res.set_header("X-Content-Type-Options", "nosniff");
    res.set_header("X-Frame-Options", "DENY");
    res.set_header("X-XSS-Protection", "1; mode=block");
    return res;
}

crow::response jsonError(int code, std::string message) {
    crow::json::wvalue body;
    body["error"] = std::move(message);
    return jsonResponse(std::move(body), code);
}

crow::json::wvalue internetToJson(bool available) {
    crow::json::wvalue w;
    w["available"] = available;
    w["contingencyEngaged"] = !available;
    return w;
}

crow::json::wvalue nodeToJson(const Node& node, std::optional<bool> reachable = std::nullopt) {
    crow::json::wvalue w;
    w["id"] = node.id;
    w["name"] = node.name;
    w["type"] = std::string(toString(node.type));
    w["x"] = node.position.x;
    w["y"] = node.position.y;
    if (node.hasRange()) {
        w["range"] = node.range.value();
    } else {
        w["range"] = crow::json::wvalue(); // null
    }
    w["status"] = std::string(toString(node.status));
    if (reachable.has_value()) {
        w["reachable"] = reachable.value();
    }
    return w;
}

crow::json::wvalue edgeToJson(const Edge& edge) {
    crow::json::wvalue w;
    w["from"] = edge.from;
    w["to"] = edge.to;
    w["weight"] = edge.weight;
    return w;
}

crow::json::wvalue shapeToJson(const Shape& shape) {
    crow::json::wvalue w;
    w["id"] = shape.id;
    w["type"] = std::string(toString(shape.type));
    w["x"] = shape.x;
    w["y"] = shape.y;
    w["width"] = shape.width;
    w["height"] = shape.height;
    return w;
}

crow::json::wvalue routeToJson(const Route& route, const std::string& source,
                               const std::string& destination) {
    crow::json::wvalue w;
    w["source"] = source;
    w["destination"] = destination;
    w["reachable"] = route.reachable;
    w["total_cost"] = route.total_cost;
    w["path"] = crow::json::wvalue::list();
    for (size_t i = 0; i < route.path.size(); ++i) {
        w["path"][static_cast<unsigned>(i)] = route.path[i];
    }
    return w;
}

bool parseDouble(const crow::json::rvalue& value, double& out) {
    if (value.t() != crow::json::type::Number) {
        return false;
    }
    out = value.d();
    return true;
}

bool parseBool(const crow::json::rvalue& value, bool& out) {
    if (value.t() == crow::json::type::True || value.t() == crow::json::type::False) {
        out = value.b();
        return true;
    }
    return false;
}

bool parseString(const crow::json::rvalue& value, std::string& out) {
    if (value.t() != crow::json::type::String) {
        return false;
    }
    out = std::string(value.s());
    return true;
}

// Aplica el default de rango cuando el nodo lo requiere y no trae rango.
void applyDefaultRange(Node& node) {
    if (node.hasRange()) {
        return;
    }
    switch (node.type) {
        case NodeType::Esp32:
            node.range = Node::kDefaultEspRange;
            break;
        case NodeType::Server:
            node.range = Node::kDefaultServerRange;
            break;
        case NodeType::Sensor:
            break;
    }
}

// Parsea un payload de creación de nodo. Devuelve true si es válido.
bool parseNodeCreate(const crow::json::rvalue& body, Node& out, std::string& error) {
    if (!body.has("id") || body["id"].t() != crow::json::type::String) {
        error = "campo 'id' requerido (string)";
        return false;
    }
    if (!body.has("type") || body["type"].t() != crow::json::type::String) {
        error = "campo 'type' requerido (SENSOR|ESP32|SERVER)";
        return false;
    }
    if (!body.has("x") || !body.has("y")) {
        error = "campos 'x' e 'y' requeridos";
        return false;
    }
    double x, y;
    if (!parseDouble(body["x"], x) || !parseDouble(body["y"], y)) {
        error = "'x'/'y' deben ser números";
        return false;
    }
    const auto type = nodeTypeFromString(std::string(body["type"].s()));
    if (!type.has_value()) {
        error = "tipo inválido: '" + std::string(body["type"].s()) + "'";
        return false;
    }

    Node node;
    node.id = std::string(body["id"].s());
    node.type = type.value();
    node.position = {x, y};
    node.name = node.id;

    if (body.has("name") && parseString(body["name"], node.name) && node.name.empty()) {
        error = "'name' no puede estar vacío";
        return false;
    }
    if (body.has("range")) {
        if (body["range"].t() == crow::json::type::Null) {
            node.range = std::nullopt;
        } else {
            double range;
            if (!parseDouble(body["range"], range)) {
                error = "'range' debe ser número o null";
                return false;
            }
            node.range = range;
        }
    }
    if (body.has("status")) {
        const auto status = nodeStatusFromString(std::string(body["status"].s()));
        if (!status.has_value()) {
            error = "'status' inválido (ONLINE|OFFLINE)";
            return false;
        }
        node.status = status.value();
    }

    applyDefaultRange(node);

    if (!Network::validPosition(x, y) || !Network::validRange(node.range)) {
        error = "posición (x>=0, y>=0) o rango (>0) inválidos";
        return false;
    }
    out = std::move(node);
    return true;
}

// Parsea un payload de forma (estructura/objeto geométrico). Validación aquí,
// los límites de la planta se aplican junto con Network::validShape.
bool parseShape(const crow::json::rvalue& body, Shape& out, std::string& error) {
    if (!body.has("id") || !parseString(body["id"], out.id) || out.id.empty()) {
        error = "campo 'id' requerido (string no vacío)";
        return false;
    }
    if (!body.has("type")) {
        error = "campo 'type' requerido (rect|circle)";
        return false;
    }
    std::string typeText;
    if (!parseString(body["type"], typeText)) {
        error = "'type' debe ser string";
        return false;
    }
    const auto type = shapeTypeFromString(typeText);
    if (!type.has_value()) {
        error = "tipo inválido: '" + typeText + "' (rect|circle)";
        return false;
    }
    out.type = type.value();

    if (!body.has("x") || !body.has("y")) {
        error = "campos 'x' e 'y' requeridos";
        return false;
    }
    if (!parseDouble(body["x"], out.x) || !parseDouble(body["y"], out.y)) {
        error = "'x'/'y' deben ser números";
        return false;
    }
    if (!body.has("width") || !body.has("height")) {
        error = "campos 'width' y 'height' requeridos";
        return false;
    }
    if (!parseDouble(body["width"], out.width) || !parseDouble(body["height"], out.height)) {
        error = "'width'/'height' deben ser números";
        return false;
    }
    return true;
}

} // namespace

void registerApiRoutes(crow::SimpleApp& app, Network& network) {

    // ---- GET /api/simulation -------------------------------------------------
    CROW_ROUTE(app, "/api/simulation")
        .methods(crow::HTTPMethod::Get)([&network]() {
            try {
                const std::string server = network.serverId();
                const Graph graph = network.buildGraph();
                const std::vector<std::string> isolated = network.isolatedNodes();

                crow::json::wvalue w;
                w["factory"]["width"] = network.factory().width;
                w["factory"]["height"] = network.factory().height;
                w["internet"]["available"] = network.internetAvailable();
                w["internet"]["contingencyEngaged"] = !network.internetAvailable();

                unsigned idx = 0;
                for (const auto& [id, node] : network.nodes()) {
                    const Route r = Dijkstra::shortestPath(graph, id, server);
                    w["nodes"][idx++] = nodeToJson(node, r.reachable);
                }
                idx = 0;
                for (const Edge& e : network.connections()) {
                    w["connections"][idx++] = edgeToJson(e);
                }
                idx = 0;
                for (const std::string& id : isolated) {
                    w["isolated"][idx++] = id;
                }
                idx = 0;
                for (const Shape& s : network.shapes()) {
                    w["shapes"][idx++] = shapeToJson(s);
                }
                return jsonResponse(std::move(w));
            } catch (const std::exception& e) {
                CROW_LOG_ERROR << "Error en /api/simulation: " << e.what();
                return jsonError(500, "Error interno del servidor");
            }
        });

    // ---- POST /api/state (importar snapshot completo) ------------------------
    CROW_ROUTE(app, "/api/state")
        .methods(crow::HTTPMethod::Post)([&network](const crow::request& req) {
            try {
                const auto body = crow::json::load(req.body);
                if (!body) {
                    return jsonError(400, "JSON inválido");
                }

                // Planta (obligatoria).
                if (!body.has("factory") || body["factory"].t() != crow::json::type::Object) {
                    return jsonError(400, "campo 'factory' requerido (objeto)");
                }
                double width, height;
                if (!parseDouble(body["factory"]["width"], width) ||
                    !parseDouble(body["factory"]["height"], height)) {
                    return jsonError(400, "'factory.width'/'factory.height' deben ser números");
                }
                Network::FactoryDims factory = {width, height};

                // Internet (opcional).
                bool available = true;
                if (body.has("internet") && body["internet"].t() == crow::json::type::Object &&
                    body["internet"].has("available")) {
                    if (!parseBool(body["internet"]["available"], available)) {
                        return jsonError(400, "'internet.available' debe ser booleano");
                    }
                }

                // Nodos (obligatorio: lista, puede estar vacía).
                if (!body.has("nodes") || body["nodes"].t() != crow::json::type::List) {
                    return jsonError(400, "campo 'nodes' requerido (lista)");
                }
                std::vector<Node> nodes;
                {
                    const auto& arr = body["nodes"];
                    nodes.reserve(arr.size());
                    for (size_t i = 0; i < arr.size(); ++i) {
                        Node node;
                        std::string error;
                        if (!parseNodeCreate(arr[i], node, error)) {
                            return jsonError(400, "nodo #" + std::to_string(i) + ": " + error);
                        }
                        nodes.push_back(std::move(node));
                    }
                }

                // Formas (opcional).
                std::vector<Shape> shapes;
                if (body.has("shapes")) {
                    if (body["shapes"].t() != crow::json::type::List) {
                        return jsonError(400, "'shapes' debe ser una lista");
                    }
                    const auto& arr = body["shapes"];
                    shapes.reserve(arr.size());
                    for (size_t i = 0; i < arr.size(); ++i) {
                        Shape shape;
                        std::string error;
                        if (!parseShape(arr[i], shape, error)) {
                            return jsonError(400, "forma #" + std::to_string(i) + ": " + error);
                        }
                        shapes.push_back(std::move(shape));
                    }
                }

                const ReplaceError result =
                    network.replaceState(factory, available, std::move(nodes), std::move(shapes));
                switch (result) {
                    case ReplaceError::Ok:
                        return crow::response(204);
                    case ReplaceError::InvalidFactory:
                        return jsonError(400, "'factory.width'/'factory.height' deben ser > 0");
                    case ReplaceError::InvalidNode:
                        return jsonError(400, "nodo inválido (posicion/rango/id duplicado)");
                    case ReplaceError::SecondServer:
                        return jsonError(409, "el snapshot contiene más de un SERVER");
                    case ReplaceError::InvalidShape:
                        return jsonError(400, "forma inválida (datos o id duplicado)");
                }
                return jsonError(500, "Error interno del servidor");
            } catch (const std::exception& e) {
                CROW_LOG_ERROR << "Error en /api/state: " << e.what();
                return jsonError(500, "Error interno del servidor");
            }
        });

    // ---- GET/PUT /api/factory ------------------------------------------------
    CROW_ROUTE(app, "/api/factory")
        .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Put)(
            [&network](const crow::request& req) {
                try {
                    if (req.method == crow::HTTPMethod::Get) {
                        crow::json::wvalue w;
                        w["width"] = network.factory().width;
                        w["height"] = network.factory().height;
                        w["internetAvailable"] = network.internetAvailable();
                        return jsonResponse(std::move(w));
                    }

                    const auto body = crow::json::load(req.body);
                    if (!body) {
                        return jsonError(400, "JSON inválido");
                    }
                    if (body.has("width")) {
                        double width;
                        if (!parseDouble(body["width"], width) || width <= 0.0) {
                            return jsonError(400, "'width' debe ser > 0");
                        }
                        if (!body.has("height")) {
                            network.setFactoryDims(width, network.factory().height);
                        } else {
                            double height;
                            if (!parseDouble(body["height"], height) || height <= 0.0) {
                                return jsonError(400, "'height' debe ser > 0");
                            }
                            network.setFactoryDims(width, height);
                        }
                    } else if (body.has("height")) {
                        double height;
                        if (!parseDouble(body["height"], height) || height <= 0.0) {
                            return jsonError(400, "'height' debe ser > 0");
                        }
                        network.setFactoryDims(network.factory().width, height);
                    }
                    if (body.has("internetAvailable")) {
                        bool available;
                        if (!parseBool(body["internetAvailable"], available)) {
                            return jsonError(400, "'internetAvailable' debe ser booleano");
                        }
                        network.setInternetAvailable(available);
                    }
                    crow::json::wvalue w;
                    w["width"] = network.factory().width;
                    w["height"] = network.factory().height;
                    w["internetAvailable"] = network.internetAvailable();
                    return jsonResponse(std::move(w));
                } catch (const std::exception& e) {
                    CROW_LOG_ERROR << "Error en /api/factory: " << e.what();
                    return jsonError(500, "Error interno del servidor");
                }
            });

    // ---- POST /api/internet --------------------------------------------------
    CROW_ROUTE(app, "/api/internet")
        .methods(crow::HTTPMethod::Post)([&network](const crow::request& req) {
            try {
                const auto body = crow::json::load(req.body);
                if (!body) {
                    return jsonError(400, "JSON inválido");
                }
                if (!body.has("available")) {
                    return jsonError(400, "campo 'available' requerido");
                }
                bool available;
                if (!parseBool(body["available"], available)) {
                    return jsonError(400, "'available' debe ser booleano");
                }
                network.setInternetAvailable(available);
                return jsonResponse(internetToJson(network.internetAvailable()));
            } catch (const std::exception& e) {
                CROW_LOG_ERROR << "Error en /api/internet: " << e.what();
                return jsonError(500, "Error interno del servidor");
            }
        });

    // ---- GET/POST /api/nodes -------------------------------------------------
    CROW_ROUTE(app, "/api/nodes")
        .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Post)(
            [&network](const crow::request& req) {
                try {
                    if (req.method == crow::HTTPMethod::Get) {
                        crow::json::wvalue w = crow::json::wvalue::list();
                        unsigned idx = 0;
                        for (const auto& [id, node] : network.nodes()) {
                            w[idx++] = nodeToJson(node);
                        }
                        return jsonResponse(std::move(w));
                    }

                    const auto body = crow::json::load(req.body);
                    if (!body) {
                        return jsonError(400, "JSON inválido");
                    }
                    Node node;
                    std::string error;
                    if (!parseNodeCreate(body, node, error)) {
                        return jsonError(400, error);
                    }
                    const AddNodeError result = network.addNode(std::move(node));
                    if (result == AddNodeError::Ok) {
                        crow::json::wvalue created = nodeToJson(*network.find(body["id"].s()));
                        crow::response res = jsonResponse(std::move(created), 201);
                        return res;
                    }
                    if (result == AddNodeError::DuplicateId) {
                        return jsonError(409, "id ya existe: '" + std::string(body["id"].s()) + "'");
                    }
                    if (result == AddNodeError::SecondServer) {
                        return jsonError(409, "ya existe un SERVER en la simulación");
                    }
                    return jsonError(400, "datos de nodo inválidos");
                } catch (const std::exception& e) {
                    CROW_LOG_ERROR << "Error en /api/nodes: " << e.what();
                    return jsonError(500, "Error interno del servidor");
                }
            });

    // ---- GET/PUT/DELETE /api/nodes/{id} ------------------------------------
    CROW_ROUTE(app, "/api/nodes/<string>")
        .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Put, crow::HTTPMethod::Delete)(
            [&network](const crow::request& req, std::string id) {
                try {
                    if (req.method == crow::HTTPMethod::Get) {
                        const Node* node = network.find(id);
                        if (node == nullptr) {
                            return jsonError(404, "nodo no encontrado: '" + id + "'");
                        }
                        return jsonResponse(nodeToJson(*node));
                    }
                    if (req.method == crow::HTTPMethod::Delete) {
                        if (!network.removeNode(id)) {
                            return jsonError(404, "nodo no encontrado: '" + id + "'");
                        }
                        return crow::response(204);
                    }

                    // PUT
                    const Node* existing = network.find(id);
                    if (existing == nullptr) {
                        return jsonError(404, "nodo no encontrado: '" + id + "'");
                    }
                    const auto body = crow::json::load(req.body);
                    if (!body) {
                        return jsonError(400, "JSON inválido");
                    }
                    if (body.has("type")) {
                        return jsonError(400, "'type' no es mutable (borrar y recrear)");
                    }
                    if (body.has("x") || body.has("y")) {
                        double x = existing->position.x;
                        double y = existing->position.y;
                        if (body.has("x") && !parseDouble(body["x"], x)) {
                            return jsonError(400, "'x' debe ser número");
                        }
                        if (body.has("y") && !parseDouble(body["y"], y)) {
                            return jsonError(400, "'y' debe ser número");
                        }
                        if (!network.moveNode(id, x, y)) {
                            return jsonError(400, "posición inválida (x>=0, y>=0)");
                        }
                    }
                    if (body.has("name")) {
                        std::string name;
                        if (!parseString(body["name"], name) || !network.setNodeName(id, std::move(name))) {
                            return jsonError(400, "'name' inválido");
                        }
                    }
                    if (body.has("range")) {
                        std::optional<double> range;
                        if (body["range"].t() == crow::json::type::Null) {
                            range = std::nullopt;
                        } else {
                            double r;
                            if (!parseDouble(body["range"], r)) {
                                return jsonError(400, "'range' debe ser número o null");
                            }
                            range = r;
                        }
                        if (!network.setNodeRange(id, range)) {
                            return jsonError(400, "'range' debe ser > 0 o null");
                        }
                    }
                    if (body.has("status")) {
                        const auto status = nodeStatusFromString(std::string(body["status"].s()));
                        if (!status.has_value() || !network.setNodeStatus(id, status.value())) {
                            return jsonError(400, "'status' inválido (ONLINE|OFFLINE)");
                        }
                    }
                    return jsonResponse(nodeToJson(*network.find(id)));
                } catch (const std::exception& e) {
                    CROW_LOG_ERROR << "Error en /api/nodes/" << id << ": " << e.what();
                    return jsonError(500, "Error interno del servidor");
                }
            });

    // ---- GET/POST /api/shapes ------------------------------------------------
    CROW_ROUTE(app, "/api/shapes")
        .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Post)(
            [&network](const crow::request& req) {
                try {
                    if (req.method == crow::HTTPMethod::Get) {
                        crow::json::wvalue w = crow::json::wvalue::list();
                        unsigned idx = 0;
                        for (const Shape& s : network.shapes()) {
                            w[idx++] = shapeToJson(s);
                        }
                        return jsonResponse(std::move(w));
                    }

                    const auto body = crow::json::load(req.body);
                    if (!body) {
                        return jsonError(400, "JSON inválido");
                    }
                    Shape shape;
                    std::string error;
                    if (!parseShape(body, shape, error)) {
                        return jsonError(400, error);
                    }
                    if (!network.addShape(shape)) {
                        return jsonError(409, "id duplicado o forma fuera de la planta: '" + shape.id + "'");
                    }
                    return jsonResponse(shapeToJson(shape), 201);
                } catch (const std::exception& e) {
                    CROW_LOG_ERROR << "Error en /api/shapes: " << e.what();
                    return jsonError(500, "Error interno del servidor");
                }
            });

    // ---- PUT/DELETE /api/shapes/{id} -----------------------------------------
    CROW_ROUTE(app, "/api/shapes/<string>")
        .methods(crow::HTTPMethod::Put, crow::HTTPMethod::Delete)(
            [&network](const crow::request& req, std::string id) {
                try {
                    if (req.method == crow::HTTPMethod::Delete) {
                        if (!network.removeShape(id)) {
                            return jsonError(404, "forma no encontrada: '" + id + "'");
                        }
                        return crow::response(204);
                    }

                    const auto body = crow::json::load(req.body);
                    if (!body) {
                        return jsonError(400, "JSON inválido");
                    }
                    Shape shape;
                    std::string error;
                    if (!parseShape(body, shape, error)) {
                        return jsonError(400, error);
                    }
                    if (shape.id != id) {
                        return jsonError(400, "el 'id' del cuerpo debe coincidir con la URL");
                    }
                    if (!network.updateShape(shape)) {
                        return jsonError(404, "forma no encontrada: '" + id + "'");
                    }
                    return jsonResponse(shapeToJson(shape));
                } catch (const std::exception& e) {
                    CROW_LOG_ERROR << "Error en /api/shapes/" << id << ": " << e.what();
                    return jsonError(500, "Error interno del servidor");
                }
            });

    // ---- GET /api/connections ------------------------------------------------
    CROW_ROUTE(app, "/api/connections")
        .methods(crow::HTTPMethod::Get)([&network]() {
            try {
                crow::json::wvalue w = crow::json::wvalue::list();
                unsigned idx = 0;
                for (const Edge& e : network.connections()) {
                    w[idx++] = edgeToJson(e);
                }
                return jsonResponse(std::move(w));
            } catch (const std::exception& e) {
                CROW_LOG_ERROR << "Error en /api/connections: " << e.what();
                return jsonError(500, "Error interno del servidor");
            }
        });

    // ---- POST /api/routes -----------------------------------------------------
    CROW_ROUTE(app, "/api/routes")
        .methods(crow::HTTPMethod::Post)([&network](const crow::request& req) {
            try {
                const auto body = crow::json::load(req.body);
                if (!body || !body.has("source")) {
                    return jsonError(400, "campo 'source' requerido");
                }
                std::string source;
                if (!parseString(body["source"], source)) {
                    return jsonError(400, "'source' debe ser string");
                }
                const Node* src = network.find(source);
                if (src == nullptr) {
                    return jsonError(404, "nodo no encontrado: '" + source + "'");
                }
                const std::string server = network.serverId();
                const Route route = Dijkstra::shortestPath(network.buildGraph(), source, server);
                return jsonResponse(routeToJson(route, source, server));
            } catch (const std::exception& e) {
                CROW_LOG_ERROR << "Error en /api/routes: " << e.what();
                return jsonError(500, "Error interno del servidor");
            }
        });
}

} // namespace sim