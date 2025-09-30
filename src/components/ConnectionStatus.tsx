import React from 'react';

interface ConnectionStatusProps {
  isConnected: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected }) => {
  return (
    <div className="flex justify-center items-center py-4 bg-slate-900 border-b border-slate-700">
      <p className="text-sm font-medium text-white px-4 py-2 bg-slate-800 rounded-full shadow">
        Estado de la conexión: {' '}
        <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
          {isConnected ? 'Conectado' : 'Desconectado'}
        </span>
      </p>
    </div>
  );
};

export default ConnectionStatus;