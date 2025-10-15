// Tipos base para el sistema de lobbies
export type LobbyType = 'publico' | 'privado' | 'pago';
export type LobbyStatus = 'waiting' | 'starting' | 'in-progress' | 'finished' | 'cancelled';

// Redes blockchain soportadas
export type SupportedNetwork = 'ronin' | 'ronin-saigon' | 'sepolia';

// Monedas soportadas por red
export type SupportedToken = 'ETH' | 'RON' | 'RICE' | 'RONKE';

// Configuración de tokens por red
export interface TokenConfig {
  symbol: SupportedToken;
  name: string;
  decimals: number;
  address?: string; // undefined para tokens nativos
}

// Configuración de redes
export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: TokenConfig;
  supportedTokens: TokenConfig[];
}

// Configuraciones de redes disponibles
export const NETWORK_CONFIGS: Record<SupportedNetwork, NetworkConfig> = {
  ronin: {
    name: 'Ronin',
    chainId: 2020,
    rpcUrl: 'https://api.roninchain.com/rpc',
    blockExplorer: 'https://app.roninchain.com',
    nativeCurrency: {
      symbol: 'RON',
      name: 'Ronin',
      decimals: 18
    },
    supportedTokens: [
      {
        symbol: 'RON',
        name: 'Ronin',
        decimals: 18
      },
      {
        symbol: 'RICE',
        name: 'Rice Token',
        decimals: 18,
        address: '0x9049ca10dd4cba0248226b4581443201f8f225c6'
      },
      {
        symbol: 'RONKE',
        name: 'Ronke Token',
        decimals: 18,
        address: '0xf988f63bf26c3ed3fbf39922149e3e7b1e5c27cb'
      }
    ]
  },
  'ronin-saigon': {
    name: 'Ronin Saigon Testnet',
    chainId: 2021,
    rpcUrl: 'https://saigon-testnet.roninchain.com/rpc',
    blockExplorer: 'https://saigon-app.roninchain.com',
    nativeCurrency: {
      symbol: 'RON',
      name: 'Ronin',
      decimals: 18
    },
    supportedTokens: [
      {
        symbol: 'RON',
        name: 'Ronin',
        decimals: 18
      },
      {
        symbol: 'RICE',
        name: 'Rice Token',
        decimals: 18,
        address: '0x' // TODO: Agregar dirección real del token RICE en Saigon
      },
      {
        symbol: 'RONKE',
        name: 'Ronke Token',
        decimals: 18,
        address: '0x' // TODO: Agregar dirección real del token RONKE en Saigon
      }
    ]
  },
  sepolia: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Sepolia Ether',
      decimals: 18
    },
    supportedTokens: [
      {
        symbol: 'ETH',
        name: 'Sepolia Ether',
        decimals: 18
      }
    ]
  }
};

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
  entryCost?: string; // Amount as string to handle decimals
  token?: SupportedToken;
  network?: SupportedNetwork;
  mode?: 'BEAST' | 'CLASSIC';
  maxPlayers?: number;
  description?: string;
}

// Configuración de pago del lobby
export interface PaymentConfig {
  network: SupportedNetwork;
  token: SupportedToken;
  amount: string; // En unidades legibles (ej: "0.01")
  amountWei?: string; // En wei/unidades mínimas
  tokenAddress?: string; // Para tokens ERC20
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
  paymentConfig?: PaymentConfig; // Para lobbies de pago
  mode?: 'BEAST' | 'CLASSIC';
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