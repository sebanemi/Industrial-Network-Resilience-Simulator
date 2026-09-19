cmake_minimum_required(VERSION 3.20)
project(industrial-network-simulator LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

option(SIM_BUILD_SERVER "Build the HTTP server (requires Crow/Boost)" ON)
option(SIM_BUILD_TESTS "Build unit tests" ON)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    add_compile_options(-Wall -Wextra)
endif()

# ---------------------------------------------------------------------------
# Dependencia: Crow (solo si se construye el servidor)
# ---------------------------------------------------------------------------
if(SIM_BUILD_SERVER)
    include(FetchContent)
    set(CROW_VERSION "v1.3.3")
    set(CROW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
    set(CROW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
    set(CROW_USE_BOOST ON CACHE BOOL "Usar Boost.Asio (requiere Boost instalado)" FORCE)
    FetchContent_Declare(
        crow
        GIT_REPOSITORY https://github.com/CrowCpp/Crow.git
        GIT_TAG        ${CROW_VERSION}
        GIT_SHALLOW    TRUE
    )
    FetchContent_MakeAvailable(crow)
endif()

# ---------------------------------------------------------------------------
# Núcleo de simulación (independiente de HTTP, sin dependencias externas)
# ---------------------------------------------------------------------------
add_library(simcore STATIC
    src/graph/graph.cpp
    src/models/node.cpp
    src/routing/dijkstra.cpp
    src/simulation/network.cpp
)
target_include_directories(simcore PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src)
target_compile_features(simcore PUBLIC cxx_std_20)

# ---------------------------------------------------------------------------
# Servidor HTTP (API REST)
# ---------------------------------------------------------------------------
if(SIM_BUILD_SERVER)
    add_executable(sim-server
        src/main.cpp
        src/api/api.cpp
    )
    target_link_libraries(sim-server PRIVATE simcore Crow::Crow)
endif()

# ---------------------------------------------------------------------------
# Tests unitarios del motor
# ---------------------------------------------------------------------------
if(SIM_BUILD_TESTS)
    enable_testing()
    add_executable(sim-tests
        tests/test_main.cpp
        tests/test_models.cpp
        tests/test_graph.cpp
        tests/test_dijkstra.cpp
        tests/test_network.cpp
    )
    target_link_libraries(sim-tests PRIVATE simcore)
    add_test(NAME sim-tests COMMAND sim-tests)
endif()