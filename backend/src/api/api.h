#pragma once

#include "crow.h"
#include "simulation/network.hpp"

namespace sim {

// Registra todos los endpoints REST sobre el estado vivo `network`.
// La capa API NO contiene reglas de negocio: solo traduce HTTP ⇄ modelo.
void registerApiRoutes(crow::SimpleApp& app, Network& network);

} // namespace sim