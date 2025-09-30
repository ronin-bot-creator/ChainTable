import React from 'react';
import type { WildColor } from '../types/game';

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
    { key: 'Red', name: 'Rojo', color: '#E53E3E' },
    { key: 'Blue', name: 'Azul', color: '#3182CE' },
    { key: 'Green', name: 'Verde', color: '#38A169' },
    { key: 'Yellow', name: 'Amarillo', color: '#D69E2E' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
          Elige un color
        </h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          {colors.map(({ key, name, color }) => (
            <button
              key={key}
              onClick={() => onColorSelect(key)}
              className="flex flex-col items-center p-4 rounded-lg border-2 border-gray-300 hover:border-gray-500 transition-colors group"
              style={{ backgroundColor: `${color}20` }}
            >
              <div
                className="w-12 h-12 rounded-full mb-2 group-hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium text-gray-700">
                {name}
              </span>
            </button>
          ))}
        </div>
        
        {onCancel && (
          <div className="text-center">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
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