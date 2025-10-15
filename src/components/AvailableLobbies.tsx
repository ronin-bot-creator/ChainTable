import React from 'react';

interface AvailableLobbiesProps {
  lobbies?: Array<{
    id: string;
    name: string;
    type: string;
    players: number;
    maxPlayers: number;
    entryCost?: string;
    token?: string;
    mode?: string;
  }>;
}

const AvailableLobbies: React.FC<AvailableLobbiesProps> = ({ lobbies = [] }) => {
  // Función para obtener el color del tipo de lobby
  const getLobbyTypeColor = (type: string) => {
    switch(type.toLowerCase()) {
      case 'publico':
        return 'bg-green-600 text-white';
      case 'privado':
        return 'bg-yellow-600 text-white';
      case 'pago':
        return 'bg-purple-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  // Función para obtener el emoji del tipo
  const getLobbyTypeEmoji = (type: string) => {
    switch(type.toLowerCase()) {
      case 'publico':
        return '🌍';
      case 'privado':
        return '🔒';
      case 'pago':
        return '💰';
      default:
        return '🎮';
    }
  };

  return (
    <div className="bg-slate-900 py-6 border-t-2 border-slate-700 shadow-lg mt-auto">
      <div className="px-8 w-full max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-blue-400 mb-4">Lobbies Disponibles</h2>
        <div className="bg-slate-800 rounded-lg p-6 border-2 border-slate-700">
          {lobbies.length > 0 ? (
            <div className="space-y-3">
              {lobbies.map((lobby) => (
                <div 
                  key={lobby.id} 
                  className="flex justify-between items-center bg-slate-700 p-4 rounded-lg hover:bg-slate-600 transition-colors border border-slate-600"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-white text-lg">{lobby.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getLobbyTypeColor(lobby.type)}`}>
                        {getLobbyTypeEmoji(lobby.type)} {lobby.type.toUpperCase()}
                      </span>
                      {lobby.mode && lobby.type === 'pago' && (
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          lobby.mode === 'BEAST' ? 'bg-rose-500 text-white' : 'bg-indigo-500 text-white'
                        }`}>
                          {lobby.mode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-300 font-medium">
                        👥 {lobby.players}/8 jugadores
                      </span>
                      {lobby.entryCost && lobby.token && (
                        <span className="text-yellow-400 font-bold">
                          🔥 {lobby.entryCost} {lobby.token}
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-semibold">
                    Unirse
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 font-medium text-center">
              No hay lobbies disponibles en este momento
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvailableLobbies;