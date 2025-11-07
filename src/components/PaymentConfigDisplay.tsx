import React from 'react';
import type { SupportedNetwork, SupportedToken } from '../types/lobby';
import { NETWORK_CONFIGS } from '../types/lobby';

interface PaymentConfigDisplayProps {
  network: SupportedNetwork;
  token: SupportedToken;
  amount: string;
  mode?: 'BEAST' | 'CLASSIC';
  compact?: boolean;
}

/**
 * Componente para mostrar la configuración de pago de un lobby
 * Muestra red, token, monto y modo de reparto de forma visual
 */
export const PaymentConfigDisplay: React.FC<PaymentConfigDisplayProps> = ({
  network,
  token,
  amount,
  mode,
  compact = false
}) => {
  const networkConfig = NETWORK_CONFIGS[network];
  
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded-full text-xs font-semibold">
          {amount} {token}
        </span>
        <span className="text-gray-400 text-xs">
          en {networkConfig.name}
        </span>
        {mode && (
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
            mode === 'BEAST' ? 'bg-rose-600/20 text-rose-400' : 'bg-indigo-600/20 text-indigo-400'
          }`}>
            {mode}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 font-semibold">💰 Configuración de Pago</span>
        {mode && (
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
            mode === 'BEAST' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'
          }`}>
            {mode}
          </span>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Red:</span>
          <span className="text-sm font-semibold text-white">{networkConfig.name}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Moneda:</span>
          <span className="text-sm font-semibold text-white">{token}</span>
        </div>
        
        <div className="flex justify-between items-center pt-2 border-t border-slate-700">
          <span className="text-xs text-gray-400">Costo de entrada:</span>
          <span className="text-lg font-bold text-yellow-400">{amount} {token}</span>
        </div>
        
        {mode && (
          <div className="text-xs text-gray-400 pt-2 border-t border-slate-700">
            {mode === 'BEAST' ? (
              <>
                <div className="font-semibold text-rose-400 mb-1">Modo BEAST 🔥</div>
                <div>• 95% al ganador</div>
                <div>• 5% fee del proyecto</div>
              </>
            ) : (
              <>
                <div className="font-semibold text-indigo-400 mb-1">Modo CLASSIC 🏆</div>
                <div>• 60% / 20% / 15%</div>
                <div>• 5% fee del proyecto</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface NetworkBadgeProps {
  network: SupportedNetwork;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Badge para mostrar la red de forma compacta
 */
export const NetworkBadge: React.FC<NetworkBadgeProps> = ({ network, size = 'md' }) => {
  const networkConfig = NETWORK_CONFIGS[network];
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };
  
  const networkColors: Record<string, string> = {
    abstract: 'bg-purple-600/20 text-purple-400 border-purple-600/50',
    base: 'bg-blue-600/20 text-blue-400 border-blue-600/50',
    ethereum: 'bg-gray-600/20 text-gray-300 border-gray-600/50',
    ronin: 'bg-cyan-600/20 text-cyan-400 border-cyan-600/50',
    sepolia: 'bg-orange-600/20 text-orange-400 border-orange-600/50'
  };
  
  return (
    <span className={`${sizeClasses[size]} ${networkColors[network]} rounded-full font-semibold border`}>
      {networkConfig.name}
    </span>
  );
};

interface TokenBadgeProps {
  token: SupportedToken;
  amount?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Badge para mostrar el token
 */
export const TokenBadge: React.FC<TokenBadgeProps> = ({ token, amount, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };
  
  return (
    <span className={`${sizeClasses[size]} bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 rounded-full font-bold`}>
      {amount && `${amount} `}{token}
    </span>
  );
};
