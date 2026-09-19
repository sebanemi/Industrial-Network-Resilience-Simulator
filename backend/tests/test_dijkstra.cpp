#include "test.h"

#include "graph/graph.hpp"
#include "routing/dijkstra.hpp"

using namespace sim;

namespace {

Graph smallChain() {
    Graph g;
    g.addVertex("A");
    g.addVertex("B");
    g.addVertex("SERVER");
    g.addUndirectedEdge("A", "B", 10.0);
    g.addUndirectedEdge("B", "SERVER", 20.0);
    return g;
}

Graph forkGraph() {
    // A->B (10), A->C->SERVER (5+8), B->SERVER (1)
    Graph g;
    for (const char* v : {"A", "B", "C"}) {
        g.addVertex(v);
    }
    g.addVertex("SERVER");
    g.addUndirectedEdge("A", "B", 10.0);
    g.addUndirectedEdge("A", "C", 5.0);
    g.addUndirectedEdge("C", "SERVER", 8.0);
    g.addUndirectedEdge("B", "SERVER", 1.0);
    return g;
}

} // namespace

TEST("dijkstra: caso 1 - ruta simple") {
    const Route r = Dijkstra::shortestPath(smallChain(), "A", "SERVER");
    CHECK_EQ(r.reachable, true);
    CHECK_NEAR(r.total_cost, 30.0, 1e-12);
    CHECK_EQ(r.path, std::vector<std::string>({"A", "B", "SERVER"}));
}

TEST("dijkstra: caso 2 - elige ruta de menor costo") {
    const Route r = Dijkstra::shortestPath(forkGraph(), "A", "SERVER");
    CHECK_EQ(r.reachable, true);
    // A->C->SERVER = 13 ; A->B->SERVER = 11 → debe elegir 11
    CHECK_NEAR(r.total_cost, 11.0, 1e-12);
    CHECK_EQ(r.path, std::vector<std::string>({"A", "B", "SERVER"}));
}

TEST("dijkstra: caso 3 - reconexión de ruta con saltos") {
    Graph g;
    for (const char* v : {"S", "E1", "E2", "E3", "SVR"}) {
        g.addVertex(v);
    }
    g.addUndirectedEdge("S", "E1", 1.0);
    g.addUndirectedEdge("E1", "E2", 2.0);
    g.addUndirectedEdge("E2", "E3", 3.0);
    g.addUndirectedEdge("E3", "SVR", 4.0);
    const Route r = Dijkstra::shortestPath(g, "S", "SVR");
    CHECK_EQ(r.reachable, true);
    CHECK_NEAR(r.total_cost, 10.0, 1e-12);
    CHECK_EQ(r.path, std::vector<std::string>({"S", "E1", "E2", "E3", "SVR"}));
}

TEST("dijkstra: caso 4 - sin ruta") {
    Graph g;
    g.addVertex("A");
    g.addVertex("SERVER");
    g.addUndirectedEdge("A", "B", 1.0);   // B no existe → arista rechazada
    const Route r = Dijkstra::shortestPath(g, "A", "SERVER");
    CHECK_EQ(r.reachable, false);
    CHECK_EQ(r.total_cost, 0.0);
    CHECK_EQ(r.path.empty(), true);
}

TEST("dijkstra: vertice inexistente") {
    const Route r = Dijkstra::shortestPath(smallChain(), "NO_EXISTE", "SERVER");
    CHECK_EQ(r.reachable, false);
}

TEST("dijkstra: destino inexistente") {
    const Route r = Dijkstra::shortestPath(smallChain(), "A", "NO_EXISTE");
    CHECK_EQ(r.reachable, false);
}

TEST("dijkstra: origen == destino") {
    const Route r = Dijkstra::shortestPath(smallChain(), "SERVER", "SERVER");
    CHECK_EQ(r.reachable, true);
    CHECK_NEAR(r.total_cost, 0.0, 1e-12);
    CHECK_EQ(r.path, std::vector<std::string>({"SERVER"}));
}

TEST("dijkstra: grafo vacio") {
    const Graph g;
    const Route r = Dijkstra::shortestPath(g, "A", "SERVER");
    CHECK_EQ(r.reachable, false);
}

TEST("dijkstra: pesos no uniformes prefieren distancia real") {
    // A-SERVER directo pesa 50; A-B-SERVER pesa 20 < 50
    Graph g;
    g.addVertex("A");
    g.addVertex("B");
    g.addVertex("SERVER");
    g.addUndirectedEdge("A", "SERVER", 50.0);
    g.addUndirectedEdge("A", "B", 5.0);
    g.addUndirectedEdge("B", "SERVER", 15.0);
    const Route r = Dijkstra::shortestPath(g, "A", "SERVER");
    CHECK_EQ(r.reachable, true);
    CHECK_NEAR(r.total_cost, 20.0, 1e-12);
    CHECK_EQ(r.path, std::vector<std::string>({"A", "B", "SERVER"}));
}