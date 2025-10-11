import React from 'react';

import { useState } from 'react';
import type { CreateLobbyFormData } from '../types/lobby';

interface LobbyCardProps {
  title: string;
  type: 'publico' | 'privado' | 'pago';
  onCreateLobby: (data: CreateLobbyFormData) => void;
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

  // Form state (controlled)
  const [name, setName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [entryCost, setEntryCost] = useState<number>(10);
  const [token, setToken] = useState<string>('native');
  const [mode, setMode] = useState<'BEAST' | 'CLASSIC'>('BEAST');

  return (
    <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 transform hover:scale-105 transition-transform duration-300">
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <h2 className="text-2xl font-bold text-white tracking-wide">{title}</h2>
      </div>
      <div className="p-6 space-y-5">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Nombre del lobby:</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            placeholder={`Ej: ${type === 'publico' ? 'Mesa pública' : type === 'privado' ? 'Solo amigos' : 'Torneo'}`}
            className={`w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${colors.border} transition-colors`}
          />
        </div>
        
        {type === 'privado' && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">Contraseña:</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••"
              className={`w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${colors.border} transition-colors`}
            />
          </div>
        )}
        
        {type === 'pago' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Entry cost:</label>
              <input
                value={entryCost}
                onChange={(e) => setEntryCost(Number(e.target.value))}
                type="number"
                min={1}
                className={`w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${colors.border} transition-colors`}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Token:</label>
              <select value={token} onChange={(e) => setToken(e.target.value)} className={`w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none ${colors.border}`}>
                <option value="native">RON (native)</option>
                <option value="weth">WETH (ERC20)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Modo de reparto:</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as 'BEAST' | 'CLASSIC') } className={`w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none ${colors.border}`}>
                <option value="BEAST">BEAST (1 ganador)</option>
                <option value="CLASSIC">CLASSIC (top 3)</option>
              </select>
            </div>
          </div>
        )}
        
        <button 
          className={`w-full ${colors.button} text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 transform hover:scale-105 shadow-lg`}
          onClick={() => {
            const payload: CreateLobbyFormData = {
              name: name || `${type} lobby`,
              type,
              password: type === 'privado' ? password : undefined,
              entryCost: type === 'pago' ? entryCost : undefined,
              token: type === 'pago' ? token : undefined,
              mode: type === 'pago' ? mode : undefined,
              maxPlayers: undefined,
              description: undefined
            };
            onCreateLobby(payload);
          }}
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