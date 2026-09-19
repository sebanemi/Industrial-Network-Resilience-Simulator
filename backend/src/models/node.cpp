#include "models/node.hpp"

#include <cctype>
#include <algorithm>

namespace sim {

namespace {

// Comparación case-insensitive de un fragmento.
bool asciiEqualsIgnoreCase(std::string_view a, std::string_view b) {
    if (a.size() != b.size()) {
        return false;
    }
    return std::equal(a.begin(), a.end(), b.begin(),
                      [](unsigned char ca, unsigned char cb) {
                          return std::tolower(ca) == std::tolower(cb);
                      });
}

} // namespace

std::optional<NodeType> nodeTypeFromString(std::string_view text) {
    if (asciiEqualsIgnoreCase(text, "SENSOR")) return NodeType::Sensor;
    if (asciiEqualsIgnoreCase(text, "ESP32"))  return NodeType::Esp32;
    if (asciiEqualsIgnoreCase(text, "SERVER")) return NodeType::Server;
    return std::nullopt;
}

std::optional<NodeStatus> nodeStatusFromString(std::string_view text) {
    if (asciiEqualsIgnoreCase(text, "ONLINE"))  return NodeStatus::Online;
    if (asciiEqualsIgnoreCase(text, "OFFLINE")) return NodeStatus::Offline;
    return std::nullopt;
}

} // namespace sim