import React from 'react';

interface LobbyCardProps {
  title: string;
  type: 'publico' | 'privado' | 'pago';
  onCreateLobby: (type: string) => void;
  onUpdateList: () => void;
}

const LobbyCard: React.FC<LobbyCardProps> = ({ title, type, onCreateLobby, onUpdateList }) => {
  const getColorScheme = () => {
    switch (type) {
      case 'publico':
        return {
          border: 'focus:border-blue-500',
          button: 'bg-blue-600 hover:bg-blue-700',
          updateButton: 'text-blue-400 hover:text-blue-300'
        };
      case 'privado':
        return {
          border: 'focus:border-green-500',
          button: 'bg-green-600 hover:bg-green-700',
          updateButton: 'text-green-400 hover:text-green-300'
        };
      case 'pago':
        return {
          border: 'focus:border-yellow-500',
          button: 'bg-yellow-600 hover:bg-yellow-700',
          updateButton: 'text-yellow-400 hover:text-yellow-300'
        };
      default:
        return {
          border: 'focus:border-blue-500',
          button: 'bg-blue-600 hover:bg-blue-700',
          updateButton: 'text-blue-400 hover:text-blue-300'
        };
    }
  };

  const colors = getColorScheme();

  return (
    <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 transform hover:scale-105 transition-transform duration-300">
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <h2 className="text-2xl font-bold text-white tracking-wide">{title}</h2>
      </div>
      <div className="p-6 space-y-5">
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Nombre del lobby:
          </label>
          <input
            type="text"
            placeholder={`Ej: ${type === 'publico' ? 'Mesa pública' : type === 'privado' ? 'Solo amigos' : 'Torneo'}`}
            className={`w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${colors.border} transition-colors`}
          />
        </div>
        
        {type === 'privado' && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Contraseña:
            </label>
            <input
              type="password"
              placeholder="••••••"
              className={`w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${colors.border} transition-colors`}
            />
          </div>
        )}
        
        {type === 'pago' && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Entry cost:
            </label>
            <input
              type="number"
              placeholder="10"
              className={`w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${colors.border} transition-colors`}
            />
          </div>
        )}
        
        <button 
          className={`w-full ${colors.button} text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 transform hover:scale-105 shadow-lg`}
          onClick={() => onCreateLobby(type)}
        >
          Crear lobby
        </button>
        
        <button 
          className={`w-full ${colors.updateButton} font-semibold text-sm underline mt-2`}
          onClick={onUpdateList}
        >
          Actualizar lista
        </button>
      </div>
    </div>
  );
};

export default LobbyCard;