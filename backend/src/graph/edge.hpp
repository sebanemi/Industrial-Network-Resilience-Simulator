#pragma once

#include <string>

namespace sim {

// Arista no dirigida: A --(weight)-- B
struct Edge {
    std::string from;
    std::string to;
    double weight = 0.0;
};

} // namespace sim