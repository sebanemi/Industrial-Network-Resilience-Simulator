#pragma once

#include <string>
#include <vector>

#include "graph/graph.hpp"

namespace sim {

struct Route {
    bool reachable = false;
    double total_cost = 0.0;
    std::vector<std::string> path; // desde source hasta destination (inclusive)
};

// Algoritmo de Dijkstra implementado en el motor (nunca en la interfaz).
class Dijkstra {
public:
    static Route shortestPath(const Graph& graph,
                              const std::string& source,
                              const std::string& destination);
};

} // namespace sim