import type { 
  CreateLobbyFormData, 
  Lobby, 
  LobbyPlayer,
  LobbyErrorType,
  LobbyType
} from '../types/lobby';

import {
  LobbyError,
  LOBBY_TYPE_CONFIGS,
  DEFAULT_GAME_SETTINGS
} from '../types/lobby';

// Clase para manejar la lógica de lobbies
export class LobbyManager {
  private lobbies: Map<string, Lobby> = new Map();
  private playerLobbyMap: Map<string, string> = new Map(); // playerId -> lobbyId

  // Validar datos del formulario de creación
  validateCreateLobbyForm(formData: CreateLobbyFormData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = LOBBY_TYPE_CONFIGS[formData.type];

    // Validar nombre
    if (!formData.name || formData.name.trim().length < 3) {
      errors.push('El nombre del lobby debe tener al menos 3 caracteres');
    }

    if (formData.name && formData.name.length > 50) {
      errors.push('El nombre del lobby no puede exceder 50 caracteres');
    }

    // Validar contraseña para lobbies privados
    if (config.requiresPassword) {
      if (!formData.password || formData.password.length < 4) {
        errors.push('La contraseña debe tener al menos 4 caracteres');
      }
      if (formData.password && formData.password.length > 20) {
        errors.push('La contraseña no puede exceder 20 caracteres');
      }
    }

    // Validar costo de entrada para lobbies pagos
    if (config.requiresPayment) {
      if (!formData.entryCost || formData.entryCost <= 0) {
        errors.push('El costo de entrada debe ser mayor a 0');
      }
      if (formData.entryCost && formData.entryCost > 1000) {
        errors.push('El costo de entrada no puede exceder 1000');
      }
    }

    // Validar número máximo de jugadores
    if (formData.maxPlayers) {
      if (formData.maxPlayers < config.minPlayers) {
        errors.push(`Mínimo ${config.minPlayers} jugadores para este tipo de lobby`);
      }
      if (formData.maxPlayers > config.maxPlayers) {
        errors.push(`Máximo ${config.maxPlayers} jugadores para este tipo de lobby`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Crear un nuevo lobby
  createLobby(formData: CreateLobbyFormData, creatorId: string, creatorUsername: string): { 
    success: boolean; 
    lobby?: Lobby; 
    error?: LobbyErrorType;
    message?: string;
  } {
    // Validar formulario
    const validation = this.validateCreateLobbyForm(formData);
    if (!validation.isValid) {
      return {
        success: false,
        error: LobbyError.INVALID_NAME,
        message: validation.errors.join(', ')
      };
    }

    // Verificar que el jugador no esté ya en otro lobby
    if (this.playerLobbyMap.has(creatorId)) {
      return {
        success: false,
        error: LobbyError.ALREADY_IN_LOBBY,
        message: 'Ya estás en otro lobby'
      };
    }

    const config = LOBBY_TYPE_CONFIGS[formData.type];
    const lobbyId = this.generateLobbyId();
    
    // Crear el lobby
    const lobby: Lobby = {
      id: lobbyId,
      name: formData.name.trim(),
      type: formData.type,
      status: 'waiting',
      createdBy: creatorId,
      createdAt: new Date(),
      hasPassword: config.requiresPassword,
      entryCost: config.requiresPayment ? formData.entryCost : undefined,
      maxPlayers: formData.maxPlayers || config.maxPlayers,
      currentPlayers: 1,
      players: [{
        id: creatorId,
        username: creatorUsername,
        isReady: false,
        isHost: true,
        joinedAt: new Date()
      }],
      spectators: config.allowSpectators ? [] : undefined,
      gameSettings: { ...DEFAULT_GAME_SETTINGS },
      description: formData.description
    };

    // Guardar el lobby
    this.lobbies.set(lobbyId, lobby);
    this.playerLobbyMap.set(creatorId, lobbyId);

    return {
      success: true,
      lobby
    };
  }

  // Unirse a un lobby
  joinLobby(lobbyId: string, playerId: string, username: string, password?: string): {
    success: boolean;
    lobby?: Lobby;
    error?: LobbyErrorType;
    message?: string;
  } {
    // Verificar que el lobby existe
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      return {
        success: false,
        error: LobbyError.LOBBY_NOT_FOUND,
        message: 'Lobby no encontrado'
      };
    }

    // Verificar que el jugador no esté ya en otro lobby
    if (this.playerLobbyMap.has(playerId)) {
      return {
        success: false,
        error: LobbyError.ALREADY_IN_LOBBY,
        message: 'Ya estás en otro lobby'
      };
    }

    // Verificar capacidad
    if (lobby.currentPlayers >= lobby.maxPlayers) {
      return {
        success: false,
        error: LobbyError.LOBBY_FULL,
        message: 'El lobby está lleno'
      };
    }

    // Verificar contraseña si es necesario
    if (lobby.hasPassword && !password) {
      return {
        success: false,
        error: LobbyError.INVALID_PASSWORD,
        message: 'Se requiere contraseña'
      };
    }

    // Aquí validarías la contraseña contra la almacenada de forma segura
    // Por ahora solo verificamos que se proporcione una contraseña

    // Crear el jugador
    const newPlayer: LobbyPlayer = {
      id: playerId,
      username,
      isReady: false,
      isHost: false,
      joinedAt: new Date()
    };

    // Agregar al lobby
    lobby.players.push(newPlayer);
    lobby.currentPlayers++;
    this.playerLobbyMap.set(playerId, lobbyId);

    // Verificar si debe auto-iniciar (lobbies pagos)
    const config = LOBBY_TYPE_CONFIGS[lobby.type];
    if (config.autoStart && lobby.currentPlayers === lobby.maxPlayers) {
      lobby.status = 'starting';
    }

    return {
      success: true,
      lobby
    };
  }

  // Salir de un lobby
  leaveLobby(playerId: string): {
    success: boolean;
    lobbyId?: string;
    wasHost?: boolean;
    message?: string;
  } {
    const lobbyId = this.playerLobbyMap.get(playerId);
    if (!lobbyId) {
      return {
        success: false,
        message: 'No estás en ningún lobby'
      };
    }

    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      this.playerLobbyMap.delete(playerId);
      return {
        success: false,
        message: 'Lobby no encontrado'
      };
    }

    const playerIndex = lobby.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      this.playerLobbyMap.delete(playerId);
      return {
        success: false,
        message: 'No estás en este lobby'
      };
    }

    const wasHost = lobby.players[playerIndex].isHost;
    
    // Remover jugador
    lobby.players.splice(playerIndex, 1);
    lobby.currentPlayers--;
    this.playerLobbyMap.delete(playerId);

    // Si era el host y quedan jugadores, asignar nuevo host
    if (wasHost && lobby.players.length > 0) {
      lobby.players[0].isHost = true;
    }

    // Si no quedan jugadores, eliminar el lobby
    if (lobby.players.length === 0) {
      this.lobbies.delete(lobbyId);
    }

    return {
      success: true,
      lobbyId,
      wasHost
    };
  }

  // Obtener lobby por ID
  getLobby(lobbyId: string): Lobby | undefined {
    return this.lobbies.get(lobbyId);
  }

  // Obtener lobby del jugador
  getPlayerLobby(playerId: string): Lobby | undefined {
    const lobbyId = this.playerLobbyMap.get(playerId);
    return lobbyId ? this.lobbies.get(lobbyId) : undefined;
  }

  // Obtener todos los lobbies públicos
  getPublicLobbies(): Lobby[] {
    return Array.from(this.lobbies.values())
      .filter(lobby => lobby.type === 'publico' && lobby.status === 'waiting');
  }

  // Cambiar estado de ready del jugador
  togglePlayerReady(playerId: string): {
    success: boolean;
    lobby?: Lobby;
    allReady?: boolean;
    message?: string;
  } {
    const lobby = this.getPlayerLobby(playerId);
    if (!lobby) {
      return {
        success: false,
        message: 'No estás en ningún lobby'
      };
    }

    const player = lobby.players.find(p => p.id === playerId);
    if (!player) {
      return {
        success: false,
        message: 'Jugador no encontrado'
      };
    }

    player.isReady = !player.isReady;
    const allReady = lobby.players.every(p => p.isReady);

    return {
      success: true,
      lobby,
      allReady
    };
  }

  // Obtener estadísticas de lobbies
  getLobbyStats(): {
    total: number;
    byType: Record<LobbyType, number>;
    byStatus: Record<'waiting' | 'starting' | 'in-progress' | 'finished' | 'cancelled', number>;
  } {
    const stats = {
      total: this.lobbies.size,
      byType: {
        publico: 0,
        privado: 0,
        pago: 0
      } as Record<LobbyType, number>,
      byStatus: {
        waiting: 0,
        starting: 0,
        'in-progress': 0,
        finished: 0,
        cancelled: 0
      }
    };

    for (const lobby of this.lobbies.values()) {
      stats.byType[lobby.type]++;
      stats.byStatus[lobby.status]++;
    }

    return stats;
  }





  // Obtener información detallada de lobbies activos (inicializa ejemplos si es necesario)
  getActiveLobbiesInfo(): {
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
  } {
    const waitingForPlayers: Array<{
      id: string;
      name: string;
      type: LobbyType;
      currentPlayers: number;
      maxPlayers: number;
    }> = [];

    const inGame: Array<{
      id: string;
      name: string;
      type: LobbyType;
      players: number;
    }> = [];

    for (const lobby of this.lobbies.values()) {
      if (lobby.status === 'waiting' || lobby.status === 'starting') {
        waitingForPlayers.push({
          id: lobby.id,
          name: lobby.name,
          type: lobby.type,
          currentPlayers: lobby.players.length,
          maxPlayers: lobby.maxPlayers
        });
      } else if (lobby.status === 'in-progress') {
        inGame.push({
          id: lobby.id,
          name: lobby.name,
          type: lobby.type,
          players: lobby.players.length
        });
      }
    }

    return {
      waitingForPlayers,
      inGame
    };
  }

  // Generar ID único para lobby
  private generateLobbyId(): string {
    return `lobby_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Instancia singleton del manager
export const lobbyManager = new LobbyManager();