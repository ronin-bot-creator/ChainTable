class LobbyManager {
  constructor() {
    this.lobbies = new Map();
    this.playerLobbyMap = new Map();
    this.disconnectTimeouts = new Map();
    this.games = new Map();
  }

  // Graceful disconnect: schedule expel (test code may set short timers)
  handleDisconnectGrace(lobbyId, playerId, onExpel, ms = 30000) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    const player = lobby.players.find(p => p.id === playerId);
    if (!player) return;
    player.isConnected = false;
    player.disconnectTimestamp = Date.now();
    const timeoutId = setTimeout(() => {
      onExpel();
      this.disconnectTimeouts.delete(playerId);
    }, ms);
    this.disconnectTimeouts.set(playerId, timeoutId);
  }

  handleReconnect(lobbyId, playerId, newSocketId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    const player = lobby.players.find(p => p.id === playerId);
    if (!player) return;
    player.isConnected = true;
    player.disconnectTimestamp = null;
    player.socketId = newSocketId;
    if (this.disconnectTimeouts.has(playerId)) {
      clearTimeout(this.disconnectTimeouts.get(playerId));
      this.disconnectTimeouts.delete(playerId);
    }
  }

  createLobby(data, creatorId, creatorUsername, walletAddress, socketId) {
    const lobbyId = `lobby_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    const lobby = {
      id: lobbyId,
      name: data.name,
      type: data.type,
      status: 'waiting',
      hostId: creatorId,
      maxPlayers: data.type === 'publico' ? 8 : data.type === 'privado' ? 6 : 4,
      players: [{ id: creatorId, username: creatorUsername, walletAddress, socketId, isHost: true, isReady: false, joinedAt: new Date(), isConnected: true }],
      createdAt: new Date(),
    };
    this.lobbies.set(lobbyId, lobby);
    this.playerLobbyMap.set(creatorId, lobbyId);
    return { success: true, lobby };
  }

  joinLobby(lobbyId, playerId, username, walletAddress, socketId, password) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby no encontrado' };
    if (lobby.players.length >= lobby.maxPlayers) return { success: false, error: 'Lobby lleno' };
    if (this.playerLobbyMap.has(playerId)) return { success: false, error: 'Ya estás en otro lobby' };
    const player = { id: playerId, username, walletAddress, socketId, isHost: false, isReady: false, joinedAt: new Date(), isConnected: true };
    lobby.players.push(player);
    this.playerLobbyMap.set(playerId, lobbyId);
    return { success: true, lobby };
  }

  leaveLobby(lobbyId, playerId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby no encontrado' };
    lobby.players = lobby.players.filter(p => p.id !== playerId);
    this.playerLobbyMap.delete(playerId);
    if (lobby.players.length === 0) {
      this.lobbies.delete(lobbyId);
    } else {
      const hasHost = lobby.players.some(p => p.isHost);
      if (!hasHost && lobby.players.length > 0) {
        lobby.players[0].isHost = true;
        lobby.hostId = lobby.players[0].id;
      }
    }
    return { success: true, lobbyId };
  }

  getActiveLobbiesInfo() {
    const waitingForPlayers = [];
    const inGame = [];
    for (const lobby of this.lobbies.values()) {
      if (lobby.status === 'waiting' || lobby.status === 'starting') {
        waitingForPlayers.push({ id: lobby.id, name: lobby.name, type: lobby.type, currentPlayers: lobby.players.length, maxPlayers: lobby.maxPlayers });
      } else if (lobby.status === 'in-progress') {
        inGame.push({ id: lobby.id, name: lobby.name, type: lobby.type, players: lobby.players.length });
      }
    }
    return { waitingForPlayers, inGame };
  }

  // Cleanup helper: cancel timeouts, remove player mappings, delete lobby and its game
  cleanupLobby(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return false;
    // Clear timeouts
    try {
      lobby.players.forEach(p => {
        if (this.disconnectTimeouts && this.disconnectTimeouts.has(p.id)) {
          clearTimeout(this.disconnectTimeouts.get(p.id));
          this.disconnectTimeouts.delete(p.id);
        }
      });
    } catch (e) {}
    // Remove player mappings
    lobby.players.forEach(p => { if (this.playerLobbyMap.has(p.id)) this.playerLobbyMap.delete(p.id); });
    // Delete game if present
    if (this.games && this.games.has(lobbyId)) this.games.delete(lobbyId);
    // Delete lobby
    this.lobbies.delete(lobbyId);
    return true;
  }
}

module.exports = { LobbyManager };
