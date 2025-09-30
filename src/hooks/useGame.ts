import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameState, Card, GameUpdateData, Winner, WildColor } from '../types/game';
import { socketService } from '../services/socketService';
import { getUserSession } from '../utils/userSession';
import { useSocket } from './useSocket';

interface UseGameReturn {
  // Estado
  gameState: GameState | null;
  playerHand: Card[];
  isMyTurn: boolean;
  currentPlayer: string | null;
  isGameStarted: boolean;
  isGameFinished: boolean;
  
  // Acciones
  startGame: () => void;
  playCard: (cardIndex: number) => void;
  drawCard: () => void;
  passTurn: () => void;
  chooseWildColor: (color: WildColor) => void;
  
  // Estados UI
  isLoading: boolean;
  error: string | null;
  showColorPicker: boolean;
  winners: Winner[];
  gameMessage: string | null;
  
  // Cleanup
  leaveGame: () => void;
}

export function useGame(lobbyId: string): UseGameReturn {
  const navigate = useNavigate();
  const { leaveLobby } = useSocket();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Iniciar en loading
  const [error, setError] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWildCardIndex, setPendingWildCardIndex] = useState<number | null>(null);
  const [gameMessage, setGameMessage] = useState<string | null>(null);

  // Obtener sesión actual
  const session = getUserSession();
  const mySessionId = session?.id || '';
  const mySocketId = socketService.socket_instance?.id || '';

  // Guardar lobbyId en localStorage para reconexión persistente
  useEffect(() => {
    if (lobbyId) {
      localStorage.setItem('activeLobbyId', lobbyId);
    } else {
      localStorage.removeItem('activeLobbyId');
    }
  }, [lobbyId]);

  // Reconexión automática al lobby
  useEffect(() => {
    const handleReconnect = () => {
      const storedLobbyId = localStorage.getItem('activeLobbyId');
      if (session && storedLobbyId) {
        console.log('🔄 Enviando lobby:reconnect tras reconexión de socket');
        socketService.emit('lobby:reconnect', { lobbyId: storedLobbyId, userId: session.id });
        setTimeout(() => {
          console.log('🔍 Solicitando información del lobby tras reconexión');
          socketService.getLobbyInfo(storedLobbyId);
        }, 200);
      }
    };
    socketService.on('connect', handleReconnect);
    return () => {
      socketService.off('connect', handleReconnect);
    };
  }, [session]);

  // Estados computados
  // A user may be identified by their persistent session id (player.id) or their current socket id.
  const isMyTurn = gameState
    ? (gameState.players[gameState.currentTurnIndex]?.id === mySessionId) ||
      (gameState.players[gameState.currentTurnIndex]?.socketId === mySocketId)
    : false;
  const currentPlayer = gameState?.players[gameState.currentTurnIndex]?.username || null;
  const isGameStarted = gameState?.status === 'in_game';
  const isGameFinished = gameState?.status === 'finished';
  const winners = gameState?.winners || [];

  // Debugging: log who has the turn and our identifiers when gameState changes
  useEffect(() => {
    try {
      const socketId = socketService.socket_instance?.id || null;
      console.debug('useGame debug:', {
        lobbyId,
        mySessionId,
        socketId,
        currentTurnIndex: gameState?.currentTurnIndex,
        currentTurnPlayerId: gameState?.players?.[gameState?.currentTurnIndex || 0]?.id,
        currentTurnPlayerSocket: gameState?.players?.[gameState?.currentTurnIndex || 0]?.socketId,
        isMyTurn
      });
      // expose a snapshot for debugging in the browser console
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          window.__debugGame = {
            lobbyId,
            mySessionId,
            socketId,
            currentTurnIndex: gameState?.currentTurnIndex,
            currentTurnPlayerId: gameState?.players?.[gameState?.currentTurnIndex || 0]?.id,
            currentTurnPlayerSocket: gameState?.players?.[gameState?.currentTurnIndex || 0]?.socketId,
            isMyTurn,
            isLoading,
            gameState
          };
        }
      } catch (e) {}
    } catch (e) {}
  }, [gameState, mySessionId, isMyTurn, lobbyId]);

  // Mostrar mensaje temporal
  const showGameMessage = useCallback((message: string, duration = 3000) => {
    setGameMessage(message);
    setTimeout(() => setGameMessage(null), duration);
  }, []);

  // Inicializar listeners de Socket.IO
  useEffect(() => {
    // Solo añadir listeners, la conexión se maneja globalmente

    // Solicitar información del lobby al cargar
    const requestLobbyInfo = () => {
      if (lobbyId && socketService.isConnected) {
        console.log('🔍 Solicitando información del lobby:', lobbyId);
        socketService.getLobbyInfo(lobbyId);
      }
    };

    // Listener para información del lobby
    const handleLobbyInfo = (data: { success: boolean; lobby?: any; error?: string }) => {
      setIsLoading(false);
      if (data.success && data.lobby) {
        console.log('📋 Información del lobby recibida:', data.lobby);
        setGameState(data.lobby);
        setError(null);
      } else {
        console.error('❌ Error obteniendo lobby:', data.error);
        setError(data.error || 'Lobby no encontrado');
        // Si el lobby no existe en el servidor, limpiamos y volvemos a la lista
        try { localStorage.removeItem('activeLobbyId'); } catch (e) {}
        // Pequeño delay para dejar que la UI muestre el error antes de navegar
        setTimeout(() => {
          navigate('/lobbies');
        }, 600);
      }
    };

    // Listener para información del juego
    const handleGameInfo = (data: { success: boolean; game?: GameState; error?: string }) => {
      if (data.success && data.game) {
        console.log('🎮 Información del juego recibida:', data.game);
        setGameState(data.game);
        setIsLoading(false);
      }
    };

    // Game started
    const handleGameStarted = ({ gameState: newGameState }: { gameState: GameState; firstCard: Card }) => {
      setGameState(newGameState);
      showGameMessage(`¡La partida ha comenzado!`);
      setError(null);
      setIsLoading(false);
    };

    // Game update
    const handleGameUpdate = (data: GameUpdateData) => {
      setGameState(data.gameState);
      setIsLoading(false);
      
      // Mostrar mensajes según la acción
      switch (data.action) {
        case 'draw':
          if (data.playerPlayed !== session?.username) {
            showGameMessage(`${data.playerPlayed} robó una carta`);
          }
          break;
        case 'skip':
          showGameMessage(`¡${data.playerPlayed} jugó SKIP!`);
          break;
        case 'reverse':
          showGameMessage(`¡${data.playerPlayed} jugó REVERSE!`);
          break;
        case 'drawTwo_played':
          showGameMessage(`+2 en juego...`);
          break;
        case 'drawFour_played':
          showGameMessage(`+4 en juego...`);
          break;
        case 'draw_penalty':
          showGameMessage(`${data.playerPlayed} recibió ${data.cardsDrawn} cartas de penalidad`);
          break;
        case 'color_chosen':
          showGameMessage(`${data.playerPlayed} eligió color`);
          break;
      }
    };

    // Your hand update
    const handleYourHand = (hand: Card[]) => {
      setPlayerHand(hand);
      setIsLoading(false);
    };

    // Color picker prompt
    const handlePromptColor = ({ playedCardIndex }: { lobbyId: string; playedCardIndex: number }) => {
      setPendingWildCardIndex(playedCardIndex);
      setShowColorPicker(true);
    };

    // Winner found
    const handleWinner = ({ username, rank }: { username: string; rank: number; gameState: GameState }) => {
      showGameMessage(`🏆 ${username} salió en ${rank}° lugar!`, 4000);
    };

    // Game over
    const handleGameOver = ({ gameState: finalState }: { gameState: GameState }) => {
      setGameState(finalState);
      showGameMessage('¡Partida terminada!', 5000);
      setIsLoading(false);
    };

    // Game error
    const handleGameError = (message: string) => {
      setError(message);
      showGameMessage(`❌ ${message}`);
      setIsLoading(false);
    };

    // Lobby cancelled (host closed before starting)
    const handleLobbyCancelled = (data: { lobbyId: string }) => {
      if (data.lobbyId === lobbyId) {
        showGameMessage('El lobby fue cerrado por el creador', 3000);
        try { localStorage.removeItem('activeLobbyId'); } catch (e) {}
        navigate('/lobbies');
      }
    };

    // Registrar listeners
    socketService.on('game:lobbyInfo', handleLobbyInfo);
    socketService.on('game:gameInfo', handleGameInfo);
    socketService.on('game:started', handleGameStarted);
    socketService.on('game:update', handleGameUpdate);
    socketService.on('game:yourHand', handleYourHand);
    socketService.on('game:promptColor', handlePromptColor);
    socketService.on('game:winner', handleWinner);
    socketService.on('game:over', handleGameOver);
    socketService.on('game:error', handleGameError);
  socketService.on('lobby:cancelled', handleLobbyCancelled);
    // Nuevo: listener para lobby:updated
    const handleLobbyUpdated = (data: { lobbyId: string }) => {
      if (lobbyId && data.lobbyId === lobbyId) {
        console.log('🔔 Recibido lobby:updated, solicitando info actualizada');
        socketService.getLobbyInfo(lobbyId);
      }
    };
    socketService.on('lobby:updated', handleLobbyUpdated);

    // Solicitar información del lobby
    const timer = setTimeout(requestLobbyInfo, 100); // Pequeño delay para asegurar conexión

    // Cleanup
    return () => {
      clearTimeout(timer);
      socketService.off('game:lobbyInfo', handleLobbyInfo);
      socketService.off('game:gameInfo', handleGameInfo);
      socketService.off('game:started', handleGameStarted);
      socketService.off('game:update', handleGameUpdate);
      socketService.off('game:yourHand', handleYourHand);
      socketService.off('game:promptColor', handlePromptColor);
      socketService.off('game:winner', handleWinner);
      socketService.off('game:over', handleGameOver);
      socketService.off('game:error', handleGameError);
  socketService.off('lobby:cancelled', handleLobbyCancelled);
      socketService.off('lobby:updated', handleLobbyUpdated);
    };
  }, [session?.username, showGameMessage, lobbyId]);

  // Acciones del juego
  const startGame = useCallback(() => {
    if (!lobbyId || isLoading) return;
    setIsLoading(true);
    setError(null);
    
    socketService.startGame(lobbyId);
  }, [lobbyId, isLoading]);

  const playCard = useCallback((cardIndex: number) => {
    if (!lobbyId || !isMyTurn || isLoading) return;
    setIsLoading(true);
    setError(null);
    
    socketService.playCard(lobbyId, cardIndex);
    setTimeout(() => setIsLoading(false), 1000);
  }, [lobbyId, isMyTurn, isLoading]);

  const drawCard = useCallback(() => {
    if (!lobbyId || !isMyTurn || isLoading) return;
    setIsLoading(true);
    setError(null);
    
    socketService.drawCard(lobbyId);
    setTimeout(() => setIsLoading(false), 1000);
  }, [lobbyId, isMyTurn, isLoading]);

  const passTurn = useCallback(() => {
    if (!lobbyId || !isMyTurn || isLoading) return;
    setIsLoading(true);
    setError(null);
    
    socketService.passTurn(lobbyId);
    setTimeout(() => setIsLoading(false), 1000);
  }, [lobbyId, isMyTurn, isLoading]);

  const chooseWildColor = useCallback((color: WildColor) => {
    if (!lobbyId || pendingWildCardIndex === null) return;
    
    socketService.chooseColor(lobbyId, color, pendingWildCardIndex);
    
    setShowColorPicker(false);
    setPendingWildCardIndex(null);
  }, [lobbyId, pendingWildCardIndex]);

  const leaveGame = useCallback(() => {
    // Intentar salir del lobby en el servidor y limpiar estado local
    (async () => {
      try {
        if (lobbyId) {
          await leaveLobby(lobbyId);
        }
      } catch (err) {
        console.warn('leaveLobby fallo o no estaba conectado:', err);
      } finally {
        // Limpiar la referencia de lobby activo en localStorage
        try { localStorage.removeItem('activeLobbyId'); } catch (e) {}
        navigate('/lobbies');
      }
    })();
  }, [navigate, leaveLobby, lobbyId]);

  // Intentar salir correctamente si el hook se desmonta (por ejemplo, navegación abrupta)
  useEffect(() => {
    // NOTE: remove automatic leave on unmount to avoid race conditions where
    // a component unmount during navigation triggers a leave immediately after
    // creating a lobby. Use explicit leaveGame() instead.
    return () => {
      try { localStorage.removeItem('activeLobbyId'); } catch (e) {}
    };
  }, [lobbyId]);

  return {
    // Estado
    gameState,
    playerHand,
    isMyTurn,
    currentPlayer,
    isGameStarted,
    isGameFinished,
    
    // Acciones
    startGame,
    playCard,
    drawCard,
    passTurn,
    chooseWildColor,
    
    // Estados UI
    isLoading,
    error,
    showColorPicker,
    winners,
    gameMessage,
    
    // Cleanup
    leaveGame,
  };
}