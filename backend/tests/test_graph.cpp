#include "test.h"

#include "graph/graph.hpp"
#include "graph/edge.hpp"

using namespace sim;

TEST("graph: vertices y existencia") {
    Graph g;
    g.addVertex("A");
    g.addVertex("B");
    CHECK_EQ(g.hasVertex("A"), true);
    CHECK_EQ(g.hasVertex("B"), true);
    CHECK_EQ(g.hasVertex("C"), false);
    CHECK_EQ(g.vertexCount(), 2);
}

TEST("graph: arista no dirigida aparece en ambos lados") {
    Graph g;
    g.addVertex("A");
    g.addVertex("B");
    CHECK_EQ(g.addUndirectedEdge("A", "B", 5.0), true);

    const auto& na = g.neighbors("A");
    const auto& nb = g.neighbors("B");
    CHECK_EQ(na.size(), 1);
    CHECK_EQ(nb.size(), 1);
    CHECK_EQ(na[0].to, "B");
    CHECK_EQ(na[0].weight, 5.0);
    CHECK_EQ(nb[0].to, "A");
    CHECK_EQ(nb[0].weight, 5.0);
    CHECK_EQ(g.edgeCount(), 1);
}

TEST("graph: arista duplicada es no-op") {
    Graph g;
    g.addVertex("A");
    g.addVertex("B");
    CHECK_EQ(g.addUndirectedEdge("A", "B", 5.0), true);
    CHECK_EQ(g.addUndirectedEdge("B", "A", 7.0), false); // ya existe
    CHECK_EQ(g.edgeCount(), 1);
    CHECK_NEAR(g.neighbors("A")[0].weight, 5.0, 1e-12);
}

TEST("graph: arista invalida es rechazada") {
    Graph g;
    g.addVertex("A");
    g.addVertex("B");
    CHECK_EQ(g.addUndirectedEdge("A", "A", 3.0), false);
    CHECK_EQ(g.addUndirectedEdge("A", "C", 3.0), false);
    CHECK_EQ(g.addUndirectedEdge("A", "B", -1.0), false);
    CHECK_EQ(g.edgeCount(), 0);
}

TEST("graph: removeVertex elimina aristas incidentes") {
    Graph g;
    g.addVertex("A");
    g.addVertex("B");
    g.addVertex("C");
    g.addUndirectedEdge("A", "B", 1.0);
    g.addUndirectedEdge("B", "C", 2.0);
    g.removeVertex("B");
    CHECK_EQ(g.hasVertex("B"), false);
    CHECK_EQ(g.vertexCount(), 2);
    CHECK_EQ(g.edgeCount(), 0);
    CHECK_EQ(g.neighbors("A").size(), 0);
    CHECK_EQ(g.neighbors("C").size(), 0);
}

TEST("graph: edges() devuelve cada arista una vez") {
    Graph g;
    g.addVertex("A");
    g.addVertex("B");
    g.addVertex("C");
    g.addUndirectedEdge("A", "B", 1.0);
    g.addUndirectedEdge("B", "C", 2.0);
    auto edges = g.edges();
    CHECK_EQ(edges.size(), 2);
    CHECK_EQ(g.edgeCount(), 2);
}