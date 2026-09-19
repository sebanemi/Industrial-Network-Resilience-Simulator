# ============================================================
# Fase de build
# ============================================================
FROM ubuntu:24.04 AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        git \
        ca-certificates \
        libboost-all-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .

RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release \
        -DSIM_BUILD_SERVER=ON \
        -DSIM_BUILD_TESTS=ON \
    && cmake --build build --parallel "$(nproc)" \
    && ctest --test-dir build --output-on-failure

# ============================================================
# Fase de runtime (solo el binario; Crow/Boost son header-only)
# ============================================================
FROM ubuntu:24.04 AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /src/build/sim-server /app/sim-server

ENV SIM_SERVER_PORT=8080
EXPOSE 8080

CMD ["/app/sim-server"]