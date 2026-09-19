#include "test.h"

#include "simulation/network.hpp"
#include "routing/dijkstra.hpp"

using namespace sim;

namespace {

Node makeEsp(const std::string& id, double x, double y, double range) {
    Node n;
    n.id = id;
    n.name = id;
    n.type = NodeType::Esp32;
    n.position = {x, y};
    n.range = range;
    return n;
}

Node makeSensor(const std::string& id, double x, double y) {
    Node n;
    n.id = id;
    n.name = id;
    n.type = NodeType::Sensor;
    n.position = {x, y};
    return n;
}

Node makeServer(const std::string& id, double x, double y, double range) {
    Node n;
    n.id = id;
    n.name = id;
    n.type = NodeType::Server;
    n.position = {x, y};
    n.range = range;
    return n;
}

} // namespace

TEST("network: regla de arista - dos ESP32 dentro de ambos rangos") {
    Node a = makeEsp("ESP-A", 10, 10, 15);
    Node b = makeEsp("ESP-B", 20, 15, 12);
    CHECK_EQ(Network::canCommunicate(a, b), true);  // d=11.18 <= min(15,12)
}

TEST("network: regla de arista - el ESP32 con rango menor domina") {
    Node a = makeEsp("ESP-A", 10, 10, 15);
    Node b = makeEsp("ESP-B", 20, 15, 10);
    CHECK_EQ(Network::canCommunicate(a, b), false); // d=11.18 > 10 → no comunica
}

TEST("network: regla de arista - fuera de rango no comunica") {
    Node a = makeEsp("ESP-A", 10, 10, 10);
    Node b = makeEsp("ESP-B", 30, 10, 15);
    CHECK_EQ(Network::canCommunicate(a, b), false);  // 20 > 15 → no
}

TEST("network: regla de arista - d <= min(rangoA, rangoB)") {
    Node a = makeEsp("ESP-A", 0, 0, 25);
    Node b = makeEsp("ESP-B", 14, 0, 15);
    CHECK_EQ(Network::canCommunicate(a, b), true);   // 14 <= min(25,15)
    Node c = makeEsp("ESP-C", 20, 0, 15);
    CHECK_EQ(Network::canCommunicate(a, c), false);  // 20 > 15
}

TEST("network: regla de arista - sensor con ESP32") {
    Node sensor = makeSensor("SENSOR-01", 20, 15);
    Node esp = makeEsp("ESP-01", 20, 30, 25);
    CHECK_EQ(Network::canCommunicate(sensor, esp), true);  // 15 <= 25
    esp.position = {20, 60};
    CHECK_EQ(Network::canCommunicate(sensor, esp), false); // 45 > 25
}

TEST("network: regla de arista - sensores entre si no enlazan") {
    Node a = makeSensor("S1", 0, 0);
    Node b = makeSensor("S2", 5, 0);
    CHECK_EQ(Network::canCommunicate(a, b), false);
}

TEST("network: regla de arista - sensor con rango propio enlaza a otro") {
    Node a = makeSensor("S1", 0, 0);
    a.range = 10.0;
    Node b = makeSensor("S2", 5, 0);
    CHECK_EQ(Network::canCommunicate(a, b), true);
    b.position = {20, 0};
    CHECK_EQ(Network::canCommunicate(a, b), false); // 20 > 10
}

TEST("network: regla de arista - offline no enlaza") {
    Node a = makeEsp("ESP-A", 0, 0, 20);
    Node b = makeEsp("ESP-B", 10, 0, 20);
    b.status = NodeStatus::Offline;
    CHECK_EQ(Network::canCommunicate(a, b), false);
}

TEST("network: buildGraph respeta posiciones y pesos") {
    Network net;
    net.addNode(makeServer("SERVER", 90, 10, 50));
    net.addNode(makeSensor("SENSOR-01", 20, 15));
    net.addNode(makeEsp("ESP-01", 20, 30, 25));
    net.addNode(makeEsp("ESP-02", 40, 30, 20));

    Graph g = net.buildGraph();
    CHECK_EQ(g.vertexCount(), 4);
    // SENSOR-01 (20,15) -- ESP-01 (20,30): dist 15 ✓ (sensor sin rango, ESP 25)
    // ESP-01 (20,30) -- ESP-02 (40,30): dist 20 ≤ min(25,20) ✓
    // ESP-02 (40,30) -- SERVER (90,10): dist √(50²+20²)=53.85 > 50 ✗ ·  > 20 ✗
    // SERVER -- ESP-01: 53.85 > 50 ✗
    CHECK_EQ(g.edgeCount(), 2);

    const auto& edges = g.edges();
    for (const Edge& e : edges) {
        const Node* na = net.find(e.from);
        const Node* nb = net.find(e.to);
        CHECK_NEAR(e.weight, distance(na->position, nb->position), 1e-9);
    }
}

TEST("network: nodo offline desaparece y se recalcula") {
    // SERVER (10,60) r30 ; ESP-02 (10,40) r25 ; ESP-01 (20,25) r25 ; SENSOR (5,5)
    //   SENSOR─ESP-01: 25.0 ≤ 25 ✓ (justo en el borde)
    //   ESP-01─ESP-02: 18.0 ≤ min(25,25) ✓
    //   ESP-02─SERVER: 20.0 ≤ min(25,30) ✓
    //   SENSOR─ESP-02: 35.4 > 25 (NO enlaza)
    Network net;
    net.addNode(makeServer("SERVER", 10, 60, 30));
    net.addNode(makeSensor("SENSOR-01", 5, 5));
    net.addNode(makeEsp("ESP-01", 20, 25, 25));
    net.addNode(makeEsp("ESP-02", 10, 40, 25));

    // (a) ruta SENSOR-01 → ESP-01 → ESP-02 → SERVER
    CHECK_EQ(net.isolatedNodes(), (std::vector<std::string>{}));

    // (b) apagamos ESP-01 → SENSOR-01 queda aislado
    net.setNodeStatus("ESP-01", NodeStatus::Offline);
    CHECK_EQ(net.isolatedNodes(), (std::vector<std::string>{"SENSOR-01"}));

    // (c) movemos el sensor a (12,42): a 18.1m del SERVER → vuelve a alcanzar
    net.moveNode("SENSOR-01", 12, 42);
    CHECK_EQ(net.isolatedNodes(), (std::vector<std::string>{}));

    // (d) movemos ESP-02 a (90,5) (fuera de todo) → solo ESP-02 queda aislado
    net.moveNode("ESP-02", 90, 5);
    CHECK_EQ(net.isolatedNodes(), (std::vector<std::string>{"ESP-02"}));
}

TEST("network: dijkstra sobre la red construida (caso integrado)") {
    // SERVER (100,50) r40 ; ESP-A (20,40) r25 ; ESP-B (45,40) r30 ;
    // ESP-C (70,45) r35 ; TEMP-01 (20,20)
    //   TEMP-01─ESP-A: 20 ≤ 25 ✓
    //   ESP-A─ESP-B:  25 ≤ min(25,30) ✓
    //   ESP-B─ESP-C:  √650 = 25.50 ≤ min(30,35) ✓
    //   ESP-C─SERVER: √925 = 30.41 ≤ min(35,40) ✓
    Network net;
    net.addNode(makeServer("SERVER", 100, 50, 40));
    net.addNode(makeEsp("ESP-A", 20, 40, 25));
    net.addNode(makeEsp("ESP-B", 45, 40, 30));
    net.addNode(makeEsp("ESP-C", 70, 45, 35));
    net.addNode(makeSensor("TEMP-01", 20, 20));

    const Graph g = net.buildGraph();
    const Route r = Dijkstra::shortestPath(g, "TEMP-01", "SERVER");
    CHECK_EQ(r.reachable, true);
    CHECK_EQ(r.path, (std::vector<std::string>{"TEMP-01", "ESP-A", "ESP-B", "ESP-C", "SERVER"}));
    CHECK_NEAR(r.total_cost, 20.0 + 25.0 + 25.495097567963924 + 30.4138126514911, 1e-6);
}

TEST("network: moveNode y name/range/status") {
    Network net;
    net.addNode(makeEsp("ESP-01", 10, 10, 20));
    CHECK_EQ(net.moveNode("ESP-01", 30, 30), true);
    CHECK_NEAR(net.find("ESP-01")->position.x, 30.0, 1e-12);

    CHECK_EQ(net.setNodeRange("ESP-01", 50.0), true);
    CHECK_NEAR(net.find("ESP-01")->range.value(), 50.0, 1e-12);
    CHECK_EQ(net.setNodeRange("ESP-01", -5.0), false);  // inválido
    CHECK_EQ(net.setNodeRange("ESP-01", std::nullopt), true); // limpiar

    CHECK_EQ(net.setNodeName("ESP-01", "ESP-NORTE"), true);
    CHECK_EQ(net.find("ESP-01")->name, "ESP-NORTE");
    CHECK_EQ(net.setNodeName("ESP-01", ""), false);

    CHECK_EQ(net.setNodeStatus("ESP-01", NodeStatus::Offline), true);
    CHECK_EQ(net.find("ESP-01")->status, NodeStatus::Offline);
    CHECK_EQ(net.moveNode("NO_EXISTE", 1, 1), false);
    CHECK_EQ(net.setNodeStatus("NO_EXISTE", NodeStatus::Offline), false);
}

TEST("network: addNode validaciones") {
    Network net;
    CHECK_EQ(net.addNode(makeServer("SERVER", 50, 50, 30)), AddNodeError::Ok);
    CHECK_EQ(net.addNode(makeServer("SERVER-2", 80, 80, 30)), AddNodeError::SecondServer);
    CHECK_EQ(net.addNode(makeEsp("SERVER", 10, 10, 20)), AddNodeError::DuplicateId);
    Node bad = makeEsp("BAD", -5, 10, 20);
    CHECK_EQ(net.addNode(bad), AddNodeError::InvalidData);
    bad.position = {5, 10};
    bad.range = 0.0;
    CHECK_EQ(net.addNode(bad), AddNodeError::InvalidData);
    CHECK_EQ(net.addNode(makeEsp("OK", 5, 10, 15)), AddNodeError::Ok);
}

TEST("network: unico servidor y eliminacion") {
    Network net;
    net.addNode(makeServer("SERVER", 50, 50, 30));
    CHECK_EQ(net.hasServer(), true);
    CHECK_EQ(net.serverId(), "SERVER");
    CHECK_EQ(net.removeNode("SERVER"), true);
    CHECK_EQ(net.hasServer(), false);
    CHECK_EQ(net.removeNode("SERVER"), false);
}

TEST("network: factory dims e internet flag") {
    Network net;
    net.setFactoryDims(120, 80);
    CHECK_NEAR(net.factory().width, 120.0, 1e-12);
    CHECK_NEAR(net.factory().height, 80.0, 1e-12);

    net.setFactoryDims(-10, 50); // inválido → se ignora
    CHECK_NEAR(net.factory().width, 120.0, 1e-12);

    CHECK_EQ(net.internetAvailable(), true);
    net.setInternetAvailable(false);
    CHECK_EQ(net.internetAvailable(), false);
}

TEST("network: sin servidor, todos aislados") {
    Network net;
    net.addNode(makeSensor("S1", 10, 10));
    net.addNode(makeEsp("E1", 30, 10, 20));
    CHECK_EQ(net.isolatedNodes(), (std::vector<std::string>{"E1", "S1"}));
}