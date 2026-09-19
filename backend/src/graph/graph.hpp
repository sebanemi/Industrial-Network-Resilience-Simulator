#pragma once

#include <string>
#include <unordered_map>
#include <vector>

#include "graph/edge.hpp"

namespace sim {

// Grafo no dirigido con lista de adyacencia.
// No posee lógica de negocio de la simulación: solo estructura.
class Graph {
public:
    void addVertex(std::string id);
    void addVertexIfMissing(const std::string& id);

    bool hasVertex(const std::string& id) const;

    // Agrega la arista a--b (peso>=0). No-op si falta alguno de los vértices
    // o si la arista ya existía. Devuelve true si se agregó.
    bool addUndirectedEdge(const std::string& a, const std::string& b, double weight);

    // Elimina el vértice y todas sus aristas incidentes.
    void removeVertex(const std::string& id);

    const std::vector<Edge>& neighbors(const std::string& id) const;

    std::vector<std::string> vertices() const;
    std::vector<Edge> edges() const;

    size_t vertexCount() const { return adj_.size(); }
    size_t edgeCount() const;
    bool empty() const { return adj_.empty(); }

    void clear();

private:
    using Adjacency = std::vector<Edge>;
    // Clave canónica mínima para aristas no dirigidas.
    static std::string normalizedKey(const std::string& a, const std::string& b);

    std::unordered_map<std::string, Adjacency> adj_;
};

} // namespace sim