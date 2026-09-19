#pragma once

// Harness de tests mínimo y propio (ADR-008).
// Sin dependencias externas: permite que el core se pruebe sin HTTP y sin red.

#include <cstdio>
#include <functional>
#include <optional>
#include <sstream>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

namespace test {

struct TestCase {
    std::string name;
    std::function<void()> fn;
};

inline std::vector<TestCase>& registry() {
    static std::vector<TestCase> tests;
    return tests;
}

inline int& failures() {
    static int count = 0;
    return count;
}

struct Registrar {
    Registrar(std::string name, std::function<void()> fn) {
        registry().push_back({std::move(name), std::move(fn)});
    }
};

template <typename T>
std::string to_string_any(const T& value) {
    std::ostringstream out;
    out << value;
    return out.str();
}

// Enum classes no tienen operator<<; se muestran como su valor entero.
template <typename T>
    requires std::is_enum_v<T>
std::string to_string_any(const T& value) {
    return std::to_string(static_cast<long long>(value));
}

// std::optional no tiene operator<<.
template <typename T>
std::string to_string_any(const std::optional<T>& value) {
    return value.has_value() ? to_string_any(*value) : "nullopt";
}

inline std::string to_string_any(std::string_view v) { return std::string(v); }
inline std::string to_string_any(bool v) { return v ? "true" : "false"; }

inline std::string to_string_any(const std::vector<std::string>& v) {
    std::ostringstream out;
    out << "[";
    for (size_t i = 0; i < v.size(); ++i) {
        if (i != 0) out << ", ";
        out << v[i];
    }
    out << "]";
    return out.str();
}

template <typename A, typename B>
void checkEqual(const char* file, int line, const char* aExpr, const char* bExpr,
                const A& a, const B& b) {
    if (!(a == b)) {
        ++failures();
        std::printf("    FAIL %s:%d: %s == %s  [%s != %s]\n", file, line, aExpr, bExpr,
                    to_string_any(a).c_str(), to_string_any(b).c_str());
        std::fflush(stdout);
    }
}

inline void checkNear(const char* file, int line, const char* aExpr, const char* bExpr,
                      double a, double b, double epsilon = 1e-9) {
    const double diff = a > b ? a - b : b - a;
    if (diff > epsilon) {
        ++failures();
        std::printf("    FAIL %s:%d: %s ~= %s  [%.6f != %.6f]\n", file, line, aExpr, bExpr, a, b);
        std::fflush(stdout);
    }
}

inline int runAll() {
    int ran = 0;
    for (const TestCase& tc : registry()) {
        std::printf("[ RUN  ] %s\n", tc.name.c_str()); std::fflush(stdout);
        const int before = failures();
        tc.fn();
        if (failures() == before) {
            std::printf("[  OK  ] %s\n", tc.name.c_str()); std::fflush(stdout);
        } else {
            std::printf("[ FAIL ] %s (aserciones: %d)\n", tc.name.c_str(), failures() - before); std::fflush(stdout);
        }
        ++ran;
    }
    std::printf("\n%d tests, %d failure(s)\n", ran, failures());
    return failures() == 0 ? 0 : 1;
}

} // namespace test

#define TEST_CONCAT_IMPL(a, b) a##b
#define TEST_CONCAT(a, b) TEST_CONCAT_IMPL(a, b)

#define TEST(name)                                                                                 \
    static void TEST_CONCAT(test_fn_, __LINE__)();                                                  \
    static ::test::Registrar TEST_CONCAT(test_reg_, __LINE__){(name), TEST_CONCAT(test_fn_, __LINE__)}; \
    static void TEST_CONCAT(test_fn_, __LINE__)()

#define CHECK(cond)                                                                                \
    do {                                                                                           \
        if (!(cond)) {                                                                             \
            ++::test::failures();                                                                  \
            std::printf("    FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); std::fflush(stdout);                        \
        }                                                                                          \
    } while (0)

#define CHECK_EQ(a, b) ::test::checkEqual(__FILE__, __LINE__, #a, #b, (a), (b))

#define CHECK_NEAR(a, b, eps) ::test::checkNear(__FILE__, __LINE__, #a, #b, (a), (b), (eps))