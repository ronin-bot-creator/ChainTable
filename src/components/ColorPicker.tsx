import React from "react";
import type { WildColor } from "../types/game";

interface ColorPickerProps {
  isVisible: boolean;
  onColorSelect: (color: WildColor) => void;
  onCancel?: () => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  isVisible,
  onColorSelect,
  onCancel,
}) => {
  if (!isVisible) return null;

  const colors: { key: WildColor; name: string; color: string }[] = [
    { key: "Red", name: "Rojo", color: "#E53E3E" },
    { key: "Blue", name: "Azul", color: "#3182CE" },
    { key: "Green", name: "Verde", color: "#38A169" },
    { key: "Yellow", name: "Amarillo", color: "#D69E2E" },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 shadow-2xl border border-gray-200 animate-slide-in-up">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-3xl">🎨</span>
          <h3 className="text-2xl font-bold text-gray-800">Elige un color</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {colors.map(({ key, name, color }) => (
            <button
              key={key}
              onClick={() => onColorSelect(key)}
              className="flex flex-col items-center p-6 rounded-2xl border-4 border-gray-300 hover:border-gray-600 transition-all duration-300 group hover:scale-105 shadow-lg hover:shadow-2xl transform"
              style={{ backgroundColor: `${color}15` }}
            >
              <div
                className="w-16 h-16 rounded-full mb-3 group-hover:scale-125 transition-transform shadow-lg"
                style={{ backgroundColor: color }}
              />
              <span className="text-base font-bold text-gray-800">{name}</span>
            </button>
          ))}
        </div>

        {onCancel && (
          <div className="text-center">
            <button
              onClick={onCancel}
              className="px-6 py-2 text-gray-500 hover:text-gray-700 text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ColorPicker;
