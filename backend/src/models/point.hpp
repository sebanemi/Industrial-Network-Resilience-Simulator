#pragma once

#include <cmath>

namespace sim {

struct Point {
    double x = 0.0;
    double y = 0.0;
};

inline double distance(const Point& a, const Point& b) {
    const double dx = b.x - a.x;
    const double dy = b.y - a.y;
    return std::sqrt(dx * dx + dy * dy);
}

} // namespace sim