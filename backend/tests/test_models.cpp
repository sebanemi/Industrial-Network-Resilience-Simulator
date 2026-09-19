#include "test.h"

#include "models/point.hpp"
#include "models/node.hpp"

using namespace sim;

TEST("distance: eje horizontal") {
    CHECK_NEAR(distance(Point{0, 0}, Point{3, 0}), 3.0, 1e-12);
    CHECK_NEAR(distance(Point{3, 0}, Point{0, 0}), 3.0, 1e-12);
}

TEST("distance: eje vertical") {
    CHECK_NEAR(distance(Point{0, 0}, Point{0, 4}), 4.0, 1e-12);
}

TEST("distance: pitagoras (3-4-5)") {
    CHECK_NEAR(distance(Point{20, 15}, Point{35, 20}), 15.811388300841896, 1e-9);
}

TEST("distance: simetrica") {
    const Point a{10, 10};
    const Point b{20, 15};
    CHECK_NEAR(distance(a, b), distance(b, a), 1e-12);
}

TEST("nodeType: parseo") {
    CHECK_EQ(nodeTypeFromString("SENSOR"), NodeType::Sensor);
    CHECK_EQ(nodeTypeFromString("ESP32"), NodeType::Esp32);
    CHECK_EQ(nodeTypeFromString("SERVER"), NodeType::Server);
    CHECK_EQ(nodeTypeFromString("esp32").has_value(), true);
    CHECK_EQ(nodeTypeFromString("sEnSoR"), NodeType::Sensor);
    CHECK_EQ(nodeTypeFromString("WIFI").has_value(), false);
}

TEST("nodeType: serializacion") {
    CHECK_EQ(std::string(toString(NodeType::Sensor)), "SENSOR");
    CHECK_EQ(std::string(toString(NodeType::Esp32)), "ESP32");
    CHECK_EQ(std::string(toString(NodeType::Server)), "SERVER");
}

TEST("nodeStatus: parseo y serializacion") {
    CHECK_EQ(nodeStatusFromString("ONLINE"), NodeStatus::Online);
    CHECK_EQ(nodeStatusFromString("offline"), NodeStatus::Offline);
    CHECK_EQ(nodeStatusFromString("x").has_value(), false);
    CHECK_EQ(std::string(toString(NodeStatus::Online)), "ONLINE");
    CHECK_EQ(std::string(toString(NodeStatus::Offline)), "OFFLINE");
}

TEST("node: defaults y helpers") {
    Node n;
    n.id = "ESP-01";
    n.type = NodeType::Esp32;
    CHECK_EQ(n.hasRange(), false);
    CHECK_EQ(n.isOnline(), true);

    n.range = 15.0;
    CHECK_EQ(n.hasRange(), true);
    n.status = NodeStatus::Offline;
    CHECK_EQ(n.isOnline(), false);
}