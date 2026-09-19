#pragma once

#include <optional>
#include <string>
#include <string_view>

namespace sim {

enum class ShapeType { Rect, Circle };

constexpr std::string_view toString(ShapeType type) {
    switch (type) {
        case ShapeType::Rect:   return "rect";
        case ShapeType::Circle: return "circle";
    }
    return "UNKNOWN";
}

inline std::optional<ShapeType> shapeTypeFromString(std::string_view text) {
    if (text == "rect") return ShapeType::Rect;
    if (text == "circle") return ShapeType::Circle;
    return std::nullopt;
}

// Objeto geométrico decorativo dentro de la planta (pared, máquina, estructura...).
// No participa de la conectividad; sirve para representar el modelo real.
struct Shape {
    std::string id;
    ShapeType type = ShapeType::Rect;
    double x = 0.0;      // centro en metros
    double y = 0.0;      // centro en metros
    double width = 0.0;  // ancho (m) > 0; para circle es el diámetro
    double height = 0.0; // alto (m) > 0; para circle se ignora internamente
};

} // namespace sim