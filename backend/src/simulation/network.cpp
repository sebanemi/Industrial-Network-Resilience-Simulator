#include "simulation/network.hpp"

#include <algorithm>
#include <cmath>
#include <cstdlib>

#include "routing/dijkstra.hpp"

namespace sim {

namespace {

bool finitePositive(double value) { return std::isfinite(value) && value > 0.0; }

} // namespace

// ---- Mutaciones ----------------------------------------------------------

AddNodeError Network::addNode(Node node) {
    if (!validPosition(node.position.x, node.position.y) || !validRange(node.range)) {
        return AddNodeError::InvalidData;
    }
    if (nodes_.contains(node.id)) {
        return AddNodeError::DuplicateId;
    }
    if (node.type == NodeType::Server) {
        if (server_id_.has_value()) {
            return AddNodeError::SecondServer;
        }
        server_id_ = node.id;
    }
    nodes_.emplace(node.id, std::move(node));
    return AddNodeError::Ok;
}

bool Network::removeNode(const std::string& id) {
    const auto it = nodes_.find(id);
    if (it == nodes_.end()) {
        return false;
    }
    if (server_id_ == id) {
        server_id_.reset();
    }
    nodes_.erase(it);
    return true;
}

bool Network::moveNode(const std::string& id, double x, double y) {
    if (!validPosition(x, y)) {
        return false;
    }
    Node* node = find(id);
    if (node == nullptr) {
        return false;
    }
    node->position = {x, y};
    return true;
}

bool Network::setNodeStatus(const std::string& id, NodeStatus status) {
    Node* node = find(id);
    if (node == nullptr) {
        return false;
    }
    node->status = status;
    return true;
}

bool Network::setNodeName(const std::string& id, std::string name) {
    if (name.empty()) {
        return false;
    }
    Node* node = find(id);
    if (node == nullptr) {
        return false;
    }
    node->name = std::move(name);
    return true;
}

bool Network::setNodeRange(const std::string& id, std::optional<double> range) {
    if (!validRange(range)) {
        return false;
    }
    Node* node = find(id);
    if (node == nullptr) {
        return false;
    }
    node->range = range;
    return true;
}

void Network::setFactoryDims(double width, double height) {
    if (finitePositive(width) && finitePositive(height)) {
        factory_.width = width;
        factory_.height = height;
    }
}

void Network::setInternetAvailable(bool available) { internet_available_ = available; }

// ---- Formas (objetos decorativos) ------------------------------------------

bool Network::addShape(const Shape& shape) {
    if (!validShape(shape)) {
        return false;
    }
    for (const Shape& s : shapes_) {
        if (s.id == shape.id) {
            return false;
        }
    }
    shapes_.push_back(shape);
    return true;
}

bool Network::updateShape(const Shape& shape) {
    if (!validShape(shape)) {
        return false;
    }
    for (Shape& s : shapes_) {
        if (s.id == shape.id) {
            s = shape;
            return true;
        }
    }
    return false;
}

bool Network::removeShape(const std::string& id) {
    for (auto it = shapes_.begin(); it != shapes_.end(); ++it) {
        if (it->id == id) {
            shapes_.erase(it);
            return true;
        }
    }
    return false;
}

// ---- Consultas ------------------------------------------------------------

const Node* Network::find(const std::string& id) const {
    const auto it = nodes_.find(id);
    return it == nodes_.end() ? nullptr : &it->second;
}

Node* Network::find(const std::string& id) {
    const auto it = nodes_.find(id);
    return it == nodes_.end() ? nullptr : &it->second;
}

// ---- Derivación del grafo ---------------------------------------------------

bool Network::canCommunicate(const Node& a, const Node& b) {
    if (!a.isOnline() || !b.isOnline()) {
        return false;
    }
    if (!a.hasRange() && !b.hasRange()) {
        return false; // dos hojas no se vinculan directamente
    }
    const double d = distance(a.position, b.position);
    if (a.hasRange() && d > a.range.value()) {
        return false;
    }
    if (b.hasRange() && d > b.range.value()) {
        return false;
    }
    return true;
}

bool Network::validRange(std::optional<double> range) {
    return !range.has_value() || finitePositive(range.value());
}

bool Network::validPosition(double x, double y) {
    return std::isfinite(x) && std::isfinite(y) && x >= 0.0 && y >= 0.0;
}

bool Network::validShape(const Shape& shape) {
    return validPosition(shape.x, shape.y) && finitePositive(shape.width) && finitePositive(shape.height);
}

Graph Network::buildGraph() const {
    Graph graph;

    // Determinismo: recorremos los ids ordenados.
    std::vector<std::string> ids;
    ids.reserve(nodes_.size());
    for (const auto& [id, node] : nodes_) {
        if (node.isOnline()) {
            ids.push_back(id);
        }
    }
    std::sort(ids.begin(), ids.end());

    for (const std::string& id : ids) {
        graph.addVertex(id);
    }
    for (size_t i = 0; i < ids.size(); ++i) {
        for (size_t j = i + 1; j < ids.size(); ++j) {
            const Node& a = nodes_.at(ids[i]);
            const Node& b = nodes_.at(ids[j]);
            if (canCommunicate(a, b)) {
                graph.addUndirectedEdge(ids[i], ids[j], distance(a.position, b.position));
            }
        }
    }
    return graph;
}

std::vector<Edge> Network::connections() const {
    std::vector<Edge> result = buildGraph().edges();
    std::sort(result.begin(), result.end(),
              [](const Edge& a, const Edge& b) {
                  return std::tie(a.from, a.to) < std::tie(b.from, b.to);
              });
    return result;
}

std::vector<std::string> Network::isolatedNodes() const {
    const Graph graph = buildGraph();
    const std::string server = serverId();
    std::vector<std::string> isolated;
    for (const auto& [id, node] : nodes_) {
        if (!node.isOnline() || node.type == NodeType::Server) {
            continue;
        }
        const Route route = Dijkstra::shortestPath(graph, id, server);
        if (!route.reachable) {
            isolated.push_back(id);
        }
    }
    std::sort(isolated.begin(), isolated.end());
    return isolated;
}

} // namespace sim