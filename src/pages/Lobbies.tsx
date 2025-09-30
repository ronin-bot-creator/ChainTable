import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';
import type { LobbyType, CreateLobbyFormData } from '../types/lobby';
import { useSocket } from '../hooks/useSocket';
import { getUserId, getUserSession, clearUserSession } from '../utils/userSession';

// Interfaz local para los formularios
interface LobbyFormData {
  name: string;
  password?: string;
  entryCost?: number;
}

const Lobbies: React.FC = () => {
  const navigate = useNavigate();
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  const { disconnect: disconnectWallet } = useDisconnect();
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [isUserNameSet, setIsUserNameSet] = useState<boolean>(false);
  const [tabId] = useState<string>(() => `tab_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
  
  // Usar el hook de websockets
  const {
    isConnected,
    isLoading,
    error: socketError,
    activeLobbies,
    createLobby: socketCreateLobby,
    joinLobby: socketJoinLobby,
    refreshLobbies,
    connect,
    disconnect
  } = useSocket();

  // Estado para los formularios de cada lobby
  const [lobbyForms, setLobbyForms] = useState<Record<LobbyType, LobbyFormData>>({
    publico: { name: '' },
    privado: { name: '', password: '' },
    pago: { name: '', entryCost: 0 }
  });

  // Cargar información del usuario desde la sesión y verificar wallet
  useEffect(() => {
    try {
      const session = getUserSession();
      if (session && session.walletAddress && isWalletConnected && walletAddress === session.walletAddress) {
        setUserName(session.walletAddress); // Usar la dirección como username
        setIsUserNameSet(true);
        console.log('👤 Sesión EVM cargada en lobbies, Wallet:', session.walletAddress);
      } else {
        console.error('❌ No hay sesión EVM completa, redirigiendo a auth...');
        navigate('/auth');
      }
    } catch (error) {
      console.error('❌ Error al cargar sesión EVM, redirigiendo a auth...', error);
      navigate('/auth');
    }
  }, [navigate, isWalletConnected, walletAddress]);

  // Conectar automáticamente cuando se tenga el nombre
  useEffect(() => {
    // La conexión la maneja el SocketProvider central; no invocamos connect() aquí
    // para evitar llamadas duplicadas que puedan recrear/desconectar el socket.
  }, [isUserNameSet, connect]);

  // Limpiar mensajes
  const clearMessages = useCallback(() => {
    setSuccessMessage('');
    setErrorMessage('');
  }, []);

  // Cerrar sesión y desconectar wallet
  const handleLogout = useCallback(() => {
    clearUserSession();
    disconnect();
    disconnectWallet();
    navigate('/');
  }, [disconnect, disconnectWallet, navigate]);

  // Mostrar errores de socket
  useEffect(() => {
    if (socketError) {
      setErrorMessage(socketError);
    }
  }, [socketError]);

  // Manejo optimizado de creación de lobbies con useCallback
  const handleCreateLobby = useCallback(async (type: LobbyType) => {
    clearMessages();
    const formData = lobbyForms[type];
    
    try {
      // Crear los datos del formulario según el tipo
      const createLobbyData: CreateLobbyFormData = {
        type,
        name: formData.name,
        ...(type === 'privado' && { password: formData.password }),
        ...(type === 'pago' && { entryCost: formData.entryCost })
      };

      // Usar websockets para crear el lobby
      const creatorId = getUserId();
      const creatorUsername = userName;
      
      const createdLobby = await socketCreateLobby(createLobbyData, creatorId, creatorUsername);
      
      // Limpiar formulario después de crear
      setLobbyForms(prev => ({
        ...prev,
        [type]: type === 'pago' 
          ? { name: '', entryCost: 0 }
          : type === 'privado' 
          ? { name: '', password: '' }
          : { name: '' }
      }));
      
      setSuccessMessage(`Lobby "${formData.name}" creado exitosamente!`);
      
      // Navegar al juego
      navigate(`/game/${createdLobby.id}`);
      
    } catch (error) {
      console.error('Error creando lobby:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al crear el lobby';
      setErrorMessage(errorMsg);
    }
  }, [lobbyForms, clearMessages, socketCreateLobby, navigate]);

  // Manejo de actualización de lista
  const handleUpdateList = useCallback(() => {
    clearMessages();
    
    try {
      refreshLobbies();
      
      // Crear mensaje informativo
      const totalLobbies = activeLobbies.length;
      const waitingCount = activeLobbies.filter(lobby => lobby.status === 'Esperando jugadores').length;
      const inGameCount = activeLobbies.filter(lobby => lobby.status === 'En partida').length;
      
      setSuccessMessage(`Total de lobbies: ${totalLobbies} | Esperando: ${waitingCount} | En partida: ${inGameCount}`);
      
    } catch (error) {
      console.error('Error actualizando lista:', error);
      setErrorMessage('Error al obtener la lista de lobbies');
    }
  }, [clearMessages, refreshLobbies, activeLobbies]);

  // Manejo de unirse a un lobby
  const handleJoinLobby = useCallback(async (lobbyId: string, lobbyType: LobbyType) => {
    clearMessages();
    
    try {
      // Si es un lobby privado, pedir contraseña (simplificado para demo)
      let password: string | undefined;
      if (lobbyType === 'privado') {
        password = prompt('Ingresa la contraseña del lobby privado:') || undefined;
        if (!password) {
          setErrorMessage('Contraseña requerida para lobby privado');
          return;
        }
      }

      await socketJoinLobby(lobbyId, password);
      setSuccessMessage('¡Te has unido al lobby exitosamente!');
      
      // Navegar al juego
      navigate(`/game/${lobbyId}`);
      
    } catch (error) {
      console.error('Error uniéndose al lobby:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al unirse al lobby';
      setErrorMessage(errorMsg);
    }
  }, [clearMessages, socketJoinLobby, navigate]);

  // Manejo de cambios en formularios
  const handleInputChange = useCallback((type: LobbyType, field: keyof LobbyFormData, value: string | number) => {
    setLobbyForms(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  }, []);



  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col">
      {/* Encabezado */}
      <div className="text-center py-6 bg-slate-900 border-b-2 border-slate-700 shadow-lg">
        <h1 className="text-4xl font-extrabold text-blue-500 tracking-wider font-jersey">
          CHAIN TABLE
        </h1>
        <p className="text-gray-400 text-sm mt-2">
          {tabId} - {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Sin wallet'}
        </p>
      </div>

      {/* Estado de la conexión y usuario */}
      <div className="flex justify-between items-center py-4 bg-slate-900 border-b border-slate-700 px-8">
        {/* Información del usuario */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800 rounded-full px-4 py-2 shadow">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-bold text-sm">
                {walletAddress ? walletAddress.charAt(2).toUpperCase() : '?'}
              </span>
            </div>
            <div className="text-white">
              <div className="text-sm font-medium font-mono">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Cargando...'}
              </div>
              <div className="text-xs text-gray-400">
                Wallet Address
              </div>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/auth')}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full transition-colors"
            title="Cambiar wallet"
          >
            Cambiar Wallet
          </button>
          
          <button
            onClick={handleLogout}
            className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-full transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>

        {/* Estado de conexión */}
        <div className="text-sm font-medium text-white px-4 py-2 bg-slate-800 rounded-full shadow">
          <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
            {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
          </span>
          <button 
            onClick={() => isConnected ? disconnect() : connect()}
            className="ml-3 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full transition-colors"
          >
            {isConnected ? 'Desconectar' : 'Conectar'}
          </button>
        </div>
      </div>

      {/* Secciones de los lobbies */}
      <div className="flex-1 flex items-start justify-center p-8 bg-slate-950">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl">

          {/* Tarjeta de Lobby Público */}
          <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 transform hover:scale-105 transition-transform duration-300">
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-white tracking-wide font-jersey">Lobby Público</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Nombre del lobby:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Mesa pública"
                  value={lobbyForms.publico.name}
                  onChange={(e) => handleInputChange('publico', 'name', e.target.value)}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
              <button 
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 transform hover:scale-105 shadow-lg disabled:transform-none"
                onClick={() => handleCreateLobby('publico')}
                disabled={isLoading || !isConnected}
              >
                {isLoading ? 'Creando...' : 'Crear lobby'}
              </button>
              <button 
                className="w-full text-blue-400 hover:text-blue-300 disabled:text-blue-600 font-semibold text-sm underline mt-2"
                onClick={handleUpdateList}
                disabled={isLoading}
              >
                {isLoading ? 'Actualizando...' : 'Actualizar lobbies'}
              </button>
            </div>
          </div>

          {/* Tarjeta de Lobby Privado */}
          <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 transform hover:scale-105 transition-transform duration-300">
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-white tracking-wide font-jersey">Lobby Privado</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Nombre del lobby:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Solo amigos"
                  value={lobbyForms.privado.name}
                  onChange={(e) => handleInputChange('privado', 'name', e.target.value)}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Contraseña:
                </label>
                <input
                  type="password"
                  placeholder="••••••"
                  value={lobbyForms.privado.password || ''}
                  onChange={(e) => handleInputChange('privado', 'password', e.target.value)}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
              <button 
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 transform hover:scale-105 shadow-lg disabled:transform-none"
                onClick={() => handleCreateLobby('privado')}
                disabled={isLoading || !isConnected}
              >
                {isLoading ? 'Creando...' : 'Crear lobby'}
              </button>
              <button 
                className="w-full text-green-400 hover:text-green-300 disabled:text-green-600 font-semibold text-sm underline mt-2"
                onClick={handleUpdateList}
                disabled={isLoading}
              >
                {isLoading ? 'Actualizando...' : 'Actualizar lobbies'}
              </button>
            </div>
          </div>

          {/* Tarjeta de Lobby Pago */}
          <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 transform hover:scale-105 transition-transform duration-300">
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-white tracking-wide font-jersey">Lobby Pago</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Nombre del lobby:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Torneo"
                  value={lobbyForms.pago.name}
                  onChange={(e) => handleInputChange('pago', 'name', e.target.value)}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Costo de entrada:
                </label>
                <input
                  type="number"
                  placeholder="10"
                  min="1"
                  value={lobbyForms.pago.entryCost || ''}
                  onChange={(e) => handleInputChange('pago', 'entryCost', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
              <button 
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 transform hover:scale-105 shadow-lg disabled:transform-none"
                onClick={() => handleCreateLobby('pago')}
                disabled={isLoading || !isConnected}
              >
                {isLoading ? 'Creando...' : 'Crear lobby'}
              </button>
              <button 
                className="w-full text-yellow-400 hover:text-yellow-300 disabled:text-yellow-600 font-semibold text-sm underline mt-2"
                onClick={handleUpdateList}
                disabled={isLoading}
              >
                {isLoading ? 'Actualizando...' : 'Actualizar lobbies'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de lobbies activos */}
      {activeLobbies.length > 0 && (
        <div className="px-8 pb-8 bg-slate-950">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              🎮 Lobbies Activos
            </h2>
            
            <div className="space-y-4">
              {/* Lobbies esperando jugadores */}
              {activeLobbies.filter(lobby => lobby.status === 'Esperando jugadores').length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center">
                    <span className="mr-2">⏳</span>
                    Esperando Jugadores
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeLobbies
                      .filter(lobby => lobby.status === 'Esperando jugadores')
                      .map(lobby => (
                        <div key={lobby.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-green-500 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-white truncate mr-2">{lobby.name}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              lobby.type === 'publico' ? 'bg-blue-600 text-white' :
                              lobby.type === 'privado' ? 'bg-purple-600 text-white' :
                              'bg-yellow-600 text-white'
                            }`}>
                              {lobby.type === 'publico' ? 'Público' : 
                               lobby.type === 'privado' ? 'Privado' : 'Pago'}
                            </span>
                          </div>
                          <div className="text-gray-400 text-sm">
                            Jugadores: {lobby.playerCount}/{lobby.maxPlayers}
                          </div>
                          <div className="mt-3">
                            <button 
                              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors"
                              onClick={() => handleJoinLobby(lobby.id, lobby.type)}
                              disabled={isLoading || !isConnected}
                            >
                              {isLoading ? 'Conectando...' : 'Unirse'}
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Lobbies en partida */}
              {activeLobbies.filter(lobby => lobby.status === 'En partida').length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center">
                    <span className="mr-2">🔥</span>
                    En Partida
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeLobbies
                      .filter(lobby => lobby.status === 'En partida')
                      .map(lobby => (
                        <div key={lobby.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 opacity-75">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-white truncate mr-2">{lobby.name}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              lobby.type === 'publico' ? 'bg-blue-600 text-white' :
                              lobby.type === 'privado' ? 'bg-purple-600 text-white' :
                              'bg-yellow-600 text-white'
                            }`}>
                              {lobby.type === 'publico' ? 'Público' : 
                               lobby.type === 'privado' ? 'Privado' : 'Pago'}
                            </span>
                          </div>
                          <div className="text-gray-400 text-sm">
                            Jugadores: {lobby.playerCount}
                          </div>
                          <div className="mt-3">
                            <button disabled className="w-full bg-gray-600 text-gray-400 font-bold py-2 px-4 rounded cursor-not-allowed">
                              En curso...
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay lobbies */}
      {activeLobbies.length === 0 && (
        <div className="px-8 pb-8 bg-slate-950">
          <div className="max-w-7xl mx-auto text-center">
            <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
              <div className="text-6xl mb-4">🎮</div>
              <h3 className="text-xl font-bold text-white mb-2">No hay lobbies activos</h3>
              <p className="text-gray-400">¡Crea un lobby para empezar a jugar!</p>
            </div>
          </div>
        </div>
      )}

      {/* Mensajes de estado */}
      {(successMessage || errorMessage) && (
        <div className="fixed bottom-4 right-4 z-50">
          {successMessage && (
            <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg mb-2 max-w-md">
              <div className="flex items-center justify-between">
                <span>{successMessage}</span>
                <button 
                  onClick={() => setSuccessMessage('')}
                  className="ml-4 text-green-200 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg mb-2 max-w-md">
              <div className="flex items-center justify-between">
                <span>{errorMessage}</span>
                <button 
                  onClick={() => setErrorMessage('')}
                  className="ml-4 text-red-200 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default Lobbies;
