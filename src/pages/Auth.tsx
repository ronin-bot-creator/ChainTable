import { useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNavigate } from "react-router-dom";
import { useAccount } from 'wagmi';
import { createUserSession, getUserSession, clearUserSession } from '../utils/userSession';

export default function Auth() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();

  // Crear sesión con dirección de wallet como username
  const handleWalletConnected = () => {
    if (isConnected && address) {
      clearUserSession();
      // Usar la dirección como username directamente
      createUserSession(address);
      
      console.log('👤 Usuario EVM conectado con dirección:', address);
      navigate("/lobbies");
    }
  };

  useEffect(() => {
    // Solo verificar si hay una sesión activa y redirigir si coincide
    try {
      const session = getUserSession();
      if (session && session.walletAddress && isConnected && address === session.walletAddress) {
        console.log('👤 Sesión EVM existente encontrada:', session.walletAddress);
        navigate("/lobbies");
        return;
      }
    } catch {
      // No hay sesión activa, continuar con el flujo normal
    }
  }, [navigate, isConnected, address]);

  // NO auto-conectar - que el usuario elija manualmente

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
      <h1 className="text-4xl font-bold mb-6">Conectar Wallet</h1>
      <p className="text-gray-300 text-center mb-4 max-w-md">
        Para jugar en Chain Table, necesitás conectar tu wallet. Tu dirección será tu identificador único.
      </p>
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-6 max-w-md">
        <p className="text-blue-300 text-sm text-center">
          💡 <strong>Multi-pestaña:</strong> Cada pestaña puede usar una wallet diferente. 
          Desconectá y conectá otra wallet si querés cambiar.
        </p>
      </div>

      <div className="bg-slate-800 p-6 rounded-xl shadow-lg w-96">
        <div className="mb-6">
          <ConnectButton />
        </div>
        
        {!isConnected && (
          <div className="text-center text-gray-400">
            <p>🔒 Conectá tu wallet para continuar</p>
            <p className="text-sm mt-2">Tu dirección será tu username</p>
            <p className="text-xs mt-3 text-gray-500">
              💡 Cada pestaña puede usar una wallet diferente
            </p>
          </div>
        )}

        {isConnected && address && (
          <div className="space-y-4 text-center">
            <p className="text-green-400 text-sm">✅ Wallet detectada</p>
            
            <div className="bg-slate-700 p-3 rounded-lg">
              <p className="text-gray-300 text-sm mb-1">Dirección detectada:</p>
              <p className="text-yellow-400 font-mono text-sm">
                {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleWalletConnected}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition"
              >
                ✅ Usar esta wallet
              </button>
              
              <p className="text-gray-400 text-xs">
                ¿Querés usar otra wallet? Desconectá desde el botón de arriba y conectá otra.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
