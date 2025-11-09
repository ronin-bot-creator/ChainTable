import React from "react";
import type { WildColor } from "../types/game";
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  
  if (!isVisible) return null;

  const colors: { key: WildColor; nameKey: string; color: string }[] = [
    { key: "Red", nameKey: "color_red", color: "#E53E3E" },
    { key: "Blue", nameKey: "color_blue", color: "#3182CE" },
    { key: "Green", nameKey: "color_green", color: "#38A169" },
    { key: "Yellow", nameKey: "color_yellow", color: "#D69E2E" },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 shadow-2xl border border-gray-200 animate-slide-in-up">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-3xl">🎨</span>
          <h3 className="text-2xl font-bold text-gray-800">{t('choose_color')}</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {colors.map(({ key, nameKey, color }) => (
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
              <span className="text-base font-bold text-gray-800">{t(nameKey)}</span>
            </button>
          ))}
        </div>

        {onCancel && (
          <div className="text-center">
            <button
              onClick={onCancel}
              className="px-6 py-2 text-gray-500 hover:text-gray-700 text-sm font-semibold transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ColorPicker;
