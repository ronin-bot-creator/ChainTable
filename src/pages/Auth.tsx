import { useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  createUserSession,
  getUserSession,
  clearUserSession,
} from "../utils/userSession";

export default function Auth() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();

  // Crear sesión con dirección de wallet como username
  const handleWalletConnected = () => {
    if (isConnected && address) {
      clearUserSession();
      // Usar la dirección como username directamente
      createUserSession(address);

      console.log("👤 Usuario EVM conectado con dirección:", address);
      navigate("/lobbies");
    }
  };

  useEffect(() => {
    // Solo verificar si hay una sesión activa y redirigir si coincide
    try {
      const session = getUserSession();
      if (
        session &&
        session.walletAddress &&
        isConnected &&
        address === session.walletAddress
      ) {
        console.log(
          "👤 Sesión EVM existente encontrada:",
          session.walletAddress
        );
        navigate("/lobbies");
        return;
      }
    } catch {
      // No hay sesión activa, continuar con el flujo normal
    }
  }, [navigate, isConnected, address]);

  // NO auto-conectar - que el usuario elija manualmente

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-block mb-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl transform rotate-3">
              <span className="text-4xl">🃏</span>
            </div>
          </div>
          <h1 className="text-5xl font-extrabold mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-jersey">
            CHAIN TABLE
          </h1>
          <p className="text-gray-400 text-sm">Blockchain UNO Platform</p>
        </div>

        {/* Main Card */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-slate-700/50 animate-fade-in">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              Conectar Wallet
            </h2>
            <p className="text-gray-400 text-center text-sm">
              Tu dirección será tu identificador único
            </p>
          </div>

          {/* Connect Button */}
          <div className="mb-6">
            <ConnectButton />
          </div>

          {!isConnected && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-blue-950/30 border border-blue-700/50 rounded-xl">
                <span className="text-xl mt-0.5">🔒</span>
                <div className="text-left">
                  <p className="text-blue-200 text-sm font-medium">
                    Conectá tu wallet para continuar
                  </p>
                  <p className="text-blue-300/70 text-xs mt-1">
                    Podés usar MetaMask, WalletConnect u otras
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                <span className="text-xl mt-0.5">💡</span>
                <div className="text-left">
                  <p className="text-gray-300 text-sm font-medium">
                    Multi-pestaña
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Cada pestaña puede usar una wallet diferente
                  </p>
                </div>
              </div>
            </div>
          )}

          {isConnected && address && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <p className="text-green-400 text-sm font-medium">
                  Wallet conectada
                </p>
              </div>

              <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-4 rounded-xl border border-slate-600/50">
                <p className="text-gray-400 text-xs mb-2 text-center">
                  Dirección detectada
                </p>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {address.charAt(2).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-white font-mono text-sm font-medium">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </p>
                </div>
              </div>

              <button
                onClick={handleWalletConnected}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/40 transform hover:scale-[1.02] active:scale-100 flex items-center justify-center gap-2"
              >
                <span className="text-xl">✅</span>
                Continuar con esta wallet
              </button>

              <p className="text-gray-400 text-xs text-center pt-2">
                ¿Otra wallet? Desconectá desde el botón de arriba
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-xs">
            Juega UNO de forma segura en la blockchain
          </p>
        </div>
      </div>
    </div>
  );
}
