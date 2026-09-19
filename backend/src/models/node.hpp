#pragma once

#include <optional>
#include <string>
#include <string_view>

#include "models/point.hpp"

namespace sim {

enum class NodeType { Sensor, Esp32, Server };
enum class NodeStatus { Online, Offline };

constexpr std::string_view toString(NodeType type) {
    switch (type) {
        case NodeType::Sensor: return "SENSOR";
        case NodeType::Esp32:  return "ESP32";
        case NodeType::Server: return "SERVER";
    }
    return "UNKNOWN";
}

constexpr std::string_view toString(NodeStatus status) {
    switch (status) {
        case NodeStatus::Online:  return "ONLINE";
        case NodeStatus::Offline: return "OFFLINE";
    }
    return "UNKNOWN";
}

std::optional<NodeType> nodeTypeFromString(std::string_view text);
std::optional<NodeStatus> nodeStatusFromString(std::string_view text);

struct Node {
    std::string id;
    std::string name;
    NodeType type = NodeType::Sensor;
    Point position{};
    std::optional<double> range; // meters; nullopt = no radio propio (hoja: sensor típico)
    NodeStatus status = NodeStatus::Online;

    static constexpr double kDefaultEspRange = 25.0;
    static constexpr double kDefaultServerRange = 50.0;

    bool hasRange() const { return range.has_value(); }
    bool isOnline() const { return status == NodeStatus::Online; }
};

} // namespace sim