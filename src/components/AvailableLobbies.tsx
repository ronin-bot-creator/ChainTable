import React from 'react';

interface AvailableLobbiesProps {
  lobbies?: Array<{
    id: string;
    name: string;
    type: string;
    players: number;
    maxPlayers: number;
  }>;
}

const AvailableLobbies: React.FC<AvailableLobbiesProps> = ({ lobbies = [] }) => {
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
                  className="flex justify-between items-center bg-slate-700 p-4 rounded-lg hover:bg-slate-600 transition-colors"
                >
                  <div>
                    <h3 className="font-semibold text-white">{lobby.name}</h3>
                    <p className="text-sm text-gray-400">
                      {lobby.type} • {lobby.players}/{lobby.maxPlayers} jugadores
                    </p>
                  </div>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
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