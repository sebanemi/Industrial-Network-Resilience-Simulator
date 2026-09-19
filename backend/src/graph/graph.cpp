#include "graph/graph.hpp"

#include <algorithm>
#include <cassert>
#include <set>

namespace sim {

std::string Graph::normalizedKey(const std::string& a, const std::string& b) {
    return (a < b) ? (a + "\x1f" + b) : (b + "\x1f" + a);
}

void Graph::addVertex(std::string id) {
    if (!hasVertex(id)) {
        adj_[std::move(id)] = {};
    }
}

void Graph::addVertexIfMissing(const std::string& id) {
    adj_.try_emplace(id);
}

bool Graph::hasVertex(const std::string& id) const {
    return adj_.contains(id);
}

bool Graph::addUndirectedEdge(const std::string& a, const std::string& b, double weight) {
    if (a == b || !hasVertex(a) || !hasVertex(b) || weight < 0.0) {
        return false;
    }
    const std::string key = normalizedKey(a, b);
    for (const Edge& e : adj_.at(a)) {
        if (normalizedKey(e.from, e.to) == key) {
            return false; // ya existente
        }
    }
    adj_.at(a).push_back({a, b, weight});
    adj_.at(b).push_back({b, a, weight});
    return true;
}

void Graph::removeVertex(const std::string& id) {
    if (!hasVertex(id)) {
        return;
    }
    adj_.erase(id);
    for (auto& [v, list] : adj_) {
        list.erase(std::remove_if(list.begin(), list.end(),
                                  [&id](const Edge& e) {
                                      return e.from == id || e.to == id;
                                  }),
                   list.end());
    }
}

const std::vector<Edge>& Graph::neighbors(const std::string& id) const {
    static const std::vector<Edge> kEmpty;
    const auto it = adj_.find(id);
    return it == adj_.end() ? kEmpty : it->second;
}

std::vector<std::string> Graph::vertices() const {
    std::vector<std::string> ids;
    ids.reserve(adj_.size());
    for (const auto& [id, list] : adj_) {
        (void)list;
        ids.push_back(id);
    }
    return ids;
}

std::vector<Edge> Graph::edges() const {
    std::vector<Edge> result;
    for (const auto& [v, list] : adj_) {
        for (const Edge& e : list) {
            if (e.from <= e.to) { // forma canónica: cada arista una sola vez
                result.push_back(e);
            }
        }
    }
    return result;
}

size_t Graph::edgeCount() const {
    size_t count = 0;
    for (const auto& [v, list] : adj_) {
        for (const Edge& e : list) {
            if (e.from <= e.to) {
                ++count;
            }
        }
    }
    return count;
}

void Graph::clear() { adj_.clear(); }

} // namespace sim