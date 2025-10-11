// Tipos para el juego UNO
export interface Card {
  id?: string;
  color: 'Red' | 'Blue' | 'Green' | 'Yellow' | 'Wild';
  value: string; // '0'-'9', 'Skip', 'Reverse', 'DrawTwo', 'Wild', 'WildDrawFour'
  type: 'Number' | 'Action' | 'Wild';
  variant?: 'a' | 'b' | 'c' | 'd'; // Para diferentes diseños
}

export interface GamePlayer {
  id: string;
  username: string;
  walletAddress: string;
  socketId: string;
  hand: Card[];
  cardCount: number; // Para otros jugadores (solo cantidad, no cartas)
  // Metadata de lobby
  isHost?: boolean;
  isReady?: boolean;
  isConnected?: boolean;
  joinedAt?: string | Date;
}

export interface Winner {
  username: string;
  walletAddress: string;
  socketId: string;
  rank: number; // 1=Oro, 2=Plata, 3=Bronce
}

export interface GameState {
  id: string;
  name: string;
  status: 'waiting' | 'in_game' | 'finished';
  players: GamePlayer[];
  hostId: string;
  
  // Estado del juego
  drawPile: Card[];
  discardPile: Card[];
  currentTurnIndex: number;
  direction: number; // 1 o -1
  currentActiveColor: string | null;
  
  // Mecánicas especiales
  drawStackCount: number; // Cartas acumuladas por +2/+4
  drawStackActive: boolean;
  hasDrawnCard: Record<string, boolean>; // Por socketId
  
  // Resultados
  winners: Winner[];
  finishedIds: Set<string>;
}

// Eventos WebSocket del juego
export interface GameSocketEvents {
  // Cliente → Servidor
  'game:start': (data: { lobbyId: string }) => void;
  'game:playCard': (data: { lobbyId: string; cardIndex: number }) => void;
  'game:drawCard': (data: { lobbyId: string }) => void;
  'game:passTurn': (data: { lobbyId: string }) => void;
  'game:chooseColor': (data: { lobbyId: string; color: string; cardIndex: number }) => void;
  
  // Servidor → Cliente
  'game:started': (data: { gameState: GameState; firstCard: Card }) => void;
  'game:update': (data: GameUpdateData) => void;
  'game:yourHand': (hand: Card[]) => void;
  'game:promptColor': (data: { lobbyId: string; playedCardIndex: number }) => void;
  'game:winner': (data: { username: string; rank: number; gameState: GameState }) => void;
  'game:over': (data: { gameState: GameState }) => void;
  'game:error': (message: string) => void;
}

export interface GameUpdateData {
  gameState: GameState;
  playedCard?: Card;
  playerPlayed: string;
  newTurnIndex: number;
  action: 'play' | 'draw' | 'pass' | 'skip' | 'reverse' | 'drawTwo_played' | 
    'drawFour_played' | 'draw_penalty' | 'color_chosen' | 'player_disconnected' |
    'stack_allowed' | 'stack_not_allowed';
  currentPlayerName: string | null;
  currentActiveColor: string | null;
  cardsDrawn?: number;
}

// Tipos de colores para Wild cards
export type WildColor = 'Red' | 'Blue' | 'Green' | 'Yellow';