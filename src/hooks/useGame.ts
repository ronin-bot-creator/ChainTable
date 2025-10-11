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
  
  // Premios (NEW in V2)
  autoDistributePrizes: (winnerAddresses: string[]) => Promise<any>;
  
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

  /**
   * Auto-distribución de premios (NEW in V2)
   * Cualquier jugador puede llamar esta función cuando se muestra el podio
   * No depende del evento del servidor
   */
  const autoDistributePrizes = useCallback(async (winnerAddresses: string[]) => {
    console.log('🎁 [AUTO-DISTRIBUTE] Iniciando auto-distribución de premios');
    console.log('   📌 Winners:', winnerAddresses);
    console.log('   📌 Game State:', gameState);
    
    try {
      // Verificar si es un lobby de pago
      if (!gameState || (gameState as any).type !== 'pago') {
        console.log('ℹ️ Lobby gratuito, no hay premios on-chain');
        return;
      }

      const onchainLobbyId = (gameState as any).onchainLobbyId || (gameState as any).onchain?.lobbyId;
      if (!onchainLobbyId) {
        console.error('❌ No se encontró onchainLobbyId');
        showGameMessage('❌ No se puede distribuir: Lobby ID no disponible', 3000);
        return;
      }

      console.log('   📌 On-chain Lobby ID:', onchainLobbyId);

      // Importar dinámicamente ethers
      const { ethers } = await import('ethers');
      
      if (!window.ethereum) {
        console.error('❌ MetaMask no disponible');
        showGameMessage('❌ MetaMask no detectado', 3000);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      
      console.log('✅ User address:', userAddress);
      
      // ABI actualizado para V2
      const contractABI = [
        'function endLobby(uint256 lobbyId, address[] calldata winners) external',
        'function isPlayerInLobby(uint256 lobbyId, address player) external view returns (bool)'
      ];
      
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS_SEPOLIA || '0x5099CA1a00a96869A6D1DCEC7BF579bf72D51E1B';
      const contract = new ethers.Contract(contractAddress, contractABI, signer);
      
      console.log('📝 Contrato V2:', contractAddress);
      
      // Verificar que el usuario sea un jugador del lobby (V2 feature)
      const isPlayer = await contract.isPlayerInLobby(onchainLobbyId, userAddress);
      console.log('   🎮 Is player in lobby:', isPlayer);
      
      if (!isPlayer) {
        console.log('⚠️ Usuario no es jugador del lobby, no puede distribuir premios');
        showGameMessage('⚠️ Solo los jugadores pueden distribuir premios', 3000);
        return;
      }
      
      console.log('🔑 Llamando endLobby con:');
      console.log('   - lobbyId:', onchainLobbyId);
      console.log('   - winners:', winnerAddresses);
      
      showGameMessage('🔄 Distribuyendo premios on-chain...', 0);
      
      // Llamar a endLobby
      console.log('⏳ Enviando transacción endLobby...');
      const tx = await contract.endLobby(onchainLobbyId, winnerAddresses);
      console.log('✅ Transacción enviada:', tx.hash);
      
      showGameMessage('⏳ Esperando confirmación... Esto puede tomar unos segundos', 0);
      const receipt = await tx.wait();
      
      console.log('✅ Premios distribuidos:', receipt.hash);
      showGameMessage(`✅ Premios distribuidos! TX: ${receipt.hash.slice(0, 10)}...`, 8000);
      
      // Notificar al servidor (opcional, para logging)
      socketService.emit('game:prizeDistributed', {
        txHash: receipt.hash,
        lobbyId
      });
      
      return receipt;
      
    } catch (error: any) {
      console.error('❌ Error en auto-distribución:', error);
      
      // Mensajes de error más específicos
      let errorMsg = 'Error desconocido';
      if (error.code === 'ACTION_REJECTED') {
        errorMsg = 'Transacción rechazada por el usuario';
      } else if (error.reason) {
        errorMsg = error.reason;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      showGameMessage(`❌ Error: ${errorMsg}`, 8000);
      throw error;
    }
  }, [gameState, lobbyId, showGameMessage]);

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
        case 'stack_allowed':
          // Indica al penalizado que puede responder (apilar) si tiene la carta
          if (data.currentPlayerName === session?.username) {
            showGameMessage('Tienes un stack sobre ti. Puedes apilar +2/+4 si tienes la carta.');
          } else {
            showGameMessage(`${data.playerPlayed} puede ser apilado`);
          }
          break;
        case 'stack_not_allowed':
          // Indica que no hay defensa posible; el jugador debería robar/pasar
          if (data.currentPlayerName === session?.username) {
            showGameMessage('No puedes defenderte. Debes robar las cartas acumuladas y se te saltará el turno.');
          } else {
            showGameMessage(`${data.playerPlayed} no puede defenderse y deberá robar`);
          }
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

    // Distribución de premios desde evento del servidor
    const handleDistributePrizes = async (data: { lobbyId: string; winners: string[]; mode: string }) => {
      console.log('💰 [FRONTEND] Evento game:distributePrizes recibido:', data);
      console.log('   📌 Lobby ID:', data.lobbyId);
      console.log('   📌 Winners:', data.winners);
      console.log('   📌 Mode:', data.mode);
      
      // Delegar a autoDistributePrizes para evitar código duplicado
      await autoDistributePrizes(data.winners);
    };

    const handlePrizesDistributed = (data: { success: boolean; txHash: string; message: string }) => {
      console.log('✅ Premios distribuidos confirmados:', data);
      showGameMessage(`✅ ${data.message}`, 5000);
    };

    const handlePrizeError = (data: { error: string }) => {
      console.error('❌ Error en distribución:', data.error);
      showGameMessage(`❌ ${data.error}`, 5000);
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
    socketService.on('game:distributePrizes', handleDistributePrizes);
    socketService.on('game:prizesDistributed', handlePrizesDistributed);
    socketService.on('game:prizeError', handlePrizeError);
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
      socketService.off('game:distributePrizes', handleDistributePrizes);
      socketService.off('game:prizesDistributed', handlePrizesDistributed);
      socketService.off('game:prizeError', handlePrizeError);
    };
  }, [session?.username, showGameMessage, lobbyId, autoDistributePrizes]);

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
    
    // Premios (NEW in V2)
    autoDistributePrizes,
    
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