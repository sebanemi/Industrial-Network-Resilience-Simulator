#include "routing/dijkstra.hpp"

#include <algorithm>
#include <cmath>
#include <functional>
#include <queue>
#include <unordered_map>
#include <utility>

namespace sim {

Route Dijkstra::shortestPath(const Graph& graph,
                             const std::string& source,
                             const std::string& destination) {
    Route route;

    if (source == destination) {
        if (graph.hasVertex(source)) {
            route.reachable = true;
            route.total_cost = 0.0;
            route.path = {source};
        }
        return route;
    }

    if (!graph.hasVertex(source) || !graph.hasVertex(destination)) {
        return route; // reachable = false, path vacío
    }

    using Entry = std::pair<double, std::string>;
    std::priority_queue<Entry, std::vector<Entry>, std::greater<Entry>> frontier;
    std::unordered_map<std::string, double> dist;
    std::unordered_map<std::string, std::string> prev;

    dist[source] = 0.0;
    frontier.emplace(0.0, source);

    while (!frontier.empty()) {
        const auto [current_dist, current] = frontier.top();
        frontier.pop();

        if (current_dist > dist[current]) {
            continue; // entrada obsoleta
        }
        if (current == destination) {
            break;
        }

        for (const Edge& edge : graph.neighbors(current)) {
            const std::string& next = edge.to;
            const double candidate = current_dist + edge.weight;
            const auto found = dist.find(next);
            if (found == dist.end() || candidate < found->second) {
                dist[next] = candidate;
                prev[next] = current;
                frontier.emplace(candidate, next);
            }
        }
    }

    const auto found = dist.find(destination);
    if (found == dist.end() || !std::isfinite(found->second)) {
        return route;
    }

    route.reachable = true;
    route.total_cost = found->second;

    std::vector<std::string> path;
    std::string step = destination;
    while (step != source) {
        path.push_back(step);
        const auto it = prev.find(step);
        if (it == prev.end()) {
            break; // no debería ocurrir si reachable
        }
        step = it->second;
    }
    path.push_back(source);
    std::reverse(path.begin(), path.end());

    route.path = std::move(path);
    return route;
}

} // namespace sim