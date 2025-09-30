// Tipos base para el sistema de lobbies
export type LobbyType = 'publico' | 'privado' | 'pago';
export type LobbyStatus = 'waiting' | 'starting' | 'in-progress' | 'finished' | 'cancelled';

// Configuración de cada tipo de lobby
export interface LobbyTypeConfig {
  requiresPassword: boolean;
  requiresPayment: boolean;
  minPlayers: number;
  maxPlayers: number;
  autoStart: boolean;
  allowSpectators: boolean;
}

// Datos del formulario para crear lobby
export interface CreateLobbyFormData {
  name: string;
  type: LobbyType;
  password?: string;
  entryCost?: number;
  maxPlayers?: number;
  description?: string;
}

// Estructura completa de un lobby
export interface Lobby {
  id: string;
  name: string;
  type: LobbyType;
  status: LobbyStatus;
  createdBy: string;
  createdAt: Date;
  hasPassword: boolean;
  entryCost?: number;
  maxPlayers: number;
  currentPlayers: number;
  players: LobbyPlayer[];
  spectators?: LobbyPlayer[];
  gameSettings: GameSettings;
  description?: string;
}

// Jugador en el lobby
export interface LobbyPlayer {
  id: string;
  username: string;
  wallet?: string;
  isReady: boolean;
  isHost: boolean;
  joinedAt: Date;
  avatar?: string;
}

// Configuraciones del juego UNO
export interface GameSettings {
  drawTwoStackable: boolean;
  drawFourStackable: boolean;
  jumpInAllowed: boolean;
  sevenOSwap: boolean;
  timeLimit: number; // segundos por turno
  customRules: string[];
}

// Configuraciones predeterminadas por tipo de lobby
export const LOBBY_TYPE_CONFIGS: Record<LobbyType, LobbyTypeConfig> = {
  publico: {
    requiresPassword: false,
    requiresPayment: false,
    minPlayers: 2,
    maxPlayers: 8,
    autoStart: false,
    allowSpectators: true
  },
  privado: {
    requiresPassword: true,
    requiresPayment: false,
    minPlayers: 2,
    maxPlayers: 6,
    autoStart: false,
    allowSpectators: true
  },
  pago: {
    requiresPassword: false,
    requiresPayment: true,
    minPlayers: 3,
    maxPlayers: 6,
    autoStart: true, // Auto-inicia cuando se llena
    allowSpectators: false // No espectadores en lobbies pagos
  }
};

// Configuraciones predeterminadas del juego
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  drawTwoStackable: true,
  drawFourStackable: true,
  jumpInAllowed: false,
  sevenOSwap: false,
  timeLimit: 30,
  customRules: []
};

// Errores específicos para lobbies
export const LobbyError = {
  INVALID_NAME: 'INVALID_NAME',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INVALID_ENTRY_COST: 'INVALID_ENTRY_COST',
  LOBBY_FULL: 'LOBBY_FULL',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  ALREADY_IN_LOBBY: 'ALREADY_IN_LOBBY',
  LOBBY_NOT_FOUND: 'LOBBY_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED'
} as const;

export type LobbyErrorType = typeof LobbyError[keyof typeof LobbyError];