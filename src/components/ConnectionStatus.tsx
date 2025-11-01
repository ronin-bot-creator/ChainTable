import React from "react";

interface ConnectionStatusProps {
  isConnected: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected }) => {
  return (
    <div className="flex justify-center items-center py-4 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700">
      <div className="flex items-center gap-3 px-5 py-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-lg border border-slate-600">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-400" : "bg-red-400"
          } animate-pulse`}
        ></div>
        <p className="text-sm font-medium text-white">
          Estado:{" "}
          <span
            className={`font-bold ${
              isConnected ? "text-green-400" : "text-red-400"
            }`}
          >
            {isConnected ? "Conectado" : "Desconectado"}
          </span>
        </p>
      </div>
    </div>
  );
};

export default ConnectionStatus;
