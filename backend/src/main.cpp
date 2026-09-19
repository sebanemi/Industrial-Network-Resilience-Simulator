#include <cstdlib>
#include <cstdint>

#include "api/api.h"
#include "simulation/network.hpp"

#include "crow.h"

namespace {

uint16_t readPort() {
    if (const char* value = std::getenv("SIM_SERVER_PORT"); value != nullptr) {
        const int port = std::atoi(value);
        if (port > 0 && port <= 65535) {
            return static_cast<uint16_t>(port);
        }
    }
    return 8080;
}

} // namespace

int main() {
    crow::SimpleApp app;
    sim::Network network;
    sim::registerApiRoutes(app, network);

    const uint16_t port = readPort();

    CROW_LOG_INFO << "Industrial Network Resilience Simulator";
    CROW_LOG_INFO << "Escuchando en http://0.0.0.0:" << port;

    app.port(port).concurrency(1).run();
    return 0;
}