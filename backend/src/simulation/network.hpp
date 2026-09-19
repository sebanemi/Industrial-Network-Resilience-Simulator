#pragma once

#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

#include "graph/graph.hpp"
#include "models/node.hpp"
#include "models/shape.hpp"

namespace sim {

enum class AddNodeError {
    Ok,
    DuplicateId,
    SecondServer,
    InvalidData, // tipo/posición/rango inválidos
};

// Red en vivo: inventario de la simulación.
// Dueña del estado (planta, nodos, rangos, online/offline, Internet) y única
// fuente de verdad para derivar el grafo. No persiste nada (ADR-005).
class Network {
public:
    struct FactoryDims {
        double width = 200.0;
        double height = 150.0;
    };

    Network() = default;

    // ---- Mutaciones -------------------------------------------------

    AddNodeError addNode(Node node);
    bool removeNode(const std::string& id);
    bool moveNode(const std::string& id, double x, double y);
    bool setNodeStatus(const std::string& id, NodeStatus status);
    bool setNodeName(const std::string& id, std::string name);
    // nullopt limpia el rango; un valor debe ser > 0.
    bool setNodeRange(const std::string& id, std::optional<double> range);

    void setFactoryDims(double width, double height);
    void setInternetAvailable(bool available);

    // ---- Formas (objetos decorativos) --------------------------------

    bool addShape(const Shape& shape);   // false si id duplicado o datos inválidos
    bool updateShape(const Shape& shape);
    bool removeShape(const std::string& id);
    const std::vector<Shape>& shapes() const { return shapes_; }

    // ---- Consultas ---------------------------------------------------

    const std::unordered_map<std::string, Node>& nodes() const { return nodes_; }
    const Node* find(const std::string& id) const;
    Node* find(const std::string& id);
    std::string serverId() const { return server_id_.value_or(""); }
    bool hasServer() const { return server_id_.has_value(); }
    bool internetAvailable() const { return internet_available_; }
    FactoryDims factory() const { return factory_; }

    // ---- Derivación del grafo -----------------------------------------

    // Construye el grafo de los nodos ONLINE con la regla de conectividad
    // simétrica (doc simulation.md §3).
    Graph buildGraph() const;

    // Aristas del estado actual, ordenadas canónicamente (from <= to).
    std::vector<Edge> connections() const;

    // Nodos online que no alcanzan el servidor (o servidor inexistente).
    std::vector<std::string> isolatedNodes() const;

    static bool canCommunicate(const Node& a, const Node& b);
    static bool validRange(std::optional<double> range);
    static bool validPosition(double x, double y);
    static bool validShape(const Shape& shape);

private:
    std::unordered_map<std::string, Node> nodes_;
    std::optional<std::string> server_id_;
    std::vector<Shape> shapes_;
    FactoryDims factory_;
    bool internet_available_ = true;
};

} // namespace sim