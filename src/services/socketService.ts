import { io, Socket } from 'socket.io-client';
import type { LobbyType, CreateLobbyFormData, Lobby } from '../types/lobby';
import type { GameState, Card, GameUpdateData, WildColor } from '../types/game';

export interface SocketEvents {
  // Reconexión de lobby
  'lobby:reconnect': (data: { lobbyId: string; userId: string }) => void;
  // ===== EVENTOS DE LOBBY =====
  // Cliente al servidor
  'lobby:create': (data: CreateLobbyFormData & { creatorId: string; creatorUsername: string; walletAddress: string }) => void;
  'lobby:join': (data: { lobbyId: string; playerId: string; username: string; walletAddress: string; password?: string; onchain?: { txHash: string; contract: string; chain: string } }) => void;
  'lobby:cancel': (data: { lobbyId: string; playerId: string }) => void;
  'lobby:leave': (data: { lobbyId: string; playerId: string }) => void;
  'lobby:list': () => void;
  'lobby:ready': (data: { lobbyId: string; playerId: string }) => void;

  // Servidor al cliente
  'lobby:created': (data: { success: boolean; lobby?: Lobby; error?: string }) => void;
  'lobby:joined': (data: { success: boolean; lobby?: Lobby; error?: string }) => void;
  'lobby:left': (data: { success: boolean; lobbyId: string }) => void;
  'lobby:cancelled': (data: { lobbyId: string }) => void;
  'lobby:updated': (data: { lobbyId: string }) => void;
  'lobby:list-updated': (data: { 
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
  }) => void;

  // ===== EVENTOS DEL JUEGO =====
  // Cliente al servidor
  'game:start': (data: { lobbyId: string }) => void;
  'game:playCard': (data: { lobbyId: string; cardIndex: number }) => void;
  'game:drawCard': (data: { lobbyId: string }) => void;
  'game:passTurn': (data: { lobbyId: string }) => void;
  'game:chooseColor': (data: { lobbyId: string; color: WildColor; cardIndex: number }) => void;
  'game:getLobbyInfo': (data: { lobbyId: string }) => void;
  'game:prizeDistributed': (data: { txHash: string; lobbyId: string }) => void;

  // Servidor al cliente
  'game:started': (data: { gameState: GameState; firstCard: Card }) => void;
  'game:update': (data: GameUpdateData) => void;
  'game:yourHand': (hand: Card[]) => void;
  'game:promptColor': (data: { lobbyId: string; playedCardIndex: number }) => void;
  'game:winner': (data: { username: string; rank: number; gameState: GameState }) => void;
  'game:over': (data: { gameState: GameState }) => void;
  'game:error': (message: string) => void;
  'game:lobbyInfo': (data: { success: boolean; lobby?: any; error?: string }) => void;
  'game:gameInfo': (data: { success: boolean; game?: GameState; error?: string }) => void;
  'game:distributePrizes': (data: { lobbyId: string; winners: string[]; mode: string }) => void;
  'game:prizesDistributed': (data: { success: boolean; txHash: string; message: string }) => void;
  'game:prizeError': (data: { error: string }) => void;

  // Eventos de conexión
  'connect': () => void;
  'disconnect': () => void;
  'connect_error': (error: Error) => void;
}

class SocketService {
  private socket: Socket | null = null;

  connect(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        console.log('✅ Socket ya conectado, reutilizando conexión');
        resolve(this.socket);
        return;
      }

      if (this.socket && !this.socket.connected) {
        console.log('🔄 Reconectando socket existente...');
        this.socket.connect();
        resolve(this.socket);
        return;
      }

      console.log('🔌 Creando nueva conexión socket...');
      const serverUrl = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SOCKET_URL : undefined) || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
      console.log('📡 Socket serverUrl:', serverUrl); // Log temporal para verificar URL en producción

      this.socket = io(serverUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('✅ Conectado al servidor WebSocket', { socketId: this.socket?.id });
        resolve(this.socket!);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Error conectando al servidor WebSocket:', error);
        reject(error);
      });

      // Registrar motivo de desconexión para depuración
      this.socket.on('disconnect', (reason: string) => {
        console.log('🔌 Desconectado del servidor WebSocket', { reason, socketId: this.socket?.id });
      });
    });
  }

  // Esperar a que el socket esté conectado antes de emitir eventos
  async ensureConnected(timeout = 5000): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }
    
    // Si no hay socket, intentar conectar
    if (!this.socket) {
      await this.connect();
      return;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Socket connection timeout'));
      }, timeout);

      const cleanup = () => {
        this.socket?.off('connect', onConnect);
        this.socket?.off('connect_error', onError);
        clearTimeout(timer);
      };

      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err || new Error('Socket connection error'));
      };

      this.socket?.once('connect', onConnect);
      this.socket?.once('connect_error', onError);
    });
  }

  disconnect(): void {
    if (this.socket) {
      // Trace stack to see who requested a disconnect
      console.warn('socketService.disconnect() called. Stack trace to caller:');
      // eslint-disable-next-line no-console
      console.trace();
      try {
        this.socket.disconnect();
      } catch (err) {
        console.error('Error during socket disconnect:', err);
      }
      this.socket = null;
    }
  }

  // Métodos para lobbies
  async createLobby(data: CreateLobbyFormData, creatorId: string, creatorUsername: string, walletAddress: string): Promise<void> {
    await this.ensureConnected();
    console.debug('socketService.createLobby ->', { data, creatorId, creatorUsername, walletAddress });
    this.emit('lobby:create', { ...data, creatorId, creatorUsername, walletAddress });
  }

  async joinLobby(lobbyId: string, playerId: string, username: string, walletAddress: string, password?: string, onchain?: { txHash: string; contract: string; chain: string }): Promise<void> {
    await this.ensureConnected();
    console.debug('socketService.joinLobby ->', { lobbyId, playerId, username, walletAddress, password, onchain });
    this.emit('lobby:join', { lobbyId, playerId, username, walletAddress, password, onchain });
  }

  async leaveLobby(lobbyId: string, playerId: string): Promise<void> {
    await this.ensureConnected();
    console.debug('socketService.leaveLobby ->', { lobbyId, playerId });
    this.emit('lobby:leave', { lobbyId, playerId });
  }

  async cancelLobby(lobbyId: string, playerId: string): Promise<void> {
    await this.ensureConnected();
    console.debug('socketService.cancelLobby ->', { lobbyId, playerId });
    this.emit('lobby:cancel', { lobbyId, playerId });
  }

  async requestLobbyList(): Promise<void> {
    await this.ensureConnected();
    console.debug('socketService.requestLobbyList ->');
    this.emit('lobby:list');
  }

  async setPlayerReady(lobbyId: string, playerId: string): Promise<void> {
    await this.ensureConnected();
    console.debug('socketService.setPlayerReady ->', { lobbyId, playerId });
    this.emit('lobby:ready', { lobbyId, playerId });
  }

  // ===== MÉTODOS PARA EL JUEGO =====
  async startGame(lobbyId: string): Promise<void> {
    await this.ensureConnected();
    console.debug('socketService.startGame ->', { lobbyId });
    this.emit('game:start', { lobbyId });
  }

  async playCard(lobbyId: string, cardIndex: number): Promise<void> {
    await this.ensureConnected();
    console.debug('socketService.playCard ->', { lobbyId, cardIndex });
    this.emit('game:playCard', { lobbyId, cardIndex });
  }

  async drawCard(lobbyId: string): Promise<void> {
    await this.ensureConnected();
    console.debug('socketService.drawCard ->', { lobbyId });
    this.emit('game:drawCard', { lobbyId });
  }

  async passTurn(lobbyId: string): Promise<void> {
    await this.ensureConnected();
    console.debug('socketService.passTurn ->', { lobbyId });
    this.emit('game:passTurn', { lobbyId });
  }

  async chooseColor(lobbyId: string, color: WildColor, cardIndex: number): Promise<void> {
    await this.ensureConnected();
    console.debug('socketService.chooseColor ->', { lobbyId, color, cardIndex });
    this.emit('game:chooseColor', { lobbyId, color, cardIndex });
  }

  async getLobbyInfo(lobbyId: string): Promise<void> {
    await this.ensureConnected();
    console.debug('socketService.getLobbyInfo ->', { lobbyId });
    this.emit('game:getLobbyInfo', { lobbyId });
  }

  // Métodos para escuchar eventos
  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]): void {
    if (this.socket) {
      console.debug(`socketService.on -> ${String(event)}`);
      this.socket.on(event as string, callback as any);
    }
  }

  off<K extends keyof SocketEvents>(event: K, callback?: SocketEvents[K]): void {
    if (this.socket) {
      console.debug(`socketService.off -> ${String(event)}`);
      this.socket.off(event as string, callback as any);
    }
  }

  // Método genérico para emit (privado - usar métodos públicos async)
  private emit<K extends keyof SocketEvents>(event: K, data?: any): void {
    if (!this.socket?.connected) {
      throw new Error('No hay conexión con el servidor');
    }
    console.debug(`socketService.emit -> ${String(event)}`, data);
    this.socket.emit(event as string, data);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get socket_instance(): Socket | null {
    return this.socket;
  }
}

// Instancia singleton del servicio de socket
export const socketService = new SocketService();

// Expose for debugging in browser console
try {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.socketService = socketService;
  }
} catch (e) {
  // no-op
}