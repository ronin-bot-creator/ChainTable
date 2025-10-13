import { useState, useEffect, useCallback } from 'react';
import { socketService } from '../services/socketService';
import { getUserSession } from '../utils/userSession';
import type { LobbyType, CreateLobbyFormData, Lobby } from '../types/lobby';

interface UseSocketReturn {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  activeLobbies: Array<{
    id: string;
    name: string;
    type: LobbyType;
    status: string;
    playerCount: number;
    maxPlayers: number;
  }>;
  createLobby: (data: CreateLobbyFormData, creatorId: string, creatorUsername: string) => Promise<Lobby>;
  joinLobby: (lobbyId: string, password?: string) => Promise<void>;
  joinLobbyOnchain: (lobbyId: string, password?: string, onchain?: { txHash: string; contract: string; chain: string }) => Promise<void>;
  leaveLobby: (lobbyId: string) => Promise<void>;
  cancelLobby: (lobbyId: string) => Promise<void>;
  refreshLobbies: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useSocket = (): UseSocketReturn => {
  const [isConnected, setIsConnected] = useState<boolean>(() => socketService.isConnected);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLobbies, setActiveLobbies] = useState<Array<{
    id: string;
    name: string;
    type: LobbyType;
    status: string;
    playerCount: number;
    maxPlayers: number;
  }>>([]);

  // Conectar al servidor WebSocket
  const connect = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.debug('useSocket.connect() called');
      await socketService.connect();
      setIsConnected(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error de conexión desconocido';
      setError(`No se pudo conectar al servidor WebSocket: ${errorMsg}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Desconectar del servidor WebSocket
  const disconnect = useCallback(() => {
    socketService.disconnect();
    setIsConnected(false);
    setActiveLobbies([]);
  }, []);

  // NOTE: No desconectamos automáticamente al desmontar el hook/componente
  // porque queremos mantener la conexión active durante la navegación entre rutas
  // (la responsabilidad de desconexión explícita queda a quien llame a `disconnect`).

  // Crear un lobby
  const createLobby = useCallback(async (data: CreateLobbyFormData, creatorId: string, creatorUsername: string) => {
    console.debug('useSocket.createLobby() called', { data, creatorId, creatorUsername });
    if (!isConnected) {
      throw new Error('No hay conexión con el servidor');
    }

    setIsLoading(true);
    setError(null);

    return new Promise<Lobby>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout: El servidor no respondió'));
      }, 10000);

      const handleResponse = (response: { success: boolean; lobby?: Lobby; error?: string }) => {
        clearTimeout(timeoutId);
        socketService.off('lobby:created', handleResponse);
        
        if (response.success && response.lobby) {
          try {
            // Persist active lobby for reconnects
            localStorage.setItem('activeLobbyId', response.lobby.id);
          } catch (e) {}
          resolve(response.lobby);
          refreshLobbies(); // Actualizar la lista de lobbies
        } else {
          reject(new Error(response.error || 'Error desconocido al crear lobby'));
        }
      };

      // Extraer walletAddress de la sesión del usuario
      const userSession = getUserSession();
      const walletAddress = userSession?.walletAddress || creatorUsername;

      socketService.on('lobby:created', handleResponse);
      socketService.createLobby(data, creatorId, creatorUsername, walletAddress);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [isConnected]);

  // Unirse a un lobby enviando prueba on-chain (txHash)
  const joinLobbyOnchain = useCallback(async (lobbyId: string, password?: string, onchain?: { txHash: string; contract: string; chain: string }) => {
    if (!isConnected) {
      throw new Error('No hay conexión con el servidor');
    }

    setIsLoading(true);
    setError(null);

    return new Promise<void>((resolve, reject) => {
      // Obtener datos únicos del usuario para esta sesión
      const userSession = getUserSession();
      if (!userSession) {
        reject(new Error('No hay sesión de usuario activa'));
        return;
      }
      const playerId = userSession.id;
      const username = userSession.username;
      const walletAddress = userSession.walletAddress || username; // Usar wallet si existe
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout: El servidor no respondió'));
      }, 10000);

      const handleResponse = (response: { success: boolean; lobby?: Lobby; error?: string }) => {
        clearTimeout(timeoutId);
        socketService.off('lobby:joined', handleResponse);

        if (response.success) {
          resolve();
          refreshLobbies(); // Actualizar la lista de lobbies
        } else {
          reject(new Error(response.error || 'Error desconocido al unirse al lobby'));
        }
      };

      socketService.on('lobby:joined', handleResponse);
      socketService.joinLobby(lobbyId, playerId, username, walletAddress, password, onchain);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [isConnected]);

  // Unirse a un lobby
  const joinLobby = useCallback(async (lobbyId: string, password?: string) => {
    if (!isConnected) {
      throw new Error('No hay conexión con el servidor');
    }

    setIsLoading(true);
    setError(null);

    return new Promise<void>((resolve, reject) => {
      // Obtener datos únicos del usuario para esta sesión
      const userSession = getUserSession();
      if (!userSession) {
        reject(new Error('No hay sesión de usuario activa'));
        return;
      }
      const playerId = userSession.id;
      const username = userSession.username;
      const walletAddress = userSession.walletAddress || username; // Usar wallet si existe
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout: El servidor no respondió'));
      }, 10000);

      const handleResponse = (response: { success: boolean; lobby?: Lobby; error?: string }) => {
        clearTimeout(timeoutId);
        socketService.off('lobby:joined', handleResponse);
        
        if (response.success) {
          resolve();
          refreshLobbies(); // Actualizar la lista de lobbies
        } else {
          reject(new Error(response.error || 'Error desconocido al unirse al lobby'));
        }
      };

      socketService.on('lobby:joined', handleResponse);
      socketService.joinLobby(lobbyId, playerId, username, walletAddress, password);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [isConnected]);

  // Salir de un lobby
  const leaveLobby = useCallback(async (lobbyId: string) => {
    if (!isConnected) {
      throw new Error('No hay conexión con el servidor');
    }

    setIsLoading(true);
    setError(null);

    // Obtener datos únicos del usuario para esta sesión
    const userSession = getUserSession();
    if (!userSession) {
      setError('No hay sesión de usuario activa');
      setIsLoading(false);
      return Promise.reject(new Error('No hay sesión de usuario activa'));
    }
    const playerId = userSession.id;

    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout: El servidor no respondió'));
      }, 10000);

      const handleResponse = (response: { success: boolean; lobbyId: string }) => {
        clearTimeout(timeoutId);
        socketService.off('lobby:left', handleResponse);
        
        if (response.success) {
          resolve();
          refreshLobbies(); // Actualizar la lista de lobbies
        } else {
          reject(new Error('Error desconocido al salir del lobby'));
        }
      };

      socketService.on('lobby:left', handleResponse);
      socketService.leaveLobby(lobbyId, playerId);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [isConnected]);

  // Actualizar lista de lobbies
  const refreshLobbies = useCallback(() => {
    if (isConnected) {
      socketService.requestLobbyList();
    }
  }, [isConnected]);

  // Configurar event listeners
  useEffect(() => {
    // Register socket listeners unconditionally so the hook stays in sync
    // with the global socketService even if the local state is false initially.
    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
      refreshLobbies(); // Cargar lobbies al conectar
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setActiveLobbies([]);
    };

    const handleConnectError = (err: Error) => {
      setError(`Error de conexión: ${err.message}`);
      setIsConnected(false);
    };

    const handleLobbyListUpdate = (data: {
      waitingForPlayers: Array<{
        id: string;
        name: string;
        type: LobbyType;
        currentPlayers: number;
        maxPlayers: number;
      }>;
      inGame: Array<{
        id: string;
        name: string;
        type: LobbyType;
        players: number;
      }>;
    }) => {
      // Convertir la data del servidor al formato esperado por el componente
      const lobbiesList = [
        ...data.waitingForPlayers.map((lobby: any) => ({
          id: lobby.id,
          name: lobby.name,
          type: lobby.type,
          status: 'Esperando jugadores',
          playerCount: lobby.currentPlayers,
          maxPlayers: lobby.maxPlayers,
          ...(lobby.onchain && { onchain: lobby.onchain }),
          ...(lobby.entryCost && { entryCost: lobby.entryCost })
        })),
        ...data.inGame.map((lobby: any) => ({
          id: lobby.id,
          name: lobby.name,
          type: lobby.type,
          status: 'En partida',
          playerCount: lobby.players,
          maxPlayers: lobby.players,
          ...(lobby.onchain && { onchain: lobby.onchain }),
          ...(lobby.entryCost && { entryCost: lobby.entryCost })
        }))
      ];

      setActiveLobbies(lobbiesList);
    };

    const handleLobbyUpdate = (data: { lobbyId: string }) => {
      // Cuando un lobby individual se actualiza, solicitamos la lista completa
      // (el servidor nos pasa solo el lobbyId)
      console.debug('useSocket -> lobby:updated received', data);
      refreshLobbies();
    };

    // Registrar event listeners
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('connect_error', handleConnectError);
    socketService.on('lobby:list-updated', handleLobbyListUpdate);
    socketService.on('lobby:updated', handleLobbyUpdate);

    return () => {
      // Limpiar event listeners
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('connect_error', handleConnectError);
      socketService.off('lobby:list-updated', handleLobbyListUpdate);
      socketService.off('lobby:updated', handleLobbyUpdate);
    };
  }, [refreshLobbies]);

  return {
    isConnected,
    isLoading,
    error,
    activeLobbies,
    createLobby,
    joinLobby,
    joinLobbyOnchain,
    leaveLobby,
    cancelLobby: async (lobbyId: string) => {
      if (!isConnected) throw new Error('No hay conexión con el servidor');
      setIsLoading(true);
      setError(null);
      const userSession = getUserSession();
      if (!userSession) throw new Error('No hay sesión de usuario activa');
      const playerId = userSession.id;

      return new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Timeout: El servidor no respondió')), 10000);
        console.debug('useSocket.cancelLobby called, isConnected=', isConnected, 'socketService.isConnected=', socketService.isConnected);
      
        const handleResponse = (response: { success: boolean; lobbyId: string }) => {
          clearTimeout(timeoutId);
          socketService.off('lobby:left', handleResponse);
          if (response.success) {
            resolve();
            refreshLobbies();
          } else {
            reject(new Error('No se pudo cancelar el lobby'));
          }
        };

        socketService.on('lobby:left', handleResponse);
        socketService.cancelLobby(lobbyId, playerId);
      }).finally(() => setIsLoading(false));
    },
    refreshLobbies,
    connect,
    disconnect
  };
};